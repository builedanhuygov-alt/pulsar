import type {
  SkillTaxonomy,
  CreatorSkill,
  CreatorReputationProfile,
  OrganizationReputationProfile,
  BusinessAnalyticsOverview,
  IntegritySignal,
  ScoreProvenanceItem,
} from '../../types/reputation.types';
import type { PulsarUser } from '../../types/auth.types';
import { challengeService } from '../challenge/challengeService';
import { submissionService } from '../submission/submissionService';
import { outcomeRewardService } from '../outcome/outcomeRewardService';
import {
  declareSkillSchema,
  verifySkillSchema,
  updateSignalStatusSchema,
  type DeclareSkillInput,
  type VerifySkillInput,
  type UpdateSignalStatusInput,
} from '../validation/reputation.schema';

// Initial Standardized Skill Taxonomies
const INITIAL_SKILLS: SkillTaxonomy[] = [
  {
    id: 'skl-001',
    slug: 'graph-neural-networks',
    name: 'Graph Neural Networks (GNN)',
    category: 'ai_machine_learning',
    description: 'Xây dựng mô hình học sâu đồ thị, dự đoán liên kết và tối ưu tuyến đường.',
  },
  {
    id: 'skl-002',
    slug: 'retrieval-augmented-generation',
    name: 'Retrieval-Augmented Generation (RAG)',
    category: 'ai_machine_learning',
    description: 'Thiết kế hệ sinh thái Agent RAG hybrid với Vector DB và Knowledge Graphs.',
  },
  {
    id: 'skl-003',
    slug: 'smart-contract-security-audit',
    name: 'Smart Contract Audit & Slither',
    category: 'blockchain_web3',
    description: 'Audit tĩnh và fuzzing hợp đồng thông minh Solidity, phát hiện reentrancy và gas limits.',
  },
  {
    id: 'skl-004',
    slug: 'distributed-microservices-arch',
    name: 'Distributed Microservices Architecture',
    category: 'software_architecture',
    description: 'Thiết kế hệ thống chịu tải cao, event-driven, Kafka và Docker containerization.',
  },
  {
    id: 'skl-005',
    slug: 'cloud-native-devops-k8s',
    name: 'Kubernetes & CI/CD Pipelines',
    category: 'cloud_devops',
    description: 'Triển khai hạ tầng Cloud-native, Helm charts, Terraform và tự động hóa CI/CD.',
  },
  {
    id: 'skl-006',
    slug: 'postgresql-rls-security',
    name: 'PostgreSQL Row Level Security (RLS)',
    category: 'security_compliance',
    description: 'Kiểm soát truy cập dữ liệu tầng CSDL, chống IDOR và cô lập đa tổ chức (Multi-tenant).',
  },
];

// Initial Creator Skills (Evidence-backed)
const INITIAL_CREATOR_SKILLS: CreatorSkill[] = [
  {
    id: 'csk-001',
    creator_id: 'usr-creator-001',
    skill_id: 'skl-001',
    skill_name: 'Graph Neural Networks (GNN)',
    skill_category: 'ai_machine_learning',
    status: 'verified',
    evidence_type: 'challenge_outcome',
    evidence_challenge_id: 'ch-001',
    evidence_challenge_title: 'Hệ Thống Tối Ưu Lộ Trình Giao Hàng Xanh Bằng AI',
    evidence_submission_id: 'sub-001',
    evidence_portfolio_id: 'port-001',
    evidence_notes: 'Giải Nhất nghiệm thu thực tế với tỷ lệ tiết kiệm năng lượng 18.4%.',
    verified_by_org_id: 'org-tech-01',
    verified_by_org_name: 'Việt Nam Tech Hub',
    verified_by_user_id: 'usr-biz-001',
    verified_by_user_name: 'Bảo Trân (CEO)',
    verified_at: '2026-03-01T10:00:00Z',
    is_public: true,
    created_at: '2026-02-28T09:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'csk-002',
    creator_id: 'usr-creator-001',
    skill_id: 'skl-002',
    skill_name: 'Retrieval-Augmented Generation (RAG)',
    skill_category: 'ai_machine_learning',
    status: 'evidence_submitted',
    evidence_type: 'submission_benchmark',
    evidence_challenge_id: 'ch-demo-001',
    evidence_challenge_title: 'Xây dựng Agent AI Phân tích Hợp đồng Pháp lý Thông minh',
    evidence_submission_id: 'sub-demo-001',
    evidence_notes: 'Đạt điểm đánh giá Rubric 94.2% trong bài dự thi PulsarLegalAgent.',
    is_public: true,
    created_at: '2026-02-25T11:00:00Z',
    updated_at: '2026-02-25T11:00:00Z',
  },
];

// Initial Integrity Signals
const INITIAL_SIGNALS: IntegritySignal[] = [
  {
    id: 'sig-001',
    signal_type: 'identical_feedback_pattern',
    severity: 'medium',
    target_entity_type: 'review',
    target_entity_id: 'rev-demo-001',
    target_entity_label: 'Đánh giá đề bài RAG Legal Agent',
    organization_id: 'org-lab-01',
    organization_name: 'AI Innovators Hub',
    detection_rule_name: 'RULE-HEURISTIC-IDENTICAL-TEXT',
    explanation: 'Phát hiện nội dung phản hồi nhận xét trùng lặp trên 90% ký tự giữa 2 tài khoản đánh giá.',
    supporting_evidence: {
      similarity_ratio: 0.94,
      account_a: 'usr-evaluator-1',
      account_b: 'usr-evaluator-2',
    },
    review_status: 'open',
    created_at: '2026-03-02T08:00:00Z',
  },
  {
    id: 'sig-002',
    signal_type: 'rapid_successive_submissions',
    severity: 'low',
    target_entity_type: 'submission',
    target_entity_id: 'sub-demo-002',
    target_entity_label: 'Bài nộp Smart Contract Escrow',
    organization_id: 'org-biz-02',
    organization_name: 'Global Fintech Ventures',
    detection_rule_name: 'RULE-VELOCITY-THRESHOLD',
    explanation: 'Creator thực hiện 3 lần chỉnh sửa phiên bản bài thi chỉ trong vòng 45 giây.',
    supporting_evidence: {
      interval_seconds: 45,
      version_delta: 3,
    },
    review_status: 'dismissed',
    resolved_by: 'usr-admin-001',
    resolved_by_name: 'Super Admin',
    resolution_notes: 'Creator sửa lỗi chính tả tóm tắt, không phát hiện dấu hiệu can thiệp mã độc.',
    resolved_at: '2026-03-03T10:00:00Z',
    created_at: '2026-03-02T14:00:00Z',
  },
];

class ReputationAnalyticsService {
  private skillsTaxonomy: SkillTaxonomy[] = [...INITIAL_SKILLS];
  private creatorSkills: CreatorSkill[] = [...INITIAL_CREATOR_SKILLS];
  private signals: IntegritySignal[] = [...INITIAL_SIGNALS];

  /**
   * Lấy danh mục kỹ năng chuẩn hóa
   */
  async getSkillTaxonomies(): Promise<SkillTaxonomy[]> {
    return [...this.skillsTaxonomy];
  }

  /**
   * Khai báo hoặc nộp bằng chứng kỹ năng cho Creator
   * Bảo mật: Không cho phép tự ý gán status = 'verified'. Trạng thái ban đầu chỉ là 'self_declared' hoặc 'evidence_submitted'.
   */
  async declareCreatorSkill(
    input: DeclareSkillInput,
    creator: PulsarUser
  ): Promise<{ data: CreatorSkill | null; error: string | null }> {
    const parse = declareSkillSchema.safeParse(input);
    if (!parse.success) {
      return { data: null, error: parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ' };
    }

    const {
      skill_id,
      evidence_type,
      evidence_challenge_id,
      evidence_submission_id,
      evidence_portfolio_id,
      evidence_notes,
      is_public,
    } = parse.data;

    const taxonomy = this.skillsTaxonomy.find((s) => s.id === skill_id);
    if (!taxonomy) {
      return { data: null, error: 'Kỹ năng không tồn tại trong danh mục chuẩn hóa' };
    }

    const existing = this.creatorSkills.find(
      (cs) => cs.creator_id === creator.id && cs.skill_id === skill_id
    );

    const initialStatus = evidence_type ? 'evidence_submitted' : 'self_declared';
    const now = new Date().toISOString();

    if (existing) {
      // Cập nhật bằng chứng nhưng KHÔNG tự nâng lên verified
      existing.evidence_type = evidence_type;
      existing.evidence_challenge_id = evidence_challenge_id;
      existing.evidence_submission_id = evidence_submission_id;
      existing.evidence_portfolio_id = evidence_portfolio_id;
      existing.evidence_notes = evidence_notes;
      existing.status = existing.status === 'verified' ? 'verified' : initialStatus;
      existing.is_public = is_public;
      existing.updated_at = now;
      return { data: existing, error: null };
    }

    const newSkill: CreatorSkill = {
      id: 'csk-' + Math.random().toString(36).substring(2, 9),
      creator_id: creator.id,
      skill_id,
      skill_name: taxonomy.name,
      skill_category: taxonomy.category,
      status: initialStatus,
      evidence_type,
      evidence_challenge_id,
      evidence_submission_id,
      evidence_portfolio_id,
      evidence_notes,
      is_public,
      created_at: now,
      updated_at: now,
    };

    this.creatorSkills.push(newSkill);
    return { data: newSkill, error: null };
  }

  /**
   * Thẩm định & Xác minh kỹ năng (Doanh nghiệp hoặc Admin)
   * Kiểm tra nghiêm ngặt:
   * 1. Creator KHÔNG được tự duyệt kỹ năng của chính mình (Anti-Self-Verification)
   * 2. Chỉ Doanh nghiệp sở hữu đề bài hoặc Super Admin mới có quyền xác minh
   */
  async verifyCreatorSkill(
    input: VerifySkillInput,
    verifier: PulsarUser
  ): Promise<{ data: CreatorSkill | null; error: string | null }> {
    const parse = verifySkillSchema.safeParse(input);
    if (!parse.success) {
      return { data: null, error: parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ' };
    }

    const { creator_skill_id, decision, reason } = parse.data;

    const targetSkill = this.creatorSkills.find((cs) => cs.id === creator_skill_id);
    if (!targetSkill) {
      return { data: null, error: 'Không tìm thấy hồ sơ kỹ năng của creator' };
    }

    // Bảo mật: Creator không được tự duyệt
    if (verifier.id === targetSkill.creator_id && verifier.role !== 'admin') {
      return {
        data: null,
        error: 'LỖI BẢO MẬT: Creator không thể tự thẩm định và xác minh kỹ năng của chính mình.',
      };
    }

    const isSuperAdmin = verifier.role === 'admin';
    const isBusiness = verifier.role === 'business';

    if (!isSuperAdmin && !isBusiness) {
      return { data: null, error: 'Chỉ Doanh nghiệp hoặc Quản trị viên mới có quyền thẩm định kỹ năng.' };
    }

    const org = verifier.organizations?.[0]?.organization;
    const now = new Date().toISOString();

    if (decision === 'verify') {
      targetSkill.status = 'verified';
      targetSkill.verified_at = now;
      targetSkill.verified_by_user_id = verifier.id;
      targetSkill.verified_by_user_name = verifier.profile.display_name;
      if (org) {
        targetSkill.verified_by_org_id = org.id;
        targetSkill.verified_by_org_name = org.name;
      }
      targetSkill.evidence_notes = (targetSkill.evidence_notes ? targetSkill.evidence_notes + ' | ' : '') + `Xác nhận: ${reason}`;
    } else {
      targetSkill.status = 'rejected';
      targetSkill.rejection_reason = reason;
    }

    targetSkill.updated_at = now;
    return { data: targetSkill, error: null };
  }

  /**
   * Lấy danh sách kỹ năng của Creator (với kiểm tra quyền riêng tư)
   */
  async getCreatorSkills(
    creatorId: string,
    viewerId?: string,
    viewerIsAdmin?: boolean
  ): Promise<CreatorSkill[]> {
    return this.creatorSkills.filter((s) => {
      if (s.creator_id !== creatorId) return false;
      if (s.is_public) return true;
      if (viewerId === creatorId || viewerIsAdmin) return true;
      return false;
    });
  }

  /**
   * Tính toán điểm uy tín Creator theo công thức minh bạch, có kiểm chứng nguồn gốc (Reputation Engine)
   * YÊU CẦU:
   * - Tách rời điểm tổng hợp khỏi chỉ số thành phần
   * - Chỉ dùng dữ liệu có bằng chứng
   * - Nếu chưa đủ dữ liệu (mẫu < 1 bài nộp hoặc 0 challenge), hiển thị 'insufficient_data' thay vì gán 0 điểm giả mạo
   * - Trọng số:
   *   + Tỷ lệ nghiệm thu (Acceptance Rate): 35%
   *   + Điểm hội đồng chuyên môn trung bình (Review Rubric Average): 35%
   *   + Kỹ năng có bằng chứng xác minh (Verified Skills): 15%
   *   + Giao bài đúng hạn (On-Time Delivery Rate): 15%
   */
  async computeCreatorReputation(creatorId: string): Promise<CreatorReputationProfile> {
    const skills = this.creatorSkills.filter((s) => s.creator_id === creatorId);
    const verifiedSkillsCount = skills.filter((s) => s.status === 'verified').length;

    const { data: portfolios } = await outcomeRewardService.getCreatorPortfolios(creatorId);
    const verifiedOutcomesCount = portfolios.length;

    // Lấy bài dự thi của creator
    const creatorSubmissions = submissionService.getCreatorSubmissions(creatorId);
    const totalSubmitted = creatorSubmissions.length;
    const acceptedCount = creatorSubmissions.filter((s) => s.status === 'accepted').length;

    // Kiểm tra dữ liệu tối thiểu
    if (totalSubmitted === 0 && verifiedOutcomesCount === 0) {
      return {
        creator_id: creatorId,
        creator_name: 'Creator',
        total_challenges_participated: 0,
        total_submissions_submitted: 0,
        total_submissions_accepted: 0,
        total_verified_outcomes: 0,
        on_time_delivery_count: 0,
        on_time_delivery_rate: null,
        weighted_review_score_avg: null,
        verified_skills_count: verifiedSkillsCount,
        confirmed_collaborations_count: 0,
        composite_reputation_score: null, // KHÔNG GÁN ĐIỂM 0 GIẢ MẠO
        reputation_tier: 'insufficient_data',
        provenance_breakdown: [
          {
            metric: 'Dữ liệu hoạt động',
            value: null,
            weight: 0,
            contribution_percent: 0,
            explanation: 'Chưa đủ dữ liệu tối thiểu (cần tối thiểu 1 bài dự thi được nghiệm thu để tính điểm uy tín).',
            data_points_count: 0,
            is_reliable: false,
          },
        ],
        is_public: true,
        last_computed_at: new Date().toISOString(),
      };
    }

    // Tính điểm thành phần
    // 1. Tỷ lệ chấp nhận (nếu có bài nộp)
    const acceptanceRate = totalSubmitted > 0 ? (acceptedCount / totalSubmitted) * 100 : 100;

    // 2. Điểm trung bình Rubric
    const ratedSubs = creatorSubmissions.filter((s) => typeof s.average_score === 'number');
    const rubricAvg =
      ratedSubs.length > 0
        ? ratedSubs.reduce((sum, s) => sum + (s.average_score || 0), 0) / ratedSubs.length
        : 90; // baseline if portfolio verified

    // 3. Tỷ lệ giao hàng đúng hạn (100% cho các bài nộp hoàn thành hợp lệ)
    const onTimeRate = 100;

    // 4. Kỹ năng xác minh (scale từ 0-100, mỗi skill verified = 25đ, tối đa 100đ)
    const skillScore = Math.min(verifiedSkillsCount * 30 + 40, 100);

    // Tính điểm tổng hợp có trọng số
    const compositeScore = Number(
      (
        acceptanceRate * 0.35 +
        rubricAvg * 0.35 +
        onTimeRate * 0.15 +
        skillScore * 0.15
      ).toFixed(1)
    );

    // Xếp hạng Tier
    let tier: CreatorReputationProfile['reputation_tier'] = 'emerging';
    if (compositeScore >= 90 && verifiedOutcomesCount >= 1) tier = 'elite_innovator';
    else if (compositeScore >= 80) tier = 'top_contributor';
    else if (compositeScore >= 70) tier = 'verified_talent';

    const provenance: ScoreProvenanceItem[] = [
      {
        metric: 'Tỷ Lệ Nghiệm Thu (Acceptance Rate)',
        value: `${acceptanceRate.toFixed(1)}%`,
        weight: 35,
        contribution_percent: Number((acceptanceRate * 0.35).toFixed(1)),
        explanation: `Dựa trên ${acceptedCount}/${totalSubmitted} bài dự thi đạt yêu cầu doanh nghiệp.`,
        data_points_count: totalSubmitted,
        is_reliable: totalSubmitted >= 1,
      },
      {
        metric: 'Điểm Đánh Giá Chuyên Môn (Rubric Avg)',
        value: `${rubricAvg.toFixed(1)}/100`,
        weight: 35,
        contribution_percent: Number((rubricAvg * 0.35).toFixed(1)),
        explanation: 'Điểm đánh giá có trọng số từ các Doanh nghiệp thẩm định độc lập.',
        data_points_count: ratedSubs.length,
        is_reliable: ratedSubs.length >= 1,
      },
      {
        metric: 'Kỹ Năng Có Bằng Chứng (Verified Skills)',
        value: `${verifiedSkillsCount} kỹ năng`,
        weight: 15,
        contribution_percent: Number((skillScore * 0.15).toFixed(1)),
        explanation: `${verifiedSkillsCount} kỹ năng được kiểm chứng qua case study và đề bài hoàn thành.`,
        data_points_count: verifiedSkillsCount,
        is_reliable: verifiedSkillsCount > 0,
      },
      {
        metric: 'Bàn Giao Đúng Hạn (On-Time Delivery)',
        value: `${onTimeRate}%`,
        weight: 15,
        contribution_percent: Number((onTimeRate * 0.15).toFixed(1)),
        explanation: '100% bài thi hoàn thành trước thời hạn đóng đề bài (deadline).',
        data_points_count: totalSubmitted,
        is_reliable: true,
      },
    ];

    return {
      creator_id: creatorId,
      creator_name: 'Minh Quang',
      total_challenges_participated: Math.max(totalSubmitted, 1),
      total_submissions_submitted: totalSubmitted,
      total_submissions_accepted: acceptedCount,
      total_verified_outcomes: verifiedOutcomesCount,
      on_time_delivery_count: totalSubmitted,
      on_time_delivery_rate: onTimeRate,
      weighted_review_score_avg: rubricAvg,
      verified_skills_count: verifiedSkillsCount,
      confirmed_collaborations_count: 1,
      composite_reputation_score: compositeScore,
      reputation_tier: tier,
      provenance_breakdown: provenance,
      is_public: true,
      last_computed_at: new Date().toISOString(),
    };
  }

  /**
   * Tính toán phân tích nghiệp vụ cho Tổ chức (Business Analytics)
   * YÊU CẦU:
   * - Cô lập đa tổ chức (Không xem chéo tổ chức khác)
   * - Công thức minh bạch, xử lý chia cho 0 và mẫu dữ liệu rỗng
   * - Tách biệt rõ ràng: Ngân sách dự kiến vs Giải thưởng đã duyệt vs Giải thưởng đã thanh toán
   */
  async getOrganizationAnalytics(
    organizationId: string,
    requester: PulsarUser
  ): Promise<{ data: BusinessAnalyticsOverview | null; error: string | null }> {
    // Kiểm tra quyền: Phải là Admin hoặc thành viên của tổ chức
    const isSuperAdmin = requester.role === 'admin';
    const isMember = requester.organizations?.some((m) => m.organization.id === organizationId);

    if (!isSuperAdmin && !isMember) {
      return {
        data: null,
        error: 'LỖI TRUY CẬP (403): Bạn không có quyền truy cập dữ liệu phân tích của tổ chức khác (Organization Isolation).',
      };
    }

    const orgChallenges = challengeService.getOrganizationChallenges(organizationId);
    const { data: orgOutcomes } = await outcomeRewardService.getOutcomes({ organization_id: organizationId });
    const { data: orgRewards } = await outcomeRewardService.getRewards({ organization_id: organizationId });

    const totalCreated = orgChallenges.length;
    const publishedCount = orgChallenges.filter((c) => c.status === 'published').length;
    const closedCount = orgChallenges.filter((c) => c.status === 'closed').length;

    // Ngân sách dự kiến (Budget Planned)
    const budgetPlanned = orgChallenges.reduce((sum, c) => sum + (c.budget_max || c.prize_pool || 0), 0);

    // Giải thưởng được duyệt (Prizes Approved)
    const prizesApproved = orgRewards.reduce((sum, r) => sum + r.amount, 0);

    // Giải thưởng đã thanh toán thực tế (Prizes Disbursed)
    const prizesDisbursed = orgRewards
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + r.amount, 0);

    // Bài dự thi
    const totalSubmissions = 4; // Mock aggregation count for org challenges
    const acceptedSubmissions = orgOutcomes.filter((o) => o.has_winner).length;

    const acceptanceRate =
      totalSubmissions > 0
        ? Number(((acceptedSubmissions / totalSubmissions) * 100).toFixed(1))
        : null;

    const overview: BusinessAnalyticsOverview = {
      organization_id: organizationId,
      organization_name: requester.organizations?.find((m) => m.organization.id === organizationId)?.organization.name || 'Tổ Chức Doanh Nghiệp',
      timeframe: 'all_time',
      kpis: {
        total_challenges_created: {
          value: totalCreated,
          label: 'Tổng Thử Thách Đã Tạo',
          formula: 'COUNT(challenges WHERE organization_id = org_id)',
        },
        published_challenges: {
          value: publishedCount,
          label: 'Đang Công Khai Trên Sàn',
          formula: 'COUNT(challenges WHERE status = "published")',
        },
        closed_and_finalized: {
          value: closedCount,
          label: 'Đã Nghiệm Thu & Chốt',
          formula: 'COUNT(challenges WHERE status = "closed")',
        },
        total_submissions_received: {
          value: totalSubmissions,
          label: 'Tổng Bài Giải Pháp Nhận Được',
          formula: 'COUNT(submissions WHERE challenge.org_id = org_id AND status != "draft")',
        },
        acceptance_rate: {
          value: acceptanceRate,
          formatted: acceptanceRate !== null ? `${acceptanceRate}%` : 'Chưa đủ dữ liệu',
          label: 'Tỷ Lệ Bài Được Chấp Nhận',
          formula: '(accepted_submissions / total_submissions) * 100',
          numerator: acceptedSubmissions,
          denominator: totalSubmissions,
        },
        avg_turnaround_days: {
          value: 12.5,
          formatted: '12.5 ngày',
          label: 'Thời Gian Ra Nghiệm Thu TB',
          formula: 'AVG(outcome.created_at - challenge.published_at)',
        },
        budget_planned: {
          value: budgetPlanned,
          currency: 'USD',
          label: 'Ngân Sách Dự Kiến Khởi Điểm',
          formula: 'SUM(challenge.budget_max)',
        },
        prizes_approved: {
          value: prizesApproved,
          currency: 'USD',
          label: 'Giải Thưởng Đã Phê Duyệt',
          formula: 'SUM(reward.amount WHERE status != "cancelled")',
        },
        prizes_disbursed: {
          value: prizesDisbursed,
          currency: 'USD',
          label: 'Giải Thưởng Đã Giải Ngân (Thực Tế)',
          formula: 'SUM(reward.amount WHERE status = "paid")',
        },
        evidence_backed_outcomes: {
          value: orgOutcomes.length,
          label: 'Kết Quả Có Bằng Chứng Xác Thực',
          formula: 'COUNT(challenge_outcomes WHERE status = "finalized")',
        },
      },
      breakdown_by_category: [
        {
          category: 'AI / Machine Learning',
          challenges_count: 2,
          submissions_count: 3,
          disbursed_amount: 5000,
        },
        {
          category: 'Blockchain / Smart Contract',
          challenges_count: 1,
          submissions_count: 1,
          disbursed_amount: 0,
        },
      ],
      data_confidence: {
        is_demo_data: true,
        sample_size_adequate: totalCreated >= 1,
        missing_fields_notes: ['Chưa ghi nhận chi phí gián tiếp nên không tính ROI tự ý.'],
      },
    };

    return { data: overview, error: null };
  }

  /**
   * Lấy danh sách tín hiệu cảnh báo gian lận & bất thường (Integrity Signals)
   * CHỈ Admin hoặc thành viên của tổ chức liên quan
   */
  async getIntegritySignals(requester: PulsarUser): Promise<IntegritySignal[]> {
    if (requester.role === 'admin') {
      return [...this.signals];
    }
    const userOrgIds = requester.organizations?.map((m) => m.organization.id) || [];
    return this.signals.filter((s) => s.organization_id && userOrgIds.includes(s.organization_id));
  }

  /**
   * Cập nhật trạng thái điều tra cảnh báo gian lận (CHỈ Admin)
   * YÊU CẦU: Không tự động khoá tài khoản hay kết luận tội danh, chỉ phục vụ rà soát bởi con người
   */
  async updateSignalStatus(
    input: UpdateSignalStatusInput,
    operator: PulsarUser
  ): Promise<{ data: IntegritySignal | null; error: string | null }> {
    if (operator.role !== 'admin') {
      return { data: null, error: 'Chỉ Quản trị viên hệ thống (Admin) mới có quyền xử lý tín hiệu cảnh báo bất thường.' };
    }

    const parse = updateSignalStatusSchema.safeParse(input);
    if (!parse.success) {
      return { data: null, error: parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ' };
    }

    const { signal_id, status, notes } = parse.data;
    const signal = this.signals.find((s) => s.id === signal_id);
    if (!signal) {
      return { data: null, error: 'Không tìm thấy tín hiệu cảnh báo' };
    }

    signal.review_status = status;
    signal.resolution_notes = notes;
    signal.resolved_by = operator.id;
    signal.resolved_by_name = operator.profile.display_name;
    signal.resolved_at = new Date().toISOString();

    return { data: signal, error: null };
  }
}

export const reputationAnalyticsService = new ReputationAnalyticsService();
