import React, { useState } from 'react';
import { Database, Copy, Check, Terminal, FileCode, CheckCircle2 } from 'lucide-react';

export const MigrationViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const migrations = [
    {
      filename: 'consolidated_sprint1_schema.sql',
      title: '⚡ TOÀN BỘ SPRINT 1 (Chạy 1 lần duy nhất)',
      description: 'Script tổng hợp nguyên khối (atomic transaction): Tạo 5 bảng, RLS, Anti-Recursion, Triggers, Grants, và Bootstrap Procedure.',
      sql: `-- ==============================================================================
-- PULSAR PLATFORM - SPRINT 1 CONSOLIDATED DATABASE SCHEMA (1-CLICK RUN)
-- Chạy toàn bộ trong Supabase SQL Editor:
-- ==============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BẢNG DỮ LIỆU
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('creator', 'business', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    organization_type TEXT NOT NULL CHECK (organization_type IN ('business', 'agency', 'school', 'partner')),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    membership_role TEXT NOT NULL DEFAULT 'member' CHECK (membership_role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_org_members_org_user UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 2. TRIGGERS UPDATED_AT & IMMUTABILITY
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.created_at = OLD.created_at;
    NEW.id = OLD.id;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit log entries are strictly immutable.'; END; $$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 3. RLS POLICIES & ANTI-RECURSION HELPERS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = target_org_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(target_org_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = target_org_id AND user_id = auth.uid() AND membership_role = 'owner');
$$;

DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
CREATE POLICY "Users can update only their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own roles or admins view all" ON public.user_roles;
CREATE POLICY "Users can view their own roles or admins view all" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Members or admins can view organizations" ON public.organizations;
CREATE POLICY "Members or admins can view organizations" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id) OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners or admins can update organizations" ON public.organizations;
CREATE POLICY "Owners or admins can update organizations" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_owner(id) OR public.is_admin()) WITH CHECK (public.is_org_owner(id) OR public.is_admin());

DROP POLICY IF EXISTS "Members can view membership within same org" ON public.organization_members;
CREATE POLICY "Members can view membership within same org" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "Owners or admins can add organization members" ON public.organization_members;
CREATE POLICY "Owners or admins can add organization members" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "Admins or actors can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins or actors can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin() OR auth.uid() = actor_user_id);

-- 4. GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated, service_role;

-- 5. AUTH TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_display_name TEXT; v_avatar_url TEXT; v_requested_role TEXT; v_assigned_role TEXT;
BEGIN
    v_display_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''), NULLIF(split_part(NEW.email, '@', 1), ''), 'Pulsar Member');
    v_avatar_url := NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), '');
    v_requested_role := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'creator'));
    IF v_requested_role = 'business' THEN v_assigned_role := 'business'; ELSE v_assigned_role := 'creator'; END IF;
    INSERT INTO public.profiles (id, display_name, avatar_url) VALUES (NEW.id, v_display_name, v_avatar_url)
    ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_assigned_role) ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (NEW.id, 'user.registered', 'user', NEW.id::text, jsonb_build_object('email', NEW.email, 'assigned_role', v_assigned_role));
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_organization() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.organization_members (organization_id, user_id, membership_role) VALUES (NEW.id, NEW.created_by, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (NEW.created_by, 'organization.created', 'organization', NEW.id::text, jsonb_build_object('name', NEW.name, 'slug', NEW.slug));
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- 6. ADMIN BOOTSTRAP (WITH ADVISORY LOCK & ONE-TIME LOCK)
CREATE OR REPLACE FUNCTION public.bootstrap_admin_user(target_user_email TEXT, operator_reason TEXT DEFAULT 'Initial deployment bootstrap')
RETURNS TABLE (success BOOLEAN, user_id UUID, assigned_role TEXT, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id UUID;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('pulsar_admin_bootstrap_lock'));
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Bootstrap procedure is LOCKED: An administrator already exists in the system.'::TEXT;
        RETURN;
    END IF;
    SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(target_user_email));
    IF v_user_id IS NULL THEN RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'User not found. Register first.'; RETURN; END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (auth.uid(), 'admin.role_granted', 'user_roles', v_user_id::text, jsonb_build_object('target_email', target_user_email, 'target_user_id', v_user_id::text, 'reason', operator_reason));
    RETURN QUERY SELECT true, v_user_id, 'admin'::TEXT, format('Admin role granted to %s.', target_user_email);
END; $$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;`,
    },
    {
      filename: '20240101000000_create_base_schema.sql',
      title: '1. Khởi tạo Base Schema & Tables',
      description: 'Định nghĩa 5 bảng: profiles, user_roles, organizations, organization_members, audit_logs và trigger updated_at.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 1: Base Schema Migration
-- 20240101000000_create_base_schema.sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- 2. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('creator', 'business', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 3. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    organization_type TEXT NOT NULL CHECK (organization_type IN ('business', 'agency', 'school', 'partner')),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- 4. ORGANIZATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    membership_role TEXT NOT NULL DEFAULT 'member' CHECK (membership_role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_org_members_org_user UNIQUE (organization_id, user_id)
);

-- 5. AUDIT LOGS TABLE (IMMUTABLE)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);`,
    },
    {
      filename: '20240101000001_create_rls_policies.sql',
      title: '2. Row Level Security & Anti-Recursion Helpers',
      description: 'Bật RLS trên 5 bảng, tạo các hàm SECURITY DEFINER (is_admin, is_org_member, is_org_owner) và các policies.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 1: Row Level Security (RLS) & Security Policies
-- 20240101000001_create_rls_policies.sql
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Anti-Recursion Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = target_org_id AND user_id = check_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(target_org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = target_org_id AND user_id = check_user_id AND membership_role = 'owner');
$$;

-- PROFILES:
CREATE POLICY "Profiles are readable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update only their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ORGANIZATIONS:
CREATE POLICY "Members or admins can view organizations" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id) OR public.is_admin());
CREATE POLICY "Owners or admins can update organizations" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_owner(id) OR public.is_admin()) WITH CHECK (public.is_org_owner(id) OR public.is_admin());

-- AUDIT LOGS IMMUTABILITY:
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM public, anon, authenticated;
CREATE POLICY "Admins or actors can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin() OR auth.uid() = actor_user_id);`,
    },
    {
      filename: '20240101000002_create_auth_triggers.sql',
      title: '3. Triggers tự động hóa & Ngăn ngừa leo thang quyền',
      description: 'Trigger on_auth_user_created và on_organization_created tạo profile, gán role an toàn và gán owner cho org creator.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 1: Auth & Organization Triggers
-- 20240101000002_create_auth_triggers.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_display_name TEXT;
    v_avatar_url TEXT;
    v_requested_role TEXT;
    v_assigned_role TEXT;
BEGIN
    v_display_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(split_part(NEW.email, '@', 1), ''),
        'Pulsar Member'
    );
    v_avatar_url := NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), '');

    -- SECURITY: Client can never self-register as admin
    v_requested_role := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'creator'));
    IF v_requested_role = 'business' THEN
        v_assigned_role := 'business';
    ELSE
        v_assigned_role := 'creator';
    END IF;

    INSERT INTO public.profiles (id, display_name, avatar_url) VALUES (NEW.id, v_display_name, v_avatar_url);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_assigned_role);
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to initialize user profile and role: %', SQLERRM;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`,
    },
    {
      filename: '20240101000003_admin_bootstrap_procedure.sql',
      title: '4. Thủ tục Bootstrap Admin Đặc quyền',
      description: 'Stored procedure an toàn để khởi tạo Super Admin đầu tiên thông qua Supabase SQL Editor hoặc Service Role.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 1: Privileged Admin Bootstrap Procedure
-- 20240101000003_admin_bootstrap_procedure.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_admin_user(
    target_user_email TEXT,
    operator_reason TEXT DEFAULT 'Initial deployment bootstrap'
)
RETURNS TABLE (success BOOLEAN, user_id UUID, assigned_role TEXT, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(target_user_email));
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'User not found in auth.users. Please register first.';
        RETURN;
    END IF;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (v_user_id, 'admin.role_granted', 'user_roles', v_user_id::text,
            jsonb_build_object('target_email', target_user_email, 'reason', operator_reason));

    RETURN QUERY SELECT true, v_user_id, 'admin'::TEXT, 'Admin role granted successfully.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) TO service_role;`,
    },
    {
      filename: '20240102000000_create_challenge_engine.sql',
      title: '🚀 SPRINT 2: Challenge Engine (Bảng challenges, reviews, RLS & triggers)',
      description: 'Tạo bảng challenges, challenge_reviews, trigger cập nhật trạng thái, kiểm tra chống tự phê duyệt và RLS phân quyền theo tổ chức và ban quản trị.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 2: Challenge Engine Schema & RLS Policies
-- File: supabase/migrations/20240102000000_create_challenge_engine.sql
-- ==============================================================================

BEGIN;

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
        'draft', 'pending_review', 'changes_requested', 'approved',
        'published', 'rejected', 'closed', 'cancelled'
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

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published challenges"
    ON public.challenges FOR SELECT TO anon
    USING (status IN ('published', 'closed'));

CREATE POLICY "Authenticated users can view accessible challenges"
    ON public.challenges FOR SELECT TO authenticated
    USING (
        status IN ('published', 'closed')
        OR public.is_org_member(organization_id)
        OR public.is_admin()
    );

CREATE POLICY "Org members can create challenges"
    ON public.challenges FOR INSERT TO authenticated
    WITH CHECK (
        public.is_org_member(organization_id)
        AND auth.uid() = created_by
        AND status = 'draft'
    );

NOTIFY pgrst, 'reload schema';
COMMIT;`,
    },
    {
      filename: '20240103000000_create_submission_engine.sql',
      title: '🎯 SPRINT 3: Submission Engine (Bảng submissions, reviews, status_history & RLS)',
      description: 'Tạo bảng submissions, submission_reviews, submission_status_history, database deadline guard, anti-self-review guard và RLS cách ly đa tổ chức.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 3: Submission Engine Schema, Triggers & RLS Policies
-- File: supabase/migrations/20240103000000_create_submission_engine.sql
-- ==============================================================================

BEGIN;

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
        'draft', 'submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn'
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

CREATE TABLE IF NOT EXISTS public.submission_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_status_history ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
COMMIT;`,
    },
    {
      filename: '20240104000000_create_outcome_reward_engine.sql',
      title: '🏆 SPRINT 4: Outcome & Reward Engine',
      description: 'Chốt kết quả thử thách, bảng challenge_outcomes, rewards, reward_status_history, verified_portfolios, Separation of Duties và RLS.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 4: Outcome & Reward Engine Schema, Triggers & RLS Policies
-- File: supabase/migrations/20240104000000_create_outcome_reward_engine.sql
-- ==============================================================================
BEGIN;

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
    CONSTRAINT uq_challenge_outcomes_challenge UNIQUE (challenge_id)
);

CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outcome_id UUID NOT NULL REFERENCES public.challenge_outcomes(id) ON DELETE RESTRICT,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND', 'EUR')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'pending_approval', 'approved', 'processing', 'paid', 'failed', 'cancelled')),
    disbursement_method TEXT NOT NULL DEFAULT 'mock_escrow_adapter',
    is_mock_disbursement BOOLEAN NOT NULL DEFAULT true,
    reference_code TEXT NOT NULL UNIQUE,
    notes TEXT,
    disbursed_at TIMESTAMPTZ,
    disbursed_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_rewards_outcome UNIQUE (outcome_id)
);

CREATE TABLE IF NOT EXISTS public.reward_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

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

ALTER TABLE public.challenge_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_portfolios ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
COMMIT;`,
    },
    {
      filename: '20240105000000_create_reputation_analytics_engine.sql',
      title: '💎 SPRINT 5: Reputation, Skills & Analytics',
      description: 'Hệ thống uy tín (Reputation Profiles), đồ thị kỹ năng (creator_skills & skill_taxonomies), tín hiệu bất thường (integrity_signals) và RLS.',
      sql: `-- ==============================================================================
-- PULSAR Sprint 5: Trust, Reputation, Skill Evidence & Analytics Schema
-- File: supabase/migrations/20240105000000_create_reputation_analytics_engine.sql
-- ==============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.skill_taxonomies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    category TEXT NOT NULL CHECK (category IN (
        'ai_machine_learning', 'blockchain_web3', 'cloud_devops', 'software_architecture',
        'security_compliance', 'data_engineering', 'frontend_mobile', 'domain_expertise'
    )),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE TABLE IF NOT EXISTS public.creator_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skill_taxonomies(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'self_declared' CHECK (status IN ('self_declared', 'evidence_submitted', 'verified', 'rejected')),
    evidence_type TEXT,
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

CREATE TABLE IF NOT EXISTS public.creator_reputation_profiles (
    creator_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_challenges_participated INT NOT NULL DEFAULT 0,
    total_submissions_submitted INT NOT NULL DEFAULT 0,
    total_submissions_accepted INT NOT NULL DEFAULT 0,
    total_verified_outcomes INT NOT NULL DEFAULT 0,
    on_time_delivery_count INT NOT NULL DEFAULT 0,
    on_time_delivery_rate NUMERIC(5, 2),
    weighted_review_score_avg NUMERIC(5, 2),
    verified_skills_count INT NOT NULL DEFAULT 0,
    confirmed_collaborations_count INT NOT NULL DEFAULT 0,
    composite_reputation_score NUMERIC(5, 2),
    reputation_tier TEXT NOT NULL DEFAULT 'insufficient_data',
    score_explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT true,
    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

CREATE TABLE IF NOT EXISTS public.integrity_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'low',
    target_entity_type TEXT NOT NULL,
    target_entity_id UUID NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    detection_rule_name TEXT NOT NULL,
    explanation TEXT NOT NULL,
    supporting_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status TEXT NOT NULL DEFAULT 'open',
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

ALTER TABLE public.skill_taxonomies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_reputation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_signals ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
COMMIT;`,
    },
    {
      filename: 'rollback_sprint1_schema.sql',
      title: '⚠️ Rollback Script (Gỡ bỏ Schema)',
      description: 'Script khôi phục thảm họa: Gỡ bỏ 5 bảng và triggers Sprint 1 (giữ nguyên tài khoản auth.users).',
      sql: `-- ==============================================================================
-- PULSAR PLATFORM - SPRINT 1 ROLLBACK SCRIPT (DISASTER RECOVERY ONLY)
-- CẢNH BÁO: Script này sẽ gỡ bỏ 5 bảng và functions đã tạo ở Sprint 1.
-- ==============================================================================
BEGIN;

-- 1. DROP TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;

-- 2. DROP FUNCTIONS
DROP FUNCTION IF EXISTS public.bootstrap_admin_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.handle_new_organization();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.is_org_owner(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_org_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_admin(UUID);
DROP FUNCTION IF EXISTS public.prevent_audit_log_mutation();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- 3. DROP TABLES IN REVERSE DEPENDENCY ORDER
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

NOTIFY pgrst, 'reload schema';
COMMIT;`,
    },
  ];

  const current = migrations[selectedFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">SQL Migrations Explorer</h2>
            <p className="text-xs text-slate-400">
              Các tệp migration đã sẵn sàng trong thư mục <code className="text-purple-400">supabase/migrations/</code>.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition shadow flex items-center gap-1.5 self-start sm:self-auto"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Đã sao chép SQL!' : 'Sao chép mã SQL'}</span>
        </button>
      </div>

      {/* Migration tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {migrations.map((m, index) => (
          <button
            key={m.filename}
            onClick={() => setSelectedFile(index)}
            className={`p-3 rounded-lg text-left transition border ${
              selectedFile === index
                ? 'bg-slate-800 border-purple-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-xs font-semibold text-slate-200 truncate">{m.title}</div>
            <div className="text-[10px] font-mono text-purple-400 truncate mt-0.5">{m.filename}</div>
          </button>
        ))}
      </div>

      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-mono text-purple-300">{current.filename}</div>
          <div className="text-[11px] text-slate-500">{current.description}</div>
        </div>
        <pre className="p-3 bg-slate-950 rounded-lg border border-slate-900 text-slate-300 font-mono text-xs overflow-x-auto max-h-[350px]">
          <code>{current.sql}</code>
        </pre>
      </div>

      <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-lg text-xs text-indigo-300 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>
          Lệnh thực thi local với Supabase CLI: <code className="font-mono bg-indigo-950/60 px-1 py-0.5 rounded text-indigo-200">supabase migration up</code> hoặc chạy trực tiếp trong Supabase SQL Editor.
        </span>
      </div>
    </div>
  );
};
