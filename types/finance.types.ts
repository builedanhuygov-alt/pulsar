/**
 * PULSAR SP8A — Financial Ledger & Reconciliation domain types.
 *
 * DEMO/LABEL NOTICE: services backing these types run in-memory (local/demo mode,
 * see lib/finance/*). Amounts shown in the UI from seeds are DEMO bookkeeping
 * records, never real-money activity. No payment provider is connected.
 */

export type CurrencyCode = 'USD' | 'VND' | 'EUR';

/** Minor-unit digits per currency: USD/EUR = cents (2), VND = dong (0 decimals). */
export const CURRENCY_MINOR_DIGITS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  VND: 0,
};

export type AccountType = 'liability' | 'expense' | 'asset_memo' | 'contra';

/** Bookkeeping accounts per organization (NOT custody: PULSAR holds no customer funds). */
export interface FinancialAccount {
  id: string;
  organization_id: string;
  code: 'REWARD_PAYABLE' | 'CHALLENGE_EXPENSE' | 'CASH_OPERATING_MEMO' | 'ADJUSTMENT_CONTRA';
  name: string;
  account_type: AccountType;
  currency: CurrencyCode;
  created_at: string;
}

export type LedgerTransactionStatus =
  | 'draft'
  | 'pending'
  | 'posted'
  | 'reversed'
  | 'failed'
  | 'cancelled';

export type LedgerTransactionKind =
  | 'liability_recognition' // approved reward -> Dr expense / Cr payable
  | 'payment_attestation' // claimed transfer memo -> Dr payable / Cr cash-memo (NOT proof)
  | 'reversal' // full reversal of a posted txn, linked
  | 'adjustment'; // correcting entries from an approved adjustment

export interface LedgerTransaction {
  id: string;
  organization_id: string;
  kind: LedgerTransactionKind;
  status: LedgerTransactionStatus;
  currency: CurrencyCode;
  /** Total debit minor units (must equal total credits; single currency). */
  total_minor: number;
  source_type: 'reward' | 'payment_record' | 'adjustment' | 'manual';
  source_id: string | null;
  /** Links reversal -> original posted transaction. */
  reverses_transaction_id: string | null;
  idempotency_key: string | null;
  memo: string | null;
  created_by: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  side: 'debit' | 'credit';
  /** Integer minor units, > 0. Never float. */
  amount_minor: number;
  currency: CurrencyCode;
  created_at: string;
}

/** Adapter view: how an SP4 reward maps into the financial model (read-only w.r.t. SP4). */
export type RewardFinancialStage =
  | 'planned_estimate' // planned | pending_approval (+ cancelled/no-winner outcomes): estimate only
  | 'payable_recognized' // approved | processing: liability recognized
  | 'payment_attested' // paid (SP4 operator-attested, mock adapter): awaiting authoritative evidence
  | 'paid_verified' // paid + authoritative payment record allocated
  | 'closed_no_liability'; // failed | cancelled, or outcome cancelled/rejected

export interface RewardLedgerLink {
  reward_id: string;
  organization_id: string;
  challenge_id: string;
  outcome_id: string | null;
  /** Liability journal txn; null until payable recognized. */
  liability_transaction_id: string | null;
  reward_status_snapshot: string;
  financial_stage: RewardFinancialStage;
  updated_at: string;
}

export type PaymentEvidenceType = 'simulated_statement' | 'manual_attestation';

export interface PaymentRecord {
  id: string;
  organization_id: string;
  reward_id: string;
  /** Integer minor units. */
  amount_minor: number;
  currency: CurrencyCode;
  evidence_type: PaymentEvidenceType;
  /** External reference (bank ref / statement line). Simulated data labelled as such. */
  external_ref: string;
  paid_at: string | null;
  recorded_by: string | null;
  idempotency_key: string | null;
  note: string | null;
  created_at: string;
}

export type AdjustmentStatus = 'draft' | 'pending_review' | 'approved' | 'posted' | 'rejected' | 'cancelled';

export interface FinancialAdjustment {
  id: string;
  organization_id: string;
  /** Target posted transaction being corrected (reversed + replaced), or null for standalone. */
  target_transaction_id: string | null;
  reason: string;
  status: AdjustmentStatus;
  /** Proposed correcting entries (balanced, single currency). */
  proposed_currency: CurrencyCode;
  idempotency_key: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  posted_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentLine {
  account_id: string;
  side: 'debit' | 'credit';
  amount_minor: number;
}

export type ReconciliationRunStatus = 'completed' | 'completed_with_issues' | 'failed';

export type DiscrepancySeverity = 'critical' | 'warning' | 'info';
export type DiscrepancyState = 'open' | 'resolved' | 'acknowledged';

export type DiscrepancyCode =
  | 'REWARD_WITHOUT_LEDGER'
  | 'DUPLICATE_SOURCE_REF'
  | 'LEDGER_WITHOUT_SOURCE'
  | 'IMBALANCE'
  | 'CURRENCY_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'INVALID_STATUS_TRANSITION'
  | 'PAID_WITHOUT_EVIDENCE'
  | 'RESOLVED_PREVIOUSLY';

export interface ReconciliationItem {
  id: string;
  run_id: string;
  code: DiscrepancyCode;
  severity: DiscrepancySeverity;
  state: DiscrepancyState;
  reward_id: string | null;
  transaction_id: string | null;
  payment_id: string | null;
  expected_minor: number | null;
  actual_minor: number | null;
  currency: CurrencyCode | null;
  /** Tenant scope for authorization (derived from reward/transaction org). */
  organization_id: string | null;
  detail: string;
  /** Stable fingerprint so repeat runs don't duplicate open issues. */
  fingerprint: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface ReconciliationRun {
  id: string;
  organization_id: string | null; // null = all orgs (admin)
  started_at: string;
  finished_at: string;
  status: ReconciliationRunStatus;
  rewards_examined: number;
  transactions_examined: number;
  payments_examined: number;
  issues_open: number;
  issues_resolved: number;
  initiated_by: string | null;
}

export interface FinancialAuditEvent {
  id: string;
  organization_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: 'ledger_transaction' | 'ledger_entry' | 'adjustment' | 'payment_record' | 'reconciliation_run' | 'reward_link';
  entity_id: string;
  detail: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Dashboard buckets — each amount has a distinct, documented meaning. */
export interface FinancialSummary {
  organization_id: string | null;
  currency: CurrencyCode;
  /** Sum of challenge prize_pool estimates (NOT a liability). */
  planned_budget_minor: number;
  /** Rewards in approved/processing (or attested/verified) valued at award amount. */
  approved_rewards_minor: number;
  /** Outstanding Cr balance on REWARD_PAYABLE (owed, net of attestations/reversals). */
  payable_outstanding_minor: number;
  /** Attested (SP4 paid) but without authoritative payment evidence. */
  pending_payment_minor: number;
  /** Paid WITH authoritative payment record allocated. */
  verified_paid_minor: number;
  unresolved_discrepancies: number;
}
