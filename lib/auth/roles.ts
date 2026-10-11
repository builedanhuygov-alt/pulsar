import type { UserRole, MembershipRole } from '../../types/database.types';
import type { Permission } from '../../types/auth.types';

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  creator: [
    'profile:update_own',
    'org:create',
    'org:read',
  ],
  business: [
    'profile:update_own',
    'org:create',
    'org:read',
    'org:update',
    'org:invite_member',
    'org:remove_member',
  ],
  admin: [
    'profile:update_own',
    'org:create',
    'org:read',
    'org:update',
    'org:delete',
    'org:invite_member',
    'org:remove_member',
    'audit:read',
    'audit:export',
    'user:manage_roles',
  ],
} as const;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return (permissions as readonly string[]).includes(permission);
}

export function canManageOrg(membershipRole: MembershipRole | null | undefined, action: 'update' | 'delete' | 'invite' | 'remove'): boolean {
  if (membershipRole === 'owner') return true;
  return false;
}

export function isPrivilegedRole(role: UserRole): boolean {
  return role === 'admin';
}

export function validateRoleEscalation(actorRole: UserRole, targetRole: UserRole): boolean {
  // Only an existing admin can assign or modify a role to 'admin' or any other role
  if (actorRole !== 'admin') {
    return false;
  }
  return true;
}
