export type OutcomeStatus = 'proposed' | 'finalized' | 'cancelled';

export type RewardStatus =
  | 'planned'
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export type DisbursementMethod =
  | 'manual_bank_wire'
  | 'mock_escrow_adapter'
  | 'crypto_transfer'
  | 'corporate_invoice';

export interface ChallengeOutcome {
  id: string;
  challenge_id: string;
  challenge_title?: string;
  challenge_slug?: string;
  winning_submission_id: string | null;
  winning_submission_title?: string;
  winner_id: string | null;
  winner_name?: string;
  winner_email?: string;
  organization_id: string;
  organization_name?: string;
  decided_by: string;
  decider_name?: string;
  decision_reason: string;
  status: OutcomeStatus;
  has_winner: boolean;
  final_score?: number;
  awarded_prize_amount: number;
  currency: 'USD' | 'VND' | 'EUR';
  created_at: string;
  updated_at: string;
  reward?: Reward;
}

export interface Reward {
  id: string;
  outcome_id: string;
  challenge_id: string;
  challenge_title?: string;
  submission_id?: string;
  recipient_id: string;
  recipient_name?: string;
  organization_id: string;
  organization_name?: string;
  amount: number;
  currency: 'USD' | 'VND' | 'EUR';
  status: RewardStatus;
  disbursement_method: DisbursementMethod;
  is_mock_disbursement: boolean;
  reference_code: string;
  disbursed_at: string | null;
  disbursed_by: string | null;
  disburser_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RewardStatusHistory {
  id: string;
  reward_id: string;
  previous_status: RewardStatus | null;
  new_status: RewardStatus;
  changed_by: string;
  changer_name?: string;
  reason?: string;
  created_at: string;
}

export interface VerifiedPortfolioItem {
  id: string;
  creator_id: string;
  creator_name?: string;
  challenge_id: string;
  challenge_title: string;
  challenge_slug: string;
  category: string;
  submission_id: string;
  submission_title: string;
  outcome_id: string;
  role_description: string;
  skills_acquired: string[];
  case_study_summary: string;
  case_study_metrics: Record<string, string | number>;
  awarded_prize_amount: number;
  currency: 'USD' | 'VND' | 'EUR';
  is_public: boolean;
  is_verified: boolean;
  verified_at: string;
  verified_by_org_id: string;
  verified_by_org_name: string;
  created_at: string;
}

export interface BusinessImpactMetrics {
  organization_id: string;
  organization_name: string;
  total_challenges_completed: number;
  total_submissions_received: number;
  total_submissions_accepted: number;
  acceptance_rate_percent: number;
  total_prizes_allocated: number;
  total_prizes_disbursed: number;
  currency: 'USD' | 'VND' | 'EUR';
  avg_time_to_outcome_days: number;
  verified_impact_items: {
    challenge_id: string;
    challenge_title: string;
    solution_title: string;
    winner_name: string;
    impact_summary: string;
    completed_at: string;
    is_demo: boolean;
  }[];
}
