import { describe, it, expect, beforeEach } from 'vitest';
import { financialService, financeRoleFor } from '../lib/finance/financialService';
import { outcomeRewardService } from '../lib/outcome/outcomeRewardService';
import { toMinorUnits, formatMinor, parseMajorToMinor } from '../lib/finance/money';
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

const OWNER_A = () => makeUser('fin-owner-a', 'owner@orga.dev', 'business', [orgMember('org-tech-01', 'owner')]);
const ADMIN = () => makeUser('fin-admin', 'admin@pulsar.dev', 'admin', []);
const MEMBER_A = () => makeUser('fin-member-a', 'member@orga.dev', 'business', [orgMember('org-tech-01', 'member')]);
const OUTSIDER = () => makeUser('fin-outsider', 'out@pulsar.dev', 'creator', []);
const ORG_B_OWNER = () => makeUser('fin-owner-b', 'owner@orgb.dev', 'business', [orgMember('org-b-99', 'owner')]);

async function mintApprovedReward(actor: PulsarUser) {
  const res = await outcomeRewardService.finalizeOutcome(
    {
      challenge_id: 'ch-demo-001',
      organization_id: 'org-lab-01',
      has_winner: true,
      winning_submission_id: 'sub-demo-001',
      winner_id: 'usr-creator-001',
      decision_reason: 'Đáp ứng vượt chỉ tiêu kỹ thuật, tài liệu đầy đủ và rõ ràng.',
      awarded_prize_amount: 3000,
      currency: 'USD',
    },
    actor
  );
  if (!res.data?.reward) throw new Error(`seed reward failed: ${res.error}`);
  return res.data.reward;
}

// Second finalize slot: ch-demo-002 + sub-demo-002 (org-biz-02). One finalized
// outcome per challenge is enforced by SP4, so each slot mints at most once.
let bizRewardCache: Reward | null = null;
async function mintApprovedRewardBiz02(actor: PulsarUser): Promise<Reward> {
  if (bizRewardCache) return bizRewardCache;
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
  bizRewardCache = res.data.reward;
  return bizRewardCache;
}

function biz02Owner(): PulsarUser {
  return makeUser('fin-biz02-owner', 'biz02@pulsar.dev', 'business', [orgMember('org-biz-02', 'owner')]);
}

function labOwner(): PulsarUser {
  return makeUser('fin-lab-owner', 'labowner@pulsar.dev', 'business', [orgMember('org-lab-01', 'owner')]);
}

describe('SP8A ledger — double-entry, idempotency, permissions, SoD', () => {
  beforeEach(() => {
    financialService._reset();
  });

  it('L1: posts a balanced double-entry transaction (draft -> posted, immutable totals)', async () => {
    const actor = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const draft = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          { account_id: dr.id, side: 'debit', amount_minor: 150000, currency: 'USD' },
          { account_id: cr.id, side: 'credit', amount_minor: 150000, currency: 'USD' },
        ],
        source_type: 'manual',
        memo: 'L1 balanced',
      },
      actor
    );
    expect(draft.success).toBe(true);
    const posted = await financialService.postJournal(draft.transaction!.id, actor);
    expect(posted.success).toBe(true);
    expect(posted.transaction!.status).toBe('posted');
    expect(posted.transaction!.total_minor).toBe(150000);
    // Repeat posting rejected: posted is terminal/immutable.
    const again = await financialService.postJournal(draft.transaction!.id, actor);
    expect(again.success).toBe(false);
  });

  it('L2: rejects unbalanced postings (draft editable, post enforces balance)', async () => {
    const actor = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const draft = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          { account_id: dr.id, side: 'debit', amount_minor: 100000, currency: 'USD' },
          { account_id: cr.id, side: 'credit', amount_minor: 100000, currency: 'USD' },
        ],
        source_type: 'manual',
      },
      actor
    );
    expect(draft.success).toBe(true);
    const edited = await financialService.updateDraftLines(
      draft.transaction!.id,
      [
        { account_id: dr.id, side: 'debit', amount_minor: 100000, currency: 'USD' },
        { account_id: cr.id, side: 'credit', amount_minor: 60000, currency: 'USD' },
      ],
      actor
    );
    expect(edited.success).toBe(true); // drafts may be edited while unbalanced
    const posted = await financialService.postJournal(draft.transaction!.id, actor);
    expect(posted.success).toBe(false);
    expect(posted.error).toMatch(/IMBALANCE/);
  });

  it('L3: rejects currency mismatch (no cross-currency aggregation)', async () => {
    const actor = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const res = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          { account_id: dr.id, side: 'debit', amount_minor: 1000, currency: 'USD' },
          { account_id: cr.id, side: 'credit', amount_minor: 1000, currency: 'VND' },
        ],
        source_type: 'manual',
      },
      actor
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/CURRENCY_MISMATCH/);
  });

  it('L4: integer minor-unit validation (no floats, no negatives)', async () => {
    const actor = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const floatRes = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { account_id: dr.id, side: 'debit', amount_minor: 10.5 as any, currency: 'USD' },
          { account_id: cr.id, side: 'credit', amount_minor: 10.5 as never, currency: 'USD' },
        ],
        source_type: 'manual',
      },
      actor
    );
    expect(floatRes.success).toBe(false);
    expect(() => toMinorUnits(NaN, 'USD')).toThrow();
    expect(() => parseMajorToMinor('12.345 USD', 'USD')).toThrow();
    expect(toMinorUnits(5000, 'USD')).toBe(500000);
    expect(toMinorUnits(5000, 'VND')).toBe(5000);
    expect(formatMinor(500000, 'USD')).toBe('5,000.00 USD');
  });

  it('L5: duplicate idempotency keys do not duplicate postings', async () => {
    const actor = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const mk = () =>
      financialService.draftJournal(
        {
          organization_id: 'org-tech-01',
          kind: 'liability_recognition',
          currency: 'USD',
          lines: [
            { account_id: dr.id, side: 'debit', amount_minor: 70000, currency: 'USD' },
            { account_id: cr.id, side: 'credit', amount_minor: 70000, currency: 'USD' },
          ],
          source_type: 'manual',
        },
        actor
      );
    const d1 = await mk();
    const d2 = await mk();
    const p1 = await financialService.postJournal(d1.transaction!.id, actor, 'idem-key-001');
    const p2 = await financialService.postJournal(d2.transaction!.id, actor, 'idem-key-001');
    expect(p1.success).toBe(true);
    expect(p2.success).toBe(true);
    expect(p2.deduplicated).toBe(true);
    expect(p2.transaction!.id).toBe(p1.transaction!.id);
    const { rows } = financialService.getTransactions({ organization_id: 'org-tech-01', status: 'posted' }, actor);
    expect(rows.length).toBe(1);
  });

  it('L6: concurrent duplicate posting is safe (one wins, others dedupe/fail)', async () => {
    const actor = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const draft = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          { account_id: dr.id, side: 'debit', amount_minor: 90000, currency: 'USD' },
          { account_id: cr.id, side: 'credit', amount_minor: 90000, currency: 'USD' },
        ],
        source_type: 'manual',
      },
      actor
    );
    const results = await Promise.all([
      financialService.postJournal(draft.transaction!.id, actor, 'race-key-1'),
      financialService.postJournal(draft.transaction!.id, actor, 'race-key-1'),
    ]);
    expect(results.filter((r) => r.success).length).toBe(2); // second dedupes by key
    expect(results[1].deduplicated).toBe(true);
    const { rows } = financialService.getTransactions({ organization_id: 'org-tech-01', status: 'posted' }, actor);
    expect(rows.length).toBe(1);
  });

  it('L7: posted transactions are immutable; reversal preserves history', async () => {
    const actor = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const dr = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const cr = accs.find((a) => a.code === 'REWARD_PAYABLE')!;
    const draft = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          { account_id: dr.id, side: 'debit', amount_minor: 42000, currency: 'USD' },
          { account_id: cr.id, side: 'credit', amount_minor: 42000, currency: 'USD' },
        ],
        source_type: 'manual',
      },
      actor
    );
    await financialService.postJournal(draft.transaction!.id, actor);
    const editAfterPost = await financialService.updateDraftLines(
      draft.transaction!.id,
      [
        { account_id: dr.id, side: 'debit', amount_minor: 1, currency: 'USD' },
        { account_id: cr.id, side: 'credit', amount_minor: 1, currency: 'USD' },
      ],
      actor
    );
    expect(editAfterPost.success).toBe(false); // silent edits blocked
    const rev = await financialService.reverseTransaction(draft.transaction!.id, actor, 'Hoàn nhập do ghi nhận nhầm kỳ kế toán.');
    expect(rev.success).toBe(true);
    expect(rev.transaction!.kind).toBe('reversal');
    expect(rev.transaction!.reverses_transaction_id).toBe(draft.transaction!.id);
    const detail = financialService.getTransactionDetail(draft.transaction!.id, actor)!;
    expect(detail.transaction.status).toBe('reversed'); // original kept, flagged
    const doubleReverse = await financialService.reverseTransaction(draft.transaction!.id, actor, 'Thử đảo lần hai với lý do hợp lệ.');
    expect(doubleReverse.success).toBe(false);
    const audit = financialService.getAuditEvents('org-tech-01', actor, 20);
    expect(audit.some((e) => e.action === 'journal.reversed')).toBe(true);
  });

  it('L9: duplicate reward processing returns the same liability (no double payable)', async () => {
    const actor = labOwner();
    const reward = await mintApprovedReward(actor);
    const first = await financialService.recognizePayable({ reward_id: reward.id }, actor);
    expect(first.success).toBe(true);
    expect(first.transaction!.kind).toBe('liability_recognition');
    expect(first.transaction!.total_minor).toBe(300000); // 3000 USD -> cents
    const second = await financialService.recognizePayable({ reward_id: reward.id }, actor);
    expect(second.success).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(second.transaction!.id).toBe(first.transaction!.id);
    const links = financialService.getLinks('org-lab-01', actor);
    expect(links.filter((l) => l.reward_id === reward.id).length).toBe(1);
  });

  it('L9b: estimates and closed rewards never become liabilities; paid rewards need payment records', async () => {
    // Estimate states can never be (re-)entered via the guarded transition path…
    const bizReward = await mintApprovedRewardBiz02(biz02Owner());
    for (const target of ['planned', 'pending_approval'] as const) {
      const back = await outcomeRewardService.updateRewardStatus(bizReward.id, target, biz02Owner(), 'L9b estimate probe.');
      expect(back.error).toMatch(/không được phép/i);
    }
    // …and closed rewards never become liabilities (cancelled is terminal).
    const closed = await outcomeRewardService.updateRewardStatus(bizReward.id, 'cancelled', biz02Owner(), 'L9b: hủy giải.');
    expect(closed.data?.status).toBe('cancelled');
    const closedRes = await financialService.recognizePayable({ reward_id: bizReward.id }, biz02Owner());
    expect(closedRes.success).toBe(false);
    expect(closedRes.error).toMatch(/đóng|hủy|cancelled|không ghi nhận nợ/i);
    // Paid path: SP4 seed reward (mock-attested) must not gain a second liability.
    const { data: all } = await outcomeRewardService.getRewards({});
    const paidSeed = (all ?? []).find((r) => r.status === 'paid');
    expect(paidSeed).toBeDefined();
    const ownerOfPaid = makeUser('fin-paid-org', 'x@y.dev', 'business', [
      orgMember(paidSeed!.organization_id, 'owner'),
    ]);
    const res2 = await financialService.recognizePayable({ reward_id: paidSeed!.id }, ownerOfPaid);
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/payment record/i);
  });

  it('L10: multi-tenant isolation — outsiders see nothing, other orgs isolated', async () => {
    const owner = OWNER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    expect(financeRoleFor(OUTSIDER(), 'org-tech-01')).toBe('none');
    const { rows, total } = financialService.getTransactions({ organization_id: 'org-tech-01' }, OUTSIDER());
    expect(total).toBe(0);
    expect(rows.length).toBe(0);
    const denied = await financialService.draftJournal(
      {
        organization_id: 'org-tech-01',
        kind: 'liability_recognition',
        currency: 'USD',
        lines: [
          { account_id: accs[0].id, side: 'debit', amount_minor: 100, currency: 'USD' },
          { account_id: accs[1].id, side: 'credit', amount_minor: 100, currency: 'USD' },
        ],
        source_type: 'manual',
      },
      OUTSIDER()
    );
    expect(denied.success).toBe(false);
    expect(denied.error).toContain('403');
    // Org B owner cannot read org A books.
    const bView = financialService.getTransactions({ organization_id: 'org-tech-01' }, ORG_B_OWNER());
    expect(bView.total).toBe(0);
    // Plain member can read but cannot post.
    expect(financeRoleFor(MEMBER_A(), 'org-tech-01')).toBe('viewer');
    void owner;
  });

  it('L11+L12: adjustment SoD — maker cannot approve own; unauthorized approval blocked', async () => {
    const owner = OWNER_A();
    const admin = ADMIN();
    const member = MEMBER_A();
    const accs = financialService.ensureAccounts('org-tech-01', 'USD');
    const expense = accs.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const contra = accs.find((a) => a.code === 'ADJUSTMENT_CONTRA')!;
    const draft = await financialService.draftAdjustment(
      {
        organization_id: 'org-tech-01',
        reason: 'Điều chỉnh giảm chi phí ghi thừa kỳ trước.',
        currency: 'USD',
        lines: [
          { account_id: contra.id, side: 'debit', amount_minor: 5000, currency: 'USD' },
          { account_id: expense.id, side: 'credit', amount_minor: 5000, currency: 'USD' },
        ],
      },
      owner
    );
    expect(draft.success).toBe(true);
    await financialService.submitAdjustment(draft.adjustment!.id, owner);
    // Unauthorized: plain member cannot approve.
    const memberApprove = await financialService.reviewAdjustment(draft.adjustment!.id, 'approve', member);
    expect(memberApprove.success).toBe(false);
    expect(memberApprove.error).toContain('403');
    // SoD: maker cannot self-approve.
    const selfApprove = await financialService.reviewAdjustment(draft.adjustment!.id, 'approve', owner);
    expect(selfApprove.success).toBe(false);
    expect(selfApprove.error).toMatch(/Phân Tách Nhiệm Vụ|SoD/);
    // Independent approver (admin) approves, then posts.
    const adminApprove = await financialService.reviewAdjustment(draft.adjustment!.id, 'approve', admin, 'Đã kiểm tra chứng từ.');
    expect(adminApprove.success).toBe(true);
    const posted = await financialService.postAdjustment(draft.adjustment!.id, admin);
    expect(posted.success).toBe(true);
    expect(posted.transaction!.kind).toBe('adjustment');
    expect(posted.transaction!.status).toBe('posted');
  });
});
