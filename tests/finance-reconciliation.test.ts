import { describe, it, expect, beforeEach } from 'vitest';
import { financialService } from '../lib/finance/financialService';
import { reconciliationService } from '../lib/finance/reconciliationService';
import { outcomeRewardService } from '../lib/outcome/outcomeRewardService';
import type { PulsarUser } from '../types/auth.types';
import type { Reward } from '../types/outcome.types';

function makeUser(id: string, email: string, role: PulsarUser['role'], orgs: PulsarUser['organizations'] = []): PulsarUser {
  return {
    id,
    email,
    role,
    organizations: orgs,
    profile: { id, display_name: email, avatar_url: null, bio: '', created_at: '', updated_at: '' } as never,
  } as unknown as PulsarUser;
}

function orgMember(orgId: string, membership_role: 'owner' | 'member' = 'owner') {
  return {
    membership_role,
    organization: { id: orgId, name: `Org ${orgId}`, slug: orgId, organization_type: 'business', created_by: 'x', created_at: '', updated_at: '' } as never,
  } as never;
}

const OWNER_TECH = () => makeUser('rec-owner-a', 'owner@orga.dev', 'business', [orgMember('org-tech-01', 'owner')]);
const MEMBER_TECH = () => makeUser('rec-member-a', 'member@orga.dev', 'business', [orgMember('org-tech-01', 'member')]);
const OUTSIDER = () => makeUser('rec-outsider', 'out@pulsar.dev', 'creator', []);
const ADMIN = () => makeUser('rec-admin', 'admin@pulsar.dev', 'admin', []);

async function mintApprovedRewardLab(actor: PulsarUser, amount = 2500) {
  const res = await outcomeRewardService.finalizeOutcome(
    {
      challenge_id: 'ch-demo-001',
      organization_id: 'org-lab-01',
      has_winner: true,
      winning_submission_id: 'sub-demo-001',
      winner_id: 'usr-creator-001',
      decision_reason: 'Đáp ứng vượt chỉ tiêu kỹ thuật, tài liệu đầy đủ và rõ ràng.',
      awarded_prize_amount: amount,
      currency: 'USD',
    },
    actor
  );
  if (!res.data?.reward) throw new Error(`seed reward failed: ${res.error}`);
  return res.data.reward;
}

// SP4 enforces one finalized outcome per challenge: R1 mints the ch-demo-001
// slot once and later tests reuse it; R7 uses the ch-demo-002 slot.
let labRewardCache: Reward | null = null;
async function labRewardOnce(actor: PulsarUser): Promise<Reward> {
  if (!labRewardCache) labRewardCache = await mintApprovedRewardLab(actor);
  return labRewardCache;
}

async function mintApprovedRewardBiz02(actor: PulsarUser): Promise<Reward> {
  const res = await outcomeRewardService.finalizeOutcome(
    {
      challenge_id: 'ch-demo-002',
      organization_id: 'org-biz-02',
      has_winner: true,
      winning_submission_id: 'sub-demo-002',
      winner_id: 'usr-freelancer-99',
      decision_reason: 'Kiến trúc multisig đạt chuẩn audit, tối ưu gas vượt yêu cầu.',
      awarded_prize_amount: 4500,
      currency: 'USD',
    },
    actor
  );
  if (!res.data?.reward) throw new Error(`seed reward failed: ${res.error}`);
  return res.data.reward;
}

function labOwner(): PulsarUser {
  return makeUser('rec-lab-owner', 'labowner@pulsar.dev', 'business', [orgMember('org-lab-01', 'owner')]);
}

function biz02Owner(): PulsarUser {
  return makeUser('rec-biz02-owner', 'biz02@pulsar.dev', 'business', [orgMember('org-biz-02', 'owner')]);
}

describe('SP8A reconciliation — discrepancy detection, repeatability, access control', () => {
  beforeEach(() => {
    financialService._reset();
    reconciliationService._reset();
  });

  it('R1: detects approved reward without a ledger entry', async () => {
    const actor = labOwner();
    const reward = await labRewardOnce(actor);
    const run = await reconciliationService.runReconciliation('org-lab-01', actor);
    expect(run.success).toBe(true);
    const items = run.items!.filter((i) => i.reward_id === reward.id && i.code === 'REWARD_WITHOUT_LEDGER');
    expect(items.length).toBe(1);
    expect(items[0].severity).toBe('critical');
    expect(items[0].expected_minor).toBe(250000);
  });

  it('R2: detects ledger transaction with no valid source', async () => {
    const actor = OWNER_TECH();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const draft = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          { account_id: dr.id, side: 'debit', amount_minor: 10000, currency: 'USD' },
          { account_id: cr.id, side: 'credit', amount_minor: 10000, currency: 'USD' },
        ],
        source_type: 'reward',
        source_id: 'reward-ghost-does-not-exist',
        memo: 'R2 orphan liability',
      },
      actor
    );
    await financialService.postJournal(draft.transaction!.id, actor);
    const run = await reconciliationService.runReconciliation('org-tech-01', actor);
    expect(run.success).toBe(true);
    expect(run.items!.some((i) => i.code === 'LEDGER_WITHOUT_SOURCE' && i.transaction_id === draft.transaction!.id)).toBe(true);
  });

  it('R3: flags SP4 paid status with zero authoritative payment evidence', async () => {
    const actor = OWNER_TECH();
    // rwd-001 (SP4 seed): status paid via mock adapter, no payment records in fresh finance store.
    const run = await reconciliationService.runReconciliation('org-tech-01', actor);
    expect(run.success).toBe(true);
    const flagged = run.items!.filter((i) => i.reward_id === 'rwd-001' && i.code === 'PAID_WITHOUT_EVIDENCE');
    expect(flagged.length).toBe(1);
    expect(flagged[0].severity).toBe('critical');
  });

  it('R4: recording a payment never mutates the SP4 reward status', async () => {
    const actor = labOwner();
    const reward = await labRewardOnce(actor); // reuse R1 slot: approved, no liability yet
    const before = (await outcomeRewardService.getRewards({})).data!.find((r) => r.id === reward.id)!;
    const rec = await financialService.recordPayment(
      {
        reward_id: reward.id,
        amount_minor: 250000,
        currency: 'USD',
        evidence_type: 'simulated_statement',
        external_ref: 'SIM-R4-001',
        note: 'R4 record-only proof',
      },
      actor
    );
    expect(rec.success).toBe(true);
    const after = (await outcomeRewardService.getRewards({})).data!.find((r) => r.id === reward.id)!;
    expect(after.status).toBe(before.status); // read-only integration: no silent status change
    // Partial evidence on a paid seed reward surfaces as amount mismatch, not silence.
    const ownerTech = OWNER_TECH();
    const partial = await financialService.recordPayment(
      {
        reward_id: 'rwd-001',
        amount_minor: 200000,
        currency: 'USD',
        evidence_type: 'simulated_statement',
        external_ref: 'SIM-R4-PARTIAL',
      },
      ownerTech
    );
    expect(partial.success).toBe(true);
    const run = await reconciliationService.runReconciliation('org-tech-01', ownerTech);
    const mismatch = run.items!.filter((i) => i.reward_id === 'rwd-001' && i.code === 'AMOUNT_MISMATCH');
    expect(mismatch.length).toBeGreaterThan(0);
    expect(run.items!.some((i) => i.reward_id === 'rwd-001' && i.code === 'PAID_WITHOUT_EVIDENCE')).toBe(false);
  });

  it('R5: repeat runs are stable — same open IDs, no new transactions', async () => {
    const actor = OWNER_TECH();
    const first = await reconciliationService.runReconciliation('org-tech-01', actor);
    expect(first.success).toBe(true);
    const txnsBefore = financialService.getTransactions({ organization_id: 'org-tech-01' }, actor).total;
    const second = await reconciliationService.runReconciliation('org-tech-01', actor);
    expect(second.success).toBe(true);
    const txnsAfter = financialService.getTransactions({ organization_id: 'org-tech-01' }, actor).total;
    expect(txnsAfter).toBe(txnsBefore); // read-only: no financial writes
    const ids1 = first.items!.filter((i) => i.state === 'open').map((i) => i.id).sort();
    const ids2 = second.items!.filter((i) => i.state === 'open').map((i) => i.id).sort();
    expect(ids2).toEqual(ids1);
  });

  it('R6: multi-tenant access control on reconciliation + resolution', async () => {
    const outsiderRun = await reconciliationService.runReconciliation('org-tech-01', OUTSIDER());
    expect(outsiderRun.success).toBe(false);
    expect(outsiderRun.error).toContain('403');
    const ownerRun = await reconciliationService.runReconciliation('org-tech-01', OWNER_TECH());
    expect(ownerRun.success).toBe(true);
    const openItem = ownerRun.items!.find((i) => i.state === 'open');
    expect(openItem).toBeDefined();
    // Plain member may acknowledge but may NOT resolve (close).
    const memberResolve = reconciliationService.resolveItem(openItem!.id, 'resolved', 'member close attempt', MEMBER_TECH());
    expect(memberResolve.success).toBe(false);
    expect(memberResolve.error).toContain('403');
    const memberAck = reconciliationService.resolveItem(openItem!.id, 'acknowledged', 'đã xem', MEMBER_TECH());
    expect(memberAck.success).toBe(true);
  });

  it('R7: detects invalid status — cancelled reward with posted liability still standing', async () => {
    const actor = biz02Owner();
    const reward = await mintApprovedRewardBiz02(actor);
    const linked = await financialService.recognizePayable({ reward_id: reward.id }, actor);
    expect(linked.success).toBe(true);
    // SP4 allows the transition without guard (documented gap) — ledger must flag it.
    const cancelled = await outcomeRewardService.updateRewardStatus(reward.id, 'cancelled', actor, 'Hủy giải sau kiểm tra.');
    expect(cancelled.data?.status).toBe('cancelled');
    const run = await reconciliationService.runReconciliation('org-biz-02', actor);
    expect(run.success).toBe(true);
    expect(
      run.items!.some((i) => i.reward_id === reward.id && i.code === 'INVALID_STATUS_TRANSITION')
    ).toBe(true);
  });

  it('R8: admin sees all-org runs; members see only their org', async () => {
    const admin = ADMIN();
    const run = await reconciliationService.runReconciliation(null, admin);
    expect(run.success).toBe(true);
    expect(run.run!.rewards_examined).toBeGreaterThan(0);
    const memberScoped = reconciliationService.getRuns(MEMBER_TECH(), 'org-tech-01');
    expect(memberScoped.every((r) => r.organization_id === 'org-tech-01')).toBe(true);
    const outsiderRuns = reconciliationService.getRuns(OUTSIDER());
    expect(outsiderRuns.length).toBe(0);
  });
});
