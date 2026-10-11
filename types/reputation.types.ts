export type SkillCategory =
  | 'ai_machine_learning'
  | 'blockchain_web3'
  | 'cloud_devops'
  | 'software_architecture'
  | 'security_compliance'
  | 'data_engineering'
  | 'frontend_mobile'
  | 'domain_expertise';

export type SkillVerificationStatus =
  | 'self_declared'
  | 'evidence_submitted'
  | 'verified'
  | 'rejected';

export type ReputationTier =
  | 'insufficient_data'
  | 'emerging'
  | 'verified_talent'
  | 'top_contributor'
  | 'elite_innovator';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SignalReviewStatus = 'open' | 'under_investigation' | 'dismissed' | 'resolved';

export interface SkillTaxonomy {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  description?: string;
}

export interface CreatorSkill {
  id: string;
  creator_id: string;
  skill_id: string;
  skill_name: string;
  skill_category: SkillCategory;
  status: SkillVerificationStatus;
  evidence_type?: 'challenge_outcome' | 'submission_benchmark' | 'verified_portfolio' | 'third_party_credential';
  evidence_challenge_id?: string;
  evidence_challenge_title?: string;
  evidence_submission_id?: string;
  evidence_portfolio_id?: string;
  evidence_notes?: string;
  verified_by_org_id?: string;
  verified_by_org_name?: string;
  verified_by_user_id?: string;
  verified_by_user_name?: string;
  verified_at?: string;
  rejection_reason?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScoreProvenanceItem {
  metric: string;
  value: number | string | null;
  weight: number;
  contribution_percent: number;
  explanation: string;
  data_points_count: number;
  is_reliable: boolean;
}

export interface CreatorReputationProfile {
  creator_id: string;
  creator_name: string;
  total_challenges_participated: number;
  total_submissions_submitted: number;
  total_submissions_accepted: number;
  total_verified_outcomes: number;
  on_time_delivery_count: number;
  on_time_delivery_rate: number | null; // null if insufficient data
  weighted_review_score_avg: number | null; // null if insufficient data
  verified_skills_count: number;
  confirmed_collaborations_count: number;
  composite_reputation_score: number | null; // null if insufficient data
  reputation_tier: ReputationTier;
  provenance_breakdown: ScoreProvenanceItem[];
  is_public: boolean;
  last_computed_at: string;
}

export interface OrganizationReputationProfile {
  organization_id: string;
  organization_name: string;
  total_challenges_created: number;
  total_challenges_finalized: number;
  total_prizes_allocated: number;
  total_prizes_disbursed: number;
  disbursement_rate_percent: number | null;
  avg_review_turnaround_days: number | null;
  escrow_fidelity_score: number | null;
  last_computed_at: string;
}

export interface BusinessAnalyticsOverview {
  organization_id: string;
  organization_name: string;
  timeframe: 'all_time' | 'last_90_days' | 'last_30_days';
  kpis: {
    total_challenges_created: { value: number; label: string; formula: string };
    published_challenges: { value: number; label: string; formula: string };
    closed_and_finalized: { value: number; label: string; formula: string };
    total_submissions_received: { value: number; label: string; formula: string };
    acceptance_rate: { value: number | null; formatted: string; label: string; formula: string; numerator: number; denominator: number };
    avg_turnaround_days: { value: number | null; formatted: string; label: string; formula: string };
    budget_planned: { value: number; currency: string; label: string; formula: string };
    prizes_approved: { value: number; currency: string; label: string; formula: string };
    prizes_disbursed: { value: number; currency: string; label: string; formula: string };
    evidence_backed_outcomes: { value: number; label: string; formula: string };
  };
  breakdown_by_category: {
    category: string;
    challenges_count: number;
    submissions_count: number;
    disbursed_amount: number;
  }[];
  data_confidence: {
    is_demo_data: boolean;
    sample_size_adequate: boolean;
    missing_fields_notes: string[];
  };
}

export interface IntegritySignal {
  id: string;
  signal_type:
    | 'identical_feedback_pattern'
    | 'score_anomaly_spike'
    | 'rapid_successive_submissions'
    | 'correlated_account_cluster'
    | 'state_machine_transition_irregularity'
    | 'disbursement_mismatch';
  severity: SignalSeverity;
  target_entity_type: 'submission' | 'review' | 'challenge' | 'user' | 'organization';
  target_entity_id: string;
  target_entity_label?: string;
  organization_id?: string;
  organization_name?: string;
  detection_rule_name: string;
  explanation: string;
  supporting_evidence: Record<string, any>;
  review_status: SignalReviewStatus;
  resolved_by?: string;
  resolved_by_name?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}
