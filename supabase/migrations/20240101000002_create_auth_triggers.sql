-- ==============================================================================
-- PULSAR Sprint 1: Auth & Organization Triggers
-- 20240101000002_create_auth_triggers.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTH USER CREATION TRIGGER
-- Handles automatic profile initialization and default role assignment.
-- Sanitizes requested role so clients CANNOT elevate to admin.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_display_name TEXT;
    v_avatar_url TEXT;
    v_requested_role TEXT;
    v_assigned_role TEXT;
BEGIN
    -- Extract display name with fallback to username part of email or 'Pulsar Member'
    v_display_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(split_part(NEW.email, '@', 1), ''),
        'Pulsar Member'
    );

    v_avatar_url := NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), '');

    -- SECURITY SAFEGUARD: Never allow client to register directly as 'admin'
    v_requested_role := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'creator'));
    IF v_requested_role = 'business' THEN
        v_assigned_role := 'business';
    ELSE
        -- Defaults to creator; any unauthorized value (including 'admin') is forced to 'creator'
        v_assigned_role := 'creator';
    END IF;

    -- Create user profile (Idempotent)
    INSERT INTO public.profiles (id, display_name, avatar_url, bio)
    VALUES (NEW.id, v_display_name, v_avatar_url, NULL)
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(NULLIF(public.profiles.display_name, 'Pulsar Member'), EXCLUDED.display_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

    -- Assign user role (Idempotent)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_assigned_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Record system audit log entry
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
    ) VALUES (
        NEW.id,
        'user.registered',
        'user',
        NEW.id::text,
        jsonb_build_object(
            'email', NEW.email,
            'assigned_role', v_assigned_role,
            'source', 'auth_trigger'
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log warning and re-raise to ensure atomic signup rollback if profile creation fails
        RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
        RAISE EXCEPTION 'Failed to initialize user profile and role: %', SQLERRM;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. ORGANIZATION CREATOR OWNER ASSIGNMENT TRIGGER
-- Ensures creating an organization atomically adds the creator as 'owner'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Automatically add the creator as owner in organization_members (Idempotent)
    INSERT INTO public.organization_members (
        organization_id,
        user_id,
        membership_role
    ) VALUES (
        NEW.id,
        NEW.created_by,
        'owner'
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- Record audit log
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
    ) VALUES (
        NEW.created_by,
        'organization.created',
        'organization',
        NEW.id::text,
        jsonb_build_object(
            'name', NEW.name,
            'slug', NEW.slug,
            'type', NEW.organization_type
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_organization();
