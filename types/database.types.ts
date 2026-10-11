export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'creator' | 'business' | 'admin';
export type OrganizationType = 'business' | 'agency' | 'school' | 'partner';
export type MembershipRole = 'owner' | 'member';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: UserRole;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          organization_type: OrganizationType;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          organization_type: OrganizationType;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          organization_type?: OrganizationType;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          membership_role: MembershipRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          membership_role?: MembershipRole;
          created_at?: string;
        };
        Update: {
          membership_role?: MembershipRole;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never; // Audit logs are strictly append-only / immutable
      };
      submissions: {
        Row: {
          id: string;
          challenge_id: string;
          submitted_by: string;
          title: string;
          solution_summary: string;
          solution_content: string;
          solution_url: string | null;
          files: Json;
          version: number;
          status: string;
          idempotency_key: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          submitted_by: string;
          title: string;
          solution_summary: string;
          solution_content: string;
          solution_url?: string | null;
          files?: Json;
          version?: number;
          status?: string;
          idempotency_key?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          solution_summary?: string;
          solution_content?: string;
          solution_url?: string | null;
          files?: Json;
          version?: number;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
      };
      submission_reviews: {
        Row: {
          id: string;
          submission_id: string;
          reviewer_id: string;
          status: string;
          rubric_scores: Json;
          total_weighted_score: number;
          feedback: string;
          decision: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          reviewer_id: string;
          status?: string;
          rubric_scores: Json;
          total_weighted_score?: number;
          feedback: string;
          decision?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          rubric_scores?: Json;
          total_weighted_score?: number;
          feedback?: string;
          decision?: string | null;
          updated_at?: string;
        };
      };
      submission_status_history: {
        Row: {
          id: string;
          submission_id: string;
          previous_status: string | null;
          new_status: string;
          changed_by: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          previous_status?: string | null;
          new_status: string;
          changed_by: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: never;
      };
    };
    Functions: {
      is_admin: {
        Args: { check_user_id?: string };
        Returns: boolean;
      };
      is_org_member: {
        Args: { org_id: string; check_user_id?: string };
        Returns: boolean;
      };
      is_org_owner: {
        Args: { org_id: string; check_user_id?: string };
        Returns: boolean;
      };
    };
  };
}

export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

