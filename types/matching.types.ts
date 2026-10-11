import type { Challenge, EvaluationCriterion } from './challenge.types';
import type { CreatorSkill, CreatorReputationProfile } from './reputation.types';
import type { VerifiedPortfolioItem } from './outcome.types';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient_data';

export interface ScoreComponentBreakdown {
  name: string;
  weight: number; // e.g. 35%
  score: number; // 0 - 100
  weighted_contribution: number; // score * weight / 100
  explanation: string;
  matched_items: string[];
  missing_items: string[];
}

export interface ChallengeCreatorMatch {
  challenge_id: string;
  challenge_title: string;
  challenge_slug: string;
  organization_id: string;
  organization_name: string;
  creator_id: string;
  creator_name: string;
  creator_role?: string;
  composite_match_score: number; // 0 - 100
  confidence: ConfidenceLevel;
  components: {
    skill_alignment: ScoreComponentBreakdown; // 35%
    evidence_alignment: ScoreComponentBreakdown; // 25%
    domain_relevance: ScoreComponentBreakdown; // 15%
    verified_track_record: ScoreComponentBreakdown; // 15%
    availability_and_constraints: ScoreComponentBreakdown; // 10%
  };
  reasons: string[];
  evidence_highlights: string[];
  skill_gaps: string[];
  computed_at: string;
  is_dismissed?: boolean;
  is_interested?: boolean;
}

export interface CreatorFeedItem {
  challenge: Challenge;
  match: ChallengeCreatorMatch;
}

export interface TalentMatchItem {
  creator_id: string;
  creator_name: string;
  creator_email?: string;
  creator_bio?: string;
  reputation_tier: string;
  composite_reputation_score: number | null;
  match: ChallengeCreatorMatch;
}

export interface RecommendationFeedbackRecord {
  id: string;
  user_id: string;
  challenge_id: string;
  target_creator_id?: string;
  feed_type: 'creator_feed' | 'business_talent_match';
  action: 'viewed' | 'dismissed' | 'interested' | 'applied';
  match_score: number;
  confidence_level: ConfidenceLevel;
  created_at: string;
}

export interface CopilotAnalysisResult {
  clarity_score: number; // 0 - 100
  strengths: string[];
  unclear_objectives: string[];
  deliverable_refinements: {
    original?: string;
    suggestion: string;
    reason: string;
  }[];
  rubric_suggestions: {
    suggested_criteria: EvaluationCriterion[];
    total_weight: number;
    explanation: string;
  };
  conflicts_or_risks: string[];
  clarification_questions: string[];
  is_ai_generated: boolean;
  model_source: 'gemini-rule-engine-hybrid' | 'deterministic-copilot';
}
