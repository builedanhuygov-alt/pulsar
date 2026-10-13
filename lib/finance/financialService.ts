import type {
  AdjustmentLine,
  CurrencyCode,
  FinancialAccount,
  FinancialAdjustment,
  FinancialAuditEvent,
  FinancialSummary,
  LedgerEntry,
  LedgerTransaction,
  LedgerTransactionKind,
  LedgerTransactionStatus,
  PaymentRecord,
  RewardFinancialStage,
  RewardLedgerLink,
} from '../../types/finance.types';
import type { PulsarUser } from '../../types/auth.types';
import type { Reward } from '../../types/outcome.types';
import { outcomeRewardService } from '../outcome/outcomeRewardService';
import { challengeService } from '../challenge/challengeService';
import { toMinorUnits, assertSameCurrency, sumMinor } from './money';
import type { IFinancialReadRepository } from './financeRepository';
import {
  postJournalSchema,
  recognizePayableSchema,
  recordPaymentSchema,
  draftAdjustmentSchema,
  type PostJournalInput,
  type RecognizePayableInput,
  type RecordPaymentInput,
  type DraftAdjustmentInput,
} from '../validation/finance.schema';

/**
 * SP8A — FinancialService (LOCAL/DEMO adapter).
 *
 * Runs in-memory, mirroring existing SP4/SP7 service conventions. Clearly labelled
 * demo mode: isolate behind this adapter; do NOT claim persistence or production
 * security. The SQL migration 20240109000000 defines the production schema
 * (UNIQUE idempotency, balance trigger, RLS) which this adapter emulates in code.
 *
 * Accounting assumptions (also documented in the migration header):
 * - Double-entry, single currency per transaction; sum(debits) == sum(credits).
 * - Accounts are pure bookkeeping buckets. PULSAR holds NO customer funds;
 *   CASH_OPERATING_MEMO entries are memo records of claimed transfers, not custody.
 * - No tax / revenue-recognition / escrow rules are invented.
 * - Payable liability is recognized ONLY for SP4 rewards in {approved, processing}.
 * - SP4 `paid` is operator-attested (often mock adapter) — treated as *attested*,
 *   verified-paid ONLY with an authoritative PaymentRecord allocated.
 */

function displayNameOf(actor: Pick<PulsarUser, 'email' | 'profile'>): string {
  const p = actor.profile as unknown as Record<string, unknown>;
  return (p?.['full_name'] as string) || (p?.['display_name'] as string) || actor.email;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Rewards whose status means a payable liability may exist. */
const PAYABLE_STATUSES = new Set(['approved', 'processing']);
/** Rewards that are only estimates (never a liability). */
const ESTIMATE_STATUSES = new Set(['planned', 'pending_approval']);

export type FinanceRole = 'viewer' | 'operator' | 'approver' | 'none';

export function financeRoleFor(actor: PulsarUser, organizationId: string): FinanceRole {
  if (actor.role === 'admin') return 'approver';
  const membership = actor.organizations?.find((m) => m.organization.id === organizationId);
  if (!membership) return 'none';
  // SP1 membership_role is owner|member; accept legacy 'admin' string from older mocks.
  const r = membership.membership_role as string;
  if (r === 'owner' || r === 'admin') return 'approver';
  return 'viewer';
}

class FinancialService {
  private accounts: FinancialAccount[] = [];
  private transactions: LedgerTransaction[] = [];
  private entries: LedgerEntry[] = [];
  private links: RewardLedgerLink[] = [];
  private payments: PaymentRecord[] = [];
  private adjustments: FinancialAdjustment[] = [];
  private adjustmentLines: Map<string, AdjustmentLine[]> = new Map();
  private audit: FinancialAuditEvent[] = [];
  private idempotency: Map<string, string> = new Map(); // key -> transactionId | paymentId
  /**
   * SP8B-1 (provisional): optional live read source. Default null = local/demo
   * adapter, so existing behavior is 100% unchanged unless the app explicitly
   * enables live reads after Supabase env + RLS staging checks pass.
   * Writes ALWAYS go through the local adapter for now (no posting RPC yet).
   */
  private live: IFinancialReadRepository | null = null;

  public enableLiveSource(repo: IFinancialReadRepository | null): void {
    this.live = repo;
  }

  public isLiveSource(): boolean {
    return this.live !== null;
  }

  // ------------------------------------------------------------------ accounts
  public ensureAccounts(organizationId: string, currency: CurrencyCode): FinancialAccount[] {
    const existing = this.accounts.filter((a) => a.organization_id === organizationId && a.currency === currency);
    if (existing.length === 4) return existing;
    const now = new Date().toISOString();
    const defs: Array<Pick<FinancialAccount, 'code' | 'name' | 'account_type'>> = [
      { code: 'REWARD_PAYABLE', name: 'Phải trả thưởng (liability)', account_type: 'liability' },
      { code: 'CHALLENGE_EXPENSE', name: 'Chi phí thử thách (expense)', account_type: 'expense' },
      { code: 'CASH_OPERATING_MEMO', name: 'Tiền chi hộ — ghi nhớ (memo, không phải ký quỹ)', account_type: 'asset_memo' },
      { code: 'ADJUSTMENT_CONTRA', name: 'Điều chỉnh đối ứng (contra)', account_type: 'contra' },
    ];
    const created = defs
      .filter((d) => !existing.some((e) => e.code === d.code))
      .map((d) => ({ id: uid('acc'), organization_id: organizationId, currency, created_at: now, ...d }));
    this.accounts.push(...created);
    return this.accounts.filter((a) => a.organization_id === organizationId && a.currency === currency);
  }

  public getAccounts(organizationId: string, actor: PulsarUser): FinancialAccount[] {
    if (financeRoleFor(actor, organizationId) === 'none') return [];
    return this.accounts.filter((a) => a.organization_id === organizationId);
  }

  private accountById(id: string): FinancialAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  // ------------------------------------------------------------------ audit
  private log(orgId: string | null, actor: PulsarUser | null, action: string, entity: FinancialAuditEvent['entity_type'], entityId: string, detail: string, metadata: Record<string, unknown> = {}): void {
    this.audit.unshift({
      id: uid('fae'),
      organization_id: orgId,
      actor_id: actor ? actor.id : null,
      action,
      entity_type: entity,
      entity_id: entityId,
      detail,
      metadata,
      created_at: new Date().toISOString(),
    });
  }

  // ------------------------------------------------------------------ journal
  public async draftJournal(
    input: PostJournalInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; transaction?: LedgerTransaction; error?: string }> {
    try {
      const v = postJournalSchema.parse(input);
      const role = financeRoleFor(actor, v.organization_id);
      if (role === 'none') return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Tổ chức của bạn không có quyền sổ cái này.' };
      if (role === 'viewer' && actor.role !== 'admin') {
        // viewers (plain members / creators in org) may not draft financial journals
        const isMember = actor.organizations?.some((m) => m.organization.id === v.organization_id);
        if (isMember) return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ tổ chức hoặc quản trị viên được lập bút toán.' };
      }
      // Accounts must exist and belong to the org+currency.
      const accounts = this.ensureAccounts(v.organization_id, v.currency);
      for (const line of v.lines) {
        const acc = accounts.find((a) => a.id === line.account_id);
        if (!acc) return { success: false, error: `Tài khoản không thuộc tổ chức/tiền tệ này: ${line.account_id}.` };
        if (line.currency !== v.currency) {
          return { success: false, error: `CURRENCY_MISMATCH: dòng tiền ${line.currency} khác tiền tệ bút toán ${v.currency}.` };
        }
      }
      const now = new Date().toISOString();
      const total = sumMinor(v.lines.filter((l) => l.side === 'debit').map((l) => l.amount_minor));
      const txn: LedgerTransaction = {
        id: uid('txn'),
        organization_id: v.organization_id,
        kind: v.kind,
        status: 'draft',
        currency: v.currency,
        total_minor: total,
        source_type: v.source_type,
        source_id: v.source_id ?? null,
        reverses_transaction_id: v.reverses_transaction_id ?? null,
        idempotency_key: v.idempotency_key ?? null,
        memo: v.memo ?? null,
        created_by: actor.id,
        posted_at: null,
        created_at: now,
        updated_at: now,
      };
      this.transactions.unshift(txn);
      v.lines.forEach((l) =>
        this.entries.push({ id: uid('le'), transaction_id: txn.id, account_id: l.account_id, side: l.side, amount_minor: l.amount_minor, currency: l.currency, created_at: now })
      );
      this.log(v.organization_id, actor, 'journal.drafted', 'ledger_transaction', txn.id, `Lập bút toán nháp ${txn.kind} (${v.lines.length} dòng).`);
      return { success: true, transaction: txn };
    } catch (err: unknown) {
      const e = err as { issues?: Array<{ message?: string }>; message?: string };
      return { success: false, error: e.issues?.[0]?.message || e.message || 'Lỗi lập bút toán' };
    }
  }

  /** Edit a draft's lines (drafts only; balance enforced at posting, never after). */
  public async updateDraftLines(
    transactionId: string,
    lines: Array<{ account_id: string; side: 'debit' | 'credit'; amount_minor: number; currency: CurrencyCode }>,
    actor: PulsarUser
  ): Promise<{ success: boolean; error?: string }> {
    const txn = this.transactions.find((t) => t.id === transactionId);
    if (!txn) return { success: false, error: 'Không tìm thấy bút toán.' };
    if (txn.status !== 'draft') {
      return { success: false, error: `Chỉ bút toán nháp mới được sửa (hiện: ${txn.status}).` };
    }
    const role = financeRoleFor(actor, txn.organization_id);
    const isDrafter = txn.created_by === actor.id;
    if (!isDrafter && role !== 'approver') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ người lập hoặc chủ tổ chức/quản trị viên được sửa nháp.' };
    }
    if (lines.length < 2) return { success: false, error: 'Bút toán cần tối thiểu 2 dòng.' };
    const accounts = this.ensureAccounts(txn.organization_id, txn.currency);
    for (const l of lines) {
      if (!Number.isSafeInteger(l.amount_minor) || l.amount_minor <= 0) {
        return { success: false, error: 'Số tiền dòng phải là số nguyên dương (minor units).' };
      }
      if (!accounts.some((a) => a.id === l.account_id)) {
        return { success: false, error: `Tài khoản không thuộc tổ chức/tiền tệ: ${l.account_id}.` };
      }
      if (l.currency !== txn.currency) {
        return { success: false, error: `CURRENCY_MISMATCH: dòng ${l.currency} khác bút toán ${txn.currency}.` };
      }
    }
    const now = new Date().toISOString();
    this.entries
      .filter((e) => e.transaction_id === txn.id)
      .forEach((e) => {
        const idx = this.entries.findIndex((x) => x.id === e.id);
        if (idx !== -1) this.entries.splice(idx, 1);
      });
    lines.forEach((l) =>
      this.entries.push({ id: uid('le'), transaction_id: txn.id, account_id: l.account_id, side: l.side, amount_minor: l.amount_minor, currency: l.currency, created_at: now })
    );
    txn.total_minor = sumMinor(lines.filter((l) => l.side === 'debit').map((l) => l.amount_minor));
    txn.updated_at = now;
    this.log(txn.organization_id, actor, 'journal.draft_edited', 'ledger_transaction', txn.id, `Sửa bút toán nháp (${lines.length} dòng).`);
    return { success: true };
  }
  /** Atomic posting: validates everything BEFORE mutating (balance, currency, status, idempotency). */
  public async postJournal(
    transactionId: string,
    actor: PulsarUser,
    idempotencyKey?: string
  ): Promise<{ success: boolean; transaction?: LedgerTransaction; error?: string; deduplicated?: boolean }> {
    const key = idempotencyKey ?? null;
    if (key) {
      const existingId = this.idempotency.get(`txn:${key}`);
      if (existingId) {
        const existing = this.transactions.find((t) => t.id === existingId);
        if (existing) return { success: true, transaction: existing, deduplicated: true };
      }
    }
    const txn = this.transactions.find((t) => t.id === transactionId);
    if (!txn) return { success: false, error: 'Không tìm thấy bút toán.' };
    const role = financeRoleFor(actor, txn.organization_id);
    if (role !== 'approver') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ tổ chức hoặc quản trị viên được ghi sổ (post).' };
    }
    if (txn.status !== 'draft' && txn.status !== 'pending') {
      return { success: false, error: `Bút toán ở trạng thái ${txn.status}, không thể ghi sổ (bất biến sau khi post).` };
    }
    const lines = this.entries.filter((e) => e.transaction_id === txn.id);
    if (lines.length < 2) return { success: false, error: 'Bút toán cần tối thiểu 1 dòng nợ và 1 dòng có.' };
    try {
      assertSameCurrency([txn.currency, ...lines.map((l) => l.currency)]);
    } catch (err: unknown) {
      txn.status = 'failed';
      txn.updated_at = new Date().toISOString();
      const msg = (err as Error).message;
      this.log(txn.organization_id, actor, 'journal.failed', 'ledger_transaction', txn.id, msg);
      return { success: false, error: `CURRENCY_MISMATCH: ${msg}` };
    }
    const debits = sumMinor(lines.filter((l) => l.side === 'debit').map((l) => l.amount_minor));
    const credits = sumMinor(lines.filter((l) => l.side === 'credit').map((l) => l.amount_minor));
    if (debits !== credits || debits <= 0) {
      txn.status = 'failed';
      txn.updated_at = new Date().toISOString();
      this.log(txn.organization_id, actor, 'journal.failed', 'ledger_transaction', txn.id, `Mất cân đối nợ/có: Dr=${debits} Cr=${credits}.`);
      return { success: false, error: `IMBALANCE: tổng nợ (${debits}) phải bằng tổng có (${credits}) và lớn hơn 0.` };
    }
    // Atomic commit point.
    const now = new Date().toISOString();
    txn.status = 'posted';
    txn.total_minor = debits;
    txn.posted_at = now;
    txn.updated_at = now;
    if (key) {
      txn.idempotency_key = key;
      this.idempotency.set(`txn:${key}`, txn.id);
    }
    this.log(txn.organization_id, actor, 'journal.posted', 'ledger_transaction', txn.id, `Ghi sổ bút toán ${txn.kind} ${debits} minor ${txn.currency}.`);
    return { success: true, transaction: txn };
  }

  public async reverseTransaction(
    transactionId: string,
    actor: PulsarUser,
    reason: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; transaction?: LedgerTransaction; error?: string; deduplicated?: boolean }> {
    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Lý do đảo bút toán tối thiểu 10 ký tự.' };
    }
    if (idempotencyKey) {
      const existingId = this.idempotency.get(`txn:${idempotencyKey}`);
      if (existingId) {
        const existing = this.transactions.find((t) => t.id === existingId);
        if (existing) return { success: true, transaction: existing, deduplicated: true };
      }
    }
    const orig = this.transactions.find((t) => t.id === transactionId);
    if (!orig) return { success: false, error: 'Không tìm thấy bút toán gốc.' };
    const role = financeRoleFor(actor, orig.organization_id);
    if (role !== 'approver') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ tổ chức hoặc quản trị viên được đảo bút toán.' };
    }
    if (orig.status !== 'posted') {
      return { success: false, error: `Chỉ bút toán đã ghi sổ (posted) mới được đảo (hiện: ${orig.status}).` };
    }
    const origLines = this.entries.filter((e) => e.transaction_id === orig.id);
    const now = new Date().toISOString();
    const rev: LedgerTransaction = {
      id: uid('txn'),
      organization_id: orig.organization_id,
      kind: 'reversal',
      status: 'posted',
      currency: orig.currency,
      total_minor: orig.total_minor,
      source_type: orig.source_type,
      source_id: orig.source_id,
      reverses_transaction_id: orig.id,
      idempotency_key: idempotencyKey ?? null,
      memo: `Đảo bút toán ${orig.id}: ${reason.trim()} (bản gốc được giữ nguyên để kiểm toán)`,
      created_by: actor.id,
      posted_at: now,
      created_at: now,
      updated_at: now,
    };
    // Mirror lines (atomic with status flip below).
    origLines.forEach((l) =>
      this.entries.push({
        id: uid('le'),
        transaction_id: rev.id,
        account_id: l.account_id,
        side: l.side === 'debit' ? 'credit' : 'debit',
        amount_minor: l.amount_minor,
        currency: l.currency,
        created_at: now,
      })
    );
    this.transactions.unshift(rev);
    orig.status = 'reversed';
    orig.updated_at = now;
    if (idempotencyKey) this.idempotency.set(`txn:${idempotencyKey}`, rev.id);
    this.log(orig.organization_id, actor, 'journal.reversed', 'ledger_transaction', rev.id, `Đảo bút toán ${orig.id}. Lý do: ${reason.trim()}`, { reverses: orig.id });
    return { success: true, transaction: rev };
  }  // ------------------------------------------------------------------ SP4 integration
  private async findReward(rewardId: string): Promise<Reward | null> {
    try {
      const res = await outcomeRewardService.getRewards({});
      return (res.data ?? []).find((r) => r.id === rewardId) ?? null;
    } catch {
      return null;
    }
  }

  public rewardStage(reward: Reward): RewardFinancialStage {
    if (reward.status === 'paid') {
      // SP8A.1: verified ONLY with full-amount authoritative evidence. Partial
      // evidence stays attested (reconciliation flags AMOUNT_MISMATCH separately).
      // Mock/attested `paid` without any record must NEVER read as verified.
      const evidence = this.payments.filter((p) => p.reward_id === reward.id);
      if (evidence.length === 0) return 'payment_attested';
      let awardMinor = 0;
      try {
        awardMinor = toMinorUnits(reward.amount, reward.currency);
      } catch {
        return 'payment_attested';
      }
      const covered = evidence
        .filter((p) => p.currency === reward.currency)
        .reduce((s, p) => s + p.amount_minor, 0);
      return covered >= awardMinor && awardMinor > 0 ? 'paid_verified' : 'payment_attested';
    }
    if (PAYABLE_STATUSES.has(reward.status)) return 'payable_recognized';
    if (ESTIMATE_STATUSES.has(reward.status)) return 'planned_estimate';
    return 'closed_no_liability';
  }

  public getLinks(organizationId: string | null, actor: PulsarUser): RewardLedgerLink[] {
    // Defensive copies: financial state cannot change via frontend-held references.
    if (actor.role !== 'admin' && organizationId) {
      if (financeRoleFor(actor, organizationId) === 'none') return [];
      return this.links.filter((l) => l.organization_id === organizationId).map((l) => ({ ...l }));
    }
    if (actor.role === 'admin' && !organizationId) return this.links.map((l) => ({ ...l }));
    if (actor.role === 'admin' && organizationId) return this.links.filter((l) => l.organization_id === organizationId).map((l) => ({ ...l }));
    // Non-admin without org scope: only orgs they belong to.
    const orgIds = new Set((actor.organizations ?? []).map((m) => m.organization.id));
    return this.links.filter((l) => orgIds.has(l.organization_id)).map((l) => ({ ...l }));
  }

  /**
   * Recognize a payable liability for an SP4 reward. Enforces:
   * - reward must exist and be in {approved, processing} (never auto-settle on outcome,
   *   never recognize planned/pending_approval estimates or closed rewards).
   * - one liability txn per reward (reward_id UNIQUE) — duplicates return existing.
   * Read-only w.r.t. SP4: reward status is never mutated here.
   */
  public async recognizePayable(
    input: RecognizePayableInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; transaction?: LedgerTransaction; error?: string; deduplicated?: boolean }> {
    try {
      const v = recognizePayableSchema.parse(input);
      const reward = await this.findReward(v.reward_id);
      if (!reward) return { success: false, error: 'Không tìm thấy giải thưởng SP4 tương ứng.' };
      const role = financeRoleFor(actor, reward.organization_id);
      if (role !== 'approver') {
        return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ tổ chức hoặc quản trị viên được ghi nhận nợ phải trả.' };
      }
      const existing = this.links.find((l) => l.reward_id === reward.id);
      if (existing?.liability_transaction_id) {
        const txn = this.transactions.find((t) => t.id === existing.liability_transaction_id);
        return { success: true, transaction: txn, deduplicated: true };
      }
      if (ESTIMATE_STATUSES.has(reward.status)) {
        return { success: false, error: `Ngân sách/phê duyệt ước tính (reward=${reward.status}) không phải nợ phải trả — chỉ ghi nhận khi approved/processing.` };
      }
      if (!PAYABLE_STATUSES.has(reward.status)) {
        if (reward.status === 'paid') {
          return { success: false, error: 'Giải thưởng đã ở trạng thái paid (SP4 attested) — hãy ghi nhận payment record thay vì tạo nợ mới.' };
        }
        return { success: false, error: `Giải thưởng ở trạng thái ${reward.status} (đóng/không hợp lệ) — không ghi nhận nợ. Thử thách bị hủy/outcome bị từ chối không phát sinh nợ.` };
      }
      const minor = toMinorUnits(reward.amount, reward.currency);
      const accounts = this.ensureAccounts(reward.organization_id, reward.currency);
      const expense = accounts.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
      const payable = accounts.find((a) => a.code === 'REWARD_PAYABLE')!;
      const key = v.idempotency_key ?? `payable:${reward.id}`;
      if (this.idempotency.has(`txn:${key}`)) {
        const txn = this.transactions.find((t) => t.id === this.idempotency.get(`txn:${key}`));
        return { success: true, transaction: txn, deduplicated: true };
      }
      const draft = await this.draftJournal(
        {
          organization_id: reward.organization_id,
          kind: 'liability_recognition',
          currency: reward.currency,
          lines: [
            { account_id: expense.id, side: 'debit', amount_minor: minor, currency: reward.currency },
            { account_id: payable.id, side: 'credit', amount_minor: minor, currency: reward.currency },
          ],
          source_type: 'reward',
          source_id: reward.id,
          idempotency_key: key,
          memo: `Ghi nhận nợ phải trả cho reward ${reward.id} (SP4 status=${reward.status}). Không phải thanh toán.`,
        },
        actor
      );
      if (!draft.success || !draft.transaction) return { success: false, error: draft.error };
      const posted = await this.postJournal(draft.transaction.id, actor, key);
      if (!posted.success || !posted.transaction) return { success: false, error: posted.error };
      this.links.unshift({
        reward_id: reward.id,
        organization_id: reward.organization_id,
        challenge_id: reward.challenge_id,
        outcome_id: reward.outcome_id,
        liability_transaction_id: posted.transaction.id,
        reward_status_snapshot: reward.status,
        financial_stage: 'payable_recognized',
        updated_at: new Date().toISOString(),
      });
      this.log(reward.organization_id, actor, 'reward.payable_recognized', 'reward_link', reward.id, `Nợ phải trả ${minor} minor ${reward.currency} cho reward ${reward.id}.`, { transaction: posted.transaction.id });
      return { success: true, transaction: posted.transaction, deduplicated: posted.deduplicated };
    } catch (err: unknown) {
      const e = err as { issues?: Array<{ message?: string }>; message?: string };
      return { success: false, error: e.issues?.[0]?.message || e.message || 'Lỗi ghi nhận nợ' };
    }
  }  // ------------------------------------------------------------------ payments (record-only)
  /**
   * Record an authoritative payment record. EXPLICITLY record-only: no transfer is
   * executed, no reward status is mutated. Posts a memo attestation journal
   * (Dr payable / Cr cash-memo) so the payable balance nets down in bookkeeping.
   */
  public async recordPayment(
    input: RecordPaymentInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; payment?: PaymentRecord; error?: string; deduplicated?: boolean }> {
    try {
      const v = recordPaymentSchema.parse(input);
      const reward = await this.findReward(v.reward_id);
      if (!reward) return { success: false, error: 'Không tìm thấy giải thưởng SP4 tương ứng.' };
      const role = financeRoleFor(actor, reward.organization_id);
      if (role !== 'approver') {
        return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ tổ chức hoặc quản trị viên được ghi nhận thanh toán.' };
      }
      if (v.currency !== reward.currency) {
        return { success: false, error: `CURRENCY_MISMATCH: payment ${v.currency} khác tiền tệ reward ${reward.currency} — không gộp khi chưa có chính sách chuyển đổi.` };
      }
      if (v.idempotency_key && this.idempotency.has(`pay:${v.idempotency_key}`)) {
        const existing = this.payments.find((p) => p.id === this.idempotency.get(`pay:${v.idempotency_key}`));
        if (existing) return { success: true, payment: existing, deduplicated: true };
      }
      const now = new Date().toISOString();
      const payment: PaymentRecord = {
        id: uid('pay'),
        organization_id: reward.organization_id,
        reward_id: reward.id,
        amount_minor: v.amount_minor,
        currency: v.currency,
        evidence_type: v.evidence_type,
        external_ref: v.external_ref,
        paid_at: v.paid_at ?? now,
        recorded_by: actor.id,
        idempotency_key: v.idempotency_key ?? null,
        note: v.note ?? null,
        created_at: now,
      };
      // Post memo attestation (bookkeeping only).
      const accounts = this.ensureAccounts(reward.organization_id, reward.currency);
      const payable = accounts.find((a) => a.code === 'REWARD_PAYABLE')!;
      const cashMemo = accounts.find((a) => a.code === 'CASH_OPERATING_MEMO')!;
      const draft = await this.draftJournal(
        {
          organization_id: reward.organization_id,
          kind: 'payment_attestation',
          currency: reward.currency,
          lines: [
            { account_id: payable.id, side: 'debit', amount_minor: v.amount_minor, currency: reward.currency },
            { account_id: cashMemo.id, side: 'credit', amount_minor: v.amount_minor, currency: reward.currency },
          ],
          source_type: 'payment_record',
          source_id: payment.id,
          idempotency_key: v.idempotency_key ? `attest:${v.idempotency_key}` : `attest:${payment.id}`,
          memo: `GHI NHỚ thanh toán (không phải bằng chứng chuyển tiền độc lập): ${v.evidence_type} ref=${v.external_ref}.`,
        },
        actor
      );
      if (!draft.success || !draft.transaction) return { success: false, error: draft.error };
      const posted = await this.postJournal(draft.transaction.id, actor, draft.transaction.idempotency_key ?? undefined);
      if (!posted.success) return { success: false, error: posted.error };
      this.payments.unshift(payment);
      if (v.idempotency_key) this.idempotency.set(`pay:${v.idempotency_key}`, payment.id);
      const link = this.links.find((l) => l.reward_id === reward.id);
      if (link) {
        link.financial_stage = 'paid_verified';
        link.reward_status_snapshot = reward.status;
        link.updated_at = now;
      }
      this.log(reward.organization_id, actor, 'payment.recorded', 'payment_record', payment.id, `Ghi nhận thanh toán (record-only, KHÔNG chuyển tiền): ${v.amount_minor} minor ${v.currency} cho reward ${reward.id}.`, { evidence: v.evidence_type, ref: v.external_ref });
      return { success: true, payment };
    } catch (err: unknown) {
      const e = err as { issues?: Array<{ message?: string }>; message?: string };
      return { success: false, error: e.issues?.[0]?.message || e.message || 'Lỗi ghi nhận thanh toán' };
    }
  }

  public getPayments(organizationId: string | null, actor: PulsarUser): PaymentRecord[] {
    if (actor.role === 'admin' && !organizationId) return this.payments.map((p) => ({ ...p }));
    if (organizationId) {
      if (financeRoleFor(actor, organizationId) === 'none') return [];
      return this.payments.filter((p) => p.organization_id === organizationId).map((p) => ({ ...p }));
    }
    const orgIds = new Set((actor.organizations ?? []).map((m) => m.organization.id));
    return this.payments.filter((p) => orgIds.has(p.organization_id)).map((p) => ({ ...p }));
  }

  // ------------------------------------------------------------------ adjustments (maker != checker)
  public async draftAdjustment(
    input: DraftAdjustmentInput,
    actor: PulsarUser
  ): Promise<{ success: boolean; adjustment?: FinancialAdjustment; error?: string }> {
    try {
      const v = draftAdjustmentSchema.parse(input);
      const role = financeRoleFor(actor, v.organization_id);
      if (role === 'none') return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403).' };
      if (role !== 'approver') {
        return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ tổ chức hoặc quản trị viên được lập điều chỉnh.' };
      }
      if (v.target_transaction_id) {
        const target = this.transactions.find((t) => t.id === v.target_transaction_id);
        if (!target || target.organization_id !== v.organization_id) {
          return { success: false, error: 'Bút toán gốc không thuộc tổ chức này.' };
        }
        if (target.status !== 'posted') return { success: false, error: 'Chỉ điều chỉnh bút toán đã ghi sổ (posted).' };
      }
      const accounts = this.ensureAccounts(v.organization_id, v.currency);
      for (const l of v.lines) {
        if (!accounts.some((a) => a.id === l.account_id)) {
          return { success: false, error: `Tài khoản không thuộc tổ chức/tiền tệ: ${l.account_id}.` };
        }
        if (l.currency !== v.currency) return { success: false, error: 'CURRENCY_MISMATCH trong dòng điều chỉnh.' };
      }
      const debits = sumMinor(v.lines.filter((l) => l.side === 'debit').map((l) => l.amount_minor));
      const credits = sumMinor(v.lines.filter((l) => l.side === 'credit').map((l) => l.amount_minor));
      if (debits !== credits || debits <= 0) return { success: false, error: 'Điều chỉnh phải cân đối nợ = có.' };
      const now = new Date().toISOString();
      const adj: FinancialAdjustment = {
        id: uid('adj'),
        organization_id: v.organization_id,
        target_transaction_id: v.target_transaction_id ?? null,
        reason: v.reason.trim(),
        status: 'draft',
        proposed_currency: v.currency,
        idempotency_key: v.idempotency_key ?? null,
        created_by: actor.id,
        reviewed_by: null,
        reviewed_at: null,
        posted_transaction_id: null,
        created_at: now,
        updated_at: now,
      };
      this.adjustments.unshift(adj);
      this.adjustmentLines.set(adj.id, v.lines.map((l) => ({ account_id: l.account_id, side: l.side, amount_minor: l.amount_minor })));
      this.log(v.organization_id, actor, 'adjustment.drafted', 'adjustment', adj.id, `Lập điều chỉnh: ${adj.reason}`);
      return { success: true, adjustment: adj };
    } catch (err: unknown) {
      const e = err as { issues?: Array<{ message?: string }>; message?: string };
      return { success: false, error: e.issues?.[0]?.message || e.message || 'Lỗi lập điều chỉnh' };
    }
  }

  public async submitAdjustment(adjustmentId: string, actor: PulsarUser): Promise<{ success: boolean; error?: string }> {
    const adj = this.adjustments.find((a) => a.id === adjustmentId);
    if (!adj) return { success: false, error: 'Không tìm thấy điều chỉnh.' };
    if (financeRoleFor(actor, adj.organization_id) !== 'approver' && adj.created_by !== actor.id) {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403).' };
    }
    if (adj.status !== 'draft') return { success: false, error: `Trạng thái ${adj.status} không thể trình duyệt.` };
    adj.status = 'pending_review';
    adj.updated_at = new Date().toISOString();
    this.log(adj.organization_id, actor, 'adjustment.submitted', 'adjustment', adj.id, 'Trình duyệt điều chỉnh.');
    return { success: true };
  }

  /** Separation of duties: reviewer must differ from creator. */
  public async reviewAdjustment(
    adjustmentId: string,
    decision: 'approve' | 'reject',
    actor: PulsarUser,
    reviewNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    const adj = this.adjustments.find((a) => a.id === adjustmentId);
    if (!adj) return { success: false, error: 'Không tìm thấy điều chỉnh.' };
    if (financeRoleFor(actor, adj.organization_id) !== 'approver') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Người duyệt phải là chủ tổ chức hoặc quản trị viên.' };
    }
    if (adj.created_by === actor.id) {
      return { success: false, error: 'PHÂN TÁCH NHIỆM VỤ (SoD): Người lập không được tự duyệt điều chỉnh của chính mình.' };
    }
    if (adj.status !== 'pending_review') return { success: false, error: `Trạng thái ${adj.status} không thể duyệt.` };
    const now = new Date().toISOString();
    adj.status = decision === 'approve' ? 'approved' : 'rejected';
    adj.reviewed_by = actor.id;
    adj.reviewed_at = now;
    adj.updated_at = now;
    this.log(adj.organization_id, actor, `adjustment.${adj.status}`, 'adjustment', adj.id, `Duyệt điều chỉnh: ${decision}. ${reviewNote ?? ''}`.trim());
    return { success: true };
  }

  /** Post an approved adjustment: reverses target (if any, preserving history) + posts correcting entries. */
  public async postAdjustment(
    adjustmentId: string,
    actor: PulsarUser,
    idempotencyKey?: string
  ): Promise<{ success: boolean; transaction?: LedgerTransaction; error?: string; deduplicated?: boolean }> {
    const adj = this.adjustments.find((a) => a.id === adjustmentId);
    if (!adj) return { success: false, error: 'Không tìm thấy điều chỉnh.' };
    if (financeRoleFor(actor, adj.organization_id) !== 'approver') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403).' };
    }
    if (adj.status !== 'approved') return { success: false, error: `Điều chỉnh phải ở trạng thái approved (hiện: ${adj.status}).` };
    const key = idempotencyKey ?? adj.idempotency_key ?? `adj:${adj.id}`;
    if (this.idempotency.has(`txn:${key}`)) {
      const txn = this.transactions.find((t) => t.id === this.idempotency.get(`txn:${key}`));
      return { success: true, transaction: txn, deduplicated: true };
    }
    const lines = this.adjustmentLines.get(adj.id) ?? [];
    // Step 1: reverse target to preserve an explicit audit trail (original entries kept).
    if (adj.target_transaction_id) {
      const rev = await this.reverseTransaction(adj.target_transaction_id, actor, `Điều chỉnh ${adj.id}: ${adj.reason}`, `rev:${key}`);
      if (!rev.success) return { success: false, error: rev.error };
    }
    // Step 2: post correcting entries.
    const draft = await this.draftJournal(
      {
        organization_id: adj.organization_id,
        kind: 'adjustment',
        currency: adj.proposed_currency,
        lines: lines.map((l) => ({ ...l, currency: adj.proposed_currency })),
        source_type: 'adjustment',
        source_id: adj.id,
        idempotency_key: key,
        memo: `Bút toán điều chỉnh ${adj.id}: ${adj.reason} (ghi nhận điều chỉnh, KHÔNG chuyển tiền)`,
      },
      actor
    );
    if (!draft.success || !draft.transaction) return { success: false, error: draft.error };
    const posted = await this.postJournal(draft.transaction.id, actor, key);
    if (!posted.success || !posted.transaction) return { success: false, error: posted.error };
    adj.status = 'posted';
    adj.posted_transaction_id = posted.transaction.id;
    adj.updated_at = new Date().toISOString();
    this.log(adj.organization_id, actor, 'adjustment.posted', 'adjustment', adj.id, `Ghi sổ điều chỉnh qua bút toán ${posted.transaction.id}.`);
    return { success: true, transaction: posted.transaction };
  }

  public getAdjustments(organizationId: string | null, actor: PulsarUser): FinancialAdjustment[] {
    if (actor.role === 'admin' && !organizationId) return this.adjustments.map((a) => ({ ...a }));
    if (organizationId) {
      if (financeRoleFor(actor, organizationId) === 'none') return [];
      return this.adjustments.filter((a) => a.organization_id === organizationId).map((a) => ({ ...a }));
    }
    const orgIds = new Set((actor.organizations ?? []).map((m) => m.organization.id));
    return this.adjustments.filter((a) => orgIds.has(a.organization_id)).map((a) => ({ ...a }));
  }

  public getAdjustmentLines(adjustmentId: string, actor: PulsarUser): AdjustmentLine[] {
    const adj = this.adjustments.find((a) => a.id === adjustmentId);
    if (!adj) return [];
    if (actor.role !== 'admin' && financeRoleFor(actor, adj.organization_id) === 'none') return [];
    return this.adjustmentLines.get(adjustmentId) ?? [];
  }  // ------------------------------------------------------------------ queries
  public getTransactions(
    filters: { organization_id?: string | null; kind?: LedgerTransactionKind | null; status?: LedgerTransactionStatus | null; currency?: CurrencyCode | null; date_from?: string | null; date_to?: string | null; page?: number; limit?: number },
    actor: PulsarUser
  ): { rows: LedgerTransaction[]; total: number } {
    let rows = [...this.transactions];
    if (actor.role !== 'admin') {
      const orgIds = new Set((actor.organizations ?? []).map((m) => m.organization.id));
      rows = rows.filter((t) => orgIds.has(t.organization_id));
    }
    if (filters.organization_id) rows = rows.filter((t) => t.organization_id === filters.organization_id);
    if (filters.kind) rows = rows.filter((t) => t.kind === filters.kind);
    if (filters.status) rows = rows.filter((t) => t.status === filters.status);
    if (filters.currency) rows = rows.filter((t) => t.currency === filters.currency);
    if (filters.date_from) rows = rows.filter((t) => t.created_at >= filters.date_from!);
    if (filters.date_to) rows = rows.filter((t) => t.created_at <= filters.date_to!);
    const total = rows.length;
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    return { rows: rows.slice((page - 1) * limit, page * limit).map((t) => ({ ...t })), total };
  }

  public getTransactionDetail(transactionId: string, actor: PulsarUser): { transaction: LedgerTransaction; entries: Array<LedgerEntry & { account_code?: string; account_name?: string }> } | null {
    const txn = this.transactions.find((t) => t.id === transactionId);
    if (!txn) return null;
    if (actor.role !== 'admin' && financeRoleFor(actor, txn.organization_id) === 'none') return null;
    const entries = this.entries
      .filter((e) => e.transaction_id === transactionId)
      .map((e) => ({ ...e, account_code: this.accountById(e.account_id)?.code, account_name: this.accountById(e.account_id)?.name }));
    return { transaction: txn, entries };
  }

  // ------------------------------------------------------------------ live reads (SP8B-1 provisional)
  private liveOrThrow(): IFinancialReadRepository {
    if (!this.live) throw new Error('Nguồn live chưa được cấu hình.');
    return this.live;
  }

  private static toSafeMinor(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
  }

  /**
   * Live transaction page. Fail-closed pre-check mirrors the sync method;
   * PostgreSQL RLS re-enforces server-side. Falls back to local on ANY live
   * failure (never surfaces raw database errors).
   */
  public async fetchTransactionsLive(
    filters: { organization_id?: string | null; kind?: LedgerTransactionKind | null; status?: LedgerTransactionStatus | null; currency?: CurrencyCode | null; date_from?: string | null; date_to?: string | null; page?: number; limit?: number },
    actor: PulsarUser
  ): Promise<{ rows: LedgerTransaction[]; total: number; source: 'live' | 'demo' }> {
    const fallback = () => ({ ...this.getTransactions(filters, actor), source: 'demo' as const });
    if (filters.organization_id && actor.role !== 'admin' && financeRoleFor(actor, filters.organization_id) === 'none') {
      return { rows: [], total: 0, source: 'demo' };
    }
    try {
      const repo = this.liveOrThrow();
      const page = await repo.listTransactions({
        organization_id: filters.organization_id ?? null,
        kind: filters.kind ?? null,
        status: filters.status ?? null,
        currency: filters.currency ?? null,
        date_from: filters.date_from ?? null,
        date_to: filters.date_to ?? null,
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
      });
      const rows: LedgerTransaction[] = [];
      for (const r of page.rows) {
        const total = FinancialService.toSafeMinor(r.total_minor);
        if (total === null) continue; // corrupt row guard: skip, never trust blindly
        rows.push({
          id: r.id,
          organization_id: r.organization_id,
          kind: r.kind as LedgerTransactionKind,
          status: r.status as LedgerTransactionStatus,
          currency: r.currency as CurrencyCode,
          total_minor: total,
          source_type: r.source_type as LedgerTransaction['source_type'],
          source_id: r.source_id,
          reverses_transaction_id: r.reverses_transaction_id,
          idempotency_key: r.idempotency_key,
          memo: r.memo,
          created_by: r.created_by,
          posted_at: r.posted_at,
          created_at: r.created_at,
          updated_at: r.updated_at,
        });
      }
      return { rows, total: page.total, source: 'live' };
    } catch {
      return fallback();
    }
  }

  public async fetchTransactionDetailLive(
    transactionId: string,
    organizationId: string,
    actor: PulsarUser
  ): Promise<{ transaction: LedgerTransaction; entries: Array<LedgerEntry & { account_code?: string; account_name?: string }> } | null> {
    if (actor.role !== 'admin' && financeRoleFor(actor, organizationId) === 'none') return null;
    try {
      const repo = this.liveOrThrow();
      const [txns, entries] = await Promise.all([
        repo.listTransactions({ organization_id: organizationId, page: 1, limit: 100 }),
        repo.listEntries([transactionId]),
      ]);
      const raw = txns.rows.find((t) => t.id === transactionId);
      if (!raw || raw.organization_id !== organizationId) return null;
      const total = FinancialService.toSafeMinor(raw.total_minor);
      if (total === null) return null;
      return {
        transaction: {
          id: raw.id,
          organization_id: raw.organization_id,
          kind: raw.kind as LedgerTransactionKind,
          status: raw.status as LedgerTransactionStatus,
          currency: raw.currency as CurrencyCode,
          total_minor: total,
          source_type: raw.source_type as LedgerTransaction['source_type'],
          source_id: raw.source_id,
          reverses_transaction_id: raw.reverses_transaction_id,
          idempotency_key: raw.idempotency_key,
          memo: raw.memo,
          created_by: raw.created_by,
          posted_at: raw.posted_at,
          created_at: raw.created_at,
          updated_at: raw.updated_at,
        },
        entries: entries
          .filter((e) => e.transaction_id === transactionId)
          .map((e) => ({
            id: e.id,
            transaction_id: e.transaction_id,
            account_id: e.account_id,
            side: e.side as LedgerEntry['side'],
            amount_minor: typeof e.amount_minor === 'number' && Number.isSafeInteger(e.amount_minor) ? e.amount_minor : 0,
            currency: e.currency as CurrencyCode,
            created_at: e.created_at,
            account_code: e.account_code ?? undefined,
            account_name: e.account_name ?? undefined,
          })),
      };
    } catch {
      const local = this.getTransactionDetail(transactionId, actor);
      return local;
    }
  }

  public async fetchLinksLive(organizationId: string | null, actor: PulsarUser): Promise<{ links: RewardLedgerLink[]; source: 'live' | 'demo' }> {
    try {
      const repo = this.liveOrThrow();
      const rows = await repo.listLinks(organizationId);
      return {
        links: rows.map((r) => ({
          reward_id: r.reward_id,
          organization_id: r.organization_id,
          challenge_id: r.challenge_id,
          outcome_id: r.outcome_id,
          liability_transaction_id: r.liability_transaction_id,
          reward_status_snapshot: r.reward_status_snapshot,
          financial_stage: r.financial_stage as RewardLedgerLink['financial_stage'],
          updated_at: r.updated_at,
        })),
        source: 'live',
      };
    } catch {
      return { links: this.getLinks(organizationId, actor), source: 'demo' };
    }
  }

  public async fetchPaymentsLive(organizationId: string | null, actor: PulsarUser): Promise<{ payments: PaymentRecord[]; source: 'live' | 'demo' }> {
    try {
      const repo = this.liveOrThrow();
      const rows = await repo.listPayments(organizationId);
      return {
        payments: rows
          .map((p) => {
            const amount = FinancialService.toSafeMinor(p.amount_minor);
            if (amount === null || amount <= 0) return null;
            return {
              id: p.id,
              organization_id: p.organization_id,
              reward_id: p.reward_id,
              amount_minor: amount,
              currency: p.currency as CurrencyCode,
              evidence_type: p.evidence_type as PaymentRecord['evidence_type'],
              external_ref: p.external_ref,
              paid_at: p.paid_at,
              recorded_by: p.recorded_by,
              idempotency_key: p.idempotency_key,
              note: p.note,
              created_at: p.created_at,
            } as PaymentRecord;
          })
          .filter((p): p is PaymentRecord => p !== null),
        source: 'live',
      };
    } catch {
      return { payments: this.getPayments(organizationId, actor), source: 'demo' };
    }
  }

  /** Organization payable balance (net Cr on REWARD_PAYABLE, posted txns only, per currency). */
  public payableOutstanding(organizationId: string, currency: CurrencyCode): number {
    const payableAccs = new Set(this.accounts.filter((a) => a.organization_id === organizationId && a.currency === currency && a.code === 'REWARD_PAYABLE').map((a) => a.id));
    const postedIds = new Set(this.transactions.filter((t) => t.organization_id === organizationId && t.currency === currency && t.status === 'posted').map((t) => t.id));
    let balance = 0;
    for (const e of this.entries) {
      if (!payableAccs.has(e.account_id) || !postedIds.has(e.transaction_id)) continue;
      balance += e.side === 'credit' ? e.amount_minor : -e.amount_minor;
    }
    return Math.max(0, balance);
  }

  /** Dashboard buckets with documented, non-interchangeable meanings. */
  public async getSummary(organizationId: string | null, currency: CurrencyCode, actor: PulsarUser): Promise<FinancialSummary> {
    const { data: allRewards } = await outcomeRewardService.getRewards(organizationId ? { organization_id: organizationId } : {});
    const rewards = (allRewards ?? []).filter((r) => r.currency === currency);
    const planned = rewards
      .filter((r) => ESTIMATE_STATUSES.has(r.status))
      .reduce((s, r) => s + toMinorUnits(r.amount, r.currency), 0);
    const approved = rewards
      .filter((r) => PAYABLE_STATUSES.has(r.status) || r.status === 'paid')
      .reduce((s, r) => s + toMinorUnits(r.amount, r.currency), 0);
    const orgScope = organizationId ? [organizationId] : [...new Set(rewards.map((r) => r.organization_id))];
    let payable = 0;
    for (const org of orgScope) {
      if (organizationId || actor.role === 'admin' || financeRoleFor(actor, org) !== 'none') {
        payable += this.payableOutstanding(org, currency);
      }
    }
    const scopedPayments = this.payments.filter((p) => p.currency === currency && (!organizationId || p.organization_id === organizationId));
    const verified = sumMinor([0, ...scopedPayments.map((p) => p.amount_minor)]);
    // Pending = SP4-attested (paid) value lacking full authoritative evidence.
    let pending = 0;
    for (const r of rewards.filter((r) => r.status === 'paid')) {
      const ev = scopedPayments.filter((p) => p.reward_id === r.id).reduce((s, p) => s + p.amount_minor, 0);
      pending += Math.max(0, toMinorUnits(r.amount, r.currency) - ev);
    }
    return {
      organization_id: organizationId,
      currency,
      planned_budget_minor: planned,
      approved_rewards_minor: approved,
      payable_outstanding_minor: payable,
      pending_payment_minor: pending,
      verified_paid_minor: verified,
      unresolved_discrepancies: 0, // filled by UI from reconciliation service
    };
  }

  public getAuditEvents(organizationId: string | null, actor: PulsarUser, limit = 50): FinancialAuditEvent[] {
    let rows = [...this.audit];
    if (actor.role !== 'admin') {
      const orgIds = new Set((actor.organizations ?? []).map((m) => m.organization.id));
      rows = rows.filter((e) => e.organization_id && orgIds.has(e.organization_id));
    }
    if (organizationId) rows = rows.filter((e) => e.organization_id === organizationId);
    return rows.slice(0, limit).map((e) => ({ ...e }));
  }

  /** Test helper: full reset (local/demo only). */
  public _reset(): void {
    this.accounts = [];
    this.transactions = [];
    this.entries = [];
    this.links = [];
    this.payments = [];
    this.adjustments = [];
    this.adjustmentLines = new Map();
    this.audit = [];
    this.idempotency = new Map();
  }

  /** Seed a coherent demo graph (labelled demo; never real money). */
  public _seedDemo(sysActor: PulsarUser): void {
    // Idempotent per process.
    if (this.accounts.length > 0) return;
    const org = 'org-tech-01';
    const accounts = this.ensureAccounts(org, 'USD');
    const expense = accounts.find((a) => a.code === 'CHALLENGE_EXPENSE')!;
    const payable = accounts.find((a) => a.code === 'REWARD_PAYABLE')!;
    const now = new Date().toISOString();
    // rwd-001: SP4 seed reward (5000 USD, status paid via mock adapter).
    // Liability recognized as if approved earlier; NO authoritative payment yet
    // (only a partial simulated statement below) -> reconciliation demo issues.
    const liabilityId = 'txn-seed-rwd-001-liability';
    this.transactions.unshift({
      id: liabilityId,
      organization_id: org,
      kind: 'liability_recognition',
      status: 'posted',
      currency: 'USD',
      total_minor: 500000,
      source_type: 'reward',
      source_id: 'rwd-001',
      reverses_transaction_id: null,
      idempotency_key: 'seed-rwd-001-liability',
      memo: 'Seed demo: nợ phải trả cho reward rwd-001 (5000 USD). Dữ liệu demo, không phải hoạt động thật.',
      created_by: 'system',
      posted_at: now,
      created_at: now,
      updated_at: now,
    });
    this.idempotency.set('txn:seed-rwd-001-liability', liabilityId);
    this.entries.push(
      { id: 'le-seed-1', transaction_id: liabilityId, account_id: expense.id, side: 'debit', amount_minor: 500000, currency: 'USD', created_at: now },
      { id: 'le-seed-2', transaction_id: liabilityId, account_id: payable.id, side: 'credit', amount_minor: 500000, currency: 'USD', created_at: now }
    );
    this.links.unshift({
      reward_id: 'rwd-001',
      organization_id: org,
      challenge_id: 'ch-001',
      outcome_id: 'out-001',
      liability_transaction_id: liabilityId,
      reward_status_snapshot: 'paid',
      financial_stage: 'payment_attested',
      updated_at: now,
    });
    // Partial simulated statement: $2,000 of $5,000 attested.
    this.payments.unshift({
      id: 'pay-seed-1',
      organization_id: org,
      reward_id: 'rwd-001',
      amount_minor: 200000,
      currency: 'USD',
      evidence_type: 'simulated_statement',
      external_ref: 'SIM-STMT-2026-03-001',
      paid_at: now,
      recorded_by: 'system',
      idempotency_key: 'seed-pay-1',
      note: 'Seed demo: sao kê mô phỏng một phần. Không phải chuyển tiền thật.',
      created_at: now,
    });
    this.idempotency.set('pay:seed-pay-1', 'pay-seed-1');
    this.log(org, sysActor, 'demo.seeded', 'ledger_transaction', liabilityId, 'Seed dữ liệu demo tài chính (gắn nhãn demo).');
  }
}

export const financialService = new FinancialService();