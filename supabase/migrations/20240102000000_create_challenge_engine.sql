-- ==============================================================================
-- PULSAR Sprint 2: Challenge Engine Schema & RLS Policies
-- File: supabase/migrations/20240102000000_create_challenge_engine.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CHALLENGES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 5 AND char_length(title) <= 120),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    short_description TEXT NOT NULL CHECK (char_length(trim(short_description)) >= 20 AND char_length(short_description) <= 300),
    problem_statement TEXT NOT NULL CHECK (char_length(trim(problem_statement)) >= 50),
    desired_outcome TEXT NOT NULL CHECK (char_length(trim(desired_outcome)) >= 30),
    category TEXT NOT NULL CHECK (category IN ('ai_ml', 'blockchain', 'cloud_devops', 'mobile_iot', 'fintech', 'security')),
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluation_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    budget_min NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (budget_min >= 0),
    budget_max NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (budget_max >= budget_min),
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND', 'EUR')),
    prize_pool NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (prize_pool >= 0),
    start_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    deadline_at TIMESTAMPTZ NOT NULL CHECK (deadline_at > start_at),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',
        'pending_review',
        'changes_requested',
        'approved',
        'published',
        'rejected',
        'closed',
        'cancelled'
    )),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_challenges_organization ON public.challenges(organization_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON public.challenges(category);
CREATE INDEX IF NOT EXISTS idx_challenges_slug ON public.challenges(slug);
CREATE INDEX IF NOT EXISTS idx_challenges_deadline ON public.challenges(deadline_at);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON public.challenges(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. CHALLENGE REVIEW RECORDS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'request_changes')),
    notes TEXT NOT NULL CHECK (char_length(trim(notes)) >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_challenge_reviews_challenge ON public.challenge_reviews(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_reviews_reviewer ON public.challenge_reviews(reviewer_id);

-- ------------------------------------------------------------------------------
-- 3. TRIGGERS: UPDATED_AT & STATUS TRANSITIONS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_challenges_updated_at ON public.challenges;
CREATE TRIGGER trg_challenges_updated_at
    BEFORE UPDATE ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger validating state machine and setting published_at
CREATE OR REPLACE FUNCTION public.handle_challenge_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Automatically set published_at when transitioning to published
    IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'published') THEN
        NEW.published_at := timezone('utc'::text, now());
    END IF;

    -- Security check: Creator cannot approve their own challenge
    IF NEW.status = 'approved' AND (TG_OP = 'UPDATE' AND OLD.status = 'pending_review') THEN
        IF auth.uid() = NEW.created_by THEN
            RAISE EXCEPTION 'QUY TẮC AN NINH: Người tạo thử thách không được phép tự phê duyệt thử thách của chính mình.';
        END IF;
    END IF;

    -- Validate state transitions on UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Prevent changing from terminal states
        IF OLD.status IN ('closed', 'cancelled') AND NEW.status != OLD.status THEN
            RAISE EXCEPTION 'Thử thách đã ở trạng thái kết thúc (%), không thể thay đổi trạng thái nữa.', OLD.status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenges_status_transition ON public.challenges;
CREATE TRIGGER trg_challenges_status_transition
    BEFORE INSERT OR UPDATE ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_challenge_status_transition();

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) FOR CHALLENGE ENGINE
-- ------------------------------------------------------------------------------
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_reviews ENABLE ROW LEVEL SECURITY;

-- 4.1 CHALLENGES POLICIES
-- Public & Anonymous can ONLY view published or closed challenges
DROP POLICY IF EXISTS "Public can view published challenges" ON public.challenges;
CREATE POLICY "Public can view published challenges"
    ON public.challenges
    FOR SELECT
    TO anon
    USING (status IN ('published', 'closed'));

-- Authenticated users: view published/closed, OR member of that organization, OR admin
DROP POLICY IF EXISTS "Authenticated users can view accessible challenges" ON public.challenges;
CREATE POLICY "Authenticated users can view accessible challenges"
    ON public.challenges
    FOR SELECT
    TO authenticated
    USING (
        status IN ('published', 'closed')
        OR public.is_org_member(organization_id)
        OR public.is_admin()
    );

-- Only organization members can create challenges for their organization
DROP POLICY IF EXISTS "Org members can create challenges" ON public.challenges;
CREATE POLICY "Org members can create challenges"
    ON public.challenges
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_org_member(organization_id)
        AND auth.uid() = created_by
        AND status = 'draft'
    );

-- Org members can update editable challenges, Admins can review pending challenges
DROP POLICY IF EXISTS "Org members and admins can update challenges" ON public.challenges;
CREATE POLICY "Org members and admins can update challenges"
    ON public.challenges
    FOR UPDATE
    TO authenticated
    USING (
        (public.is_org_member(organization_id) AND status IN ('draft', 'changes_requested', 'approved', 'published'))
        OR (public.is_admin() AND status = 'pending_review' AND created_by != auth.uid())
        OR public.is_admin()
    )
    WITH CHECK (
        (public.is_org_member(organization_id) AND status IN ('draft', 'pending_review', 'published', 'closed', 'cancelled'))
        OR (public.is_admin() AND status IN ('approved', 'changes_requested', 'rejected', 'published', 'closed', 'cancelled'))
    );

-- Only organization owners can delete draft or cancelled challenges
DROP POLICY IF EXISTS "Org owners can delete drafts" ON public.challenges;
CREATE POLICY "Org owners can delete drafts"
    ON public.challenges
    FOR DELETE
    TO authenticated
    USING (
        (public.is_org_owner(organization_id) AND status IN ('draft', 'cancelled'))
        OR public.is_admin()
    );

-- 4.2 CHALLENGE REVIEWS POLICIES
DROP POLICY IF EXISTS "Admins and org members can view reviews" ON public.challenge_reviews;
CREATE POLICY "Admins and org members can view reviews"
    ON public.challenge_reviews
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.challenges c
            WHERE c.id = challenge_id
              AND public.is_org_member(c.organization_id)
        )
    );

DROP POLICY IF EXISTS "Only admins can record review decisions" ON public.challenge_reviews;
CREATE POLICY "Only admins can record review decisions"
    ON public.challenge_reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        AND auth.uid() = reviewer_id
    );

-- ------------------------------------------------------------------------------
-- 5. GRANTS FOR POSTGREST
-- ------------------------------------------------------------------------------
GRANT SELECT ON TABLE public.challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.challenges TO authenticated;

GRANT SELECT, INSERT ON TABLE public.challenge_reviews TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
