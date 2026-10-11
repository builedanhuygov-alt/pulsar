import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canManageOrg,
  validateRoleEscalation,
  ROLE_PERMISSIONS,
} from '../lib/auth/roles';

describe('Role-Based Access Control (RBAC) Tests', () => {
  it('Creator should have profile and creation permissions, but NOT audit access or role management', () => {
    expect(hasPermission('creator', 'profile:update_own')).toBe(true);
    expect(hasPermission('creator', 'org:create')).toBe(true);
    expect(hasPermission('creator', 'audit:read')).toBe(false);
    expect(hasPermission('creator', 'user:manage_roles')).toBe(false);
  });

  it('Business user should have org management permissions, but NOT audit or role management', () => {
    expect(hasPermission('business', 'org:invite_member')).toBe(true);
    expect(hasPermission('business', 'audit:read')).toBe(false);
    expect(hasPermission('business', 'user:manage_roles')).toBe(false);
  });

  it('Admin should have all system permissions including audit and role management', () => {
    expect(hasPermission('admin', 'audit:read')).toBe(true);
    expect(hasPermission('admin', 'audit:export')).toBe(true);
    expect(hasPermission('admin', 'user:manage_roles')).toBe(true);
    expect(hasPermission('admin', 'org:delete')).toBe(true);
  });

  it('SECURITY: Non-admin users cannot escalate roles', () => {
    // Creator cannot grant any role
    expect(validateRoleEscalation('creator', 'admin')).toBe(false);
    expect(validateRoleEscalation('creator', 'business')).toBe(false);

    // Business cannot grant any role
    expect(validateRoleEscalation('business', 'admin')).toBe(false);

    // Only Admin can manage roles
    expect(validateRoleEscalation('admin', 'business')).toBe(true);
    expect(validateRoleEscalation('admin', 'admin')).toBe(true);
  });

  it('Organization Owner vs Member permissions', () => {
    // Owner can update, invite, remove
    expect(canManageOrg('owner', 'update')).toBe(true);
    expect(canManageOrg('owner', 'delete')).toBe(true);
    expect(canManageOrg('owner', 'invite')).toBe(true);
    expect(canManageOrg('owner', 'remove')).toBe(true);

    // Normal member CANNOT update or invite or delete
    expect(canManageOrg('member', 'update')).toBe(false);
    expect(canManageOrg('member', 'delete')).toBe(false);
    expect(canManageOrg('member', 'invite')).toBe(false);
    expect(canManageOrg('member', 'remove')).toBe(false);

    // Non-member (null) CANNOT manage
    expect(canManageOrg(null, 'invite')).toBe(false);
  });
});
