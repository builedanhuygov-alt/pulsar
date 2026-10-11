import type { Database, UserRole, OrganizationType, MembershipRole } from './database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];

export type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

export interface PulsarUser {
  id: string;
  email: string;
  role: UserRole;
  profile: Profile;
  organizations: {
    organization: Organization;
    membership_role: MembershipRole;
  }[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: PulsarUser;
}

export type Permission =
  | 'org:create'
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:invite_member'
  | 'org:remove_member'
  | 'audit:read'
  | 'audit:export'
  | 'user:manage_roles'
  | 'profile:update_own';
