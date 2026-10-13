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
      // --- SP8A financial ledger tables (migration 20240109000000) ---
      financial_accounts: {
        Row: {
          id: string;
          organization_id: string;
          code: string;
          name: string;
          account_type: string;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          code: string;
          name: string;
          account_type: string;
          currency: string;
          created_at?: string;
        };
        Update: never;
      };
      ledger_transactions: {
        Row: {
          id: string;
          organization_id: string;
          kind: string;
          status: string;
          currency: string;
          total_minor: number;
          source_type: string;
          source_id: string | null;
          reverses_transaction_id: string | null;
          idempotency_key: string | null;
          memo: string | null;
          created_by: string | null;
          posted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: string;
          status?: string;
          currency: string;
          total_minor?: number;
          source_type: string;
          source_id?: string | null;
          reverses_transaction_id?: string | null;
          idempotency_key?: string | null;
          memo?: string | null;
          created_by?: string | null;
        };
        Update: {
          status?: string;
          total_minor?: number;
          posted_at?: string | null;
          updated_at?: string;
        };
      };
      ledger_entries: {
        Row: {
          id: string;
          transaction_id: string;
          account_id: string;
          side: string;
          amount_minor: number;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          account_id: string;
          side: string;
          amount_minor: number;
          currency: string;
        };
        Update: never;
      };
      reward_ledger_links: {
        Row: {
          reward_id: string;
          organization_id: string;
          challenge_id: string;
          outcome_id: string | null;
          liability_transaction_id: string | null;
          reward_status_snapshot: string;
          financial_stage: string;
          updated_at: string;
        };
        Insert: {
          reward_id: string;
          organization_id: string;
          challenge_id: string;
          outcome_id?: string | null;
          liability_transaction_id?: string | null;
          reward_status_snapshot: string;
          financial_stage: string;
        };
        Update: {
          liability_transaction_id?: string | null;
          reward_status_snapshot?: string;
          financial_stage?: string;
          updated_at?: string;
        };
      };
      payment_records: {
        Row: {
          id: string;
          organization_id: string;
          reward_id: string;
          amount_minor: number;
          currency: string;
          evidence_type: string;
          external_ref: string;
          paid_at: string | null;
          recorded_by: string | null;
          idempotency_key: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          reward_id: string;
          amount_minor: number;
          currency: string;
          evidence_type: string;
          external_ref: string;
          paid_at?: string | null;
          recorded_by?: string | null;
          idempotency_key?: string | null;
          note?: string | null;
        };
        Update: never;
      };
      financial_adjustments: {
        Row: {
          id: string;
          organization_id: string;
          target_transaction_id: string | null;
          reason: string;
          status: string;
          proposed_currency: string;
          idempotency_key: string | null;
          created_by: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          posted_transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          target_transaction_id?: string | null;
          reason: string;
          status?: string;
          proposed_currency: string;
          idempotency_key?: string | null;
          created_by: string;
        };
        Update: {
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          posted_transaction_id?: string | null;
          updated_at?: string;
        };
      };
      reconciliation_runs: {
        Row: {
          id: string;
          organization_id: string | null;
          started_at: string;
          finished_at: string | null;
          status: string;
          rewards_examined: number;
          transactions_examined: number;
          payments_examined: number;
          issues_open: number;
          issues_resolved: number;
          initiated_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          rewards_examined?: number;
          transactions_examined?: number;
          payments_examined?: number;
          issues_open?: number;
          issues_resolved?: number;
          initiated_by?: string | null;
        };
        Update: {
          status?: string;
          finished_at?: string | null;
          issues_open?: number;
          issues_resolved?: number;
        };
      };
      reconciliation_items: {
        Row: {
          id: string;
          run_id: string;
          organization_id: string | null;
          code: string;
          severity: string;
          state: string;
          reward_id: string | null;
          transaction_id: string | null;
          payment_id: string | null;
          expected_minor: number | null;
          actual_minor: number | null;
          currency: string | null;
          detail: string;
          fingerprint: string;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          organization_id?: string | null;
          code: string;
          severity: string;
          state?: string;
          reward_id?: string | null;
          transaction_id?: string | null;
          payment_id?: string | null;
          expected_minor?: number | null;
          actual_minor?: number | null;
          currency?: string | null;
          detail: string;
          fingerprint: string;
        };
        Update: {
          state?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
      };
      financial_audit_events: {
        Row: {
          id: string;
          organization_id: string | null;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          detail: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          detail: string;
          metadata?: Record<string, unknown>;
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

