-- ==============================================================================
-- PULSAR Sprint 1: Base Schema Migration
-- 20240101000000_create_base_schema.sql
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()))
);

-- Index for searching and display
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- ------------------------------------------------------------------------------
-- 2. USER ROLES TABLE
-- Roles: 'creator', 'business', 'admin'
-- Strict constraint: unique(user_id, role)
-- Users cannot self-grant or modify their roles.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('creator', 'business', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now())),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATIONS TABLE
-- Types: 'business', 'agency', 'school', 'partner'
-- Slug must be unique and URL-friendly.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. ORGANIZATION MEMBERS TABLE
-- Roles: 'owner', 'member'
-- Unique constraint: (organization_id, user_id)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. AUDIT LOGS TABLE
-- Immutable security audit log. Only privileged backend / service_role can insert.
-- Users cannot modify, update or delete entries.
-- ------------------------------------------------------------------------------
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
-- 6. AUTOMATIC UPDATED_AT & IMMUTABILITY TRIGGER FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.created_at = OLD.created_at; -- DEFENSE-IN-DEPTH: Disallow mutating created_at
    NEW.id = OLD.id;                 -- DEFENSE-IN-DEPTH: Disallow mutating primary key id
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Strictly prevent mutation or deletion of audit logs at the database engine level
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are strictly immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_mutation();
