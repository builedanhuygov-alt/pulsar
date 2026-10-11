-- ==============================================================================
-- PULSAR Sprint 1: Privileged Admin Bootstrap Procedure
-- 20240101000003_admin_bootstrap_procedure.sql
-- ==============================================================================

-- Security Note:
-- There is NO public signup route for admins.
-- The initial Super Admin account is provisioned via an operational procedure
-- executed by an authorized operator through the Supabase Dashboard SQL Editor,
-- direct psql connection, or a secured CI/CD operational pipeline.

CREATE OR REPLACE FUNCTION public.bootstrap_admin_user(
    target_user_email TEXT,
    operator_reason TEXT DEFAULT 'Initial deployment bootstrap'
)
RETURNS TABLE (
    success BOOLEAN,
    user_id UUID,
    assigned_role TEXT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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

    -- 3. Verify target user exists in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = lower(trim(target_user_email));

    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT
            false,
            NULL::UUID,
            NULL::TEXT,
            format('User with email "%s" not found in auth.users. Please register the user first.', target_user_email);
        RETURN;
    END IF;

    -- 4. Upsert admin role into user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 5. Log privileged event in immutable audit_logs
    -- AUDIT ATTRIBUTION CORRECTION:
    -- actor_user_id is auth.uid() (NULL when invoked via backend service_role / system operator).
    -- Target user receiving admin is NEVER recorded as the actor.
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
    ) VALUES (
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

-- Restrict execution permissions: only postgres and service_role can execute
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_user(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.bootstrap_admin_user IS
'Privileged operational procedure to grant admin privileges. Run exclusively from Supabase SQL editor or via backend service_role.';
