import { describe, it, expect, beforeEach } from 'vitest';
import { matchingService } from '../lib/matching/matchingService';
import { challengeService } from '../lib/challenge/challengeService';
import type { Challenge } from '../types/challenge.types';
import type { CreatorSkill, CreatorReputationProfile } from '../types/reputation.types';
import type { VerifiedPortfolioItem } from '../types/outcome.types';
import type { PulsarUser } from '../types/auth.types';

describe('PULSAR Sprint 6: AI Matching, Recommendations & Copilot Engine', () => {
  const mockChallenge: Challenge = {
    id: 'ch-test-ai-01',
    organization_id: 'org-tech-01',
    organization_name: 'TechCorp Vietnam',
    title: 'Hệ thống Trích xuất Hóa đơn Tự động bằng AI (OCR & LLM)',
    slug: 'ai-invoice-extraction',
    category: 'ai_ml',
    short_description: 'Xây dựng giải pháp AI trích xuất thông tin hóa đơn VAT tự động với độ chính xác cao',
    problem_statement: 'Doanh nghiệp mất 120 giờ mỗi tháng nhập liệu thủ công với tỷ lệ sai sót 4.5%. Cần giải pháp AI trích xuất các trường thông tin quan trọng.',
    desired_outcome: 'Độ chính xác trích xuất trường đạt > 98% và thời gian phản hồi API < 1.5 giây.',
    requirements: [
      'Mô hình Deep Learning / Neural Network xử lý hình ảnh',
      'API chuẩn OpenAPI kèm tài liệu Swagger',
      'Xử lý định dạng PDF và JPG/PNG độ phân giải thấp',
    ],
    deliverables: [
      'Mã nguồn GitHub kèm Dockerfile và docker-compose',
      'Tài liệu kỹ thuật và báo cáo benchmark độ chính xác F1-score',
    ],
    evaluation_criteria: [
      { id: 'crit-1', name: 'Độ chính xác F1-score', weight: 40, description: 'Đạt > 98%' },
      { id: 'crit-2', name: 'Tốc độ xử lý API', weight: 30, description: 'Thời gian phản hồi < 1.5s' },
      { id: 'crit-3', name: 'Kiến trúc & Docker', weight: 30, description: 'Clean architecture & Dockerfile' },
    ],
    budget_min: 25000000,
    budget_max: 45000000,
    prize_pool: 40000000,
    currency: 'VND',
    status: 'published',
    published_at: new Date(Date.now() - 86400000).toISOString(),
    start_at: new Date(Date.now() - 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 86400000 * 20).toISOString(), // 20 days left
    created_by: 'usr-biz-01',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  };

  const mockSkills = [
    {
      id: 'sk-1',
      creator_id: 'usr-creator-001',
      skill_id: 'sk-tax-1',
      skill_name: 'Deep Learning',
      skill_category: 'ai_machine_learning',
      status: 'verified',
      verified_at: new Date().toISOString(),
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'sk-2',
      creator_id: 'usr-creator-001',
      skill_id: 'sk-tax-2',
      skill_name: 'OpenAPI',
      skill_category: 'cloud_devops',
      status: 'verified',
      verified_at: new Date().toISOString(),
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as unknown as CreatorSkill[];

  const mockReputation = {
    creator_id: 'usr-creator-001',
    creator_name: 'Minh Quang',
    reputation_tier: 'elite_innovator',
    composite_reputation_score: 95,
    total_challenges_participated: 5,
    total_submissions_submitted: 5,
    total_submissions_accepted: 4,
    total_verified_outcomes: 3,
    on_time_delivery_count: 3,
    on_time_delivery_rate: 100,
    weighted_review_score_avg: 92,
    verified_skills_count: 2,
    confirmed_collaborations_count: 1,
    provenance_breakdown: [],
    is_public: true,
    last_computed_at: new Date().toISOString(),
  } as unknown as CreatorReputationProfile;

  const mockPortfolios = [
    {
      id: 'port-01',
      outcome_id: 'out-01',
      challenge_id: 'ch-prev-01',
      challenge_title: 'Mô hình AI Thị giác Máy tính',
      challenge_slug: 'ai-computer-vision',
      category: 'ai_ml',
      creator_id: 'usr-creator-001',
      creator_name: 'Minh Quang',
      submission_id: 'sub-01',
      submission_title: 'YOLOv8 Realtime OCR',
      role_description: 'Lead AI Engineer',
      skills_acquired: ['Computer Vision', 'Deep Learning'],
      case_study_summary: 'Hệ thống nhận diện biển số xe sử dụng YOLOv8 và ONNX Runtime',
      case_study_metrics: { accuracy: '94%' },
      awarded_prize_amount: 30000000,
      currency: 'VND',
      is_public: true,
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by_org_id: 'org-tech-01',
      verified_by_org_name: 'TechCorp Vietnam',
      created_at: new Date().toISOString(),
    },
  ] as unknown as VerifiedPortfolioItem[];

  const businessUser = {
    id: 'usr-biz-01',
    email: 'business@techcorp.dev',
    role: 'business',
    profile: {
      id: 'usr-biz-01',
      display_name: 'TechCorp Business Rep',
      avatar_url: null,
      bio: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    organizations: [
      {
        membership_role: 'owner',
        organization: {
          id: 'org-lab-01',
          name: 'AI Innovators Hub',
          slug: 'ai-innovators-hub',
          organization_type: 'business',
          created_by: 'usr-biz-01',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  } as unknown as PulsarUser;

  const unownedBusinessUser = {
    id: 'usr-biz-02',
    email: 'other@competitor.dev',
    role: 'business',
    profile: {
      id: 'usr-biz-02',
      display_name: 'Other Org Rep',
      avatar_url: null,
      bio: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    organizations: [
      {
        membership_role: 'owner',
        organization: {
          id: 'org-other-02',
          name: 'Other Org',
          slug: 'other-org',
          organization_type: 'business',
          created_by: 'usr-biz-02',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  } as unknown as PulsarUser;

  const creatorUser = {
    id: 'usr-creator-001',
    email: 'creator.developer@pulsar.dev',
    role: 'creator',
    profile: {
      id: 'usr-creator-001',
      display_name: 'Minh Quang',
      avatar_url: null,
      bio: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    organizations: [],
  } as unknown as PulsarUser;

  const adminUser = {
    id: 'usr-admin-01',
    email: 'admin@pulsar.dev',
    role: 'admin',
    profile: {
      id: 'usr-admin-01',
      display_name: 'Admin System',
      avatar_url: null,
      bio: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    organizations: [],
  } as unknown as PulsarUser;

  it('MATCH-1: Calculates transparent 5-component weighted score (0-100)', async () => {
    const match = await matchingService.calculateMatch(
      mockChallenge,
      'usr-creator-001',
      mockSkills,
      mockReputation,
      mockPortfolios
    );

    expect(match.challenge_id).toBe(mockChallenge.id);
    expect(match.creator_id).toBe('usr-creator-001');
    expect(match.composite_match_score).toBeGreaterThan(70);
    expect(match.composite_match_score).toBeLessThanOrEqual(100);

    // Verify 5 component weights
    expect(match.components.skill_alignment.weight).toBe(35);
    expect(match.components.evidence_alignment.weight).toBe(25);
    expect(match.components.domain_relevance.weight).toBe(15);
    expect(match.components.verified_track_record.weight).toBe(15);
    expect(match.components.availability_and_constraints.weight).toBe(10);

    const totalWeight =
      match.components.skill_alignment.weight +
      match.components.evidence_alignment.weight +
      match.components.domain_relevance.weight +
      match.components.verified_track_record.weight +
      match.components.availability_and_constraints.weight;
    expect(totalWeight).toBe(100);

    expect(match.confidence).toBe('high');
    expect(match.reasons.length).toBeGreaterThan(0);
  });

  it('MATCH-2: Verified skills contribute significantly more than self-declared skills', async () => {
    const selfDeclaredSkills = [
      {
        id: 'sk-3',
        creator_id: 'usr-novice',
        skill_name: 'Deep Learning',
        skill_category: 'ai_machine_learning',
        status: 'self_declared',
        created_at: new Date().toISOString(),
      },
    ] as unknown as CreatorSkill[];

    const noviceReputation = {
      creator_id: 'usr-novice',
      creator_name: 'Novice User',
      reputation_tier: 'insufficient_data',
      composite_reputation_score: null,
      total_challenges_participated: 0,
      total_submissions_submitted: 0,
      total_submissions_accepted: 0,
      total_verified_outcomes: 0,
      on_time_delivery_count: 0,
      on_time_delivery_rate: 0,
      weighted_review_score_avg: 0,
      verified_skills_count: 0,
      confirmed_collaborations_count: 0,
      provenance_breakdown: [],
      is_public: true,
      last_computed_at: new Date().toISOString(),
    } as unknown as CreatorReputationProfile;

    const verifiedMatch = await matchingService.calculateMatch(
      mockChallenge,
      'usr-creator-001',
      mockSkills,
      mockReputation,
      mockPortfolios
    );

    const noviceMatch = await matchingService.calculateMatch(
      mockChallenge,
      'usr-novice',
      selfDeclaredSkills,
      noviceReputation,
      []
    );

    expect(verifiedMatch.components.skill_alignment.score).toBeGreaterThan(
      noviceMatch.components.skill_alignment.score
    );
    expect(verifiedMatch.composite_match_score).toBeGreaterThan(
      noviceMatch.composite_match_score
    );
  });

  it('MATCH-3: Low or insufficient data yields confidence flag', async () => {
    const emptyMatch = await matchingService.calculateMatch(
      mockChallenge,
      'usr-empty',
      [],
      {
        creator_id: 'usr-empty',
        creator_name: 'Empty Profile',
        reputation_tier: 'insufficient_data',
        composite_reputation_score: null,
        total_challenges_participated: 0,
        total_submissions_submitted: 0,
        total_submissions_accepted: 0,
        total_verified_outcomes: 0,
        on_time_delivery_count: 0,
        on_time_delivery_rate: 0,
        weighted_review_score_avg: 0,
        verified_skills_count: 0,
        confirmed_collaborations_count: 0,
        provenance_breakdown: [],
        is_public: true,
        last_computed_at: new Date().toISOString(),
      } as unknown as CreatorReputationProfile,
      []
    );

    expect(emptyMatch.confidence).toBe('insufficient_data');
  });

  it('MATCH-4: Creator Feed only includes published challenges and excludes dismissed items', async () => {
    const feed = await matchingService.getCreatorFeed('usr-creator-001');
    expect(Array.isArray(feed)).toBe(true);

    feed.forEach((item) => {
      expect(item.challenge.status).toBe('published');
      expect(new Date(item.challenge.deadline_at).getTime()).toBeGreaterThan(Date.now());
      expect(item.match.composite_match_score).toBeGreaterThanOrEqual(0);
    });

    // Dismiss challenge
    if (feed.length > 0) {
      const firstChalId = feed[0].challenge.id;
      await matchingService.recordFeedback(
        {
          challenge_id: firstChalId,
          feed_type: 'creator_feed',
          action: 'dismissed',
          match_score: feed[0].match.composite_match_score,
          confidence_level: 'high',
        },
        creatorUser
      );

      const refetched = await matchingService.getCreatorFeed('usr-creator-001');
      expect(refetched.some((f) => f.challenge.id === firstChalId)).toBe(false);
    }
  });

  it('SEC-MATCH-1: Business Talent Matching enforces multi-tenant authorization (403 for unauthorized)', async () => {
    // Demo challenge ch-demo-001 belongs to org-tech-01
    const allowedRes = await matchingService.getTalentMatchesForChallenge(
      'ch-demo-001',
      businessUser
    );
    expect(allowedRes.error).toBeNull();
    expect(allowedRes.data.length).toBeGreaterThan(0);

    // Other organization user should be blocked (403)
    const unauthorizedRes = await matchingService.getTalentMatchesForChallenge(
      'ch-demo-001',
      unownedBusinessUser
    );
    expect(unauthorizedRes.error).toContain('LỖI BẢO MẬT (403)');
    expect(unauthorizedRes.data.length).toBe(0);

    // Admin should have access
    const adminRes = await matchingService.getTalentMatchesForChallenge(
      'ch-demo-001',
      adminUser
    );
    expect(adminRes.error).toBeNull();
    expect(adminRes.data.length).toBeGreaterThan(0);
  });

  it('COPILOT-1: Challenge AI Copilot analyzes clarity, flags risks, and generates 100% normalized rubric', async () => {
    const result = await matchingService.analyzeChallengeWithCopilot({
      title: 'Hệ thống AI nhận diện giọng nói tiếng Việt cho tổng đài',
      short_description: 'Mô hình speech-to-text chuyên sâu giọng địa phương 3 miền',
      problem_statement: 'Tổng đài viên xử lý 5000 cuộc gọi mỗi ngày với tỷ lệ hiểu sai phương ngữ miền Trung lên tới 18%. Cần mô hình nhận diện giọng nói thích ứng tự động.',
      desired_outcome: 'Độ chính xác nhận diện từ (WER) dưới 8% và hỗ trợ streaming độ trễ dưới 400ms.',
      category: 'ai_ml',
      requirements: ['Mô hình Conformer / Whisper fine-tuned', 'API gRPC / WebSockets'],
      deliverables: ['Docker container triển khai', 'Tài liệu hướng dẫn benchmark'],
      budget_min: 30000000,
      budget_max: 60000000,
      deadline_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    });

    expect(result.clarity_score).toBeGreaterThan(60);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.rubric_suggestions.total_weight).toBe(100);

    const sumRubricWeight = result.rubric_suggestions.suggested_criteria.reduce(
      (acc, c) => acc + c.weight,
      0
    );
    expect(sumRubricWeight).toBe(100);
  });

  it('COPILOT-2: Copilot detects timeline and budget conflicts', async () => {
    const conflictResult = await matchingService.analyzeChallengeWithCopilot({
      title: 'Xây dựng giải pháp Blockchain',
      short_description: 'Smart contract defi staking',
      problem_statement: 'Mô tả bài toán ngắn gọn và sơ sài chưa đầy đủ dữ liệu thực tế',
      desired_outcome: 'Kết quả ngắn nhưng đủ trên 15 ký tự tối thiểu',
      category: 'blockchain',
      requirements: ['Yêu cầu 1'],
      deliverables: ['Mã nguồn thô'],
      budget_min: 50000000,
      budget_max: 20000000, // min > max conflict!
      deadline_at: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days is too short!
    });

    expect(conflictResult.conflicts_or_risks.length).toBeGreaterThan(0);
    expect(conflictResult.conflicts_or_risks.some((r) => r.includes('Ngân sách'))).toBe(true);
    expect(conflictResult.conflicts_or_risks.some((r) => r.includes('tiến độ') || r.includes('Thời hạn'))).toBe(true);
  });
});
