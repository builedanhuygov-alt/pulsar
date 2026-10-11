-- ==============================================================================
-- PULSAR Sprint 6: AI Matching, Recommendations & Copilot Feedback Schema
-- File: supabase/migrations/20240106000000_create_matching_engine.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RECOMMENDATION FEEDBACK TABLE
-- Lưu trữ tương tác đối với gợi ý thử thách hoặc tài năng: viewed, dismissed, interested, applied
-- Không lưu dữ liệu nhạy cảm; bảo vệ IDOR và cô lập tổ chức
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    target_creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feed_type TEXT NOT NULL CHECK (feed_type IN ('creator_feed', 'business_talent_match')),
    action TEXT NOT NULL CHECK (action IN ('viewed', 'dismissed', 'interested', 'applied')),
    match_score NUMERIC(5, 2) CHECK (match_score >= 0 AND match_score <= 100),
    confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low', 'insufficient_data')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_recommendation_user ON public.recommendation_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_challenge ON public.recommendation_feedback(challenge_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_action ON public.recommendation_feedback(action);

-- ------------------------------------------------------------------------------
-- 2. CHALLENGE COPILOT AUDIT LOG
-- Ghi nhận lịch sử tư vấn, gợi ý cải thiện đề bài (Deliverables, Rubric, Clarity)
-- Đảm bảo chỉ mang tính chất khuyến nghị, KHÔNG tự ý sửa dữ liệu
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_copilot_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('rubric_optimization', 'deliverables_refinement', 'clarity_check', 'conflict_detection')),
    suggestions JSONB NOT NULL DEFAULT '{}'::jsonb,
    applied_changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_copilot_challenge ON public.challenge_copilot_logs(challenge_id);
CREATE INDEX IF NOT EXISTS idx_copilot_org ON public.challenge_copilot_logs(organization_id);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_copilot_logs ENABLE ROW LEVEL SECURITY;

-- recommendation_feedback:
-- Người dùng xem và quản lý phản hồi đề xuất của chính mình
CREATE POLICY "recommendation_feedback_select_owner"
    ON public.recommendation_feedback FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.is_admin()
    );

CREATE POLICY "recommendation_feedback_insert_owner"
    ON public.recommendation_feedback FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

-- challenge_copilot_logs:
-- Thành viên của tổ chức sở hữu challenge hoặc Admin mới được xem và tạo log Copilot
CREATE POLICY "copilot_logs_select_org_or_admin"
    ON public.challenge_copilot_logs FOR SELECT
    TO authenticated
    USING (
        public.is_admin() OR
        public.is_org_member(organization_id, auth.uid())
    );

CREATE POLICY "copilot_logs_insert_org_or_admin"
    ON public.challenge_copilot_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin() OR
        public.is_org_member(organization_id, auth.uid())
    );

COMMIT;
