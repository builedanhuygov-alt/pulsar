-- ==============================================================================
-- PULSAR Sprint 3: Submission Engine Schema, Triggers & RLS Policies
-- File: supabase/migrations/20240103000000_create_submission_engine.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SUBMISSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 5 AND char_length(title) <= 150),
    solution_summary TEXT NOT NULL CHECK (char_length(trim(solution_summary)) >= 20 AND char_length(solution_summary) <= 1000),
    solution_content TEXT NOT NULL CHECK (char_length(trim(solution_content)) >= 50),
    solution_url TEXT,
    files JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',
        'submitted',
        'under_review',
        'shortlisted',
        'accepted',
        'rejected',
        'withdrawn'
    )),
    idempotency_key TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON public.submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON public.submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_user_challenge_active 
    ON public.submissions(challenge_id, submitted_by) 
    WHERE status NOT IN ('withdrawn', 'rejected');

-- ------------------------------------------------------------------------------
-- 2. SUBMISSION REVIEWS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted')),
    rubric_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_weighted_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (total_weighted_score >= 0 AND total_weighted_score <= 100),
    feedback TEXT NOT NULL CHECK (char_length(trim(feedback)) >= 10),
    decision TEXT CHECK (decision IN ('shortlist', 'accept', 'reject', 'needs_revision')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_submission_reviews_submission_reviewer UNIQUE (submission_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_submission_reviews_submission ON public.submission_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_reviews_reviewer ON public.submission_reviews(reviewer_id);

-- ------------------------------------------------------------------------------
-- 3. SUBMISSION STATUS AUDIT HISTORY TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_submission_history_submission ON public.submission_status_history(submission_id);

-- ------------------------------------------------------------------------------
-- 4. TRIGGERS: UPDATED_AT, DEADLINE GUARD & ANTI-SELF-REVIEW
-- ------------------------------------------------------------------------------

-- Updated_at triggers
DROP TRIGGER IF EXISTS trg_submissions_updated_at ON public.submissions;
CREATE TRIGGER trg_submissions_updated_at
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_submission_reviews_updated_at ON public.submission_reviews;
CREATE TRIGGER trg_submission_reviews_updated_at
    BEFORE UPDATE ON public.submission_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Database-level Server Guard: Deadline & Challenge Published Check
CREATE OR REPLACE FUNCTION public.check_submission_deadline_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_challenge_status TEXT;
    v_deadline TIMESTAMPTZ;
BEGIN
    SELECT status, deadline_at INTO v_challenge_status, v_deadline
    FROM public.challenges
    WHERE id = NEW.challenge_id;

    -- Only permit submission to published challenges
    IF v_challenge_status != 'published' THEN
        RAISE EXCEPTION 'KHÔNG HỢP LỆ: Chỉ có thể nộp bài dự thi cho thử thách đã xuất bản (hiện tại: %).', v_challenge_status;
    END IF;

    -- Deadline check when submitting
    IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'submitted')) THEN
        IF timezone('utc'::text, now()) > v_deadline THEN
            RAISE EXCEPTION 'HẾT HẠN: Thời hạn nộp bài cho thử thách này đã kết thúc (Deadline: %).', v_deadline;
        END IF;
        NEW.submitted_at := timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_deadline_guard ON public.submissions;
CREATE TRIGGER trg_submissions_deadline_guard
    BEFORE INSERT OR UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_submission_deadline_guard();

-- Database-level Anti Self-Review Guard: Creator cannot review their own submission
CREATE OR REPLACE FUNCTION public.check_anti_self_review_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_submitted_by UUID;
BEGIN
    SELECT submitted_by INTO v_submitted_by
    FROM public.submissions
    WHERE id = NEW.submission_id;

    IF v_submitted_by = NEW.reviewer_id THEN
        RAISE EXCEPTION 'QUY TẮC AN NINH (Segregation of Duties): Tác giả bài dự thi không được phép tự chấm điểm bài của chính mình.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_reviews_anti_self_review ON public.submission_reviews;
CREATE TRIGGER trg_submission_reviews_anti_self_review
    BEFORE INSERT OR UPDATE ON public.submission_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.check_anti_self_review_guard();

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_status_history ENABLE ROW LEVEL SECURITY;

-- 5.1 Submissions Policies
-- Author can see their own submissions; Org members of challenge can see submitted/reviewed entries; Admin can see all
DROP POLICY IF EXISTS "Users can view accessible submissions" ON public.submissions;
CREATE POLICY "Users can view accessible submissions"
    ON public.submissions
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = submitted_by
        OR public.is_admin()
        OR (
            status != 'draft' AND EXISTS (
                SELECT 1 FROM public.challenges c
                WHERE c.id = challenge_id
                  AND public.is_org_member(c.organization_id)
            )
        )
    );

-- Creator can insert new submission with status = 'draft' or 'submitted'
DROP POLICY IF EXISTS "Creators can insert submissions" ON public.submissions;
CREATE POLICY "Creators can insert submissions"
    ON public.submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = submitted_by
        AND status IN ('draft', 'submitted')
    );

-- Creator can update their own editable submission; Org members / Admin can update review statuses
DROP POLICY IF EXISTS "Authorized users can update submissions" ON public.submissions;
CREATE POLICY "Authorized users can update submissions"
    ON public.submissions
    FOR UPDATE
    TO authenticated
    USING (
        (auth.uid() = submitted_by AND status IN ('draft', 'submitted'))
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.challenges c
            WHERE c.id = challenge_id
              AND public.is_org_member(c.organization_id)
        )
    )
    WITH CHECK (
        (auth.uid() = submitted_by AND status IN ('draft', 'submitted', 'withdrawn'))
        OR public.is_admin()
        OR (
            status IN ('under_review', 'shortlisted', 'accepted', 'rejected')
            AND EXISTS (
                SELECT 1 FROM public.challenges c
                WHERE c.id = challenge_id
                  AND public.is_org_member(c.organization_id)
            )
        )
    );

-- 5.2 Submission Reviews Policies
-- Org members and Admin can read reviews; Creator can read published reviews if decision is announced
DROP POLICY IF EXISTS "Authorized users can view submission reviews" ON public.submission_reviews;
CREATE POLICY "Authorized users can view submission reviews"
    ON public.submission_reviews
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR reviewer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.submissions s
            JOIN public.challenges c ON c.id = s.challenge_id
            WHERE s.id = submission_id
              AND public.is_org_member(c.organization_id)
        )
        OR EXISTS (
            SELECT 1 FROM public.submissions s
            WHERE s.id = submission_id
              AND s.submitted_by = auth.uid()
              AND status = 'submitted'
              AND s.status IN ('shortlisted', 'accepted', 'rejected')
        )
    );

-- Only challenge org members and Admin can insert reviews (and not self-review)
DROP POLICY IF EXISTS "Challenge org members can record reviews" ON public.submission_reviews;
CREATE POLICY "Challenge org members can record reviews"
    ON public.submission_reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (public.is_admin() OR EXISTS (
            SELECT 1 FROM public.submissions s
            JOIN public.challenges c ON c.id = s.challenge_id
            WHERE s.id = submission_id
              AND public.is_org_member(c.organization_id)
              AND s.submitted_by != auth.uid()
        ))
        AND reviewer_id = auth.uid()
    );

-- 5.3 Audit History Policies
DROP POLICY IF EXISTS "View submission status history" ON public.submission_status_history;
CREATE POLICY "View submission status history"
    ON public.submission_status_history
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.submissions s
            WHERE s.id = submission_id
              AND (
                  s.submitted_by = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.challenges c
                      WHERE c.id = s.challenge_id
                        AND public.is_org_member(c.organization_id)
                  )
              )
        )
    );

-- ------------------------------------------------------------------------------
-- 6. GRANTS FOR POSTGREST
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON TABLE public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.submission_reviews TO authenticated;
GRANT SELECT, INSERT ON TABLE public.submission_status_history TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
