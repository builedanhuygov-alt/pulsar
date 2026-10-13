-- ==============================================================================
-- PULSAR Sprint 4: Outcome & Reward Engine Schema, Triggers & RLS Policies
-- File: supabase/migrations/20240104000000_create_outcome_reward_engine.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CHALLENGE OUTCOMES TABLE
-- Ghi nhận quyết định chốt kết quả challenge, người thắng cuộc và ngân sách giải thưởng
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    has_winner BOOLEAN NOT NULL DEFAULT true,
    winning_submission_id UUID REFERENCES public.submissions(id) ON DELETE RESTRICT,
    winner_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    final_score NUMERIC(5, 2) CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 100)),
    awarded_prize_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (awarded_prize_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND', 'EUR')),
    decided_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    decision_reason TEXT NOT NULL CHECK (char_length(trim(decision_reason)) >= 15),
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'finalized', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),

    -- Consistency constraints
    CONSTRAINT chk_winner_consistency CHECK (
        (has_winner = true AND winning_submission_id IS NOT NULL AND winner_id IS NOT NULL) OR
        (has_winner = false AND winning_submission_id IS NULL AND winner_id IS NULL AND awarded_prize_amount = 0)
    ),
    -- One active outcome per challenge
    CONSTRAINT uq_challenge_outcomes_challenge UNIQUE (challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_challenge ON public.challenge_outcomes(challenge_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_org ON public.challenge_outcomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_winner ON public.challenge_outcomes(winner_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_status ON public.challenge_outcomes(status);

-- ------------------------------------------------------------------------------
-- 2. REWARDS TABLE
-- Quản lý giải thưởng và tiến độ giải ngân (Disbursement)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outcome_id UUID NOT NULL REFERENCES public.challenge_outcomes(id) ON DELETE RESTRICT,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND', 'EUR')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
        'planned',
        'pending_approval',
        'approved',
        'processing',
        'paid',
        'failed',
        'cancelled'
    )),
    disbursement_method TEXT NOT NULL DEFAULT 'mock_escrow_adapter' CHECK (disbursement_method IN (
        'manual_bank_wire',
        'mock_escrow_adapter',
        'crypto_transfer',
        'corporate_invoice'
    )),
    is_mock_disbursement BOOLEAN NOT NULL DEFAULT true,
    reference_code TEXT NOT NULL UNIQUE,
    notes TEXT,
    disbursed_at TIMESTAMPTZ,
    disbursed_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_rewards_outcome UNIQUE (outcome_id)
);

CREATE INDEX IF NOT EXISTS idx_rewards_outcome ON public.rewards(outcome_id);
CREATE INDEX IF NOT EXISTS idx_rewards_recipient ON public.rewards(recipient_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON public.rewards(status);
CREATE INDEX IF NOT EXISTS idx_rewards_reference ON public.rewards(reference_code);

-- ------------------------------------------------------------------------------
-- 3. REWARD STATUS HISTORY TABLE (Audit Trail)
-- Ghi lại mọi lần chuyển trạng thái giải thưởng
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
    previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN (
        'planned', 'pending_approval', 'approved', 'processing', 'paid', 'failed', 'cancelled'
    )),
    new_status TEXT NOT NULL CHECK (new_status IN (
        'planned', 'pending_approval', 'approved', 'processing', 'paid', 'failed', 'cancelled'
    )),
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_reward_status_history_reward ON public.reward_status_history(reward_id);
CREATE INDEX IF NOT EXISTS idx_reward_status_history_date ON public.reward_status_history(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. VERIFIED PORTFOLIO ITEMS TABLE
-- Hồ sơ năng lực thực tế có xác thực điện tử cho Creator đạt giải / hoàn thành
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verified_portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    outcome_id UUID NOT NULL REFERENCES public.challenge_outcomes(id) ON DELETE CASCADE,
    verified_by_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    case_study_summary TEXT NOT NULL CHECK (char_length(trim(case_study_summary)) >= 20),
    role_description TEXT NOT NULL DEFAULT 'Lead Solution Architect',
    skills_acquired TEXT[] NOT NULL DEFAULT '{}',
    case_study_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT true,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_portfolio_creator_challenge UNIQUE (creator_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolios_creator ON public.verified_portfolios(creator_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_public ON public.verified_portfolios(is_public) WHERE is_public = true;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION & TRIGGER: SEPARATION OF DUTIES & OUTCOME FINALIZATION
-- Không cho phép người tạo challenge tự duyệt nếu không có phân quyền hợp lệ.
-- Khi finalize outcome: cập nhật status của challenge sang 'closed',
-- cập nhật status của submission thắng sang 'accepted', các submission khác sang 'rejected'/'closed',
-- tự động sinh reward và verified portfolio record.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_challenge_outcome_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_challenge RECORD;
    v_submission RECORD;
    v_is_admin BOOLEAN;
    v_reward_id UUID;
    v_ref_code TEXT;
BEGIN
    -- Lấy thông tin challenge
    SELECT id, created_by, organization_id, status, title, slug, prize_pool, currency
    INTO v_challenge
    FROM public.challenges
    WHERE id = NEW.challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge with id % not found', NEW.challenge_id;
    END IF;

    -- Kiểm tra challenge phải thuộc organization của outcome
    IF v_challenge.organization_id != NEW.organization_id THEN
        RAISE EXCEPTION 'Outcome organization does not match challenge organization';
    END IF;

    -- Lấy role của người ra quyết định (SP8A.2: roles live in user_roles,
    -- NOT profiles — the old profiles.role reference errored on every write)
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = NEW.decided_by AND role = 'admin'
    ) INTO v_is_admin;

    -- Phân tách nhiệm vụ (Separation of Duties):
    -- Người tạo challenge không được tự chốt kết quả trừ khi là Super Admin hoặc là Business Owner
    IF v_challenge.created_by = NEW.decided_by AND NOT v_is_admin THEN
        -- Kiểm tra xem người này có quyền owner trong org không (SP8A.2: column
        -- is membership_role, NOT role — the old predicate errored)
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_id = NEW.organization_id
              AND user_id = NEW.decided_by
              AND membership_role = 'owner'
        ) THEN
            RAISE EXCEPTION 'Separation of Duties violation: Challenge creator cannot approve outcome without organization owner role or admin privileges.';
        END IF;
    END IF;

    -- Nếu có người thắng: kiểm tra submission phải thuộc về challenge này
    IF NEW.has_winner THEN
        SELECT id, challenge_id, submitted_by, status, title
        INTO v_submission
        FROM public.submissions
        WHERE id = NEW.winning_submission_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Winning submission not found';
        END IF;

        IF v_submission.challenge_id != NEW.challenge_id THEN
            RAISE EXCEPTION 'Winning submission does not belong to the target challenge';
        END IF;

        IF v_submission.submitted_by != NEW.winner_id THEN
            RAISE EXCEPTION 'Winner ID does not match the creator of winning submission';
        END IF;

        IF v_submission.status NOT IN ('submitted', 'under_review', 'shortlisted') THEN
            RAISE EXCEPTION 'Submission status "%" is not eligible for winning selection', v_submission.status;
        END IF;
    END IF;

    -- Khi chuyển sang finalized
    IF NEW.status = 'finalized' AND (OLD IS NULL OR OLD.status != 'finalized') THEN
        -- Đóng challenge
        UPDATE public.challenges
        SET status = 'closed',
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.challenge_id;

        IF NEW.has_winner THEN
            -- Chấp thuận submission thắng
            UPDATE public.submissions
            SET status = 'accepted',
                updated_at = timezone('utc'::text, now())
            WHERE id = NEW.winning_submission_id;

            -- Tạo phần thưởng Reward (nếu chưa có)
            v_ref_code := 'RWD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
            
            INSERT INTO public.rewards (
                outcome_id,
                challenge_id,
                organization_id,
                recipient_id,
                amount,
                currency,
                status,
                disbursement_method,
                is_mock_disbursement,
                reference_code,
                notes
            )
            VALUES (
                NEW.id,
                NEW.challenge_id,
                NEW.organization_id,
                NEW.winner_id,
                NEW.awarded_prize_amount,
                NEW.currency,
                'planned',
                'mock_escrow_adapter',
                true,
                v_ref_code,
                'Generated automatically upon outcome finalization.'
            )
            RETURNING id INTO v_reward_id;

            -- Ghi status history ban đầu
            INSERT INTO public.reward_status_history (
                reward_id,
                previous_status,
                new_status,
                changed_by,
                reason
            )
            VALUES (
                v_reward_id,
                NULL,
                'planned',
                NEW.decided_by,
                'Initial creation via outcome finalization'
            );

            -- Tạo Portfolio Record đã xác minh cho Creator
            INSERT INTO public.verified_portfolios (
                creator_id,
                challenge_id,
                submission_id,
                outcome_id,
                verified_by_org_id,
                case_study_summary,
                role_description,
                skills_acquired,
                case_study_metrics,
                is_public,
                is_verified,
                verified_at
            )
            VALUES (
                NEW.winner_id,
                NEW.challenge_id,
                NEW.winning_submission_id,
                NEW.id,
                NEW.organization_id,
                'Chiến thắng đề bài: ' || v_challenge.title || '. Giải pháp đã được Doanh nghiệp thẩm định và nghiệm thu.',
                'Lead Solution Architect',
                ARRAY['Problem Solving', 'Enterprise Architecture', 'Fullstack Delivery'],
                jsonb_build_object(
                    'final_score', coalesce(NEW.final_score, 100),
                    'awarded_prize', NEW.awarded_prize_amount,
                    'currency', NEW.currency
                ),
                true,
                true,
                timezone('utc'::text, now())
            )
            ON CONFLICT (creator_id, challenge_id) DO NOTHING;
        END IF;
    END IF;

    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_outcome_transition ON public.challenge_outcomes;
CREATE TRIGGER trg_challenge_outcome_transition
    BEFORE INSERT OR UPDATE ON public.challenge_outcomes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_challenge_outcome_transition();

-- ------------------------------------------------------------------------------
-- 6. FUNCTION & TRIGGER: REWARD AUDIT TRAIL & STATUS TRANSITIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_reward_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Ghi log lịch sử thay đổi trạng thái
        INSERT INTO public.reward_status_history (
            reward_id,
            previous_status,
            new_status,
            changed_by,
            reason
        )
        VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            coalesce(NEW.disbursed_by, auth.uid()),
            NEW.notes
        );

        -- Khi sang status 'paid', bắt buộc ghi nhận timestamp
        IF NEW.status = 'paid' AND NEW.disbursed_at IS NULL THEN
            NEW.disbursed_at = timezone('utc'::text, now());
            IF NEW.disbursed_by IS NULL THEN
                NEW.disbursed_by = auth.uid();
            END IF;
        END IF;
    END IF;

    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_status_update ON public.rewards;
CREATE TRIGGER trg_reward_status_update
    BEFORE UPDATE ON public.rewards
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_reward_status_update();

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.challenge_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_portfolios ENABLE ROW LEVEL SECURITY;

-- challenge_outcomes:
-- Mọi người (authenticated & anon) được xem outcome đã finalized
CREATE POLICY "outcomes_select_public_when_finalized"
    ON public.challenge_outcomes FOR SELECT
    USING (status = 'finalized');

-- Thành viên tổ chức hoặc Admin được xem mọi outcome của tổ chức mình
CREATE POLICY "outcomes_select_org_member_or_admin"
    ON public.challenge_outcomes FOR SELECT
    TO authenticated
    USING (
        public.is_admin() OR
        public.is_org_member(organization_id, auth.uid())
    );

-- Chỉ thành viên có quyền (manager/owner) trong tổ chức hoặc Admin mới được tạo outcome
CREATE POLICY "outcomes_insert_org_manager_or_admin"
    ON public.challenge_outcomes FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_id
              AND om.user_id = auth.uid()
              AND om.membership_role = 'owner'
        )
    );

-- Chỉ thành viên có quyền trong tổ chức hoặc Admin mới được sửa outcome (khi chưa finalized)
CREATE POLICY "outcomes_update_org_manager_or_admin"
    ON public.challenge_outcomes FOR UPDATE
    TO authenticated
    USING (
        (public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_id
              AND om.user_id = auth.uid()
              AND om.membership_role = 'owner'
        )) AND status != 'finalized'
    )
    WITH CHECK (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_id
              AND om.user_id = auth.uid()
              AND om.membership_role = 'owner'
        )
    );

-- rewards:
-- Người nhận giải (recipient) được xem giải thưởng của mình
CREATE POLICY "rewards_select_recipient"
    ON public.rewards FOR SELECT
    TO authenticated
    USING (recipient_id = auth.uid());

-- Doanh nghiệp và Super Admin được xem các khoản thưởng thuộc tổ chức
CREATE POLICY "rewards_select_org_or_admin"
    ON public.rewards FOR SELECT
    TO authenticated
    USING (
        public.is_admin() OR
        public.is_org_member(organization_id, auth.uid())
    );

-- Cập nhật trạng thái giải thưởng: chỉ Business Owner/Manager hoặc Admin
CREATE POLICY "rewards_update_org_manager_or_admin"
    ON public.rewards FOR UPDATE
    TO authenticated
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_id
              AND om.user_id = auth.uid()
              AND om.membership_role = 'owner'
        )
    )
    WITH CHECK (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_id
              AND om.user_id = auth.uid()
              AND om.membership_role = 'owner'
        )
    );

-- verified_portfolios:
-- Công khai xem các portfolio công khai
CREATE POLICY "portfolios_select_public"
    ON public.verified_portfolios FOR SELECT
    USING (is_public = true);

-- Creator xem tất cả portfolio của mình (cả private)
CREATE POLICY "portfolios_select_owner"
    ON public.verified_portfolios FOR SELECT
    TO authenticated
    USING (creator_id = auth.uid());

-- Creator có thể cập nhật trạng thái hiển thị (is_public)
CREATE POLICY "portfolios_update_owner"
    ON public.verified_portfolios FOR UPDATE
    TO authenticated
    USING (creator_id = auth.uid())
    WITH CHECK (creator_id = auth.uid());

-- Quyền EXECUTE các hàm mới
REVOKE EXECUTE ON FUNCTION public.handle_challenge_outcome_transition() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_reward_status_update() FROM PUBLIC, anon;

COMMIT;
