-- ==============================================================================
-- PULSAR Sprint 1: Row Level Security (RLS) & Security Policies
-- 20240101000001_create_rls_policies.sql
-- ==============================================================================

-- Enable Row Level Security on ALL user-facing and private tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- ANTI-RECURSION SECURITY DEFINER HELPER FUNCTIONS
-- Using SECURITY DEFINER and fixed search_path prevents infinite recursion in RLS.
-- Strictly bound to auth.uid() of current caller to prevent role probing of arbitrary users.
-- ------------------------------------------------------------------------------

-- Check if current authenticated user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
    );
$$;

-- Check if current authenticated user is a member of target organization
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = target_org_id
          AND user_id = auth.uid()
    );
$$;

-- Check if current authenticated user is an owner of target organization
CREATE OR REPLACE FUNCTION public.is_org_owner(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = target_org_id
          AND user_id = auth.uid()
          AND membership_role = 'owner'
    );
$$;

-- ------------------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
CREATE POLICY "Users can update only their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Prevent unauthorized deletion; only cascade or admin
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
CREATE POLICY "Only admins can delete profiles"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. USER ROLES POLICIES
-- Strict: Users CANNOT self-assign or escalate roles
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own roles or admins view all" ON public.user_roles;
CREATE POLICY "Users can view their own roles or admins view all"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- Only admins can grant or modify roles directly via SQL API
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
    ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATIONS POLICIES
-- Visible only to organization members or global admins
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members or admins can view organizations" ON public.organizations;
CREATE POLICY "Members or admins can view organizations"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (public.is_org_member(id) OR public.is_admin());

-- Any authenticated creator or business user can create an organization
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Only owners or global admins can update organization details
DROP POLICY IF EXISTS "Owners or admins can update organizations" ON public.organizations;
CREATE POLICY "Owners or admins can update organizations"
    ON public.organizations
    FOR UPDATE
    TO authenticated
    USING (public.is_org_owner(id) OR public.is_admin())
    WITH CHECK (public.is_org_owner(id) OR public.is_admin());

-- Only owners or global admins can delete organizations
DROP POLICY IF EXISTS "Owners or admins can delete organizations" ON public.organizations;
CREATE POLICY "Owners or admins can delete organizations"
    ON public.organizations
    FOR DELETE
    TO authenticated
    USING (public.is_org_owner(id) OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. ORGANIZATION MEMBERS POLICIES
-- Visible only within the organization. Only owner can manage members.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view membership within same org" ON public.organization_members;
CREATE POLICY "Members can view membership within same org"
    ON public.organization_members
    FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id) OR public.is_admin());

-- Only owners can invite or add members
DROP POLICY IF EXISTS "Owners or admins can add organization members" ON public.organization_members;
CREATE POLICY "Owners or admins can add organization members"
    ON public.organization_members
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

-- Only owners can change membership roles
DROP POLICY IF EXISTS "Owners or admins can update membership roles" ON public.organization_members;
CREATE POLICY "Owners or admins can update membership roles"
    ON public.organization_members
    FOR UPDATE
    TO authenticated
    USING (public.is_org_owner(organization_id) OR public.is_admin())
    WITH CHECK (public.is_org_owner(organization_id) OR public.is_admin());

-- Owners can remove members, or a member can leave (delete own record)
DROP POLICY IF EXISTS "Owners can remove members or members can leave" ON public.organization_members;
CREATE POLICY "Owners can remove members or members can leave"
    ON public.organization_members
    FOR DELETE
    TO authenticated
    USING (
        public.is_org_owner(organization_id)
        OR (auth.uid() = user_id)
        OR public.is_admin()
    );

-- ------------------------------------------------------------------------------
-- 5. AUDIT LOGS POLICIES & IMMUTABILITY
-- Highly confidential & tamper-proof.
-- INSERT: only service_role (trusted backend code).
-- UPDATE / DELETE: strictly forbidden for EVERYONE (no policy allows update/delete).
-- SELECT: Admins can view all; actors can view their own events.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins or actors can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins or actors can view audit logs"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.is_admin() OR auth.uid() = actor_user_id);

-- ------------------------------------------------------------------------------
-- 6. EXPLICIT GRANTS FOR POSTGREST & RLS
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grants subject to RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;

-- Audit logs: Authenticated users only receive SELECT permission subject to RLS
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- Helper Functions: Revoke default EXECUTE from PUBLIC and anon; grant strictly to authenticated and service_role for RLS
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated, service_role;
