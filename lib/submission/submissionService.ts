import type {
  Submission,
  SubmissionFile,
  SubmissionFilterOptions,
  SubmissionReview,
  SubmissionStatus,
  SubmissionStatusHistory,
} from '../../types/submission.types';
import type { Challenge } from '../../types/challenge.types';
import {
  submissionFormSchema,
  submissionReviewSchema,
  type SubmissionFormData,
  type SubmissionReviewFormData,
} from '../validation/submission.schema';
import {
  canSubmitToChallenge,
  canTransitionSubmissionStatus,
  canReviewSubmission,
} from './submissionWorkflow';
import { challengeService } from '../challenge/challengeService';

// Initial Demo Submissions (clearly labeled as seed data)
const INITIAL_DEMO_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-demo-001',
    challenge_id: 'ch-demo-001', // AI Legal Contract Analysis Agent (Published)
    challenge_title: 'Xây dựng Agent AI Phân tích Hợp đồng Pháp lý Thông minh',
    challenge_slug: 'ai-legal-contract-analysis-agent',
    organization_id: 'org-lab-01',
    organization_name: 'AI Innovators Hub',
    submitted_by: 'usr-creator-001',
    creator_name: 'Minh Quang (Creator)',
    creator_email: 'creator.developer@pulsar.dev',
    title: 'PulsarLegalAgent: Kiến trúc RAG Hybrid kết hợp Graph Neural Network',
    solution_summary:
      'Giải pháp ứng dụng Llama 3.3 fine-tuned trên dữ liệu pháp lý thương mại Việt Nam kết hợp Qdrant Vector Search và Knowledge Graph.',
    solution_content:
      'Hệ thống bao gồm 3 module chính:\n1. Ingestion Pipeline: Parse PDF/DOCX sang cấu trúc Markdown có phân cấp chương mục.\n2. Hybrid Retrieval: Kết hợp BM25 (sparse) và BGE-m3 embeddings (dense) với Reciprocal Rank Fusion.\n3. Reasoning Agent: Sử dụng Chain-of-Thought kiểm tra chéo từng điều khoản bồi thường thiệt hại và bảo mật dữ liệu.\nĐã đo đạc benchmark đạt 94.2% độ chính xác và tốc độ trích xuất trung bình 18 giây mỗi hợp đồng 30 trang.',
    solution_url: 'https://github.com/pulsar-dev/pulsar-legal-rag-agent',
    files: [
      {
        id: 'file-001',
        name: 'architecture_technical_whitepaper.pdf',
        size: 2450000,
        mime_type: 'application/pdf',
        storage_path: 'submissions/ch-demo-001/sub-demo-001/architecture.pdf',
        uploaded_at: '2026-02-20T10:00:00Z',
        is_private: true,
        signed_url: 'https://storage.pulsar.dev/signed/ch-demo-001/architecture.pdf?token=exp_3600',
      },
      {
        id: 'file-002',
        name: 'benchmark_results_dataset.csv',
        size: 512000,
        mime_type: 'text/csv',
        storage_path: 'submissions/ch-demo-001/sub-demo-001/benchmark.csv',
        uploaded_at: '2026-02-20T10:05:00Z',
        is_private: true,
        signed_url: 'https://storage.pulsar.dev/signed/ch-demo-001/benchmark.csv?token=exp_3600',
      },
    ],
    version: 1,
    status: 'submitted',
    submitted_at: '2026-02-20T10:15:00Z',
    created_at: '2026-02-19T14:00:00Z',
    updated_at: '2026-02-20T10:15:00Z',
    idempotency_key: 'idem-usr-creator-001-ch-demo-001-v1',
    reviews: [],
    average_score: undefined,
  },
  {
    id: 'sub-demo-002',
    challenge_id: 'ch-demo-002', // Multisig Escrow Smart Contract (Published)
    challenge_title: 'Hệ thống Smart Contract Escrow Đa Chữ ký cho Sàn Freelance',
    challenge_slug: 'multisig-escrow-smart-contract',
    organization_id: 'org-biz-02',
    organization_name: 'Nexus Fintech Corp',
    submitted_by: 'usr-freelancer-99',
    creator_name: 'Tuấn Anh Web3 Dev',
    creator_email: 'tuananh.sol@pulsar.dev',
    title: 'Arbitrum Escrow Protocol with Timelock & UUPS Upgradeability',
    solution_summary:
      'Bộ hợp đồng ký quỹ 3/5 multisig trên Arbitrum Nitro, tối ưu hóa gas storage packing và tích hợp arbitration module.',
    solution_content:
      'Triển khai toàn bộ bằng Solidity 0.8.24 với Foundry suite, test coverage đạt 98.4%. Sử dụng EIP-712 typed data signatures để phê duyệt giải ngân không cần gửi transaction trực tiếp, giúp doanh nghiệp tiết kiệm 85% chi phí gas.',
    solution_url: 'https://github.com/tuananh-dev/arbitrum-escrow-contracts',
    files: [
      {
        id: 'file-003',
        name: 'slither_static_analysis_audit.pdf',
        size: 1850000,
        mime_type: 'application/pdf',
        storage_path: 'submissions/ch-demo-002/sub-demo-002/audit.pdf',
        uploaded_at: '2026-02-22T08:00:00Z',
        is_private: true,
        signed_url: 'https://storage.pulsar.dev/signed/ch-demo-002/audit.pdf?token=exp_3600',
      },
    ],
    version: 1,
    status: 'shortlisted',
    submitted_at: '2026-02-22T08:30:00Z',
    created_at: '2026-02-21T09:00:00Z',
    updated_at: '2026-02-25T14:00:00Z',
    idempotency_key: 'idem-usr-freelancer-99-ch-demo-002',
    reviews: [
      {
        id: 'rev-sub-001',
        submission_id: 'sub-demo-002',
        reviewer_id: 'usr-biz-002',
        reviewer_name: 'Bảo Trân (Business CEO)',
        status: 'submitted',
        rubric_scores: [
          {
            criterion_id: 'crit-1',
            criterion_name: 'Bảo mật & Audit Static Analysis',
            weight: 50,
            score: 95,
            comments: 'Slither report sạch không có High/Critical, kiểm thử Foundry rất kỹ.',
          },
          {
            criterion_id: 'crit-2',
            criterion_name: 'Tối ưu Gas',
            weight: 25,
            score: 90,
            comments: 'Storage layout packed chặt chẽ, chi phí giải ngân rất thấp.',
          },
          {
            criterion_id: 'crit-3',
            criterion_name: 'Tài liệu & Test Coverage',
            weight: 25,
            score: 88,
            comments: 'Tài liệu đầy đủ, có mô tả chi tiết luồng arbitration.',
          },
        ],
        total_weighted_score: 92.0, // (95*0.5) + (90*0.25) + (88*0.25) = 47.5 + 22.5 + 22 = 92
        feedback:
          'Giải pháp rất xuất sắc, mã nguồn sạch chuẩn OpenZeppelin và sẵn sàng triển khai testnet.',
        decision: 'shortlist',
        created_at: '2026-02-25T14:00:00Z',
        updated_at: '2026-02-25T14:00:00Z',
      },
    ],
    average_score: 92.0,
  },
];

// In-memory repositories
let submissionsStore: Submission[] = [...INITIAL_DEMO_SUBMISSIONS];
let submissionReviewsStore: SubmissionReview[] = [
  ...INITIAL_DEMO_SUBMISSIONS.flatMap((s) => s.reviews || []),
];
let historyStore: SubmissionStatusHistory[] = [];

export const submissionService = {
  /**
   * Create a new Submission (Draft or Submitted)
   */
  createSubmission(
    formData: SubmissionFormData,
    creatorId: string,
    creatorName: string,
    creatorEmail: string,
    submitImmediately: boolean = false
  ): { success: boolean; submission?: Submission; error?: string } {
    try {
      const validated = submissionFormSchema.parse(formData);

      // 1. Fetch target challenge
      const publicRes = challengeService.getPublicMarketplace();
      const allChallenges = [
        ...publicRes.challenges,
        ...challengeService.getOrganizationChallenges('org-lab-01'),
        ...challengeService.getOrganizationChallenges('org-biz-02'),
      ];
      const challenge = allChallenges.find((c) => c.id === validated.challenge_id);

      if (!challenge) {
        return { success: false, error: 'Không tìm thấy thử thách tương ứng.' };
      }

      // 2. Validate deadline & status
      const canSubmit = canSubmitToChallenge(challenge);
      if (!canSubmit.allowed) {
        return { success: false, error: canSubmit.reason };
      }

      // 3. Idempotency & duplicate check
      const existingSubmission = submissionsStore.find(
        (s) =>
          s.challenge_id === validated.challenge_id &&
          s.submitted_by === creatorId &&
          !['withdrawn', 'rejected'].includes(s.status)
      );

      if (existingSubmission) {
        return {
          success: false,
          error:
            'Bạn đã có một bài dự thi đang hoạt động cho thử thách này. Vui lòng chỉnh sửa bài dự thi hiện có thay vì nộp mới.',
        };
      }

      const now = new Date().toISOString();
      const initialStatus: SubmissionStatus = submitImmediately ? 'submitted' : 'draft';

      const newSubmission: Submission = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        challenge_id: challenge.id,
        challenge_title: challenge.title,
        challenge_slug: challenge.slug,
        organization_id: challenge.organization_id,
        organization_name: challenge.organization_name,
        submitted_by: creatorId,
        creator_name: creatorName,
        creator_email: creatorEmail,
        title: validated.title,
        solution_summary: validated.solution_summary,
        solution_content: validated.solution_content,
        solution_url: validated.solution_url || undefined,
        files: validated.files.map((f) => ({
          ...f,
          signed_url: `https://storage.pulsar.dev/signed/${challenge.id}/${f.id}?token=exp_7200`,
        })),
        version: 1,
        status: initialStatus,
        submitted_at: submitImmediately ? now : null,
        created_at: now,
        updated_at: now,
        idempotency_key: validated.idempotency_key || `idem-${creatorId}-${challenge.id}`,
        reviews: [],
      };

      submissionsStore.unshift(newSubmission);

      // Record history
      historyStore.unshift({
        id: `hist-${Date.now()}`,
        submission_id: newSubmission.id,
        previous_status: null,
        new_status: initialStatus,
        changed_by: creatorId,
        changer_name: creatorName,
        reason: submitImmediately ? 'Nộp bài thi chính thức' : 'Tạo bản nháp bài thi',
        created_at: now,
      });

      return { success: true, submission: newSubmission };
    } catch (err: any) {
      const message = err.errors?.[0]?.message || err.message || 'Lỗi kiểm thực dữ liệu';
      return { success: false, error: message };
    }
  },

  /**
   * Update an existing draft or editable submission
   */
  updateSubmission(
    submissionId: string,
    formData: Partial<SubmissionFormData>,
    userId: string
  ): { success: boolean; submission?: Submission; error?: string } {
    const index = submissionsStore.findIndex((s) => s.id === submissionId);
    if (index === -1) {
      return { success: false, error: 'Không tìm thấy bài dự thi.' };
    }

    const existing = submissionsStore[index];

    // Ownership guard
    if (existing.submitted_by !== userId) {
      return { success: false, error: 'Chỉ tác giả mới có quyền chỉnh sửa bài dự thi này.' };
    }

    // Editable status guard
    if (!['draft', 'submitted'].includes(existing.status)) {
      return {
        success: false,
        error: `Bài dự thi ở trạng thái "${existing.status}" không thể chỉnh sửa nội dung nữa.`,
      };
    }

    const now = new Date().toISOString();
    const updated: Submission = {
      ...existing,
      title: formData.title ?? existing.title,
      solution_summary: formData.solution_summary ?? existing.solution_summary,
      solution_content: formData.solution_content ?? existing.solution_content,
      solution_url: formData.solution_url ?? existing.solution_url,
      files: formData.files ?? existing.files,
      version: existing.version + 1, // Auto-increment version on edit
      updated_at: now,
    };

    submissionsStore[index] = updated;
    return { success: true, submission: updated };
  },

  /**
   * Transition Submission Status via workflow state machine
   */
  transitionStatus(
    submissionId: string,
    targetStatus: SubmissionStatus,
    context: {
      userId: string;
      userRole: 'creator' | 'business' | 'admin';
      isOwner: boolean;
      isOrgMember: boolean;
      notes?: string;
    }
  ): { success: boolean; submission?: Submission; error?: string } {
    const index = submissionsStore.findIndex((s) => s.id === submissionId);
    if (index === -1) {
      return { success: false, error: 'Không tìm thấy bài dự thi.' };
    }

    const existing = submissionsStore[index];

    const decision = canTransitionSubmissionStatus(existing.status, targetStatus, {
      userId: context.userId,
      userRole: context.userRole,
      isOwnerOfSubmission: context.isOwner,
      isChallengeOrgMember: context.isOrgMember,
      notes: context.notes,
    });

    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'Chuyển đổi trạng thái không được phép.' };
    }

    const now = new Date().toISOString();
    const updated: Submission = {
      ...existing,
      status: targetStatus,
      submitted_at: targetStatus === 'submitted' && !existing.submitted_at ? now : existing.submitted_at,
      updated_at: now,
    };

    submissionsStore[index] = updated;

    // Record status audit history
    historyStore.unshift({
      id: `hist-${Date.now()}`,
      submission_id: existing.id,
      previous_status: existing.status,
      new_status: targetStatus,
      changed_by: context.userId,
      reason: context.notes || `Chuyển trạng thái sang ${targetStatus}`,
      created_at: now,
    });

    return { success: true, submission: updated };
  },

  /**
   * Evaluate & Submit Review with Rubric Calculation
   */
  submitReview(
    submissionId: string,
    reviewData: SubmissionReviewFormData,
    reviewerId: string,
    reviewerName: string,
    reviewerRole: 'creator' | 'business' | 'admin',
    isOrgMember: boolean
  ): { success: boolean; review?: SubmissionReview; submission?: Submission; error?: string } {
    try {
      const validated = submissionReviewSchema.parse(reviewData);

      const subIndex = submissionsStore.findIndex((s) => s.id === submissionId);
      if (subIndex === -1) {
        return { success: false, error: 'Không tìm thấy bài dự thi.' };
      }

      const submission = submissionsStore[subIndex];

      // Fetch challenge to check organization & deadline
      const publicRes = challengeService.getPublicMarketplace();
      const allChallenges = [
        ...publicRes.challenges,
        ...challengeService.getOrganizationChallenges('org-lab-01'),
        ...challengeService.getOrganizationChallenges('org-biz-02'),
      ];
      const challenge = allChallenges.find((c) => c.id === submission.challenge_id) || {
        organization_id: submission.organization_id || '',
        status: 'published',
      };

      // Reviewer authorization & anti-self-review check
      const authCheck = canReviewSubmission(
        submission,
        challenge,
        reviewerId,
        reviewerRole,
        isOrgMember
      );
      if (!authCheck.allowed) {
        return { success: false, error: authCheck.reason };
      }

      // Calculate total weighted score: sum(score_i * weight_i / 100)
      let weightedSum = 0;
      let totalWeight = 0;
      validated.rubric_scores.forEach((r) => {
        weightedSum += (r.score * r.weight) / 100;
        totalWeight += r.weight;
      });

      // Normalize if totalWeight != 100
      const finalScore =
        totalWeight > 0 ? Number(((weightedSum / totalWeight) * 100).toFixed(1)) : 0;

      const now = new Date().toISOString();

      const newReview: SubmissionReview = {
        id: `rev-${Date.now()}`,
        submission_id: submission.id,
        reviewer_id: reviewerId,
        reviewer_name: reviewerName,
        status: validated.status,
        rubric_scores: validated.rubric_scores,
        total_weighted_score: finalScore,
        feedback: validated.feedback,
        decision: validated.decision,
        created_at: now,
        updated_at: now,
      };

      // Update or insert review
      const existingRevIndex = submissionReviewsStore.findIndex(
        (r) => r.submission_id === submission.id && r.reviewer_id === reviewerId
      );
      if (existingRevIndex !== -1) {
        submissionReviewsStore[existingRevIndex] = newReview;
      } else {
        submissionReviewsStore.unshift(newReview);
      }

      // Attach review to submission and update score
      const allSubReviews = submissionReviewsStore.filter(
        (r) => r.submission_id === submission.id && r.status === 'submitted'
      );
      const avgScore =
        allSubReviews.length > 0
          ? Number(
              (
                allSubReviews.reduce((sum, r) => sum + r.total_weighted_score, 0) /
                allSubReviews.length
              ).toFixed(1)
            )
          : finalScore;

      // Update submission status based on decision if final review
      let nextStatus = submission.status;
      if (validated.status === 'submitted' && validated.decision) {
        if (validated.decision === 'shortlist') nextStatus = 'shortlisted';
        else if (validated.decision === 'accept') nextStatus = 'accepted';
        else if (validated.decision === 'reject') nextStatus = 'rejected';
      } else if (submission.status === 'submitted') {
        nextStatus = 'under_review';
      }

      const updatedSub: Submission = {
        ...submission,
        status: nextStatus,
        reviews: allSubReviews,
        average_score: avgScore,
        updated_at: now,
      };

      submissionsStore[subIndex] = updatedSub;

      return { success: true, review: newReview, submission: updatedSub };
    } catch (err: any) {
      const message = err.errors?.[0]?.message || err.message || 'Lỗi thẩm định';
      return { success: false, error: message };
    }
  },

  /**
   * Get Submissions of the authenticated Creator
   */
  getCreatorSubmissions(userId: string): Submission[] {
    return submissionsStore.filter((s) => s.submitted_by === userId);
  },

  /**
   * Get Submissions for a Challenge (Strict Organization Isolation)
   */
  getChallengeSubmissions(
    challengeId: string,
    requesterId: string,
    requesterRole: 'creator' | 'business' | 'admin',
    isOrgMember: boolean
  ): { success: boolean; submissions?: Submission[]; error?: string } {
    // Check authorization: Must be Org member of the challenge or Admin!
    if (!isOrgMember && requesterRole !== 'admin') {
      return {
        success: false,
        error:
          'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ thành viên tổ chức sở hữu thử thách hoặc Quản trị viên mới được xem các bài dự thi.',
      };
    }

    const filtered = submissionsStore.filter(
      (s) => s.challenge_id === challengeId && s.status !== 'draft' // Do not leak other creators' drafts
    );

    return { success: true, submissions: filtered };
  },

  /**
   * Get detail of a single submission with strict IDOR protection
   */
  getSubmissionDetail(
    submissionId: string,
    requesterId: string,
    requesterRole: 'creator' | 'business' | 'admin',
    isOrgMember: boolean
  ): { success: boolean; submission?: Submission; error?: string } {
    const sub = submissionsStore.find((s) => s.id === submissionId);
    if (!sub) {
      return { success: false, error: 'Không tìm thấy bài dự thi.' };
    }

    // Access control:
    // 1. Author can always see their own submission
    // 2. Organization member of the challenge can see it
    // 3. Admin can see it
    const isOwner = sub.submitted_by === requesterId;
    if (!isOwner && !isOrgMember && requesterRole !== 'admin') {
      return {
        success: false,
        error:
          'TRUY CẬP BỊ TỪ CHỐI: Bạn không có quyền truy cập thông tin chi tiết bài dự thi này (Bảo mật IDOR).',
      };
    }

    return { success: true, submission: sub };
  },

  /**
   * Get Submission by ID directly (Internal / Service usage)
   */
  getSubmissionById(submissionId: string): { success: boolean; submission?: Submission; error?: string } {
    const sub = submissionsStore.find((s) => s.id === submissionId);
    if (!sub) {
      return { success: false, error: 'Không tìm thấy bài dự thi.' };
    }
    return { success: true, submission: sub };
  },

  /**
   * Reset store for unit tests
   */
  _resetStore() {
    submissionsStore = JSON.parse(JSON.stringify(INITIAL_DEMO_SUBMISSIONS));
    submissionReviewsStore = [
      ...INITIAL_DEMO_SUBMISSIONS.flatMap((s) => s.reviews || []),
    ];
    historyStore = [];
  },
};
