import { describe, it, expect, beforeEach } from 'vitest';
import {
  challengeFormSchema,
  adminReviewActionSchema,
} from '../lib/validation/challenge.schema';
import { canTransitionChallengeStatus } from '../lib/challenge/workflow';
import { challengeService } from '../lib/challenge/challengeService';

describe('PULSAR Sprint 2: Challenge Engine Test Suite', () => {
  beforeEach(() => {
    challengeService._resetStore();
  });

  // ============================================================================
  // 1. DATA VALIDATION & BUSINESS SCHEMA RULES
  // ============================================================================
  describe('1. Challenge Validation Schemas (Zod)', () => {
    const validPayload = {
      title: 'Mô hình AI dự báo sự cố mạng viễn thông tự động',
      slug: 'ai-telecom-network-fault-prediction',
      short_description:
        'Xây dựng mô hình học máy phát hiện sớm bất thường trên lưu lượng mạng lõi viễn thông.',
      problem_statement:
        'Lưu lượng mạng viễn thông tăng trưởng 40% mỗi năm khiến việc giám sát thủ công không còn khả thi. Cần một giải pháp AI tự động hóa rà soát telemetry và phát hiện dấu hiệu nghẽn mạng.',
      desired_outcome:
        'Hệ thống AI dự báo trước 15 phút nguy cơ sự cố với độ chính xác F1-Score trên 0.90.',
      category: 'ai_ml',
      requirements: ['Python 3.11+, PyTorch hoặc XGBoost', 'Docker containerized REST API'],
      deliverables: ['GitHub repository kèm README chi tiết', 'Tài liệu hướng dẫn benchmark'],
      evaluation_criteria: [
        { id: 'c1', name: 'Độ chính xác mô hình (F1-Score)', weight: 50, description: 'F1 >= 0.90' },
        { id: 'c2', name: 'Độ trễ suy luận (Inference Latency)', weight: 30, description: '< 50ms per batch' },
        { id: 'c3', name: 'Chất lượng mã nguồn', weight: 20, description: 'Clean architecture & test' },
      ],
      budget_min: 3000,
      budget_max: 6000,
      currency: 'USD',
      prize_pool: 6000,
      start_at: '2026-03-01T00:00:00Z',
      deadline_at: '2026-06-01T23:59:59Z',
      organization_id: 'org-lab-01',
    };

    it('VAL-01: Accepts fully valid challenge data payload', () => {
      const result = challengeFormSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('VAL-02: Rejects challenge with title shorter than 5 characters', () => {
      const result = challengeFormSchema.safeParse({ ...validPayload, title: 'AI' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ít nhất 5 ký tự');
      }
    });

    it('VAL-03: Rejects invalid slug formatting (e.g. spaces, uppercase, special chars)', () => {
      const result = challengeFormSchema.safeParse({
        ...validPayload,
        slug: 'AI Telecom Fault!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Slug chỉ gồm chữ thường');
      }
    });

    it('VAL-04: Rejects short_description shorter than 20 characters', () => {
      const result = challengeFormSchema.safeParse({
        ...validPayload,
        short_description: 'Mô tả quá ngắn',
      });
      expect(result.success).toBe(false);
    });

    it('VAL-05: Rejects problem_statement shorter than 50 characters', () => {
      const result = challengeFormSchema.safeParse({
        ...validPayload,
        problem_statement: 'Mô tả bài toán ngắn chưa đủ 50 ký tự.',
      });
      expect(result.success).toBe(false);
    });

    it('VAL-06: Rejects desired_outcome shorter than 30 characters', () => {
      const result = challengeFormSchema.safeParse({
        ...validPayload,
        desired_outcome: 'Chưa đủ 30 ký tự.',
      });
      expect(result.success).toBe(false);
    });

    it('VAL-07: CRITICAL: Rejects evaluation criteria if total weights !== 100%', () => {
      const result = challengeFormSchema.safeParse({
        ...validPayload,
        evaluation_criteria: [
          { id: 'c1', name: 'Tiêu chí 1', weight: 40, description: 'Desc 1' },
          { id: 'c2', name: 'Tiêu chí 2', weight: 40, description: 'Desc 2' },
          // Total is 80%, not 100%
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasWeightError = result.error.issues.some((i) =>
          i.message.includes('100%')
        );
        expect(hasWeightError).toBe(true);
      }
    });

    it('VAL-08: Rejects when budget_max is less than budget_min', () => {
      const result = challengeFormSchema.safeParse({
        ...validPayload,
        budget_min: 5000,
        budget_max: 2000, // Invalid: max < min
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasBudgetError = result.error.issues.some((i) =>
          i.message.includes('Ngân sách tối đa')
        );
        expect(hasBudgetError).toBe(true);
      }
    });

    it('VAL-09: Rejects when deadline_at is earlier than or equal to start_at', () => {
      const result = challengeFormSchema.safeParse({
        ...validPayload,
        start_at: '2026-05-01T00:00:00Z',
        deadline_at: '2026-04-01T00:00:00Z', // Invalid: deadline before start
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDeadlineError = result.error.issues.some((i) =>
          i.message.includes('Hạn chót')
        );
        expect(hasDeadlineError).toBe(true);
      }
    });

    it('VAL-10: Admin review schema requires notes >= 5 characters', () => {
      const valid = adminReviewActionSchema.safeParse({
        action: 'approve',
        notes: 'Đề bài đạt chuẩn chất lượng kỹ thuật',
      });
      expect(valid.success).toBe(true);

      const invalid = adminReviewActionSchema.safeParse({
        action: 'reject',
        notes: 'No', // Too short
      });
      expect(invalid.success).toBe(false);
    });
  });

  // ============================================================================
  // 2. STATE MACHINE & WORKFLOW RULES
  // ============================================================================
  describe('2. State Machine Transitions & Authorization', () => {
    it('WF-01: Org member can transition "draft" to "pending_review"', () => {
      const decision = canTransitionChallengeStatus('draft', 'pending_review', {
        userId: 'usr-1',
        userRole: 'business',
        isOrgMember: true,
        isCreator: true,
      });
      expect(decision.allowed).toBe(true);
      expect(decision.newStatus).toBe('pending_review');
    });

    it('WF-02: Non-member CANNOT transition "draft" to "pending_review"', () => {
      const decision = canTransitionChallengeStatus('draft', 'pending_review', {
        userId: 'usr-outsider',
        userRole: 'creator',
        isOrgMember: false,
        isCreator: false,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Chỉ thành viên của tổ chức');
    });

    it('WF-03: "draft" CANNOT bypass to "approved" or "published"', () => {
      const directApproved = canTransitionChallengeStatus('draft', 'approved', {
        userId: 'usr-1',
        userRole: 'business',
        isOrgMember: true,
        isCreator: true,
      });
      expect(directApproved.allowed).toBe(false);

      const directPublished = canTransitionChallengeStatus('draft', 'published', {
        userId: 'usr-1',
        userRole: 'business',
        isOrgMember: true,
        isCreator: true,
      });
      expect(directPublished.allowed).toBe(false);
    });

    it('WF-04: Non-admin CANNOT review "pending_review"', () => {
      const decision = canTransitionChallengeStatus('pending_review', 'approved', {
        userId: 'usr-biz-1',
        userRole: 'business',
        isOrgMember: true,
        isCreator: false,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Chỉ quản trị viên hệ thống (Admin)');
    });

    it('WF-05: Admin can approve valid "pending_review"', () => {
      const decision = canTransitionChallengeStatus('pending_review', 'approved', {
        userId: 'usr-admin-1',
        userRole: 'admin',
        isOrgMember: false,
        isCreator: false,
      });
      expect(decision.allowed).toBe(true);
      expect(decision.newStatus).toBe('approved');
    });

    it('WF-06: CRITICAL SECURITY: Creator CANNOT approve their own challenge (Segregation of Duties)', () => {
      const decision = canTransitionChallengeStatus('pending_review', 'approved', {
        userId: 'usr-admin-creator',
        userRole: 'admin', // Even if user is Admin!
        isOrgMember: true,
        isCreator: true, // BUT is the creator of the challenge!
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Người tạo thử thách không được phép tự phê duyệt');
    });

    it('WF-07: Admin can request changes or reject with valid notes', () => {
      const changesWithNotes = canTransitionChallengeStatus('pending_review', 'changes_requested', {
        userId: 'usr-admin-1',
        userRole: 'admin',
        isOrgMember: false,
        isCreator: false,
        notes: 'Cần bổ sung tiêu chí benchmark hiệu năng cụ thể hơn',
      });
      expect(changesWithNotes.allowed).toBe(true);

      const changesWithoutNotes = canTransitionChallengeStatus('pending_review', 'changes_requested', {
        userId: 'usr-admin-1',
        userRole: 'admin',
        isOrgMember: false,
        isCreator: false,
        notes: '   ', // Blank notes
      });
      expect(changesWithoutNotes.allowed).toBe(false);
      expect(changesWithoutNotes.reason).toContain('tối thiểu 5 ký tự');
    });

    it('WF-08: "approved" can transition to "published"', () => {
      const decision = canTransitionChallengeStatus('approved', 'published', {
        userId: 'usr-1',
        userRole: 'business',
        isOrgMember: true,
        isCreator: true,
      });
      expect(decision.allowed).toBe(true);
      expect(decision.newStatus).toBe('published');
    });

    it('WF-09: Terminal state ("closed" or "cancelled") CANNOT transition to any status', () => {
      const closedToDraft = canTransitionChallengeStatus('closed', 'draft', {
        userId: 'usr-1',
        userRole: 'admin',
        isOrgMember: true,
        isCreator: true,
      });
      expect(closedToDraft.allowed).toBe(false);
      expect(closedToDraft.reason).toContain('trạng thái kết thúc');

      const cancelledToPub = canTransitionChallengeStatus('cancelled', 'published', {
        userId: 'usr-1',
        userRole: 'admin',
        isOrgMember: true,
        isCreator: true,
      });
      expect(cancelledToPub.allowed).toBe(false);
    });
  });

  // ============================================================================
  // 3. CHALLENGE SERVICE & REPO LEVEL INTEGRATION
  // ============================================================================
  describe('3. Challenge Service Security & Operations', () => {
    it('SVC-01: Newly created challenge is ALWAYS forced to "draft" status at inception', () => {
      const res = challengeService.createChallenge(
        {
          title: 'Hệ thống Smart Grid Dự báo Phụ tải Điện Thông minh',
          slug: 'smart-grid-load-forecasting-system',
          short_description:
            'Thuật toán học máy chuỗi thời gian dự báo phụ tải lưới điện phân phối 24 giờ tới.',
          problem_statement:
            'Năng lượng tái tạo biến động gây áp lực lên lưới điện phân phối. Cần mô hình dự báo chính xác phụ tải để tối ưu kế hoạch phát điện và hạn chế sụt áp trên lưới cục bộ.',
          desired_outcome:
            'Mô hình đạt sai số MAPE dưới 3.5% trên tập dữ liệu đo xa 12 tháng liên tục.',
          category: 'ai_ml',
          requirements: ['Python 3.10+, LightGBM / Prophet', 'API phục vụ suy luận thời gian thực'],
          deliverables: ['Mã nguồn model và script huấn luyện tự động', 'Tài liệu giải trình sai số'],
          evaluation_criteria: [
            { id: 'c1', name: 'Chỉ số sai số MAPE', weight: 60, description: 'MAPE < 3.5%' },
            { id: 'c2', name: 'Tốc độ phản hồi API', weight: 40, description: '< 100ms' },
          ],
          budget_min: 2500,
          budget_max: 4000,
          currency: 'USD',
          prize_pool: 4000,
          start_at: '2026-03-01T00:00:00Z',
          deadline_at: '2026-05-30T23:59:59Z',
          organization_id: 'org-lab-01',
        },
        'usr-creator-001',
        'Minh Quang',
        'AI Innovators Hub',
        'ai-innovators-hub'
      );

      expect(res.success).toBe(true);
      expect(res.challenge?.status).toBe('draft');
      expect(res.challenge?.published_at).toBeNull();
    });

    it('SVC-02: Public marketplace NEVER leaks drafts, pending_review, or rejected challenges', () => {
      const { challenges } = challengeService.getPublicMarketplace();
      const nonPublicStatuses = ['draft', 'pending_review', 'changes_requested', 'rejected', 'cancelled'];

      challenges.forEach((c) => {
        expect(nonPublicStatuses).not.toContain(c.status);
        expect(['published', 'closed']).toContain(c.status);
      });
    });

    it('SVC-03: Public get by slug returns null for draft challenge', () => {
      // ch-demo-004 is draft
      const draftChallenge = challengeService.getPublicChallengeBySlug(
        'finops-cost-optimization-kubernetes'
      );
      expect(draftChallenge).toBeNull();
    });

    it('SVC-04: Non-admin is blocked from accessing Admin Review Queue', () => {
      expect(() => {
        challengeService.getPendingReviewQueue('usr-creator-001', false);
      }).toThrow('SECURITY VIOLATION');
    });

    it('SVC-05: Admin successfully retrieves pending review items', () => {
      const queue = challengeService.getPendingReviewQueue('usr-admin-001', true);
      expect(Array.isArray(queue)).toBe(true);
      queue.forEach((item) => {
        expect(item.status).toBe('pending_review');
      });
    });

    it('SVC-06: Admin cannot approve challenge they personally created', () => {
      // Find a pending review challenge and test self-approval rejection
      const pendingItems = challengeService.getPendingReviewQueue('usr-admin-001', true);
      const testItem = pendingItems[0];
      expect(testItem).toBeDefined();

      // If reviewer is the creator
      const res = challengeService.processAdminReview(
        testItem.id,
        { action: 'approve', notes: 'Tự duyệt đề bài của chính mình' },
        testItem.created_by, // SAME USER ID
        'Self Creator',
        true
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('không được phép tự phê duyệt');
    });
  });
});
