import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, UserRole } from '../../types/database.types';
import type { PulsarUser } from '../../types/auth.types';

export async function getCurrentPulsarUser(
  supabase: SupabaseClient<Database>
): Promise<PulsarUser | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Fetch role securely from user_roles table (NEVER TRUST JWT client claims alone)
  const { data: rolesData, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  let activeRole: UserRole = 'creator';
  if (!rolesError && rolesData && (rolesData as any[]).length > 0) {
    // If admin is in roles, admin takes precedence, then business, then creator
    if ((rolesData as any[]).some((r: any) => r.role === 'admin')) {
      activeRole = 'admin';
    } else if ((rolesData as any[]).some((r: any) => r.role === 'business')) {
      activeRole = 'business';
    } else {
      activeRole = 'creator';
    }
  }

  // Fetch memberships
  const { data: memberships, error: memberError } = await supabase
    .from('organization_members')
    .select('membership_role, organizations (*)')
    .eq('user_id', user.id);

  const parsedOrgs = (memberships || [])
    .filter((m: any) => m.organizations !== null)
    .map((m: any) => ({
      organization: m.organizations,
      membership_role: m.membership_role,
    }));

  return {
    id: user.id,
    email: user.email || '',
    role: activeRole,
    profile,
    organizations: parsedOrgs,
  };
}
