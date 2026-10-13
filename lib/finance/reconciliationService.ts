import type {
  CurrencyCode,
  DiscrepancySeverity,
  ReconciliationItem,
  ReconciliationRun,
  RewardLedgerLink,
} from '../../types/finance.types';
import type { PulsarUser } from '../../types/auth.types';
import type { Reward } from '../../types/outcome.types';
import { financialService, financeRoleFor } from './financialService';
import { outcomeRewardService } from '../outcome/outcomeRewardService';
import { toMinorUnits } from './money';

/**
 * SP8A — ReconciliationService (READ-ONLY by default).
 *
 * Compares (1) eligible SP4 rewards/outcomes, (2) ledger transactions,
 * (3) payment records / simulated statement rows. Never mutates rewards or the
 * ledger; never auto-fixes. Repeat runs over unchanged data reuse open issue IDs
 * (fingerprint dedup) and create no financial transactions.
 */

interface PendingIssue {
  code: ReconciliationItem['code'];
  severity: DiscrepancySeverity;
  reward_id: string | null;
  transaction_id: string | null;
  payment_id: string | null;
  expected_minor: number | null;
  actual_minor: number | null;
  currency: CurrencyCode | null;
  organization_id: string | null;
  detail: string;
}

function fingerprintOf(i: PendingIssue): string {
  const raw = [i.code, i.reward_id ?? '-', i.transaction_id ?? '-', i.payment_id ?? '-', i.expected_minor ?? '-', i.actual_minor ?? '-', i.currency ?? '-'].join('|');
  let h = 5381;
  for (let j = 0; j < raw.length; j++) h = ((h << 5) + h + raw.charCodeAt(j)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ALL_TXN_STATUSES = ['draft', 'pending', 'posted', 'reversed', 'failed', 'cancelled'] as const;

class ReconciliationService {
  private runs: ReconciliationRun[] = [];
  private items: ReconciliationItem[] = [];
  /** fingerprint -> manual resolution record */
  private resolutions: Map<string, { state: ReconciliationItem['state']; by: string; at: string; note: string }> = new Map();

  public async runReconciliation(
    organizationId: string | null,
    actor: PulsarUser
  ): Promise<{ success: boolean; run?: ReconciliationRun; items?: ReconciliationItem[]; error?: string }> {
    if (organizationId) {
      if (financeRoleFor(actor, organizationId) === 'none') {
        return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Không có quyền đối soát tổ chức này.' };
      }
    } else if (actor.role !== 'admin') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ quản trị viên được đối soát toàn hệ thống.' };
    }
    const started = new Date().toISOString();
    try {
      const [{ data: rewardsRaw }, { data: outcomesRaw }] = await Promise.all([
        outcomeRewardService.getRewards(organizationId ? { organization_id: organizationId } : {}),
        outcomeRewardService.getOutcomes(organizationId ? { organization_id: organizationId } : {}),
      ]);
      const rewards: Reward[] = (rewardsRaw ?? []).filter((r) => !organizationId || r.organization_id === organizationId);
      const outcomes = outcomesRaw ?? [];
      const links: RewardLedgerLink[] = financialService.getLinks(organizationId, actor);
      const payments = financialService.getPayments(organizationId, actor);
      let allTxns: import('../../types/finance.types').LedgerTransaction[] = [];
      for (const st of ALL_TXN_STATUSES) {
        const { rows } = financialService.getTransactions(
          { organization_id: organizationId, status: st, limit: 100, page: 1 },
          actor
        );
        allTxns = allTxns.concat(rows);
      }
      // Multi-page safety for large books (cap 600 examined; document in run).
      const txns = allTxns.slice(0, 600);

      const pending: PendingIssue[] = [];
      const rewardIds = new Set(rewards.map((r) => r.id));
      const paymentIds = new Set(payments.map((p) => p.id));

      for (const r of rewards) {
        let awardMinor: number | null = null;
        try {
          awardMinor = toMinorUnits(r.amount, r.currency);
        } catch {
          pending.push({
            code: 'AMOUNT_MISMATCH', severity: 'critical', reward_id: r.id, transaction_id: null, payment_id: null,
            expected_minor: null, actual_minor: null, currency: r.currency, organization_id: r.organization_id,
            detail: `Số tiền reward không chuyển được sang đơn vị nhỏ nhất (amount=${r.amount}).`,
          });
          continue;
        }
        const liabilityTxns = txns.filter((t) => t.kind === 'liability_recognition' && t.source_id === r.id);
        const evidence = payments.filter((p) => p.reward_id === r.id);
        const evidenceTotal = evidence.reduce((s, p) => s + p.amount_minor, 0);

        if ((r.status === 'approved' || r.status === 'processing' || r.status === 'paid') && liabilityTxns.length === 0) {
          pending.push({
            code: 'REWARD_WITHOUT_LEDGER', severity: 'critical', reward_id: r.id, transaction_id: null, payment_id: null,
            expected_minor: awardMinor, actual_minor: null, currency: r.currency, organization_id: r.organization_id,
            detail: `Reward ${r.status} trị giá ${awardMinor} minor ${r.currency} chưa có bút toán ghi nhận nợ.`,
          });
        }
        if (liabilityTxns.length > 1) {
          pending.push({
            code: 'DUPLICATE_SOURCE_REF', severity: 'critical', reward_id: r.id, transaction_id: liabilityTxns[1].id, payment_id: null,
            expected_minor: 1, actual_minor: liabilityTxns.length, currency: r.currency, organization_id: r.organization_id,
            detail: `Tìm thấy ${liabilityTxns.length} bút toán nợ cho cùng reward ${r.id} (kỳ vọng 1).`,
          });
        }
        for (const t of liabilityTxns) {
          if (t.currency !== r.currency) {
            pending.push({
              code: 'CURRENCY_MISMATCH', severity: 'critical', reward_id: r.id, transaction_id: t.id, payment_id: null,
              expected_minor: null, actual_minor: null, currency: r.currency, organization_id: r.organization_id,
              detail: `Bút toán nợ ${t.currency} khác tiền tệ reward ${r.currency}.`,
            });
          }
          if (t.status === 'posted' && t.total_minor !== awardMinor) {
            pending.push({
              code: 'AMOUNT_MISMATCH', severity: 'warning', reward_id: r.id, transaction_id: t.id, payment_id: null,
              expected_minor: awardMinor, actual_minor: t.total_minor, currency: r.currency, organization_id: r.organization_id,
              detail: `Bút toán nợ ${t.total_minor} khác số tiền thưởng ${awardMinor} minor ${r.currency}.`,
            });
          }
        }
        if ((r.status === 'failed' || r.status === 'cancelled') && liabilityTxns.some((t) => t.status === 'posted')) {
          pending.push({
            code: 'INVALID_STATUS_TRANSITION', severity: 'critical', reward_id: r.id, transaction_id: liabilityTxns.find((t) => t.status === 'posted')!.id, payment_id: null,
            expected_minor: null, actual_minor: null, currency: r.currency, organization_id: r.organization_id,
            detail: `Reward đã ${r.status} nhưng bút toán nợ vẫn posted — phải đảo (reverse) thay vì giữ.`,
          });
        }
        if (r.status === 'paid') {
          const outcome = outcomes.find((o) => o.challenge_id === r.challenge_id);
          if (!outcome || outcome.status !== 'finalized') {
            pending.push({
              code: 'INVALID_STATUS_TRANSITION', severity: 'critical', reward_id: r.id, transaction_id: null, payment_id: null,
              expected_minor: null, actual_minor: null, currency: r.currency, organization_id: r.organization_id,
              detail: `Reward paid nhưng outcome chưa finalized (outcome=${outcome?.status ?? 'không tồn tại'}).`,
            });
          }
          if (evidence.length === 0) {
            pending.push({
              code: 'PAID_WITHOUT_EVIDENCE', severity: 'critical', reward_id: r.id, transaction_id: null, payment_id: null,
              expected_minor: awardMinor, actual_minor: 0, currency: r.currency, organization_id: r.organization_id,
              detail: `Reward claimed paid nhưng KHÔNG có payment record có thẩm quyền (SP4 paid qua mock adapter không phải bằng chứng).`,
            });
          } else if (evidenceTotal !== awardMinor) {
            pending.push({
              code: 'AMOUNT_MISMATCH', severity: 'warning', reward_id: r.id, transaction_id: null, payment_id: evidence[0].id,
              expected_minor: awardMinor, actual_minor: evidenceTotal, currency: r.currency, organization_id: r.organization_id,
              detail: `Tổng chứng từ thanh toán (${evidenceTotal}) khác số tiền thưởng (${awardMinor} minor ${r.currency}).`,
            });
          }
          for (const p of evidence) {
            if (p.currency !== r.currency) {
              pending.push({
                code: 'CURRENCY_MISMATCH', severity: 'critical', reward_id: r.id, transaction_id: null, payment_id: p.id,
                expected_minor: null, actual_minor: null, currency: r.currency, organization_id: r.organization_id,
                detail: `Payment record ${p.currency} khác tiền tệ reward ${r.currency}.`,
              });
            }
          }
        }
        void links;
      }

      // Ledger-side scans.
      const seenIdempotency = new Map<string, string>();
      for (const t of txns) {
        if (t.kind === 'liability_recognition' && t.source_id && !rewardIds.has(t.source_id)) {
          pending.push({
            code: 'LEDGER_WITHOUT_SOURCE', severity: 'warning', reward_id: null, transaction_id: t.id, payment_id: null,
            expected_minor: null, actual_minor: t.total_minor, currency: t.currency, organization_id: t.organization_id,
            detail: `Bút toán nợ tham chiếu reward không tồn tại (${t.source_id}).`,
          });
        }
        if (t.kind === 'payment_attestation' && t.source_id && !paymentIds.has(t.source_id)) {
          pending.push({
            code: 'LEDGER_WITHOUT_SOURCE', severity: 'warning', reward_id: null, transaction_id: t.id, payment_id: null,
            expected_minor: null, actual_minor: t.total_minor, currency: t.currency, organization_id: t.organization_id,
            detail: `Bút toán attestation tham chiếu payment record không tồn tại (${t.source_id}).`,
          });
        }
        if (t.idempotency_key) {
          const k = `txn:${t.idempotency_key}`;
          if (seenIdempotency.has(k)) {
            pending.push({
              code: 'DUPLICATE_SOURCE_REF', severity: 'critical', reward_id: null, transaction_id: t.id, payment_id: null,
              expected_minor: null, actual_minor: null, currency: t.currency, organization_id: t.organization_id,
              detail: `Trùng idempotency key ${t.idempotency_key} với bút toán ${seenIdempotency.get(k)}.`,
            });
          } else seenIdempotency.set(k, t.id);
        }
        if (t.status === 'posted') {
          const detail = financialService.getTransactionDetail(t.id, actor);
          const ds = (detail?.entries ?? []).filter((e) => e.side === 'debit').reduce((s, e) => s + e.amount_minor, 0);
          const cs = (detail?.entries ?? []).filter((e) => e.side === 'credit').reduce((s, e) => s + e.amount_minor, 0);
          const currencies = new Set((detail?.entries ?? []).map((e) => e.currency));
          if (ds !== cs || ds <= 0) {
            pending.push({
              code: 'IMBALANCE', severity: 'critical', reward_id: null, transaction_id: t.id, payment_id: null,
              expected_minor: ds, actual_minor: cs, currency: t.currency, organization_id: t.organization_id,
              detail: `Bút toán posted mất cân đối: Dr=${ds} Cr=${cs}.`,
            });
          }
          if (currencies.size !== 1 || ![...currencies].includes(t.currency)) {
            pending.push({
              code: 'CURRENCY_MISMATCH', severity: 'critical', reward_id: null, transaction_id: t.id, payment_id: null,
              expected_minor: null, actual_minor: null, currency: t.currency, organization_id: t.organization_id,
              detail: `Dòng bút toán không đồng nhất tiền tệ với transaction (${t.currency}).`,
            });
          }
        }
      }

      // Reconcile with prior state: reuse open IDs, auto-close vanished, surface resolved.
      const now = new Date().toISOString();
      const runId = uid('recon');
      const runItems: ReconciliationItem[] = [];
      const currentFingerprints = new Set(pending.map(fingerprintOf));

      for (const p of pending) {
        const fp = fingerprintOf(p);
        const manual = this.resolutions.get(fp);
        const priorOpen = this.items.find((i) => i.fingerprint === fp && i.state === 'open');
        if (priorOpen) {
          runItems.push({ ...priorOpen, run_id: runId });
          continue;
        }
        runItems.push({
          id: uid('rd'),
          run_id: runId,
          code: p.code,
          severity: p.severity,
          state: manual && manual.state !== 'open' ? manual.state : 'open',
          reward_id: p.reward_id,
          transaction_id: p.transaction_id,
          payment_id: p.payment_id,
          expected_minor: p.expected_minor,
          actual_minor: p.actual_minor,
          currency: p.currency,
          organization_id: p.organization_id,
          detail: p.detail,
          fingerprint: fp,
          resolved_at: manual ? manual.at : null,
          resolved_by: manual ? manual.by : null,
          created_at: now,
        });
      }
      // Previously open but no longer detected -> auto-resolve (with audit note).
      const openBefore = this.items.filter((i) => i.state === 'open' && (!organizationId || i.organization_id === organizationId));
      for (const prev of openBefore) {
        if (!currentFingerprints.has(prev.fingerprint) && !runItems.some((r) => r.fingerprint === prev.fingerprint)) {
          runItems.push({
            ...prev,
            run_id: runId,
            code: 'RESOLVED_PREVIOUSLY',
            severity: 'info',
            state: 'resolved',
            detail: `${prev.detail} → Không còn phát hiện trong lần chạy này (tự động đóng).`,
            resolved_at: now,
            resolved_by: actor.id,
          });
          prev.state = 'resolved';
          prev.resolved_at = now;
        }
      }
      // Persist open state for next runs.
      for (const ri of runItems) {
        if (ri.code === 'RESOLVED_PREVIOUSLY') continue;
        const idx = this.items.findIndex((i) => i.fingerprint === ri.fingerprint);
        if (idx === -1) this.items.push({ ...ri });
        else this.items[idx] = { ...this.items[idx], run_id: runId, state: ri.state, resolved_at: ri.resolved_at, resolved_by: ri.resolved_by };
      }

      const openCount = runItems.filter((i) => i.state === 'open').length;
      const hasBlocking = runItems.some((i) => i.state === 'open' && (i.severity === 'critical' || i.severity === 'warning'));
      const finished = new Date().toISOString();
      const run: ReconciliationRun = {
        id: runId,
        organization_id: organizationId,
        started_at: started,
        finished_at: finished,
        status: openCount === 0 ? 'completed' : hasBlocking ? 'completed_with_issues' : 'completed',
        rewards_examined: rewards.length,
        transactions_examined: txns.length,
        payments_examined: payments.length,
        issues_open: openCount,
        issues_resolved: runItems.filter((i) => i.state !== 'open').length,
        initiated_by: actor.id,
      };
      this.runs.unshift(run);
      return { success: true, run, items: runItems };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || 'Đối soát thất bại.' };
    }
  }

  public getRuns(actor: PulsarUser, organizationId?: string | null): ReconciliationRun[] {
    let rows = this.runs.map((r) => ({ ...r }));
    if (actor.role !== 'admin') {
      const orgIds = new Set((actor.organizations ?? []).map((m) => m.organization.id));
      rows = rows.filter((r) => r.organization_id && orgIds.has(r.organization_id));
    }
    if (organizationId) rows = rows.filter((r) => r.organization_id === organizationId);
    return rows;
  }

  public getRunItems(runId: string, actor: PulsarUser): ReconciliationItem[] {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return [];
    if (actor.role !== 'admin') {
      if (!run.organization_id) return [];
      if (financeRoleFor(actor, run.organization_id) === 'none') return [];
    }
    return this.items.filter((i) => i.run_id === runId).map((i) => ({ ...i }));
  }

  public getOpenIssues(actor: PulsarUser, organizationId?: string | null): ReconciliationItem[] {
    // Latest state per fingerprint.
    const latest = new Map<string, ReconciliationItem>();
    for (const i of this.items) {
      const cur = latest.get(i.fingerprint);
      if (!cur || i.created_at >= cur.created_at) latest.set(i.fingerprint, i);
    }
    let rows = [...latest.values()].filter((i) => i.state === 'open').map((i) => ({ ...i }));
    if (actor.role !== 'admin') {
      const orgIds = new Set((actor.organizations ?? []).map((m) => m.organization.id));
      rows = rows.filter((i) => i.organization_id && orgIds.has(i.organization_id));
    }
    if (organizationId) rows = rows.filter((i) => i.organization_id === organizationId);
    return rows;
  }

  /** Resolve/acknowledge: resolve requires approver; acknowledge any reader. Never auto-fixes. */
  public resolveItem(
    itemId: string,
    state: 'resolved' | 'acknowledged',
    note: string,
    actor: PulsarUser
  ): { success: boolean; error?: string } {
    if (!note || note.trim().length < 1) return { success: false, error: 'Cần ghi chú xử lý.' };
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return { success: false, error: 'Không tìm thấy discrepancy.' };
    if (!item.organization_id) return { success: false, error: 'Discrepancy thiếu phạm vi tổ chức.' };
    const role = financeRoleFor(actor, item.organization_id);
    if (role === 'none') return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403).' };
    if (state === 'resolved' && role !== 'approver') {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ tổ chức hoặc quản trị viên được đóng discrepancy.' };
    }
    item.state = state;
    item.resolved_at = new Date().toISOString();
    item.resolved_by = actor.id;
    item.detail = `${item.detail} [${state}: ${note.trim()}]`;
    this.resolutions.set(item.fingerprint, { state, by: actor.id, at: item.resolved_at, note: note.trim() });
    return { success: true };
  }

  public _reset(): void {
    this.runs = [];
    this.items = [];
    this.resolutions = new Map();
  }
}

export const reconciliationService = new ReconciliationService();
