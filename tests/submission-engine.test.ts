import { describe, it, expect, beforeEach } from 'vitest';
import {
  submissionFormSchema,
  submissionReviewSchema,
} from '../lib/validation/submission.schema';
import {
  canSubmitToChallenge,
  canTransitionSubmissionStatus,
  canReviewSubmission,
} from '../lib/submission/submissionWorkflow';
import { submissionService } from '../lib/submission/submissionService';
import { challengeService } from '../lib/challenge/challengeService';
import type { Challenge } from '../types/challenge.types';

describe('PULSAR Sprint 3: Submission Engine Test Suite', () => {
  beforeEach(() => {
    challengeService._resetStore();
    submissionService._resetStore();
  });

  // ============================================================================
  // 1. DATA VALIDATION & SCHEMA CHECKS
  // ============================================================================
  describe('1. Submission Validation Schemas (Zod)', () => {
    const validSubmissionPayload = {
      challenge_id: 'ch-demo-001',
      title: 'Hệ thống Phân tích Hợp đồng Thông minh PulsarLegal',
      solution_summary:
        'Ứng dụng mô hình AI ngôn ngữ lớn kết hợp trích xuất tri thức pháp lý tự động.',
      solution_content:
        'Hệ thống gồm 3 module chính: Module tiền xử lý văn bản OCR/PDF, Module truy xuất vector BM25/BGE-m3, và Module lập luận LLM kiểm tra chéo điều khoản rủi ro.',
      solution_url: 'https://github.com/pulsar/legal-ai-agent',
      files: [
        {
          id: 'file-1',
          name: 'architecture_diagram.pdf',
          size: 1024 * 500, // 500 KB
          mime_type: 'application/pdf',
          storage_path: 'submissions/ch-demo-001/file-1.pdf',
          uploaded_at: '2026-03-01T00:00:00Z',
          is_private: true,
        },
      ],
      idempotency_key: 'idem-test-001',
    };

    it('SUB-VAL-01: Accepts fully valid submission payload', () => {
      const result = submissionFormSchema.safeParse(validSubmissionPayload);
      expect(result.success).toBe(true);
    });

    it('SUB-VAL-02: Rejects submission with title shorter than 5 characters', () => {
      const result = submissionFormSchema.safeParse({
        ...validSubmissionPayload,
        title: 'App',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ít nhất 5 ký tự');
      }
    });

    it('SUB-VAL-03: Rejects submission_summary shorter than 20 characters', () => {
      const result = submissionFormSchema.safeParse({
        ...validSubmissionPayload,
        solution_summary: 'Quá ngắn',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ít nhất 20 ký tự');
      }
    });

    it('SUB-VAL-04: Rejects solution_content shorter than 50 characters', () => {
      const result = submissionFormSchema.safeParse({
        ...validSubmissionPayload,
        solution_content: 'Mô tả kiến trúc chưa đủ 50 ký tự.',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ít nhất 50 ký tự');
      }
    });

    it('SUB-VAL-05: Rejects file attachment exceeding 25MB limit', () => {
      const result = submissionFormSchema.safeParse({
        ...validSubmissionPayload,
        files: [
          {
            id: 'file-huge',
            name: 'heavy_dataset.zip',
            size: 30 * 1024 * 1024, // 30MB > 25MB
            mime_type: 'application/zip',
            storage_path: 'submissions/huge.zip',
            uploaded_at: '2026-03-01T00:00:00Z',
            is_private: true,
          },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('không được vượt quá 25MB');
      }
    });

    it('SUB-VAL-06: Review schema requires at least 10 chars feedback', () => {
      const result = submissionReviewSchema.safeParse({
        submission_id: 'sub-1',
        status: 'submitted',
        rubric_scores: [
          { criterion_id: 'c1', criterion_name: 'Accuracy', weight: 100, score: 90, comments: 'Good' },
        ],
        feedback: 'Too short', // < 10 chars
      });
      expect(result.success).toBe(false);
    });

    it('SUB-VAL-07: Rejection review requires detailed explanation (>= 20 chars)', () => {
      const result = submissionReviewSchema.safeParse({
        submission_id: 'sub-1',
        status: 'submitted',
        decision: 'reject',
        rubric_scores: [
          { criterion_id: 'c1', criterion_name: 'Accuracy', weight: 100, score: 30, comments: 'Poor' },
        ],
        feedback: 'Bài thi không đạt', // 17 chars (< 20 chars)
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('tối thiểu 20 ký tự');
      }
    });
  });

  // ============================================================================
  // 2. DEADLINE & CHALLENGE STATUS SERVER GUARDS
  // ============================================================================
  describe('2. Submission Rules & Workflow Guard', () => {
    const mockPublishedChallenge: Challenge = {
      id: 'ch-test-pub',
      title: 'Published Open Challenge',
      slug: 'published-open-challenge',
      short_description: 'Valid challenge short description with enough characters',
      problem_statement: 'Problem statement with enough length to pass schema validation constraints',
      desired_outcome: 'Desired outcome with enough length to pass constraints',
      category: 'ai_ml',
      requirements: ['req 1'],
      deliverables: ['del 1'],
      evaluation_criteria: [{ id: 'c1', name: 'Crit', weight: 100, description: '' }],
      budget_min: 1000,
      budget_max: 2000,
      currency: 'USD',
      prize_pool: 2000,
      start_at: '2026-01-01T00:00:00Z',
      deadline_at: '2026-12-31T23:59:59Z', // Future deadline
      organization_id: 'org-lab-01',
      created_by: 'usr-1',
      status: 'published',
      published_at: '2026-01-02T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    it('RULE-01: Allows submission when challenge is published and before deadline', () => {
      const check = canSubmitToChallenge(mockPublishedChallenge, new Date('2026-03-01T00:00:00Z'));
      expect(check.allowed).toBe(true);
    });

    it('RULE-02: BLOCKS submission when challenge deadline has passed', () => {
      const pastDate = new Date('2027-01-01T00:00:00Z'); // After 2026-12-31
      const check = canSubmitToChallenge(mockPublishedChallenge, pastDate);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Đã quá hạn nộp bài');
    });

    it('RULE-03: BLOCKS submission if challenge is not in "published" status', () => {
      const draftChallenge: Challenge = { ...mockPublishedChallenge, status: 'draft' };
      const pendingChallenge: Challenge = { ...mockPublishedChallenge, status: 'pending_review' };
      const closedChallenge: Challenge = { ...mockPublishedChallenge, status: 'closed' };

      expect(canSubmitToChallenge(draftChallenge).allowed).toBe(false);
      expect(canSubmitToChallenge(pendingChallenge).allowed).toBe(false);
      expect(canSubmitToChallenge(closedChallenge).allowed).toBe(false);
    });

    it('RULE-04: Prevents double-submission / duplicate active entry from same user', () => {
      const payload = {
        challenge_id: 'ch-demo-001',
        title: 'Thử nghiệm Giải pháp Song song',
        solution_summary: 'Tóm tắt giải pháp với đầy đủ ký tự hợp lệ theo quy định.',
        solution_content: 'Mô tả kiến trúc giải pháp với độ dài chi tiết vượt trên mức tối thiểu 50 ký tự.',
        files: [],
      };

      // ch-demo-001 already has active sub-demo-001 submitted by usr-creator-001
      const res = submissionService.createSubmission(
        payload,
        'usr-creator-001',
        'Minh Quang',
        'creator@pulsar.dev',
        true
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('đã có một bài dự thi đang hoạt động');
    });

    it('RULE-05: Creator CANNOT self-escalate submission status to shortlisted or accepted', () => {
      const decision = canTransitionSubmissionStatus('submitted', 'accepted', {
        userId: 'usr-creator-001',
        userRole: 'creator',
        isOwnerOfSubmission: true,
        isChallengeOrgMember: false,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Chỉ doanh nghiệp tổ chức hoặc Quản trị viên');
    });

    it('RULE-06: Creator can withdraw their submission', () => {
      const decision = canTransitionSubmissionStatus('submitted', 'withdrawn', {
        userId: 'usr-creator-001',
        userRole: 'creator',
        isOwnerOfSubmission: true,
        isChallengeOrgMember: false,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.newStatus).toBe('withdrawn');
    });
  });

  // ============================================================================
  // 3. ACCESS CONTROL, IDOR ISOLATION & ANTI-SELF-REVIEW
  // ============================================================================
  describe('3. Access Control & Review Authorization', () => {
    it('SEC-01: Creator can access their own submission details', () => {
      const res = submissionService.getSubmissionDetail(
        'sub-demo-001',
        'usr-creator-001', // Author
        'creator',
        false
      );

      expect(res.success).toBe(true);
      expect(res.submission?.id).toBe('sub-demo-001');
    });

    it('SEC-02: IDOR GUARD: Unrelated third-party is BLOCKED from accessing submission details', () => {
      const res = submissionService.getSubmissionDetail(
        'sub-demo-001',
        'usr-attacker-999', // Random outsider
        'creator',
        false // Not member of org
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('TRUY CẬP BỊ TỪ CHỐI');
    });

    it('SEC-03: Organization member of the challenge CAN access submissions', () => {
      const res = submissionService.getChallengeSubmissions(
        'ch-demo-001',
        'usr-org-owner',
        'business',
        true // Org member
      );

      expect(res.success).toBe(true);
      expect(Array.isArray(res.submissions)).toBe(true);
    });

    it('SEC-04: Outsider is BLOCKED from listing challenge submissions (Cross-org guard)', () => {
      const res = submissionService.getChallengeSubmissions(
        'ch-demo-001',
        'usr-outsider',
        'creator',
        false // Not org member
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('TRUY CẬP BỊ TỪ CHỐI');
    });

    it('SEC-05: CRITICAL: Creator CANNOT review or grade their own submission (Anti-Self-Review)', () => {
      const authCheck = canReviewSubmission(
        { submitted_by: 'usr-creator-001', status: 'submitted', challenge_id: 'ch-demo-001' },
        { organization_id: 'org-lab-01', status: 'published' },
        'usr-creator-001', // REVIEWER IS AUTHOR!
        'business',
        true
      );

      expect(authCheck.allowed).toBe(false);
      expect(authCheck.reason).toContain('không được phép tự chấm điểm');
    });

    it('SEC-06: Authorized reviewer can grade submission with correct Rubric weighted score', () => {
      const reviewRes = submissionService.submitReview(
        'sub-demo-001',
        {
          submission_id: 'sub-demo-001',
          status: 'submitted',
          rubric_scores: [
            { criterion_id: 'crit-1', criterion_name: 'Độ chính xác', weight: 40, score: 90, comments: 'Tốt' },
            { criterion_id: 'crit-2', criterion_name: 'Kiến trúc', weight: 30, score: 80, comments: 'Rõ ràng' },
            { criterion_id: 'crit-3', criterion_name: 'UX', weight: 30, score: 85, comments: 'Trực quan' },
          ],
          feedback: 'Giải pháp chất lượng cao, đáp ứng benchmark 92% của doanh nghiệp.',
          decision: 'shortlist',
        },
        'usr-reviewer-biz',
        'Giám Khảo Doanh Nghiệp',
        'business',
        true
      );

      expect(reviewRes.success).toBe(true);
      // Expected weighted score: (90 * 0.4) + (80 * 0.3) + (85 * 0.3) = 36 + 24 + 25.5 = 85.5
      expect(reviewRes.review?.total_weighted_score).toBe(85.5);
      expect(reviewRes.submission?.status).toBe('shortlisted');
      expect(reviewRes.submission?.average_score).toBe(85.5);
    });
  });
});
