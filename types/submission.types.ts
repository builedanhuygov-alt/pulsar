import type { EvaluationCriterion } from './challenge.types';

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface SubmissionFile {
  id: string;
  name: string;
  size: number; // in bytes
  mime_type: string;
  storage_path: string;
  uploaded_at: string;
  is_private: boolean;
  signed_url?: string; // Expiring access URL
}

export interface RubricScoreItem {
  criterion_id: string;
  criterion_name: string;
  weight: number; // e.g. 40 for 40%
  score: number; // 0 - 100
  comments: string;
}

export interface SubmissionReview {
  id: string;
  submission_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  status: 'draft' | 'submitted';
  rubric_scores: RubricScoreItem[];
  total_weighted_score: number; // 0 - 100
  feedback: string;
  decision?: 'shortlist' | 'accept' | 'reject' | 'needs_revision';
  created_at: string;
  updated_at: string;
}

export interface SubmissionStatusHistory {
  id: string;
  submission_id: string;
  previous_status: SubmissionStatus | null;
  new_status: SubmissionStatus;
  changed_by: string;
  changer_name?: string;
  reason?: string;
  created_at: string;
}

export interface Submission {
  id: string;
  challenge_id: string;
  challenge_title?: string;
  challenge_slug?: string;
  organization_id?: string;
  organization_name?: string;
  submitted_by: string;
  creator_name?: string;
  creator_email?: string;
  title: string;
  solution_summary: string;
  solution_content: string; // Detailed architectural / implementation writeup
  solution_url?: string; // Repository or interactive demo URL
  files: SubmissionFile[];
  version: number;
  status: SubmissionStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  idempotency_key?: string;
  reviews?: SubmissionReview[];
  average_score?: number;
}

export interface SubmissionFilterOptions {
  challengeId?: string;
  status?: SubmissionStatus | 'all';
  searchQuery?: string;
  submittedBy?: string;
  organizationId?: string;
}
