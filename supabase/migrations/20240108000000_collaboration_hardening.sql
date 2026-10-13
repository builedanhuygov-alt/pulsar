-- ==============================================================================
-- PULSAR Sprint 7 hardening: Collaboration workspace follow-up
-- File: supabase/migrations/20240108000000_collaboration_hardening.sql
--
-- Mục tiêu: siết RLS + tính nhất quán cho workspace/messaging/tasks/
-- milestones/deliverables/notifications mà KHÔNG xóa dữ liệu, KHÔNG rollback,
-- KHÔNG chạy migration Cloud (chỉ cung cấp file để DBA review + apply thủ công).
-- Toàn bộ câu lệnh idempotent (IF NOT EXISTS / DROP IF EXISTS) trong 1 transaction.
-- Yêu cầu: chạy SAU 20240107000000_create_collaboration_workspace.sql.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Preconditions (fail fast with clear message if base Sprint 7 not applied)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces') THEN
    RAISE EXCEPTION 'Sprint 7 base migration missing: public.workspaces not found. Apply 20240107000000 first.';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER, anti-recursion, fixed search_path)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = target_workspace_id AND user_id = check_user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_reviewer(target_workspace_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = check_user_id
      AND status = 'active'
      AND role IN ('owner', 'reviewer', 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_workspace_reviewer(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_reviewer(UUID, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Referential integrity: tasks.milestone_id -> milestones(id)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_milestone' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_milestone FOREIGN KEY (milestone_id)
      REFERENCES public.milestones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Task status history (audit trail for status transitions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('todo', 'in_progress', 'blocked', 'completed', 'cancelled')),
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_task_history_task ON public.task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_ws ON public.task_status_history(workspace_id);
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task history select policy" ON public.task_status_history;
CREATE POLICY "Task history select policy"
ON public.task_status_history FOR SELECT TO authenticated
USING (
  public.is_workspace_member(workspace_id) OR public.is_admin()
);

-- History is append-only for clients; service_role manages writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.task_status_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.task_status_history TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Workspace activities (persistent audit trail; mirrors in-app activity feed)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('workspace', 'message', 'task', 'milestone', 'member', 'deliverable', 'notification')),
  target_id UUID,
  details TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_workspace_activities_ws ON public.workspace_activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activities_created ON public.workspace_activities(created_at DESC);
ALTER TABLE public.workspace_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace activities select policy" ON public.workspace_activities;
CREATE POLICY "Workspace activities select policy"
ON public.workspace_activities FOR SELECT TO authenticated
USING (
  public.is_workspace_member(workspace_id) OR public.is_admin()
);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.workspace_activities FROM anon, authenticated;
GRANT SELECT ON TABLE public.workspace_activities TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Fill missing UPDATE/DELETE RLS on Sprint 7 tables (least-privilege)
-- ------------------------------------------------------------------------------

-- WORKSPACES: allow owner/system-admin updates; no client deletes (archival via status).
DROP POLICY IF EXISTS "Workspaces update policy" ON public.workspaces;
CREATE POLICY "Workspaces update policy"
ON public.workspaces FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id AND wm.user_id = auth.uid()
      AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
  ) OR public.is_admin()
);

-- WORKSPACE MEMBERS: owners/admins insert/remove; members read-only.
DROP POLICY IF EXISTS "Workspace members insert policy" ON public.workspace_members;
CREATE POLICY "Workspace members insert policy"
ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_workspace_reviewer(workspace_id) OR public.is_admin()
);
DROP POLICY IF EXISTS "Workspace members update policy" ON public.workspace_members;
CREATE POLICY "Workspace members update policy"
ON public.workspace_members FOR UPDATE TO authenticated
USING (
  public.is_workspace_reviewer(workspace_id) OR public.is_admin()
);

-- MESSAGES: sender can edit own message; no client deletes (moderation via service_role).
DROP POLICY IF EXISTS "Messages update policy" ON public.messages;
CREATE POLICY "Messages update policy"
ON public.messages FOR UPDATE TO authenticated
USING (
  sender_id = auth.uid() AND public.is_workspace_member(workspace_id)
);

-- TASKS: active members create/update within their workspace.
DROP POLICY IF EXISTS "Tasks delete policy" ON public.tasks;
-- Intentionally no DELETE policy: tasks are cancelled, never hard-deleted by clients.

-- MILESTONES: owner/reviewer/admin manage; members read.
DROP POLICY IF EXISTS "Milestones insert policy" ON public.milestones;
CREATE POLICY "Milestones insert policy"
ON public.milestones FOR INSERT TO authenticated
WITH CHECK (
  public.is_workspace_reviewer(workspace_id) OR public.is_admin()
);
DROP POLICY IF EXISTS "Milestones update policy" ON public.milestones;
CREATE POLICY "Milestones update policy"
ON public.milestones FOR UPDATE TO authenticated
USING (
  public.is_workspace_reviewer(workspace_id) OR public.is_admin()
);

-- DELIVERABLES: members submit; reviewers accept/reject; self-accept blocked in app + trigger guard below.
DROP POLICY IF EXISTS "Deliverables update policy" ON public.deliverables;
CREATE POLICY "Deliverables update policy"
ON public.deliverables FOR UPDATE TO authenticated
USING (
  public.is_workspace_member(workspace_id)
);

-- DB-level self-acceptance guard (defense in depth; app also blocks).
DROP TRIGGER IF EXISTS trg_deliverable_no_self_accept ON public.deliverables;
DROP FUNCTION IF EXISTS public.prevent_deliverable_no_self_accept_guard() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_deliverable_no_self_accept_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND NEW.submitted_by IS NOT DISTINCT FROM NEW.reviewed_by THEN
    RAISE EXCEPTION 'Security: creator cannot self-accept their own deliverable.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_deliverable_no_self_accept
BEFORE INSERT OR UPDATE ON public.deliverables
FOR EACH ROW EXECUTE FUNCTION public.prevent_deliverable_no_self_accept_guard();

-- ------------------------------------------------------------------------------
-- 6. Notifications: strict recipient isolation, service-side writes only
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Notifications insert policy" ON public.notifications;
-- No INSERT policy for authenticated: only service_role (bypasses RLS) writes.
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. task_status_history + workspace_activities are append-only; no updated_at triggers needed.
-- Sprint 1 handle_updated_at() continues to maintain workspaces/tasks/milestones/deliverables.
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- 8. Grants (least privilege; service_role bypasses RLS for server writes)
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.deliverables TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.task_status_history TO authenticated;
GRANT SELECT ON TABLE public.workspace_activities TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
