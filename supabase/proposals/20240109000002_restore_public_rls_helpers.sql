-- ==============================================================================
-- PROPOSAL — NOT YET APPLIED. Requires human review + explicit approval.
-- Proposed filename on approval: supabase/migrations/20240109000002_restore_public_rls_helpers.sql
-- (staged here under supabase/proposals/ so `supabase db push --dry-run`
-- and `db push` will NOT pick it up until a human moves it into migrations/.)
--
-- Purpose: restore the `public.is_*()` RLS helper entry points that ~40
-- policies reference, after staging-only migration `isolate_rls_authorization_helpers`
-- (20261011053119) moved the implementations to `private.*` without updating
-- callers. Every policy branch calling `public.is_admin()`,
-- `public.is_org_member()`, `public.is_org_owner()`,
-- `public.is_workspace_member()` or `public.is_workspace_reviewer()` currently
-- raises "function does not exist" at plan time.
--
-- Design: thin SECURITY DEFINER wrappers delegating to the verified
-- `private.*` implementations. The private functions enforce
-- `check_user_id = auth.uid()`, so wrappers cannot be abused to probe other
-- users (any non-self argument evaluates to false/denied).
-- ==============================================================================

BEGIN;

-- Precondition: each private.* helper must exist EXACTLY once (name-level
-- count rejects hidden extra overloads), with exact full argument list
-- including the default expression, boolean returns, SECURITY DEFINER, exact
-- search_path, and postgres ownership. Any deviation aborts before any
-- wrapper is created. Literals captured verbatim from staging catalog.
DO $$
DECLARE
  v_problems TEXT[] := '{}';
BEGIN
  -- is_admin(check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
  IF (SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname = 'is_admin') <> 1 THEN
    v_problems := v_problems || 'private.is_admin: expected exactly one overload';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'is_admin'
      AND pg_catalog.pg_get_function_arguments(p.oid) = 'check_user_id uuid DEFAULT auth.uid()'
      AND p.prorettype = 'boolean'::pg_catalog.regtype
      AND p.prosecdef
      AND array_to_string(p.proconfig, ',') = 'search_path=pg_catalog, public, auth'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres') THEN
    v_problems := v_problems || 'private.is_admin: full signature/returns/secdef/search_path/owner mismatch';
  END IF;

  -- is_org_member(target_org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
  IF (SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname = 'is_org_member') <> 1 THEN
    v_problems := v_problems || 'private.is_org_member: expected exactly one overload';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'is_org_member'
      AND pg_catalog.pg_get_function_arguments(p.oid) = 'target_org_id uuid, check_user_id uuid DEFAULT auth.uid()'
      AND p.prorettype = 'boolean'::pg_catalog.regtype
      AND p.prosecdef
      AND array_to_string(p.proconfig, ',') = 'search_path=pg_catalog, public, auth'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres') THEN
    v_problems := v_problems || 'private.is_org_member: full signature/returns/secdef/search_path/owner mismatch';
  END IF;

  -- is_org_owner(target_org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
  IF (SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname = 'is_org_owner') <> 1 THEN
    v_problems := v_problems || 'private.is_org_owner: expected exactly one overload';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'is_org_owner'
      AND pg_catalog.pg_get_function_arguments(p.oid) = 'target_org_id uuid, check_user_id uuid DEFAULT auth.uid()'
      AND p.prorettype = 'boolean'::pg_catalog.regtype
      AND p.prosecdef
      AND array_to_string(p.proconfig, ',') = 'search_path=pg_catalog, public, auth'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres') THEN
    v_problems := v_problems || 'private.is_org_owner: full signature/returns/secdef/search_path/owner mismatch';
  END IF;

  -- is_workspace_member(target_workspace_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
  IF (SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname = 'is_workspace_member') <> 1 THEN
    v_problems := v_problems || 'private.is_workspace_member: expected exactly one overload';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'is_workspace_member'
      AND pg_catalog.pg_get_function_arguments(p.oid) = 'target_workspace_id uuid, check_user_id uuid DEFAULT auth.uid()'
      AND p.prorettype = 'boolean'::pg_catalog.regtype
      AND p.prosecdef
      AND array_to_string(p.proconfig, ',') = 'search_path=pg_catalog, public, auth'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres') THEN
    v_problems := v_problems || 'private.is_workspace_member: full signature/returns/secdef/search_path/owner mismatch';
  END IF;

  -- is_workspace_reviewer(target_workspace_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
  IF (SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname = 'is_workspace_reviewer') <> 1 THEN
    v_problems := v_problems || 'private.is_workspace_reviewer: expected exactly one overload';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'is_workspace_reviewer'
      AND pg_catalog.pg_get_function_arguments(p.oid) = 'target_workspace_id uuid, check_user_id uuid DEFAULT auth.uid()'
      AND p.prorettype = 'boolean'::pg_catalog.regtype
      AND p.prosecdef
      AND array_to_string(p.proconfig, ',') = 'search_path=pg_catalog, public, auth'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres') THEN
    v_problems := v_problems || 'private.is_workspace_reviewer: full signature/returns/secdef/search_path/owner mismatch';
  END IF;

  IF array_length(v_problems, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Prerequisite failed: %', array_to_string(v_problems, '; ');
  END IF;
END $$;

-- 1. is_admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT private.is_admin(check_user_id);
$$;

-- 2. is_org_member
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT private.is_org_member(target_org_id, check_user_id);
$$;

-- 3. is_org_owner
CREATE OR REPLACE FUNCTION public.is_org_owner(target_org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT private.is_org_owner(target_org_id, check_user_id);
$$;

-- 4. is_workspace_member
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT private.is_workspace_member(target_workspace_id, check_user_id);
$$;

-- 5. is_workspace_reviewer
CREATE OR REPLACE FUNCTION public.is_workspace_reviewer(target_workspace_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT private.is_workspace_reviewer(target_workspace_id, check_user_id);
$$;

-- Least privilege: staging hardened default privileges (revoked EXECUTE on
-- future functions from PUBLIC/anon/authenticated), and the pre-move grants
-- moved away with the objects into `private`. Every wrapper therefore needs
-- explicit grants. No anon grant (matches pre-move posture; anon callers in
-- PUBLIC-role policies fail closed with permission denied, as before).
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_owner(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_workspace_reviewer(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_reviewer(UUID, UUID) TO authenticated, service_role;

-- Post-apply verification (read-only):
--   SELECT routine_schema, routine_name, grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_schema = 'public'
--     AND routine_name IN ('is_admin','is_org_member','is_org_owner',
--                          'is_workspace_member','is_workspace_reviewer')
--   ORDER BY 1, 2, 3;
-- Expect: authenticated + service_role (+postgres owner) EXECUTE on all five;
-- no anon, no PUBLIC.

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ROLLBACK (narrow, non-destructive — restores the current pre-wrapper state,
-- does not touch private.* functions, policies, or grants on other objects):
--   DROP FUNCTION IF EXISTS public.is_admin(UUID);
--   DROP FUNCTION IF EXISTS public.is_org_member(UUID, UUID);
--   DROP FUNCTION IF EXISTS public.is_org_owner(UUID, UUID);
--   DROP FUNCTION IF EXISTS public.is_workspace_member(UUID, UUID);
--   DROP FUNCTION IF EXISTS public.is_workspace_reviewer(UUID, UUID);
