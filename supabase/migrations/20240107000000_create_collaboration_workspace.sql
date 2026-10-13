-- ==============================================================================
-- PULSAR Sprint 7: Collaboration, Messaging, Tasks, Milestones & Notifications Schema
-- File: supabase/migrations/20240107000000_create_collaboration_workspace.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. WORKSPACES TABLE
-- Không gian làm việc chuyên dụng gắn liền với Challenge, Organization và Submission
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 150),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'paused')),
    stage TEXT NOT NULL DEFAULT 'briefing' CHECK (stage IN ('briefing', 'in_progress', 'review', 'revision', 'completed', 'closed')),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_workspaces_challenge ON public.workspaces(challenge_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_org ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON public.workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);

-- ------------------------------------------------------------------------------
-- 2. WORKSPACE MEMBERS TABLE
-- Thành viên của workspace cùng vai trò (owner, creator, reviewer, member, admin, observer)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'creator', 'reviewer', 'member', 'admin', 'observer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    last_read_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON public.workspace_members(status);

-- ------------------------------------------------------------------------------
-- 3. MESSAGES TABLE
-- Hội thoại trong workspace: hỗ trợ đính kèm, pins, read receipts và idempotency
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 2000),
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file', 'milestone_update')),
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ,
    CONSTRAINT uq_message_idempotency UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_messages_ws ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. TASKS TABLE
-- Quản lý nhiệm vụ: todo, in_progress, blocked, completed, cancelled
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 150),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_at TIMESTAMPTZ,
    milestone_id UUID,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_tasks_ws ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);

-- ------------------------------------------------------------------------------
-- 5. MILESTONES TABLE
-- Các mốc bàn giao dự án
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 150),
    description TEXT,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'completed', 'cancelled')),
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_milestones_ws ON public.milestones(workspace_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON public.milestones(status);

-- ------------------------------------------------------------------------------
-- 6. DELIVERABLES TABLE
-- Bàn giao chi tiết cho từng Milestone kèm phiên bản, tệp và quy trình duyệt
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 150),
    description TEXT,
    file_url TEXT NOT NULL,
    file_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'changes_requested', 'accepted', 'rejected')),
    feedback TEXT,
    submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_deliverables_ms ON public.deliverables(milestone_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_ws ON public.deliverables(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON public.deliverables(status);
CREATE INDEX IF NOT EXISTS idx_deliverables_submitter ON public.deliverables(submitted_by);

-- ------------------------------------------------------------------------------
-- 7. NOTIFICATIONS TABLE
-- Hệ thống thông báo bảo mật (Strict Recipient Isolation & Idempotency)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'new_message',
        'workspace_invitation',
        'task_assigned',
        'task_deadline_changed',
        'deliverable_reviewed',
        'milestone_due_soon',
        'revision_requested'
    )),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('workspace', 'message', 'task', 'milestone', 'deliverable')),
    entity_id UUID NOT NULL,
    title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
    body TEXT NOT NULL CHECK (char_length(body) <= 1000),
    read_at TIMESTAMPTZ,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES — STRICT MULTI-TENANT & ORG ISOLATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 8.1 WORKSPACES RLS
-- Người xem: Thành viên active của workspace, hoặc Thành viên của Tổ chức sở hữu, hoặc System Admin
CREATE POLICY "Workspaces select policy"
ON public.workspaces FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = workspaces.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.is_admin()
);

-- Người tạo workspace: Chỉ Org Owner/Admin hoặc System Admin
CREATE POLICY "Workspaces insert policy"
ON public.workspaces FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = workspaces.organization_id
        AND om.user_id = auth.uid()
        AND om.membership_role = 'owner'
    )
    OR public.is_admin()
);

-- 8.2 WORKSPACE MEMBERS RLS
CREATE POLICY "Workspace members select policy"
ON public.workspace_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm2
        WHERE wm2.workspace_id = workspace_members.workspace_id
        AND wm2.user_id = auth.uid()
        AND wm2.status = 'active'
    )
    OR public.is_admin()
);

-- 8.3 MESSAGES RLS
-- Chỉ thành viên active của workspace mới xem được tin nhắn (Không public qua marketplace!)
CREATE POLICY "Messages select policy"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = messages.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR public.is_admin()
);

CREATE POLICY "Messages insert policy"
ON public.messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = messages.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

-- 8.4 TASKS RLS
CREATE POLICY "Tasks select policy"
ON public.tasks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = tasks.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR public.is_admin()
);

CREATE POLICY "Tasks insert policy"
ON public.tasks FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = tasks.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

CREATE POLICY "Tasks update policy"
ON public.tasks FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = tasks.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

-- 8.5 MILESTONES RLS
CREATE POLICY "Milestones select policy"
ON public.milestones FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = milestones.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR public.is_admin()
);

-- 8.6 DELIVERABLES RLS
CREATE POLICY "Deliverables select policy"
ON public.deliverables FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = deliverables.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR public.is_admin()
);

CREATE POLICY "Deliverables insert policy"
ON public.deliverables FOR INSERT
WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = deliverables.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
);

-- 8.7 NOTIFICATIONS RLS (CÔ LẬP TUYỆT ĐỐI THEO RECIPIENT)
CREATE POLICY "Notifications select policy"
ON public.notifications FOR SELECT
USING (
    recipient_id = auth.uid()
);

CREATE POLICY "Notifications update policy"
ON public.notifications FOR UPDATE
USING (
    recipient_id = auth.uid()
);

COMMIT;
