-- ==============================================================================
-- PULSAR PLATFORM - SPRINT 1 CONSOLIDATED DATABASE SCHEMA
-- File: supabase/migrations/consolidated_sprint1_schema.sql
-- Description: Complete, atomic, idempotent PostgreSQL schema migration for PULSAR Sprint 1.
-- Includes: Tables, Triggers, RLS Policies, Anti-Recursion Helpers, and Bootstrap Procedure.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CORE TABLES
-- ------------------------------------------------------------------------------

-- 2.1 PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- 2.2 USER ROLES TABLE (RBAC)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('creator', 'business', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 2.3 ORGANIZATIONS TABLE
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
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON public.organizations(organization_type);

-- 2.4 ORGANIZATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    membership_role TEXT NOT NULL DEFAULT 'member' CHECK (membership_role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_org_members_org_user UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON public.organization_members(organization_id, membership_role);

-- 2.5 AUDIT LOGS TABLE (IMMUTABLE)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. CORE TRIGGER FUNCTIONS
-- ------------------------------------------------------------------------------

-- 3.1 Updated_at and Immutability Triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.created_at = OLD.created_at; -- Prevent mutating created_at
    NEW.id = OLD.id;                 -- Prevent mutating primary key
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are strictly immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY & HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4.1 Anti-Recursion Helper Functions
-- Using SECURITY DEFINER and fixed search_path prevents infinite recursion in RLS.
-- Strictly bound to auth.uid() of current caller to prevent role probing of arbitrary users.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members WHERE organization_id = target_org_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(target_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members WHERE organization_id = target_org_id AND user_id = auth.uid() AND membership_role = 'owner'
    );
$$;

-- 4.2 Profiles Policies
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
    ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
CREATE POLICY "Users can update only their own profile"
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
CREATE POLICY "Only admins can delete profiles"
    ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

-- 4.3 User Roles Policies
DROP POLICY IF EXISTS "Users can view their own roles or admins view all" ON public.user_roles;
CREATE POLICY "Users can view their own roles or admins view all"
    ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
    ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
    ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
    ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());

-- 4.4 Organizations Policies
DROP POLICY IF EXISTS "Members or admins can view organizations" ON public.organizations;
CREATE POLICY "Members or admins can view organizations"
    ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id) OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners or admins can update organizations" ON public.organizations;
CREATE POLICY "Owners or admins can update organizations"
    ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_owner(id) OR public.is_admin()) WITH CHECK (public.is_org_owner(id) OR public.is_admin());

DROP POLICY IF EXISTS "Owners or admins can delete organizations" ON public.organizations;
CREATE POLICY "Owners or admins can delete organizations"
    ON public.organizations FOR DELETE TO authenticated USING (public.is_org_owner(id) OR public.is_admin());

-- 4.5 Organization Members Policies
DROP POLICY IF EXISTS "Members can view membership within same org" ON public.organization_members;
CREATE POLICY "Members can view membership within same org"
    ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "Owners or admins can add organization members" ON public.organization_members;
CREATE POLICY "Owners or admins can add organization members"
    ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "Owners or admins can update membership roles" ON public.organization_members;
CREATE POLICY "Owners or admins can update membership roles"
    ON public.organization_members FOR UPDATE TO authenticated USING (public.is_org_owner(organization_id) OR public.is_admin()) WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

DROP POLICY IF EXISTS "Owners can remove members or members can leave" ON public.organization_members;
CREATE POLICY "Owners can remove members or members can leave"
    ON public.organization_members FOR DELETE TO authenticated
    USING (public.is_org_owner(organization_id) OR (auth.uid() = user_id) OR public.is_admin());

-- 4.6 Audit Logs Policies
DROP POLICY IF EXISTS "Admins or actors can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins or actors can view audit logs"
    ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin() OR auth.uid() = actor_user_id);

-- ------------------------------------------------------------------------------
-- 5. GRANTS FOR POSTGREST & API ROLES
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- Helper Functions: Revoke default EXECUTE from PUBLIC and anon; grant strictly to authenticated and service_role for RLS
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. AUTH & USER LIFECYCLE TRIGGERS
-- ------------------------------------------------------------------------------

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

    -- ANTI-PRIVILEGE ESCALATION: Never allow registering as 'admin' directly
    v_requested_role := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'creator'));
    IF v_requested_role = 'business' THEN
        v_assigned_role := 'business';
    ELSE
        v_assigned_role := 'creator';
    END IF;

    -- Idempotent profile creation
    INSERT INTO public.profiles (id, display_name, avatar_url, bio)
    VALUES (NEW.id, v_display_name, v_avatar_url, NULL)
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(NULLIF(public.profiles.display_name, 'Pulsar Member'), EXCLUDED.display_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

    -- Idempotent role assignment
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_assigned_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Audit log
    INSERT INTO public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (
        NEW.id,
        'user.registered',
        'user',
        NEW.id::text,
        jsonb_build_object('email', NEW.email, 'assigned_role', v_assigned_role, 'source', 'auth_trigger')
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
        RAISE EXCEPTION 'Failed to initialize user profile and role: %', SQLERRM;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.organization_members (organization_id, user_id, membership_role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    INSERT INTO public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (
        NEW.created_by,
        'organization.created',
        'organization',
        NEW.id::text,
        jsonb_build_object('name', NEW.name, 'slug', NEW.slug, 'type', NEW.organization_type)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- ------------------------------------------------------------------------------
-- 7. PRIVILEGED ADMIN BOOTSTRAP STORED PROCEDURE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bootstrap_admin_user(
    target_user_email TEXT,
    operator_reason TEXT DEFAULT 'Initial deployment bootstrap'
)
RETURNS TABLE (success BOOLEAN, user_id UUID, assigned_role TEXT, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. CONCURRENCY GUARD: Acquire transaction-level advisory lock
    -- Prevents TOCTOU race conditions between concurrent bootstrap requests.
    -- Automatically released when transaction ends (COMMIT or ROLLBACK).
    PERFORM pg_advisory_xact_lock(hashtext('pulsar_admin_bootstrap_lock'));

    -- 2. SECURITY GUARD: FIRST-TIME-ONLY BOOTSTRAP LOCK
    -- If at least one active administrator already exists, permanently lock this procedure.
    -- Subsequent administrators must be granted by an existing administrator through RBAC delegation.
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        RETURN QUERY SELECT
            false,
            NULL::UUID,
            NULL::TEXT,
            'Bootstrap procedure is LOCKED: An administrator already exists in the system. Additional administrators must be granted by an existing admin through standard RBAC delegation.'::TEXT;
        RETURN;
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(target_user_email));
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT
            false,
            NULL::UUID,
            NULL::TEXT,
            format('User with email "%s" not found in auth.users. Please register the user first.', target_user_email);
        RETURN;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- AUDIT ATTRIBUTION CORRECTION:
    -- actor_user_id is auth.uid() (NULL when invoked via backend service_role / system operator).
    -- Target user receiving admin is NEVER recorded as the actor.
    INSERT INTO public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (
        auth.uid(),
        'admin.role_granted',
        'user_roles',
        v_user_id::text,
        jsonb_build_object(
            'target_user_id', v_user_id::text,
            'target_email', target_user_email,
            'granted_role', 'admin',
            'operator_type', CASE WHEN auth.uid() IS NOT NULL THEN 'authenticated_operator' ELSE 'system_privileged_operator' END,
            'reason', operator_reason,
            'source', 'bootstrap_admin_procedure'
        )
    );

    RETURN QUERY SELECT
        true,
        v_user_id,
        'admin'::TEXT,
        format('Admin role successfully granted to %s (%s).', target_user_email, v_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) TO service_role;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
