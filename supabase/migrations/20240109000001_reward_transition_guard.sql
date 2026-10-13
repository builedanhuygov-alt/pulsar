-- ==============================================================================
-- PULSAR SP8A.1: Reward/Outcome transition guard (database enforcement)
-- File: supabase/migrations/20240109000001_reward_transition_guard.sql
-- Depends: 20240104000000_create_outcome_reward_engine.sql (rewards/outcomes).
-- Run AFTER all SP1–SP7 migrations. Idempotent, single transaction,
-- NO data deletion, NO Cloud auto-apply (DBA applies manually).
--
-- Mirrors lib/outcome/outcomeRewardService.ts REWARD_TRANSITIONS in SQL so the
-- matrix holds even for writers that bypass the app layer, with one deliberate
-- layering difference (SP8A.2 review decision):
--   APP ordinary path: paid is TERMINAL (updateRewardStatus rejects all exits).
--   DB whitelist below: paid -> processing is PERMITTED, and it is the ONLY
--   edge the app may use through the dedicated, audited
--   requestRewardReprocessing() workflow (owner/admin + non-recipient +
--   reason >= 15 chars + explicit REPROCESSING history entry).
-- Rationale: PostgreSQL cannot distinguish "ordinary flip" from "audited
-- reprocessing" by caller; the DB keeps a coarse whitelist (fail-closed for
-- everything else) while the app restricts the paid->processing edge to the
-- audited workflow. failed/cancelled are terminal in BOTH layers.
--   planned          -> pending_approval | cancelled
--   pending_approval -> approved | cancelled
--   approved         -> processing | cancelled
--   processing       -> paid | failed | cancelled
--   paid             -> processing (audited reprocessing ONLY — see above)
--   failed/cancelled -> terminal
-- Notes:
--  - `paid` set here is OPERATOR-ATTESTED paid, never proof of settlement.
--    Verified-paid (authoritative payment evidence) is enforced at the app
--    layer (payment_records + reconciliation); the database cannot verify
--    external money movement, and this migration does not pretend otherwise.
--  - challenge_outcomes.status is insert-only in practice: this guard freezes
--    finalized/cancelled outcomes and only permits proposed -> finalized|cancelled.
--
-- ROLLBACK GUIDANCE (do NOT execute automatically):
--    DROP TRIGGER IF EXISTS trg_rewards_status_guard ON public.rewards;
--    DROP TRIGGER IF EXISTS trg_outcomes_status_guard ON public.challenge_outcomes;
--    DROP FUNCTION IF EXISTS public.guard_reward_status_transition();
--    DROP FUNCTION IF EXISTS public.guard_outcome_status_freeze();
-- ==============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards') THEN
    RAISE EXCEPTION 'SP4 base migration missing: public.rewards not found. Apply 20240104000000 first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_reward_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_allowed TEXT[];
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW; -- idempotent no-op
  END IF;
  v_allowed := CASE OLD.status
    WHEN 'planned' THEN ARRAY['pending_approval', 'cancelled']
    WHEN 'pending_approval' THEN ARRAY['approved', 'cancelled']
    WHEN 'approved' THEN ARRAY['processing', 'cancelled']
    WHEN 'processing' THEN ARRAY['paid', 'failed', 'cancelled']
    WHEN 'paid' THEN ARRAY['processing']
    ELSE ARRAY[]::TEXT[]
  END;
  IF NOT (NEW.status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Reward transition not allowed: % -> %. Paid via this path is attested-only, never settlement proof.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rewards_status_guard ON public.rewards;
CREATE TRIGGER trg_rewards_status_guard
BEFORE UPDATE OF status ON public.rewards
FOR EACH ROW EXECUTE FUNCTION public.guard_reward_status_transition();

CREATE OR REPLACE FUNCTION public.guard_outcome_status_freeze()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'proposed' AND NEW.status IN ('finalized', 'cancelled') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Outcome status is immutable once %. Corrections use adjustments, not edits.', OLD.status;
END $$;

DROP TRIGGER IF EXISTS trg_outcomes_status_guard ON public.challenge_outcomes;
CREATE TRIGGER trg_outcomes_status_guard
BEFORE UPDATE OF status ON public.challenge_outcomes
FOR EACH ROW EXECUTE FUNCTION public.guard_outcome_status_freeze();

NOTIFY pgrst, 'reload schema';

COMMIT;
