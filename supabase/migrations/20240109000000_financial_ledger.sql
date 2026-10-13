-- ==============================================================================
-- PULSAR SP8A: Financial Ledger & Reconciliation Engine
-- File: supabase/migrations/20240109000000_financial_ledger.sql
-- Depends: 20240104000000_create_outcome_reward_engine.sql (rewards/outcomes),
--          SP1 helpers is_org_member(UUID,UUID), is_org_owner(UUID,UUID), is_admin().
-- Run AFTER all SP1–SP7 migrations. Idempotent (IF NOT EXISTS / DROP IF EXISTS),
-- single transaction, NO data deletion, NO Cloud auto-apply (DBA applies manually).
--
-- ACCOUNTING ASSUMPTIONS (see also lib/finance/financialService.ts):
--  1. Double-entry bookkeeping. Each posted journal balances per currency:
--     SUM(debits) = SUM(credits) > 0, enforced by trigger trg_ledger_balance_guard.
--  2. Amounts are INTEGER minor units (BIGINT): USD/EUR cents (2 digits), VND dong
--     (0 digits). No floats, no cross-currency aggregation without a conversion
--     policy (none defined in SP8A).
--  3. Accounts are pure bookkeeping buckets. PULSAR holds NO customer funds and
--     operates NO legal escrow. CASH_OPERATING_MEMO rows are memo records of
--     claimed transfers, never proof of custody or settlement.
--  4. No tax, revenue-recognition, or escrow rules are invented.
--  5. Payable liability is recognized ONLY for SP4 rewards in
--     {approved, processing} (reward_ledger_links, one row per reward).
--     Planned/pending_approval are estimates, never liabilities.
--  6. SP4 `rewards.status = 'paid'` is OPERATOR-ATTESTED (often mock adapter) and
--     is NOT authoritative payment evidence. Verified-paid requires a
--     payment_records row allocated to the reward.
--  7. Posted rows are immutable: no client UPDATE/DELETE policies on entries;
--     corrections use reversing/adjusting transactions linked to the original.
--  8. Reconciliation is read-only and never auto-fixes mismatches.
--
-- ROLLBACK GUIDANCE (do NOT execute automatically):
--  To revert, in a maintenance window with no writers:
--    DROP TRIGGER IF EXISTS trg_ledger_posting_guard ON public.ledger_transactions;
--    DROP TRIGGER IF EXISTS trg_ledger_balance_guard ON public.ledger_entries;
--    DROP FUNCTION IF EXISTS public.guard_ledger_posting();
--    DROP FUNCTION IF EXISTS public.guard_ledger_balance();
--    DROP TABLE IF EXISTS public.financial_audit_events, public.reconciliation_items,
--      public.reconciliation_runs, public.financial_adjustments,
--      public.payment_records, public.reward_ledger_links,
--      public.ledger_entries, public.ledger_transactions,
--      public.financial_accounts;
--  This destroys financial history — prefer keeping tables and archiving instead.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Preconditions
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards') THEN
    RAISE EXCEPTION 'SP4 base migration missing: public.rewards not found. Apply 20240104000000 first.';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. financial_accounts — bookkeeping buckets per org+currency (no custody)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK (code IN ('REWARD_PAYABLE', 'CHALLENGE_EXPENSE', 'CASH_OPERATING_MEMO', 'ADJUSTMENT_CONTRA')),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('liability', 'expense', 'asset_memo', 'contra')),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'VND', 'EUR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
  CONSTRAINT uq_fin_accounts_org_code_ccy UNIQUE (organization_id, code, currency)
);
CREATE INDEX IF NOT EXISTS idx_fin_accounts_org ON public.financial_accounts(organization_id);

-- ------------------------------------------------------------------------------
-- 2. ledger_transactions — append-only journal header
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('liability_recognition', 'payment_attestation', 'reversal', 'adjustment')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'reversed', 'failed', 'cancelled')),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'VND', 'EUR')),
  total_minor BIGINT NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('reward', 'payment_record', 'adjustment', 'manual')),
  source_id UUID,
  reverses_transaction_id UUID REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  idempotency_key TEXT UNIQUE,
  memo TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_ledger_txn_org ON public.ledger_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ledger_txn_status ON public.ledger_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ledger_txn_source ON public.ledger_transactions(source_type, source_id);

-- ------------------------------------------------------------------------------
-- 3. ledger_entries — balanced debit/credit lines (immutable once posted)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.ledger_transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'VND', 'EUR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_txn ON public.ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON public.ledger_entries(account_id);

-- ------------------------------------------------------------------------------
-- 4. Balance + posting guards (defense in depth; app layer validates first)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_ledger_balance()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_debits BIGINT;
  v_credits BIGINT;
BEGIN
  SELECT status INTO v_status FROM public.ledger_transactions WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
  IF v_status = 'posted' THEN
    SELECT COALESCE(SUM(amount_minor) FILTER (WHERE side = 'debit'), 0),
           COALESCE(SUM(amount_minor) FILTER (WHERE side = 'credit'), 0)
      INTO v_debits, v_credits
      FROM public.ledger_entries
      WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id);
    IF v_debits IS DISTINCT FROM v_credits OR COALESCE(v_debits, 0) <= 0 THEN
      RAISE EXCEPTION 'IMBALANCE: posted transaction must balance debits = credits > 0 (Dr=% Cr=%).', v_debits, v_credits;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_ledger_balance_guard ON public.ledger_entries;
CREATE TRIGGER trg_ledger_balance_guard
AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_balance();

CREATE OR REPLACE FUNCTION public.guard_ledger_posting()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_debits BIGINT;
  v_credits BIGINT;
  v_ccys TEXT[];
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT COALESCE(SUM(amount_minor) FILTER (WHERE side = 'debit'), 0),
           COALESCE(SUM(amount_minor) FILTER (WHERE side = 'credit'), 0),
           array_agg(DISTINCT currency)
      INTO v_debits, v_credits, v_ccys
      FROM public.ledger_entries
      WHERE transaction_id = NEW.id;
    IF v_debits IS DISTINCT FROM v_credits OR COALESCE(v_debits, 0) <= 0 THEN
      RAISE EXCEPTION 'IMBALANCE: cannot post unbalanced transaction % (Dr=% Cr=%).', NEW.id, v_debits, v_credits;
    END IF;
    IF array_length(v_ccys, 1) IS DISTINCT FROM 1 OR v_ccys[1] IS DISTINCT FROM NEW.currency THEN
      RAISE EXCEPTION 'CURRENCY_MISMATCH: transaction % lines must share one currency.', NEW.id;
    END IF;
    NEW.posted_at := timezone('utc'::text, now());
    NEW.total_minor := v_debits;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ledger_posting_guard ON public.ledger_transactions;
CREATE TRIGGER trg_ledger_posting_guard
BEFORE UPDATE ON public.ledger_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_posting();

-- ------------------------------------------------------------------------------
-- 5. reward_ledger_links — one liability record per SP4 reward (adapter, read-only w.r.t. SP4)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_ledger_links (
  reward_id UUID PRIMARY KEY REFERENCES public.rewards(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE RESTRICT,
  outcome_id UUID REFERENCES public.challenge_outcomes(id) ON DELETE RESTRICT,
  liability_transaction_id UUID REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  reward_status_snapshot TEXT NOT NULL,
  financial_stage TEXT NOT NULL CHECK (financial_stage IN ('planned_estimate', 'payable_recognized', 'payment_attested', 'paid_verified', 'closed_no_liability')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_reward_links_org ON public.reward_ledger_links(organization_id);

-- ------------------------------------------------------------------------------
-- 6. payment_records — authoritative evidence rows (record-only, never executes transfers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'VND', 'EUR')),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('simulated_statement', 'manual_attestation', 'bank_record')),
  external_ref TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_payment_records_reward ON public.payment_records(reward_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_org ON public.payment_records(organization_id);

-- ------------------------------------------------------------------------------
-- 7. financial_adjustments — maker/checker corrections (post via reversing entries)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  target_transaction_id UUID REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 10),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'posted', 'rejected', 'cancelled')),
  proposed_currency TEXT NOT NULL CHECK (proposed_currency IN ('USD', 'VND', 'EUR')),
  idempotency_key TEXT UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  posted_transaction_id UUID REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
  CONSTRAINT chk_adjustment_sod CHECK (created_by IS DISTINCT FROM reviewed_by)
);
CREATE INDEX IF NOT EXISTS idx_fin_adjustments_org ON public.financial_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_adjustments_status ON public.financial_adjustments(status);

-- ------------------------------------------------------------------------------
-- 8. reconciliation_runs / reconciliation_items — repeatable, read-only runs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'completed_with_issues', 'failed')),
  rewards_examined INTEGER NOT NULL DEFAULT 0,
  transactions_examined INTEGER NOT NULL DEFAULT 0,
  payments_examined INTEGER NOT NULL DEFAULT 0,
  issues_open INTEGER NOT NULL DEFAULT 0,
  issues_resolved INTEGER NOT NULL DEFAULT 0,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_recon_runs_org ON public.reconciliation_runs(organization_id);

CREATE TABLE IF NOT EXISTS public.reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK (code IN ('REWARD_WITHOUT_LEDGER', 'DUPLICATE_SOURCE_REF', 'LEDGER_WITHOUT_SOURCE', 'IMBALANCE', 'CURRENCY_MISMATCH', 'AMOUNT_MISMATCH', 'INVALID_STATUS_TRANSITION', 'PAID_WITHOUT_EVIDENCE', 'RESOLVED_PREVIOUSLY')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'resolved', 'acknowledged')),
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.ledger_transactions(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payment_records(id) ON DELETE SET NULL,
  expected_minor BIGINT,
  actual_minor BIGINT,
  currency TEXT CHECK (currency IN ('USD', 'VND', 'EUR')),
  detail TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_recon_items_run ON public.reconciliation_items(run_id);
CREATE INDEX IF NOT EXISTS idx_recon_items_fp ON public.reconciliation_items(fingerprint);
CREATE INDEX IF NOT EXISTS idx_recon_items_state ON public.reconciliation_items(state);

-- ------------------------------------------------------------------------------
-- 9. financial_audit_events — append-only audit trail
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ledger_transaction', 'ledger_entry', 'adjustment', 'payment_record', 'reconciliation_run', 'reward_link')),
  entity_id TEXT NOT NULL,
  detail TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_fin_audit_org ON public.financial_audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_audit_created ON public.financial_audit_events(created_at DESC);

-- ------------------------------------------------------------------------------
-- 10. RLS — org isolation; writes restricted to org owners + admins.
-- ------------------------------------------------------------------------------
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_ledger_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_accounts_select" ON public.financial_accounts;
CREATE POLICY "fin_accounts_select" ON public.financial_accounts FOR SELECT TO authenticated
USING (public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "ledger_txn_select" ON public.ledger_transactions;
CREATE POLICY "ledger_txn_select" ON public.ledger_transactions FOR SELECT TO authenticated
USING (public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "ledger_entries_select" ON public.ledger_entries;
CREATE POLICY "ledger_entries_select" ON public.ledger_entries FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.ledger_transactions t WHERE t.id = ledger_entries.transaction_id
          AND (public.is_org_member(t.organization_id) OR public.is_admin()))
);

DROP POLICY IF EXISTS "reward_links_select" ON public.reward_ledger_links;
CREATE POLICY "reward_links_select" ON public.reward_ledger_links FOR SELECT TO authenticated
USING (public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "payment_records_select" ON public.payment_records;
CREATE POLICY "payment_records_select" ON public.payment_records FOR SELECT TO authenticated
USING (public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "fin_adjustments_select" ON public.financial_adjustments;
CREATE POLICY "fin_adjustments_select" ON public.financial_adjustments FOR SELECT TO authenticated
USING (public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "recon_runs_select" ON public.reconciliation_runs;
CREATE POLICY "recon_runs_select" ON public.reconciliation_runs FOR SELECT TO authenticated
USING (organization_id IS NULL AND public.is_admin() OR public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "recon_items_select" ON public.reconciliation_items;
CREATE POLICY "recon_items_select" ON public.reconciliation_items FOR SELECT TO authenticated
USING (organization_id IS NULL AND public.is_admin() OR public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "fin_audit_select" ON public.financial_audit_events;
CREATE POLICY "fin_audit_select" ON public.financial_audit_events FOR SELECT TO authenticated
USING (organization_id IS NULL AND public.is_admin() OR public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "fin_accounts_write" ON public.financial_accounts;
CREATE POLICY "fin_accounts_write" ON public.financial_accounts FOR INSERT TO authenticated
WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "ledger_txn_insert" ON public.ledger_transactions;
CREATE POLICY "ledger_txn_insert" ON public.ledger_transactions FOR INSERT TO authenticated
WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "ledger_txn_update" ON public.ledger_transactions;
CREATE POLICY "ledger_txn_update" ON public.ledger_transactions FOR UPDATE TO authenticated
USING (public.is_org_owner(organization_id) OR public.is_admin())
WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "ledger_entries_insert" ON public.ledger_entries;
CREATE POLICY "ledger_entries_insert" ON public.ledger_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.ledger_transactions t WHERE t.id = ledger_entries.transaction_id
          AND (public.is_org_owner(t.organization_id) OR public.is_admin()))
);

DROP POLICY IF EXISTS "payment_records_insert" ON public.payment_records;
CREATE POLICY "payment_records_insert" ON public.payment_records FOR INSERT TO authenticated
WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "fin_adjustments_insert" ON public.financial_adjustments;
CREATE POLICY "fin_adjustments_insert" ON public.financial_adjustments FOR INSERT TO authenticated
WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "fin_adjustments_update" ON public.financial_adjustments;
CREATE POLICY "fin_adjustments_update" ON public.financial_adjustments FOR UPDATE TO authenticated
USING (public.is_org_owner(organization_id) OR public.is_admin())
WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "recon_runs_insert" ON public.reconciliation_runs;
CREATE POLICY "recon_runs_insert" ON public.reconciliation_runs FOR INSERT TO authenticated
WITH CHECK (organization_id IS NULL AND public.is_admin() OR public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "recon_items_insert" ON public.reconciliation_items;
CREATE POLICY "recon_items_insert" ON public.reconciliation_items FOR INSERT TO authenticated
WITH CHECK (organization_id IS NULL AND public.is_admin() OR public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "recon_items_update" ON public.reconciliation_items;
CREATE POLICY "recon_items_update" ON public.reconciliation_items FOR UPDATE TO authenticated
USING (public.is_org_owner(organization_id) OR public.is_admin())
WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

-- Append-only: no client deletes on any financial table.
REVOKE DELETE, TRUNCATE ON TABLE
  public.financial_accounts, public.ledger_transactions, public.ledger_entries,
  public.reward_ledger_links, public.payment_records, public.financial_adjustments,
  public.reconciliation_runs, public.reconciliation_items, public.financial_audit_events
FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 11. Grants (least privilege; service_role bypasses RLS for server writes)
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE
  public.financial_accounts, public.ledger_transactions, public.ledger_entries,
  public.reward_ledger_links, public.payment_records, public.financial_adjustments,
  public.reconciliation_runs, public.reconciliation_items, public.financial_audit_events
TO authenticated;
GRANT INSERT, UPDATE ON TABLE
  public.financial_accounts, public.ledger_transactions, public.ledger_entries,
  public.payment_records, public.financial_adjustments,
  public.reconciliation_runs, public.reconciliation_items
TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
