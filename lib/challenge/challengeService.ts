import type {
  Challenge,
  ChallengeCategory,
  ChallengeFilterOptions,
  ChallengeReviewRecord,
  ChallengeStatus,
} from '../../types/challenge.types';
import {
  challengeFormSchema,
  adminReviewActionSchema,
  type ChallengeFormData,
  type AdminReviewActionPayload,
} from '../validation/challenge.schema';
import { canTransitionChallengeStatus } from './workflow';

// Initial Demo Challenges (Clearly tagged as demo seed data)
const INITIAL_DEMO_CHALLENGES: Challenge[] = [
  {
    id: 'ch-demo-001',
    title: 'Xây dựng Agent AI Phân tích Hợp đồng Pháp lý Thông minh',
    slug: 'ai-legal-contract-analysis-agent',
    short_description:
      'Phát triển mô hình Agent AI sử dụng LLM và RAG để tự động trích xuất các điều khoản rủi ro trong hợp đồng thương mại.',
    problem_statement:
      'Hiện tại quy trình thẩm định hợp đồng mua bán của doanh nghiệp tốn trung bình 48 giờ mỗi hợp đồng với nguy cơ bỏ sót các điều khoản phạt bất lợi. Chúng tôi cần một giải pháp AI tự động hóa rà soát, gắn nhãn rủi ro cao/trung bình/thấp và đối chiếu với luật thương mại hiện hành.',
    desired_outcome:
      'Hệ sinh thái API & Web dashboard cho phép upload PDF/DOCX, trả về bản phân tích chi tiết trong 30 giây với độ chính xác trên 92%.',
    category: 'ai_ml',
    requirements: [
      'Sử dụng Python / FastAPI hoặc Node.js TypeScript cho backend xử lý',
      'Tích hợp RAG với cơ sở dữ liệu Vector (pgvector hoặc Qdrant)',
      'Hỗ trợ đọc và phân tích định dạng PDF và DOCX',
      'Đảm bảo bảo mật mã hóa dữ liệu hợp đồng lưu trữ và truyền tải',
    ],
    deliverables: [
      'Mã nguồn GitHub repository với tài liệu hướng dẫn triển khai Docker',
      'Bộ tài liệu API OpenAPI / Swagger hoàn chỉnh',
      'Video demo 5 phút minh họa luồng xử lý hợp đồng thực tế',
    ],
    evaluation_criteria: [
      { id: 'crit-1', name: 'Độ chính xác trích xuất rủi ro', weight: 40, description: 'Đạt trên 90% benchmark' },
      { id: 'crit-2', name: 'Kiến trúc & Tính mở rộng', weight: 30, description: 'Modular, clean code, Dockerized' },
      { id: 'crit-3', name: 'Trải nghiệm người dùng (UX)', weight: 30, description: 'Giao diện trực quan, rõ ràng' },
    ],
    budget_min: 3000,
    budget_max: 5000,
    currency: 'USD',
    prize_pool: 5000,
    start_at: '2026-02-01T00:00:00Z',
    deadline_at: '2027-04-30T23:59:59Z',
    organization_id: 'org-lab-01',
    organization_name: 'AI Innovators Hub',
    organization_slug: 'ai-innovators-hub',
    created_by: 'usr-creator-001',
    creator_name: 'Minh Quang',
    status: 'published',
    published_at: '2026-02-02T10:00:00Z',
    created_at: '2026-02-01T08:00:00Z',
    updated_at: '2026-02-02T10:00:00Z',
  },
  {
    id: 'ch-demo-002',
    title: 'Hệ thống Smart Contract Escrow Đa Chữ ký cho Sàn Freelance',
    slug: 'multisig-escrow-smart-contract',
    short_description:
      'Thiết kế và audit hợp đồng thông minh Escrow với giải quyết tranh chấp thông qua DAO arbitration trên Layer 2.',
    problem_statement:
      'Thanh toán cho các dự án công nghệ thường phát sinh tranh chấp nghiệm thu. Giải pháp cần áp dụng hợp đồng ký quỹ đa chữ ký (3/5 multisig) với cơ chế giải ngân theo từng cột mốc (milestone-based release) và phí gas tối ưu dưới 0.05 USD mỗi giao dịch.',
    desired_outcome:
      'Bộ smart contracts trên Arbitrum/Polygon kèm test suite đạt độ phủ 100% và báo cáo audit bảo mật Static Analysis (Slither).',
    category: 'blockchain',
    requirements: [
      'Viết bằng Solidity phiên bản 0.8.20+ tuân thủ chuẩn OpenZeppelin',
      'Độ phủ kiểm thử Foundry / Hardhat đạt trên 95%',
      'Cơ chế Time-lock và Pause khẩn cấp khi phát hiện dấu hiệu tấn công',
    ],
    deliverables: [
      'Smart contract code với báo cáo Slither / Mythril',
      'Frontend SDK (ethers.js / viem) để tích hợp vào Web3 frontend',
      'Kịch bản kiểm thử fuzzing và edge-cases',
    ],
    evaluation_criteria: [
      { id: 'crit-1', name: 'Bảo mật & Audit Static Analysis', weight: 50, description: 'Không có lỗ hổng Critical/High' },
      { id: 'crit-2', name: 'Tối ưu Gas', weight: 25, description: 'Chi phí gas triển khai và gọi hàm thấp nhất' },
      { id: 'crit-3', name: 'Tài liệu & Test Coverage', weight: 25, description: 'Test coverage >= 95%' },
    ],
    budget_min: 4000,
    budget_max: 7500,
    currency: 'USD',
    prize_pool: 7500,
    start_at: '2026-02-10T00:00:00Z',
    deadline_at: '2027-05-15T23:59:59Z',
    organization_id: 'org-biz-02',
    organization_name: 'Nexus Fintech Corp',
    organization_slug: 'nexus-fintech',
    created_by: 'usr-biz-002',
    creator_name: 'Bảo Trân',
    status: 'published',
    published_at: '2026-02-12T09:00:00Z',
    created_at: '2026-02-10T08:00:00Z',
    updated_at: '2026-02-12T09:00:00Z',
  },
  {
    id: 'ch-demo-003',
    title: 'Giải pháp Zero-Trust API Gateway & Phát hiện Bất thường',
    slug: 'zero-trust-api-gateway-anomaly-detection',
    short_description:
      'Xây dựng hệ thống Reverse Proxy tích hợp eBPF và Machine Learning để phát hiện quét lỗ hổng và brute-force theo thời gian thực.',
    problem_statement:
      'Các cuộc tấn công dò quét API tự động gia tăng 300% trong quý vừa qua. Đội ngũ cần một API Gateway có khả năng phân tích telemetry ở tầng kernel thông qua eBPF để chặn các IP độc hại với độ trễ dưới 2ms.',
    desired_outcome:
      'Gateway xử lý được 50,000 req/sec với tỷ lệ false positive dưới 0.1% trên môi trường Kubernetes.',
    category: 'security',
    requirements: [
      'Xây dựng bằng Rust hoặc Go để tối ưu tài nguyên CPU/RAM',
      'Tích hợp Cilium hoặc eBPF filter trực tiếp',
      'Dashboard hiển thị biểu đồ tấn công theo thời gian thực',
    ],
    deliverables: [
      'Helm chart triển khai trên Kubernetes',
      'Mã nguồn gateway và model phân tích bất thường',
      'Benchmark report với kịch bản Apache Bench / k6',
    ],
    evaluation_criteria: [
      { id: 'crit-1', name: 'Độ trễ & Hiệu năng chịu tải', weight: 45, description: 'Latency overhead < 2ms' },
      { id: 'crit-2', name: 'Độ nhạy phát hiện bất thường', weight: 35, description: 'False positive < 0.1%' },
      { id: 'crit-3', name: 'Khả năng vận hành Kubernetes', weight: 20, description: 'Helm charts, logging' },
    ],
    budget_min: 5000,
    budget_max: 9000,
    currency: 'USD',
    prize_pool: 9000,
    start_at: '2026-02-15T00:00:00Z',
    deadline_at: '2026-06-01T23:59:59Z',
    organization_id: 'org-biz-02',
    organization_name: 'Nexus Fintech Corp',
    organization_slug: 'nexus-fintech',
    created_by: 'usr-biz-002',
    creator_name: 'Bảo Trân',
    status: 'pending_review', // Currently in Admin Review Queue!
    published_at: null,
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'ch-demo-004',
    title: 'Tối ưu Hóa Hạ tầng FinOps và Auto-scaling cho Kubernetes',
    slug: 'finops-cost-optimization-kubernetes',
    short_description:
      'Thuật toán dự báo lưu lượng truy cập và tự động điều chỉnh Pod Horizontal Autoscaler (HPA) giảm 35% chi phí cloud.',
    problem_statement:
      'Cụm Kubernetes production lãng phí tài nguyên CPU/RAM do phân bổ theo đỉnh tải (peak provisioning). Cần thuật toán dự đoán tải dựa trên chuỗi thời gian để scale trước 3 phút trước khi lưu lượng tăng vọt.',
    desired_outcome:
      'Bộ điều khiển Kubernetes Operator mã nguồn mở tích hợp Prometheus metrics, chứng minh giảm chi phí tối thiểu 30%.',
    category: 'cloud_devops',
    requirements: [
      'Viết Custom Kubernetes Controller bằng Go (Kubebuilder)',
      'Tích hợp Prometheus Custom Metrics API',
      'Hỗ trợ AWS EKS và GCP GKE',
    ],
    deliverables: [
      'CRD (Custom Resource Definition) và Operator controller',
      'Test suite mô phỏng traffic load bằng k6',
    ],
    evaluation_criteria: [
      { id: 'crit-1', name: 'Tỷ lệ tiết kiệm chi phí', weight: 40, description: 'Giảm >= 30% tài nguyên dư thừa' },
      { id: 'crit-2', name: 'Độ ổn định không rớt request', weight: 40, description: '0% 5xx error khi scale' },
      { id: 'crit-3', name: 'Clean Architecture Controller', weight: 20, description: 'Tuân thủ Kubernetes guidelines' },
    ],
    budget_min: 2500,
    budget_max: 4500,
    currency: 'USD',
    prize_pool: 4500,
    start_at: '2026-02-18T00:00:00Z',
    deadline_at: '2026-05-30T23:59:59Z',
    organization_id: 'org-lab-01',
    organization_name: 'AI Innovators Hub',
    organization_slug: 'ai-innovators-hub',
    created_by: 'usr-creator-001',
    creator_name: 'Minh Quang',
    status: 'draft', // Draft of Org 1
    published_at: null,
    created_at: '2026-02-18T14:00:00Z',
    updated_at: '2026-02-18T14:00:00Z',
  },
];

// Persistent state across local interactions
let challengesStore: Challenge[] = [...INITIAL_DEMO_CHALLENGES];
let reviewsStore: ChallengeReviewRecord[] = [];

export const challengeService = {
  /**
   * Public Marketplace Query
   * STRICT SECURITY ENFORCEMENT: ONLY returns challenges in 'published' or 'closed' status.
   * Internal drafts, pending reviews, and rejected challenges are NEVER leaked!
   */
  getPublicMarketplace(filters: ChallengeFilterOptions = {}): {
    challenges: Challenge[];
    total: number;
  } {
    const { searchQuery, category, minBudget, maxBudget } = filters;

    let results = challengesStore.filter(
      (c) => c.status === 'published' || c.status === 'closed'
    );

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.short_description.toLowerCase().includes(q) ||
          c.problem_statement.toLowerCase().includes(q) ||
          c.organization_name?.toLowerCase().includes(q)
      );
    }

    if (category && category !== 'all') {
      results = results.filter((c) => c.category === category);
    }

    if (typeof minBudget === 'number' && minBudget > 0) {
      results = results.filter((c) => c.budget_max >= minBudget);
    }

    if (typeof maxBudget === 'number' && maxBudget > 0) {
      results = results.filter((c) => c.budget_min <= maxBudget);
    }

    return {
      challenges: results,
      total: results.length,
    };
  },

  /**
   * Get single public challenge by slug
   * Fails if challenge is not published or closed!
   */
  getPublicChallengeBySlug(slug: string): Challenge | null {
    const found = challengesStore.find(
      (c) => c.slug === slug && (c.status === 'published' || c.status === 'closed')
    );
    return found || null;
  },

  /**
   * Get challenge by ID regardless of status (Internal/Service usage)
   */
  getChallengeById(challengeId: string): { success: boolean; challenge?: Challenge; error?: string } {
    const found = challengesStore.find((c) => c.id === challengeId);
    if (!found) {
      return { success: false, error: 'Không tìm thấy thử thách' };
    }
    return { success: true, challenge: found };
  },

  /**
   * Organization Challenge Management
   * Returns challenges belonging strictly to the specified organization.
   */
  getOrganizationChallenges(organizationId: string): Challenge[] {
    return challengesStore.filter((c) => c.organization_id === organizationId);
  },

  /**
   * Admin Review Queue
   * STRICT SECURITY: Only challenges in 'pending_review' are returned.
   */
  getPendingReviewQueue(adminUserId: string, isAdmin: boolean): Challenge[] {
    if (!isAdmin) {
      throw new Error('SECURITY VIOLATION: Chỉ quản trị viên mới có quyền truy cập hàng đợi duyệt.');
    }
    return challengesStore.filter((c) => c.status === 'pending_review');
  },

  /**
   * Create a new Challenge
   * Validates with Zod schema, forces initial status to 'draft'.
   */
  createChallenge(
    formData: ChallengeFormData,
    creatorId: string,
    creatorName: string,
    orgName: string,
    orgSlug: string
  ): { success: boolean; challenge?: Challenge; error?: string } {
    try {
      const validated = challengeFormSchema.parse(formData);

      // Check unique slug
      if (challengesStore.some((c) => c.slug === validated.slug)) {
        return { success: false, error: 'Slug thử thách này đã tồn tại, vui lòng chọn slug khác.' };
      }

      const now = new Date().toISOString();
      const newChallenge: Challenge = {
        id: `ch-${Date.now()}`,
        ...validated,
        created_by: creatorId,
        creator_name: creatorName,
        organization_name: orgName,
        organization_slug: orgSlug,
        status: 'draft', // FORCED DRAFT AT INCEPTION
        published_at: null,
        created_at: now,
        updated_at: now,
      };

      challengesStore.unshift(newChallenge);
      return { success: true, challenge: newChallenge };
    } catch (err: any) {
      const message = err.errors?.[0]?.message || err.message || 'Lỗi kiểm thực dữ liệu';
      return { success: false, error: message };
    }
  },

  /**
   * Update an existing draft or editable challenge
   */
  updateChallenge(
    challengeId: string,
    formData: Partial<ChallengeFormData>,
    userId: string,
    isOrgMember: boolean
  ): { success: boolean; challenge?: Challenge; error?: string } {
    const index = challengesStore.findIndex((c) => c.id === challengeId);
    if (index === -1) {
      return { success: false, error: 'Không tìm thấy thử thách.' };
    }

    const existing = challengesStore[index];

    if (!isOrgMember) {
      return { success: false, error: 'Chỉ thành viên của tổ chức mới có quyền chỉnh sửa thử thách này.' };
    }

    if (!['draft', 'changes_requested'].includes(existing.status)) {
      return {
        success: false,
        error: `Thử thách ở trạng thái "${existing.status}" không thể chỉnh sửa nội dung.`,
      };
    }

    const updated: Challenge = {
      ...existing,
      ...formData,
      updated_at: new Date().toISOString(),
    };

    challengesStore[index] = updated;
    return { success: true, challenge: updated };
  },

  /**
   * Transition Challenge Status via State Machine
   */
  transitionStatus(
    challengeId: string,
    targetStatus: ChallengeStatus,
    context: {
      userId: string;
      userRole: 'creator' | 'business' | 'admin';
      isOrgMember: boolean;
      notes?: string;
    }
  ): { success: boolean; challenge?: Challenge; error?: string } {
    const index = challengesStore.findIndex((c) => c.id === challengeId);
    if (index === -1) {
      return { success: false, error: 'Không tìm thấy thử thách.' };
    }

    const existing = challengesStore[index];
    const isCreator = existing.created_by === context.userId;

    // Evaluate state machine rules
    const decision = canTransitionChallengeStatus(existing.status, targetStatus, {
      ...context,
      isCreator,
    });

    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'Chuyển đổi trạng thái không được phép.' };
    }

    const now = new Date().toISOString();
    const updated: Challenge = {
      ...existing,
      status: targetStatus,
      updated_at: now,
      published_at: targetStatus === 'published' ? now : existing.published_at,
      latest_review_note: context.notes || existing.latest_review_note,
    };

    challengesStore[index] = updated;
    return { success: true, challenge: updated };
  },

  /**
   * Admin Review Decision
   */
  processAdminReview(
    challengeId: string,
    payload: AdminReviewActionPayload,
    adminId: string,
    adminName: string,
    isAdmin: boolean
  ): { success: boolean; challenge?: Challenge; reviewRecord?: ChallengeReviewRecord; error?: string } {
    try {
      if (!isAdmin) {
        return { success: false, error: 'Chỉ quản trị viên hệ thống (Admin) mới có quyền thực hiện đánh giá.' };
      }

      const validated = adminReviewActionSchema.parse(payload);
      const index = challengesStore.findIndex((c) => c.id === challengeId);
      if (index === -1) {
        return { success: false, error: 'Không tìm thấy thử thách.' };
      }

      const challenge = challengesStore[index];
      if (challenge.status !== 'pending_review') {
        return {
          success: false,
          error: `Thử thách không ở trạng thái chờ duyệt (hiện tại: ${challenge.status}).`,
        };
      }

      // CRITICAL CHECK: Creator cannot approve their own challenge
      if (challenge.created_by === adminId && validated.action === 'approve') {
        return {
          success: false,
          error: 'QUY TẮC AN NINH: Quản trị viên không được phép tự phê duyệt thử thách do chính mình tạo.',
        };
      }

      const targetStatus: ChallengeStatus =
        validated.action === 'approve'
          ? 'approved'
          : validated.action === 'request_changes'
          ? 'changes_requested'
          : 'rejected';

      const now = new Date().toISOString();

      // Record review audit record
      const reviewRecord: ChallengeReviewRecord = {
        id: `rev-${Date.now()}`,
        challenge_id: challengeId,
        reviewer_id: adminId,
        reviewer_name: adminName,
        action: validated.action,
        notes: validated.notes,
        created_at: now,
      };
      reviewsStore.unshift(reviewRecord);

      // Update challenge status
      challenge.status = targetStatus;
      challenge.updated_at = now;
      challenge.latest_review_note = validated.notes;
      challengesStore[index] = challenge;

      return { success: true, challenge, reviewRecord };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Lỗi xử lý đánh giá' };
    }
  },

  /**
   * For testing reset
   */
  _resetStore() {
    challengesStore = [...INITIAL_DEMO_CHALLENGES];
    reviewsStore = [];
  },
};
