-- ==============================================================================
-- PULSAR Sprint 5: Trust, Reputation, Skill Evidence & Analytics Schema
-- File: supabase/migrations/20240105000000_create_reputation_analytics_engine.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. STANDARDIZED SKILLS DIRECTORY
-- Danh mục kỹ năng chuẩn hóa theo nhóm (categories)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_taxonomies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    category TEXT NOT NULL CHECK (category IN (
        'ai_machine_learning',
        'blockchain_web3',
        'cloud_devops',
        'software_architecture',
        'security_compliance',
        'data_engineering',
        'frontend_mobile',
        'domain_expertise'
    )),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_skill_taxonomies_category ON public.skill_taxonomies(category);
CREATE INDEX IF NOT EXISTS idx_skill_taxonomies_slug ON public.skill_taxonomies(slug);

-- ------------------------------------------------------------------------------
-- 2. CREATOR SKILLS & EVIDENCE GRAPH
-- Liên kết Creator với kỹ năng và bằng chứng xác thực (evidence-backed)
-- Trạng thái: self_declared | evidence_submitted | verified | rejected
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skill_taxonomies(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'self_declared' CHECK (status IN (
        'self_declared',
        'evidence_submitted',
        'verified',
        'rejected'
    )),
    evidence_type TEXT CHECK (evidence_type IS NULL OR evidence_type IN (
        'challenge_outcome',
        'submission_benchmark',
        'verified_portfolio',
        'third_party_credential'
    )),
    evidence_challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
    evidence_submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
    evidence_portfolio_id UUID REFERENCES public.verified_portfolios(id) ON DELETE SET NULL,
    evidence_notes TEXT,
    verified_by_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),

    CONSTRAINT uq_creator_skills_unique UNIQUE (creator_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_skills_creator ON public.creator_skills(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_skills_status ON public.creator_skills(status);
CREATE INDEX IF NOT EXISTS idx_creator_skills_skill ON public.creator_skills(skill_id);

-- ------------------------------------------------------------------------------
-- 3. REPUTATION PROFILES (IMMUTABLE SCORE AGGREGATION)
-- Điểm uy tín được tính toán dựa trên dữ liệu có nguồn gốc (provenance-backed).
-- Người dùng KHÔNG được phép tự cập nhật các cột score này.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_reputation_profiles (
    creator_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_challenges_participated INT NOT NULL DEFAULT 0 CHECK (total_challenges_participated >= 0),
    total_submissions_submitted INT NOT NULL DEFAULT 0 CHECK (total_submissions_submitted >= 0),
    total_submissions_accepted INT NOT NULL DEFAULT 0 CHECK (total_submissions_accepted >= 0),
    total_verified_outcomes INT NOT NULL DEFAULT 0 CHECK (total_verified_outcomes >= 0),
    on_time_delivery_count INT NOT NULL DEFAULT 0 CHECK (on_time_delivery_count >= 0),
    on_time_delivery_rate NUMERIC(5, 2) CHECK (on_time_delivery_rate IS NULL OR (on_time_delivery_rate >= 0 AND on_time_delivery_rate <= 100)),
    weighted_review_score_avg NUMERIC(5, 2) CHECK (weighted_review_score_avg IS NULL OR (weighted_review_score_avg >= 0 AND weighted_review_score_avg <= 100)),
    verified_skills_count INT NOT NULL DEFAULT 0 CHECK (verified_skills_count >= 0),
    confirmed_collaborations_count INT NOT NULL DEFAULT 0 CHECK (confirmed_collaborations_count >= 0),
    composite_reputation_score NUMERIC(5, 2) CHECK (composite_reputation_score IS NULL OR (composite_reputation_score >= 0 AND composite_reputation_score <= 100)),
    reputation_tier TEXT NOT NULL DEFAULT 'insufficient_data' CHECK (reputation_tier IN (
        'insufficient_data',
        'emerging',
        'verified_talent',
        'top_contributor',
        'elite_innovator'
    )),
    score_explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT true,
    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

-- ------------------------------------------------------------------------------
-- 4. ORGANIZATION REPUTATION PROFILES
-- Uy tín tổ chức dựa trên tỷ lệ giải ngân, thanh toán đúng hạn và mức độ hài lòng
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_reputation_profiles (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    total_challenges_created INT NOT NULL DEFAULT 0 CHECK (total_challenges_created >= 0),
    total_challenges_finalized INT NOT NULL DEFAULT 0 CHECK (total_challenges_finalized >= 0),
    total_prizes_allocated NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_prizes_allocated >= 0),
    total_prizes_disbursed NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_prizes_disbursed >= 0),
    disbursement_rate_percent NUMERIC(5, 2) CHECK (disbursement_rate_percent IS NULL OR (disbursement_rate_percent >= 0 AND disbursement_rate_percent <= 100)),
    avg_review_turnaround_days NUMERIC(6, 2) CHECK (avg_review_turnaround_days IS NULL OR avg_review_turnaround_days >= 0),
    escrow_fidelity_score NUMERIC(5, 2) CHECK (escrow_fidelity_score IS NULL OR (escrow_fidelity_score >= 0 AND escrow_fidelity_score <= 100)),
    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

-- ------------------------------------------------------------------------------
-- 5. INTEGRITY & FRAUD SIGNALS TABLE
-- Lưu trữ các cảnh báo bất thường theo quy tắc minh bạch, có thể giải thích
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integrity_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_type TEXT NOT NULL CHECK (signal_type IN (
        'identical_feedback_pattern',
        'score_anomaly_spike',
        'rapid_successive_submissions',
        'correlated_account_cluster',
        'state_machine_transition_irregularity',
        'disbursement_mismatch'
    )),
    severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('submission', 'review', 'challenge', 'user', 'organization')),
    target_entity_id UUID NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    detection_rule_name TEXT NOT NULL,
    explanation TEXT NOT NULL CHECK (char_length(trim(explanation)) >= 10),
    supporting_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status TEXT NOT NULL DEFAULT 'open' CHECK (review_status IN ('open', 'under_investigation', 'dismissed', 'resolved')),
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_integrity_signals_severity ON public.integrity_signals(severity);
CREATE INDEX IF NOT EXISTS idx_integrity_signals_status ON public.integrity_signals(review_status);
CREATE INDEX IF NOT EXISTS idx_integrity_signals_target ON public.integrity_signals(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_integrity_signals_org ON public.integrity_signals(organization_id);

-- ------------------------------------------------------------------------------
-- 6. AUDIT TRIGGER FOR SKILL VERIFICATION & FRAUD SIGNAL HANDLING
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_creator_skill_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Chỉ cho phép verified nếu có người xác thực hợp lệ
    IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
        IF NEW.verified_by_user_id IS NULL AND NEW.verified_by_org_id IS NULL THEN
            RAISE EXCEPTION 'Skill verification requires verified_by_user_id or verified_by_org_id.';
        END IF;
        NEW.verified_at = timezone('utc'::text, now());
    END IF;

    -- Không cho phép Creator tự gán status verified cho chính mình
    IF NEW.status = 'verified' AND NEW.creator_id = auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Creator cannot self-verify their own skills.';
    END IF;

    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creator_skill_verification ON public.creator_skills;
CREATE TRIGGER trg_creator_skill_verification
    BEFORE UPDATE ON public.creator_skills
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_creator_skill_verification();

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.skill_taxonomies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_reputation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_reputation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_signals ENABLE ROW LEVEL SECURITY;

-- skill_taxonomies: Read-only cho tất cả người dùng
CREATE POLICY "skills_select_all"
    ON public.skill_taxonomies FOR SELECT
    USING (true);

-- creator_skills:
-- Public nếu is_public = true, hoặc chính creator, hoặc admin
CREATE POLICY "creator_skills_select"
    ON public.creator_skills FOR SELECT
    USING (
        is_public = true OR
        creator_id = auth.uid() OR
        public.is_admin()
    );

-- Creator có thể insert kỹ năng tự khai báo
CREATE POLICY "creator_skills_insert_owner"
    ON public.creator_skills FOR INSERT
    TO authenticated
    WITH CHECK (
        creator_id = auth.uid() AND
        status IN ('self_declared', 'evidence_submitted')
    );

-- Creator có thể update kỹ năng của mình nhưng KHÔNG thể tự set status sang 'verified'
CREATE POLICY "creator_skills_update_owner"
    ON public.creator_skills FOR UPDATE
    TO authenticated
    USING (creator_id = auth.uid())
    WITH CHECK (
        creator_id = auth.uid() AND
        status IN ('self_declared', 'evidence_submitted')
    );

-- Doanh nghiệp hoặc Admin có thể verify kỹ năng
CREATE POLICY "creator_skills_update_verifier"
    ON public.creator_skills FOR UPDATE
    TO authenticated
    USING (
        public.is_admin() OR
        (verified_by_org_id IS NOT NULL AND public.is_org_member(verified_by_org_id, auth.uid()))
    )
    WITH CHECK (
        public.is_admin() OR
        (verified_by_org_id IS NOT NULL AND public.is_org_member(verified_by_org_id, auth.uid()))
    );

-- creator_reputation_profiles:
-- Public có thể xem profile nếu is_public = true, hoặc chính creator
CREATE POLICY "reputation_select"
    ON public.creator_reputation_profiles FOR SELECT
    USING (
        is_public = true OR
        creator_id = auth.uid() OR
        public.is_admin()
    );

-- Ngăn chặn người dùng tự sửa điểm uy tín (Chỉ service_role hoặc database internal trigger)
-- Không cấp quyền INSERT/UPDATE trực tiếp cho authenticated role!

-- organization_reputation_profiles:
-- Thành viên của org hoặc Admin được xem
CREATE POLICY "org_reputation_select"
    ON public.organization_reputation_profiles FOR SELECT
    USING (
        public.is_admin() OR
        public.is_org_member(organization_id, auth.uid())
    );

-- integrity_signals:
-- CHỈ Admin hoặc thành viên quản trị của tổ chức liên quan mới được xem cảnh báo
CREATE POLICY "integrity_signals_select"
    ON public.integrity_signals FOR SELECT
    TO authenticated
    USING (
        public.is_admin() OR
        (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
    );

-- Chỉ Admin mới được update trạng thái điều tra tín hiệu gian lận
CREATE POLICY "integrity_signals_update_admin"
    ON public.integrity_signals FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Thu hồi EXECUTE cho hàm mới
REVOKE EXECUTE ON FUNCTION public.handle_creator_skill_verification() FROM PUBLIC, anon;

COMMIT;
