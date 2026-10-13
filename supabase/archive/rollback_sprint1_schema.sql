-- ==============================================================================
-- PULSAR PLATFORM - SPRINT 1 ROLLBACK SCRIPT (DISASTER RECOVERY ONLY)
-- File: supabase/migrations/rollback_sprint1_schema.sql
-- WARNING: This script drops all tables and functions created in Sprint 1.
-- It will delete all user profiles, roles, organizations, and audit logs.
-- It will NOT delete user authentication credentials in auth.users.
-- ==============================================================================

BEGIN;

-- 1. DROP TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;

-- 2. DROP STORED PROCEDURES & TRIGGER FUNCTIONS
DROP FUNCTION IF EXISTS public.bootstrap_admin_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.handle_new_organization();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.is_org_owner(UUID);
DROP FUNCTION IF EXISTS public.is_org_owner(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_org_member(UUID);
DROP FUNCTION IF EXISTS public.is_org_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin(UUID);
DROP FUNCTION IF EXISTS public.prevent_audit_log_mutation();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- 3. DROP TABLES IN REVERSE DEPENDENCY ORDER
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 4. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
