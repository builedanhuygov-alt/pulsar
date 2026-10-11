export type ChallengeStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'closed'
  | 'cancelled';

export type ChallengeCategory =
  | 'ai_ml'
  | 'blockchain'
  | 'cloud_devops'
  | 'mobile_iot'
  | 'fintech'
  | 'security';

export interface EvaluationCriterion {
  id: string;
  name: string;
  weight: number; // Percentage, e.g. 30 for 30%
  description: string;
}

export interface Challenge {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  problem_statement: string;
  desired_outcome: string;
  category: ChallengeCategory;
  requirements: string[];
  deliverables: string[];
  evaluation_criteria: EvaluationCriterion[];
  budget_min: number;
  budget_max: number;
  currency: 'USD' | 'VND' | 'EUR';
  prize_pool: number;
  start_at: string;
  deadline_at: string;
  organization_id: string;
  organization_name?: string;
  organization_slug?: string;
  created_by: string;
  creator_name?: string;
  status: ChallengeStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  latest_review_note?: string;
}

export interface ChallengeReviewRecord {
  id: string;
  challenge_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  action: 'approve' | 'reject' | 'request_changes';
  notes: string;
  created_at: string;
}

export interface ChallengeFilterOptions {
  searchQuery?: string;
  category?: ChallengeCategory | 'all';
  status?: ChallengeStatus | 'all';
  minBudget?: number;
  maxBudget?: number;
  organizationId?: string;
}
