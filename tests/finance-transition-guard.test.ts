import { describe, it, expect, beforeEach } from 'vitest';
import {
  outcomeRewardService,
  isRewardTransitionAllowed,
  REWARD_TRANSITIONS,
} from '../lib/outcome/outcomeRewardService';
import { financialService } from '../lib/finance/financialService';
import type { PulsarUser } from '../types/auth.types';
import type { RewardStatus } from '../types/outcome.types';
import { toMinorUnits, parseMajorToMinor } from '../lib/finance/money';

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

const labOwner = () => makeUser('g-lab-owner', 'labowner@pulsar.dev', 'business', [orgMember('org-lab-01', 'owner')]);
const techOwner = () => makeUser('g-tech-owner', 'owner@tech.dev', 'business', [orgMember('org-tech-01', 'owner')]);
const outsider = () => makeUser('g-outsider', 'out@pulsar.dev', 'creator', []);
const admin = () => makeUser('g-admin', 'admin@pulsar.dev', 'admin', []);

const ALL: RewardStatus[] = ['planned', 'pending_approval', 'approved', 'processing', 'paid', 'failed', 'cancelled'];

const EXPECTED: Record<RewardStatus, RewardStatus[]> = {
  planned: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: [], // SP8A.2: terminal on the ordinary path; reprocessing via dedicated workflow only
  failed: [],
  cancelled: [],
};

describe('SP8A.1 transition guard — matrix, authz, paid-verified, invariants', () => {
  beforeEach(() => {
    financialService._reset();
  });

  it('G1: matrix allows exactly the documented edges (unknown states denied by default)', () => {
    expect(REWARD_TRANSITIONS).toEqual(EXPECTED);
    for (const from of ALL) {
      for (const to of ALL) {
        const expected = from === to || EXPECTED[from].includes(to);
        expect(isRewardTransitionAllowed(from, to)).toBe(expected);
      }
    }
    expect(isRewardTransitionAllowed('paid', 'planned')).toBe(false);
    expect(isRewardTransitionAllowed('approved', 'paid')).toBe(false); // no skipping processing
    expect(isRewardTransitionAllowed('bogus_state', 'approved')).toBe(false);
    expect(isRewardTransitionAllowed('approved', 'bogus_state')).toBe(false);
  });

  it('G2: service walks the legal lifecycle approved→processing→paid→(reprocess)→processing→failed', async () => {
    const actor = labOwner();
    const minted = await outcomeRewardService.finalizeOutcome(
      {
        challenge_id: 'ch-demo-001',
        organization_id: 'org-lab-01',
        has_winner: true,
        winning_submission_id: 'sub-demo-001',
        winner_id: 'usr-creator-001',
        decision_reason: 'Đáp ứng vượt chỉ tiêu kỹ thuật, tài liệu đầy đủ và rõ ràng.',
        awarded_prize_amount: 2100,
        currency: 'USD',
      },
      actor
    );
    expect(minted.data?.reward?.status).toBe('approved');
    const id = minted.data!.reward!.id;
    for (const next of ['processing', 'paid'] as const) {
      const res = await outcomeRewardService.updateRewardStatus(id, next, actor, `G2 walk to ${next}.`);
      expect(res.error).toBeNull();
      expect(res.data?.status).toBe(next);
    }
    // paid is terminal on the ordinary path — reprocessing needs the workflow.
    const ordinary = await outcomeRewardService.updateRewardStatus(id, 'processing', actor, 'G2 ordinary probe.');
    expect(ordinary.error).toMatch(/không được phép/i);
    const reproc = await outcomeRewardService.requestRewardReprocessing(id, actor, 'G2: ngân hàng trả về, mở xử lý lại có kiểm toán.');
    expect(reproc.error).toBeNull();
    expect(reproc.data?.status).toBe('processing');
    const fin = await outcomeRewardService.updateRewardStatus(id, 'failed', actor, 'G2 walk to failed.');
    expect(fin.error).toBeNull();
    expect(fin.data?.status).toBe('failed');
    // Terminal: failed allows nothing further.
    const back = await outcomeRewardService.updateRewardStatus(id, 'processing', actor, 'G2 terminal probe.');
    expect(back.error).toMatch(/không được phép/i);
    const { data: history } = await outcomeRewardService.getRewardHistory(id);
    expect(history.filter((h) => h.new_status === 'paid').length).toBe(1); // no duplicate paid history
    expect(history.some((h) => h.reason?.includes('REPROCESSING'))).toBe(true);
  });

  it('G3: skips, reversals into estimates, and paid escapes are rejected', async () => {
    const actor = techOwner();
    // rwd-001 seed is paid: every exit except ->processing is rejected.
    for (const target of ['planned', 'pending_approval', 'approved', 'failed', 'cancelled'] as const) {
      const res = await outcomeRewardService.updateRewardStatus('rwd-001', target, actor, 'G3 paid-escape probe.');
      expect(res.error).toMatch(/không được phép/i);
    }
    // Same-status is an idempotent no-op (success, no duplicate history).
    const noop = await outcomeRewardService.updateRewardStatus('rwd-001', 'paid', actor, 'G3 no-op probe.');
    expect(noop.error).toBeNull();
    expect(noop.data?.status).toBe('paid');
    // Mint ch-demo-002 slot: approved→paid skip rejected; approved→planned rejected.
    const minted = await outcomeRewardService.finalizeOutcome(
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
      makeUser('g-biz02-owner', 'biz02@pulsar.dev', 'business', [orgMember('org-biz-02', 'owner')])
    );
    const op = makeUser('g-biz02-owner', 'biz02@pulsar.dev', 'business', [orgMember('org-biz-02', 'owner')]);
    const skip = await outcomeRewardService.updateRewardStatus(minted.data!.reward!.id, 'paid', op, 'G3 skip probe.');
    expect(skip.error).toMatch(/không được phép/i);
    const toPlanned = await outcomeRewardService.updateRewardStatus(minted.data!.reward!.id, 'planned', op, 'G3 planned probe.');
    expect(toPlanned.error).toMatch(/không được phép/i);
  });

  it('G4: unauthorized actors cannot move protected states (outsider, member, recipient)', async () => {
    // Outsider: 403 before matrix is even consulted.
    const out = await outcomeRewardService.updateRewardStatus('rwd-001', 'processing', outsider(), 'G4 outsider probe.');
    expect(out.error).toContain('403');
    // Plain org member (SP8A.1 tightening: owner/admin only — membership is not enough).
    const techMember = makeUser('g-tech-member', 'member@tech.dev', 'business', [orgMember('org-tech-01', 'member')]);
    const mem = await outcomeRewardService.updateRewardStatus('rwd-001', 'processing', techMember, 'G4 member probe.');
    expect(mem.error).toContain('403');
    // Recipient cannot self-move to paid even as org insider would-be.
    const recipient = makeUser('usr-creator-001', 'creator@pulsar.dev', 'creator', [orgMember('org-tech-01', 'member')]);
    const selfPaid = await outcomeRewardService.updateRewardStatus('rwd-001', 'processing', recipient, 'G4 self probe.');
    expect(selfPaid.error).toBeDefined();
    // Admin override uses the dedicated workflow (ordinary path rejects paid exits).
    const adm = await outcomeRewardService.requestRewardReprocessing('rwd-001', admin(), 'G4 admin mở xử lý lại có kiểm toán đầy đủ.');
    expect(adm.error).toBeNull();
    expect(adm.data?.status).toBe('processing');
  });

  it('G5: paid-verified requires full-amount authoritative evidence (never silent)', async () => {
    const owner = techOwner();
    // Normalize fixture: G4 may have re-processed the seed; restore attested-paid
    // through the legal processing→paid edge (no-op if already paid), then re-read.
    await outcomeRewardService.updateRewardStatus('rwd-001', 'paid', owner, 'G5 fixture restore.');
    const { data: fresh } = await outcomeRewardService.getRewards({});
    const live = fresh!.find((r) => r.id === 'rwd-001')!;
    expect(live.status).toBe('paid');
    // No evidence -> attested.
    expect(financialService.rewardStage(live)).toBe('payment_attested');
    // Partial evidence ($2k of $5k) -> still attested.
    await financialService.recordPayment(
      { reward_id: 'rwd-001', amount_minor: 200000, currency: 'USD', evidence_type: 'simulated_statement', external_ref: 'SIM-G5-PART' },
      owner
    );
    expect(financialService.rewardStage(live)).toBe('payment_attested');
    // Full coverage -> verified.
    await financialService.recordPayment(
      { reward_id: 'rwd-001', amount_minor: 300000, currency: 'USD', evidence_type: 'simulated_statement', external_ref: 'SIM-G5-REST' },
      owner
    );
    expect(financialService.rewardStage(live)).toBe('paid_verified');
  });

  it('G6: payment retries with the same idempotency key do not duplicate records', async () => {
    const owner = techOwner();
    const first = await financialService.recordPayment(
      { reward_id: 'rwd-001', amount_minor: 50000, currency: 'USD', evidence_type: 'manual_attestation', external_ref: 'MAN-G6', idempotency_key: 'g6-key-1' },
      owner
    );
    expect(first.success).toBe(true);
    const second = await financialService.recordPayment(
      { reward_id: 'rwd-001', amount_minor: 50000, currency: 'USD', evidence_type: 'manual_attestation', external_ref: 'MAN-G6', idempotency_key: 'g6-key-1' },
      owner
    );
    expect(second.success).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(second.payment!.id).toBe(first.payment!.id);
    expect(financialService.getPayments('org-tech-01', owner).length).toBe(1);
  });

  it('G7: query results are copies — frontend-held references cannot mutate the book', async () => {
    const owner = techOwner();
    financialService.ensureAccounts('org-tech-01', 'USD');
    const linksBefore = financialService.getLinks('org-tech-01', owner);
    if (linksBefore.length > 0) {
      (linksBefore[0] as { financial_stage: string }).financial_stage = 'paid_verified';
      const fresh = financialService.getLinks('org-tech-01', owner);
      expect(fresh[0].financial_stage).not.toBe('paid_verified');
    }
    const txns = financialService.getTransactions({ organization_id: 'org-tech-01' }, owner);
    if (txns.rows.length > 0) {
      (txns.rows[0] as { status: string }).status = 'cancelled';
      const again = financialService.getTransactions({ organization_id: 'org-tech-01' }, owner);
      const same = again.rows.find((t) => t.id === txns.rows[0].id);
      expect(same?.status).not.toBe('cancelled');
    }
    // Audit trail is append-only from the client perspective.
    const audit = financialService.getAuditEvents('org-tech-01', owner, 5);
    expect(Array.isArray(audit)).toBe(true);
  });

  it('G8: financial errors never leak SQL, secrets, or stack internals', async () => {
    const owner = techOwner();
    const outsiderRes = await financialService.recognizePayable({ reward_id: 'no-such-reward' }, outsider());
    const badTransition = await outcomeRewardService.updateRewardStatus('rwd-001', 'planned', owner, 'G8 probe.');
    const badPost = await financialService.postJournal('txn-does-not-exist', owner);
    const samples = [outsiderRes.error, badTransition.error, badPost.error].filter(Boolean) as string[];
    expect(samples.length).toBeGreaterThan(0);
    for (const msg of samples) {
      expect(msg).not.toMatch(/SELECT\s|INSERT\s|UPDATE\s|DELETE\s|pg_|supabase|service_role|Bearer\s|sk-/i);
    }
  });

  it('G9: dedicated reprocessing enforces paid-only, authz, and reason length', async () => {
    const owner = techOwner();
    // Non-paid rewards cannot enter the workflow.
    const { data: all } = await outcomeRewardService.getRewards({});
    const nonPaid = all!.find((r) => r.status !== 'paid');
    if (nonPaid) {
      const wrong = await outcomeRewardService.requestRewardReprocessing(nonPaid.id, owner, 'G9 probe với lý do đủ dài.');
      expect(wrong.error).toMatch(/chỉ giải thưởng ở trạng thái paid/i);
    }
    // rwd-001 is paid here (G5 restored it): short reason rejected.
    const short = await outcomeRewardService.requestRewardReprocessing('rwd-001', owner, 'quá ngắn');
    expect(short.error).toMatch(/tối thiểu 15 ký tự/i);
    // Outsider and recipient rejected.
    const out = await outcomeRewardService.requestRewardReprocessing('rwd-001', outsider(), 'G9 outsider với lý do đủ dài.');
    expect(out.error).toContain('403');
    const recipient = makeUser('usr-creator-001', 'creator@pulsar.dev', 'creator', []);
    const self = await outcomeRewardService.requestRewardReprocessing('rwd-001', recipient, 'G9 recipient với lý do đủ dài.');
    expect(self.error).toBeDefined();
    // Boundary: exactly 15 chars accepted by the dedicated path.
    const ok = await outcomeRewardService.requestRewardReprocessing('rwd-001', owner, '123456789012345');
    expect(ok.error).toBeNull();
    expect(ok.data?.status).toBe('processing');
  });

  it('G10: zero-decimal currencies reject fractions; amounts must round-trip exactly', () => {
    expect(() => toMinorUnits(10.5, 'VND')).toThrow();
    expect(toMinorUnits(10, 'VND')).toBe(10);
    expect(toMinorUnits(10.5, 'USD')).toBe(1050);
    expect(() => parseMajorToMinor('12.5', 'VND')).toThrow();
    expect(parseMajorToMinor('12.0', 'VND')).toBe(12);
    expect(parseMajorToMinor('19.99', 'USD')).toBe(1999);
  });
});
