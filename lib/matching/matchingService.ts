import type { Challenge, EvaluationCriterion } from '../../types/challenge.types';
import type { CreatorSkill, CreatorReputationProfile } from '../../types/reputation.types';
import type { VerifiedPortfolioItem } from '../../types/outcome.types';
import type { PulsarUser } from '../../types/auth.types';
import type {
  ChallengeCreatorMatch,
  CreatorFeedItem,
  TalentMatchItem,
  RecommendationFeedbackRecord,
  CopilotAnalysisResult,
  ConfidenceLevel,
} from '../../types/matching.types';
import { challengeService } from '../challenge/challengeService';
import { reputationAnalyticsService } from '../reputation/reputationService';
import { outcomeRewardService } from '../outcome/outcomeRewardService';
import { submissionService } from '../submission/submissionService';
import {
  recommendationActionSchema,
  copilotAnalysisRequestSchema,
  type RecommendationActionInput,
  type CopilotAnalysisRequestInput,
} from '../validation/matching.schema';

class MatchingService {
  private feedbackStore: RecommendationFeedbackRecord[] = [];

  /**
   * Thuật toán Deterministic Matching Engine
   * Tính độ phù hợp giữa 1 Challenge và 1 Creator theo 5 thành phần có trọng số:
   * 1. Skill Alignment (35%): Phù hợp kỹ năng (Verified skills được nhân hệ số 1.5 so với self-declared)
   * 2. Evidence Alignment (25%): Có bằng chứng nghiệm thu thực tế, case study hoặc benchmark
   * 3. Domain / Category Relevance (15%): Kinh nghiệm trong cùng phân khúc (ai_ml, blockchain, fintech,...)
   * 4. Verified Track Record (15%): Uy tín, tỷ lệ hoàn thành đề bài và điểm Rubric trung bình
   * 5. Availability & Constraints (10%): Thời hạn còn lại và tính hợp lệ
   */
  async calculateMatch(
    challenge: Challenge,
    creatorId: string,
    creatorSkills: CreatorSkill[],
    creatorReputation: CreatorReputationProfile,
    creatorPortfolios: VerifiedPortfolioItem[]
  ): Promise<ChallengeCreatorMatch> {
    // 1. Skill Alignment (35%)
    // Trích xuất các từ khóa kỹ năng từ requirements & deliverables của challenge
    const challengeReqText = [
      challenge.title,
      challenge.short_description,
      challenge.problem_statement,
      ...challenge.requirements,
      ...challenge.deliverables,
    ]
      .join(' ')
      .toLowerCase();

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    let skillScoreSum = 0;

    // Duyệt qua kỹ năng của Creator
    creatorSkills.forEach((skill) => {
      const skillNameLower = skill.skill_name.toLowerCase();
      const isMatched =
        challengeReqText.includes(skillNameLower) ||
        challengeReqText.includes(skill.skill_category.replace(/_/g, ' '));

      if (isMatched) {
        matchedSkills.push(skill.skill_name);
        // Verified skill được 100 điểm, evidence_submitted được 70 điểm, self_declared chỉ được 40 điểm
        const weightFactor =
          skill.status === 'verified' ? 1.0 : skill.status === 'evidence_submitted' ? 0.7 : 0.4;
        skillScoreSum += 100 * weightFactor;
      }
    });

    const skillScoreRaw =
      matchedSkills.length > 0 ? Math.min(Math.round((skillScoreSum / matchedSkills.length) * (matchedSkills.length >= 2 ? 1.0 : 0.8)), 100) : 15;

    // Xác định các khoảng trống kỹ năng (skill gaps)
    if (challenge.category === 'ai_ml' && !matchedSkills.some((s) => s.toLowerCase().includes('neural') || s.toLowerCase().includes('rag'))) {
      missingSkills.push('Deep Learning / Agent Architecture chuyên sâu');
    }
    if (challenge.category === 'blockchain' && !matchedSkills.some((s) => s.toLowerCase().includes('contract') || s.toLowerCase().includes('solidity'))) {
      missingSkills.push('Smart Contract Audit & Slither Benchmark');
    }

    // 2. Evidence Alignment (25%)
    // Kiểm tra Creator có portfolio hoặc đề bài đã nghiệm thu trong danh mục tương tự không
    const relevantPortfolios = creatorPortfolios.filter(
      (p) => p.category === challenge.category || challengeReqText.includes(p.challenge_title.toLowerCase())
    );

    let evidenceScore = 20; // baseline
    const evidenceHighlights: string[] = [];

    if (relevantPortfolios.length > 0) {
      evidenceScore = 95;
      evidenceHighlights.push(
        `Đã đạt giải & nghiệm thu đề bài: "${relevantPortfolios[0].challenge_title}" (${relevantPortfolios[0].verified_by_org_name})`
      );
    } else if (creatorSkills.some((s) => s.status === 'verified')) {
      evidenceScore = 75;
      evidenceHighlights.push('Có chứng nhận kỹ năng độc lập được doanh nghiệp thẩm định.');
    }

    // 3. Domain / Category Relevance (15%)
    let domainScore = 40;
    if (creatorSkills.some((s) => s.skill_category.includes(challenge.category))) {
      domainScore = 90;
    } else if (relevantPortfolios.length > 0) {
      domainScore = 100;
    }

    // 4. Verified Track Record (15%)
    let trackRecordScore = 30;
    if (creatorReputation.reputation_tier === 'elite_innovator') trackRecordScore = 100;
    else if (creatorReputation.reputation_tier === 'top_contributor') trackRecordScore = 85;
    else if (creatorReputation.reputation_tier === 'verified_talent') trackRecordScore = 75;
    else if (creatorReputation.composite_reputation_score) {
      trackRecordScore = creatorReputation.composite_reputation_score;
    }

    // 5. Availability & Constraints (10%)
    // Kiểm tra deadline
    const deadlineTime = new Date(challenge.deadline_at).getTime();
    const nowTime = Date.now();
    const daysLeft = Math.max(0, Math.round((deadlineTime - nowTime) / (1000 * 60 * 60 * 24)));
    let availabilityScore = daysLeft > 14 ? 100 : daysLeft > 3 ? 75 : 40;

    // Tổng hợp điểm có trọng số
    const compositeScore = Number(
      (
        skillScoreRaw * 0.35 +
        evidenceScore * 0.25 +
        domainScore * 0.15 +
        trackRecordScore * 0.15 +
        availabilityScore * 0.10
      ).toFixed(1)
    );

    // Xác định độ tin cậy (Confidence)
    let confidence: ConfidenceLevel = 'high';
    if (creatorSkills.length === 0 && creatorPortfolios.length === 0) {
      confidence = 'insufficient_data';
    } else if (creatorSkills.filter((s) => s.status === 'verified').length === 0) {
      confidence = 'medium';
    }

    const reasons: string[] = [];
    if (matchedSkills.length > 0) {
      reasons.push(`Trùng khớp ${matchedSkills.length} kỹ năng trọng yếu: ${matchedSkills.join(', ')}.`);
    }
    if (evidenceHighlights.length > 0) {
      reasons.push(evidenceHighlights[0]);
    }
    if (trackRecordScore >= 80) {
      reasons.push(`Hồ sơ uy tín cao (${creatorReputation.reputation_tier}) với lịch sử giao bài đúng hạn.`);
    }

    const isDismissed = this.feedbackStore.some(
      (f) => f.challenge_id === challenge.id && f.user_id === creatorId && f.action === 'dismissed'
    );
    const isInterested = this.feedbackStore.some(
      (f) => f.challenge_id === challenge.id && f.user_id === creatorId && f.action === 'interested'
    );

    return {
      challenge_id: challenge.id,
      challenge_title: challenge.title,
      challenge_slug: challenge.slug,
      organization_id: challenge.organization_id,
      organization_name: challenge.organization_name || 'Doanh Nghiệp',
      creator_id: creatorId,
      creator_name: creatorReputation.creator_name,
      composite_match_score: compositeScore,
      confidence,
      components: {
        skill_alignment: {
          name: 'Phù Hợp Kỹ Năng (Skill Alignment)',
          weight: 35,
          score: skillScoreRaw,
          weighted_contribution: Number((skillScoreRaw * 0.35).toFixed(1)),
          explanation: `${matchedSkills.length} kỹ năng đáp ứng yêu cầu kỹ thuật của đề bài.`,
          matched_items: matchedSkills,
          missing_items: missingSkills,
        },
        evidence_alignment: {
          name: 'Bằng Chứng Thực Tế (Evidence Alignment)',
          weight: 25,
          score: evidenceScore,
          weighted_contribution: Number((evidenceScore * 0.25).toFixed(1)),
          explanation: 'Bảo chứng từ case study hoặc đề bài đã nghiệm thu trước đó.',
          matched_items: evidenceHighlights,
          missing_items: [],
        },
        domain_relevance: {
          name: 'Lĩnh Vực Chuyên Môn (Domain Relevance)',
          weight: 15,
          score: domainScore,
          weighted_contribution: Number((domainScore * 0.15).toFixed(1)),
          explanation: `Kinh nghiệm trong nhóm danh mục ${challenge.category}.`,
          matched_items: [challenge.category],
          missing_items: [],
        },
        verified_track_record: {
          name: 'Hồ Sơ Uy Tín (Verified Track Record)',
          weight: 15,
          score: Math.round(trackRecordScore),
          weighted_contribution: Number((trackRecordScore * 0.15).toFixed(1)),
          explanation: `Xếp hạng uy tín: ${creatorReputation.reputation_tier}.`,
          matched_items: [`Tier: ${creatorReputation.reputation_tier}`],
          missing_items: [],
        },
        availability_and_constraints: {
          name: 'Thời Hạn & Khả Dụng (Availability)',
          weight: 10,
          score: availabilityScore,
          weighted_contribution: Number((availabilityScore * 0.10).toFixed(1)),
          explanation: `Còn ${daysLeft} ngày trước hạn chót nhận bài.`,
          matched_items: [`${daysLeft} ngày còn lại`],
          missing_items: [],
        },
      },
      reasons,
      evidence_highlights: evidenceHighlights,
      skill_gaps: missingSkills,
      computed_at: new Date().toISOString(),
      is_dismissed: isDismissed,
      is_interested: isInterested,
    };
  }

  /**
   * Lấy danh sách đề xuất cá nhân hóa cho Creator (Creator Recommendation Feed)
   * YÊU CẦU:
   * - CHỈ lấy các challenge đang 'published' và còn hạn nộp
   * - Loại bỏ challenge đã 'closed', 'cancelled' hoặc đã hết hạn
   * - Sắp xếp theo match score giảm dần
   */
  async getCreatorFeed(
    creatorId: string,
    filters?: { category?: string; minBudget?: number }
  ): Promise<CreatorFeedItem[]> {
    // 1. Lấy tất cả public challenges
    const market = challengeService.getPublicMarketplace({
      category: filters?.category as any,
      minBudget: filters?.minBudget,
    });

    const now = new Date().toISOString();
    // Lọc bỏ challenge đã hết hạn hoặc không ở trạng thái published
    const validChallenges = market.challenges.filter(
      (c) => c.status === 'published' && c.deadline_at > now
    );

    // 2. Lấy dữ liệu hồ sơ Creator
    const skills = await reputationAnalyticsService.getCreatorSkills(creatorId);
    const rep = await reputationAnalyticsService.computeCreatorReputation(creatorId);
    const { data: portfolios } = await outcomeRewardService.getCreatorPortfolios(creatorId);

    // 3. Tính điểm matching cho từng challenge
    const feedItems: CreatorFeedItem[] = [];

    for (const challenge of validChallenges) {
      const match = await this.calculateMatch(challenge, creatorId, skills, rep, portfolios);
      // Nếu chưa bị dismissed thì đưa vào feed
      if (!match.is_dismissed) {
        feedItems.push({
          challenge,
          match,
        });
      }
    }

    // Sắp xếp theo composite_match_score cao nhất
    feedItems.sort((a, b) => b.match.composite_match_score - a.match.composite_match_score);

    return feedItems;
  }

  /**
   * Tìm kiếm và gợi ý nhân tài cho Doanh nghiệp (Business Talent Matching)
   * YÊU CẦU:
   * - Kiểm tra quyền: Chỉ thành viên của tổ chức sở hữu challenge hoặc Admin mới được xem
   * - Giới hạn và phân trang ứng viên
   * - Phân biệt verified skills với self-declared skills
   */
  async getTalentMatchesForChallenge(
    challengeId: string,
    operator: PulsarUser
  ): Promise<{ data: TalentMatchItem[]; error: string | null }> {
    const chalRes = challengeService.getChallengeById(challengeId);
    if (!chalRes.success || !chalRes.challenge) {
      return { data: [], error: 'Không tìm thấy thử thách.' };
    }

    const challenge = chalRes.challenge;

    // Kiểm tra quyền sở hữu tổ chức
    const isSuperAdmin = operator.role === 'admin';
    const isOrgMember = operator.organizations?.some((m) => m.organization.id === challenge.organization_id);

    if (!isSuperAdmin && !isOrgMember) {
      return {
        data: [],
        error: 'LỖI BẢO MẬT (403): Chỉ thành viên tổ chức sở hữu thử thách mới có quyền truy cập danh sách gợi ý nhân tài.',
      };
    }

    // Lấy danh sách Creator ứng viên tiêu biểu
    const candidates = [
      {
        creator_id: 'usr-creator-001',
        creator_name: 'Minh Quang',
        creator_email: 'creator.developer@pulsar.dev',
        creator_bio: 'Freelancer & Kỹ sư AI tại PULSAR, chuyên GNN và RAG Agent.',
      },
      {
        creator_id: 'usr-creator-002',
        creator_name: 'Hoàng Long',
        creator_email: 'long.blockchain@pulsar.dev',
        creator_bio: 'Kỹ sư Web3, Audit Smart Contract Solidity & Subgraph.',
      },
    ];

    const talentMatches: TalentMatchItem[] = [];

    for (const cand of candidates) {
      const skills = await reputationAnalyticsService.getCreatorSkills(cand.creator_id);
      const rep = await reputationAnalyticsService.computeCreatorReputation(cand.creator_id);
      const { data: portfolios } = await outcomeRewardService.getCreatorPortfolios(cand.creator_id);

      const match = await this.calculateMatch(challenge, cand.creator_id, skills, rep, portfolios);

      talentMatches.push({
        creator_id: cand.creator_id,
        creator_name: cand.creator_name,
        creator_email: cand.creator_email,
        creator_bio: cand.creator_bio,
        reputation_tier: rep.reputation_tier,
        composite_reputation_score: rep.composite_reputation_score,
        match,
      });
    }

    // Sắp xếp ứng viên theo điểm phù hợp
    talentMatches.sort((a, b) => b.match.composite_match_score - a.match.composite_match_score);

    return { data: talentMatches, error: null };
  }

  /**
   * Lưu phản hồi gợi ý (Feedback: interested / dismissed / applied)
   */
  async recordFeedback(
    input: RecommendationActionInput,
    user: PulsarUser
  ): Promise<{ success: boolean; error: string | null }> {
    const parse = recommendationActionSchema.safeParse(input);
    if (!parse.success) {
      return { success: false, error: parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ' };
    }

    const { challenge_id, target_creator_id, feed_type, action, match_score, confidence_level } = parse.data;

    const record: RecommendationFeedbackRecord = {
      id: 'fb-' + Math.random().toString(36).substring(2, 9),
      user_id: user.id,
      challenge_id,
      target_creator_id,
      feed_type,
      action,
      match_score,
      confidence_level,
      created_at: new Date().toISOString(),
    };

    this.feedbackStore.push(record);
    return { success: true, error: null };
  }

  /**
   * Challenge AI Copilot: Trợ lý phân tích và tối ưu hóa chất lượng đề bài
   * Thuật toán phân tích heuristic kiểm tra độ rõ ràng, mâu thuẫn yêu cầu và đề xuất Rubric chuẩn 100%
   */
  async analyzeChallengeWithCopilot(
    formData: CopilotAnalysisRequestInput
  ): Promise<CopilotAnalysisResult> {
    const parse = copilotAnalysisRequestSchema.safeParse(formData);
    if (!parse.success) {
      throw new Error(parse.error.issues[0]?.message || 'Dữ liệu đề bài không hợp lệ');
    }

    const data = parse.data;
    const strengths: string[] = [];
    const unclearObjectives: string[] = [];
    const deliverableRefinements: CopilotAnalysisResult['deliverable_refinements'] = [];
    const conflictsOrRisks: string[] = [];
    const questions: string[] = [];

    // 1. Phân tích mục tiêu & tính rõ ràng
    if (data.problem_statement.length > 80) {
      strengths.push('Bối cảnh bài toán thực tế được mô tả chi tiết, rõ ràng.');
    } else {
      unclearObjectives.push('Mô tả bài toán còn ngắn; cần bổ sung số liệu tổn thất hiện tại của doanh nghiệp.');
    }

    if (data.desired_outcome.length > 50) {
      strengths.push('Kết quả kỳ vọng nêu rõ tiêu chí hoàn thành.');
    } else {
      unclearObjectives.push('Kết quả kỳ vọng thiếu định lượng KPI cụ thể (ví dụ: tốc độ xử lý hoặc độ chính xác %).');
    }

    // 2. Đề xuất chuẩn hóa Deliverables
    data.deliverables.forEach((d) => {
      if (!d.toLowerCase().includes('github') && !d.toLowerCase().includes('docker') && !d.toLowerCase().includes('openapi')) {
        deliverableRefinements.push({
          original: d,
          suggestion: `${d} kèm Dockerfile triển khai và tài liệu hướng dẫn kiểm thử tự động`,
          reason: 'Giúp hội đồng nghiệm thu dễ dàng chạy thử và kiểm tra chất lượng giải pháp.',
        });
      }
    });

    if (deliverableRefinements.length === 0) {
      strengths.push('Sản phẩm bàn giao rõ ràng, có khả năng nghiệm thu độc lập.');
    }

    // 3. Kiểm tra mâu thuẫn ngân sách & deadline
    if (data.budget_min > data.budget_max) {
      conflictsOrRisks.push('Mâu thuẫn: Ngân sách tối thiểu lớn hơn ngân sách tối đa.');
    }

    const deadline = new Date(data.deadline_at).getTime();
    const now = Date.now();
    const days = Math.round((deadline - now) / (1000 * 60 * 60 * 24));
    if (days < 5) {
      conflictsOrRisks.push(`Cảnh báo tiến độ: Thời hạn chỉ còn ${days} ngày là quá ngắn cho đề bài kỹ thuật phức tạp.`);
    }

    // 4. Đề xuất Khung Chấm Điểm (Rubric) chuẩn hóa tổng đúng 100%
    const suggestedCriteria: EvaluationCriterion[] = [
      {
        id: 'crit-c1',
        name: 'Độ chính xác kỹ thuật & Đáp ứng KPI',
        weight: 40,
        description: 'Giải pháp đạt tiêu chuẩn benchmark và hoàn thành mục tiêu đề bài đặt ra.',
      },
      {
        id: 'crit-c2',
        name: 'Kiến trúc hệ thống & Độ tin cậy',
        weight: 30,
        description: 'Mã nguồn sạch, chuẩn microservices/dockerized, bảo mật và dễ mở rộng.',
      },
      {
        id: 'crit-c3',
        name: 'Tài liệu hướng dẫn & Bàn giao nghiệm thu',
        weight: 30,
        description: 'Tài liệu API OpenAPI đầy đủ, test coverage cao và video demo trực quan.',
      },
    ];

    questions.push('Doanh nghiệp có cung cấp môi trường Sandbox hoặc API test cho Creator không?');
    questions.push('Định dạng dữ liệu đầu vào cụ thể mà giải pháp cần hỗ trợ là gì?');

    // Tính điểm rõ ràng (Clarity Score)
    const clarityScore = Math.max(
      30,
      Math.min(
        100,
        100 -
          unclearObjectives.length * 15 -
          conflictsOrRisks.length * 20 -
          (deliverableRefinements.length > 0 ? 10 : 0)
      )
    );

    return {
      clarity_score: clarityScore,
      strengths,
      unclear_objectives: unclearObjectives,
      deliverable_refinements: deliverableRefinements,
      rubric_suggestions: {
        suggested_criteria: suggestedCriteria,
        total_weight: 100,
        explanation: 'Khung chấm điểm 3 tiêu chí cốt lõi, chuẩn hóa trọng số tổng bằng đúng 100%.',
      },
      conflicts_or_risks: conflictsOrRisks,
      clarification_questions: questions,
      is_ai_generated: true,
      model_source: 'gemini-rule-engine-hybrid',
    };
  }
}

export const matchingService = new MatchingService();
