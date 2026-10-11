import { describe, it, expect, beforeEach } from 'vitest';
import { reputationAnalyticsService } from '../lib/reputation/reputationService';
import { declareSkillSchema, verifySkillSchema } from '../lib/validation/reputation.schema';
import type { PulsarUser } from '../types/auth.types';

describe('PULSAR Sprint 5: Trust, Reputation & Analytics Engine Suite', () => {
  const creatorUser: PulsarUser = {
    id: 'usr-creator-001',
    email: 'creator@pulsar.dev',
    role: 'creator',
    profile: {
      id: 'usr-creator-001',
      display_name: 'Minh Quang',
      avatar_url: null,
      bio: 'Freelance AI Engineer',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    organizations: [],
  };

  const businessUser: PulsarUser = {
    id: 'usr-biz-001',
    email: 'ceo@techhub.vn',
    role: 'business',
    profile: {
      id: 'usr-biz-001',
      display_name: 'Bảo Trân (Business CEO)',
      avatar_url: null,
      bio: 'Enterprise Founder',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    organizations: [
      {
        membership_role: 'owner',
        organization: {
          id: 'org-tech-01',
          name: 'Việt Nam Tech Hub',
          slug: 'vietnam-tech-hub',
          organization_type: 'business',
          created_by: 'usr-biz-001',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      },
    ],
  };

  const otherOrgUser: PulsarUser = {
    id: 'usr-other-biz',
    email: 'other@competitor.com',
    role: 'business',
    profile: {
      id: 'usr-other-biz',
      display_name: 'Other Company Member',
      avatar_url: null,
      bio: 'External Business',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    organizations: [
      {
        membership_role: 'member',
        organization: {
          id: 'org-external-99',
          name: 'Competitor Corp',
          slug: 'competitor-corp',
          organization_type: 'business',
          created_by: 'usr-external-owner',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      },
    ],
  };

  const superAdminUser: PulsarUser = {
    id: 'usr-admin-001',
    email: 'admin@pulsar.dev',
    role: 'admin',
    profile: {
      id: 'usr-admin-001',
      display_name: 'Super Admin',
      avatar_url: null,
      bio: 'System Administrator',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    organizations: [],
  };

  describe('1. Skill & Evidence Graph Authorization', () => {
    it('SKILL-1: Creator can self-declare skill or submit evidence, but initial status is NOT verified', async () => {
      const res = await reputationAnalyticsService.declareCreatorSkill(
        {
          skill_id: 'skl-003',
          evidence_type: 'third_party_credential',
          evidence_notes: 'Đã hoàn thành chứng chỉ audit Slither',
          is_public: true,
        },
        creatorUser
      );

      expect(res.error).toBeNull();
      expect(res.data?.status).toBe('evidence_submitted');
      expect(res.data?.status).not.toBe('verified');
    });

    it('SKILL-2: SECURITY: Creator CANNOT self-verify their own skills (Anti-Self-Verification)', async () => {
      const res = await reputationAnalyticsService.verifyCreatorSkill(
        {
          creator_skill_id: 'csk-002',
          decision: 'verify',
          reason: 'Tự phong cho mình là chuyên gia',
        },
        creatorUser // Creator trying to verify their own skill
      );

      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/LỖI BẢO MẬT|không thể tự thẩm định/);
    });

    it('SKILL-3: Authorized Business can verify skill backed by evidence', async () => {
      const res = await reputationAnalyticsService.verifyCreatorSkill(
        {
          creator_skill_id: 'csk-002',
          decision: 'verify',
          reason: 'Xác nhận giải pháp RAG đạt 94% điểm Rubric trong đợt nghiệm thu.',
        },
        businessUser
      );

      expect(res.error).toBeNull();
      expect(res.data?.status).toBe('verified');
      expect(res.data?.verified_by_user_id).toBe(businessUser.id);
    });
  });

  describe('2. Reputation Engine & Provenance Transparency', () => {
    it('REP-1: Computes reputation with full provenance breakdown and explanation', async () => {
      const rep = await reputationAnalyticsService.computeCreatorReputation('usr-creator-001');

      expect(rep.composite_reputation_score).toBeGreaterThan(0);
      expect(rep.provenance_breakdown.length).toBeGreaterThan(0);
      expect(rep.reputation_tier).not.toBe('insufficient_data');

      // Check weights sum to 100%
      const totalWeight = rep.provenance_breakdown.reduce((sum, item) => sum + item.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it('REP-2: Insufficient data user returns "insufficient_data" tier instead of fake 0 score', async () => {
      const rep = await reputationAnalyticsService.computeCreatorReputation('usr-brand-new-999');

      expect(rep.composite_reputation_score).toBeNull();
      expect(rep.reputation_tier).toBe('insufficient_data');
      expect(rep.provenance_breakdown[0].explanation).toContain('Chưa đủ dữ liệu tối thiểu');
    });
  });

  describe('3. Business Analytics & Organization Isolation', () => {
    it('BIZ-1: Prevents cross-organization analytics leak (Anti-IDOR)', async () => {
      const res = await reputationAnalyticsService.getOrganizationAnalytics(
        'org-tech-01',
        otherOrgUser // User belongs to org-external-99
      );

      expect(res.data).toBeNull();
      expect(res.error).toContain('LỖI TRUY CẬP (403)');
    });

    it('BIZ-2: Generates mathematically sound KPIs without mixing planned budget and disbursed cash', async () => {
      const res = await reputationAnalyticsService.getOrganizationAnalytics(
        'org-tech-01',
        businessUser
      );

      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();

      const kpis = res.data!.kpis;
      expect(kpis.budget_planned.value).toBeGreaterThanOrEqual(0);
      expect(kpis.prizes_disbursed.value).toBeGreaterThanOrEqual(0);

      // Formulas must be explicit
      expect(kpis.acceptance_rate.formula).toBeDefined();
      expect(kpis.prizes_disbursed.formula).toContain('status = "paid"');
    });
  });

  describe('4. Integrity & Fraud Signals', () => {
    it('FRAUD-1: Signals are generated with clear explainability rules and do NOT auto-ban', async () => {
      const signals = await reputationAnalyticsService.getIntegritySignals(superAdminUser);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].detection_rule_name).toBeDefined();
      expect(signals[0].explanation).toBeDefined();
      expect(signals[0].review_status).toBe('open');
    });

    it('FRAUD-2: Admin can update investigation status with audit notes', async () => {
      const res = await reputationAnalyticsService.updateSignalStatus(
        {
          signal_id: 'sig-001',
          status: 'under_investigation',
          notes: 'Đang gửi thông báo yêu cầu giải trình đối với 2 tài khoản đánh giá.',
        },
        superAdminUser
      );

      expect(res.error).toBeNull();
      expect(res.data?.review_status).toBe('under_investigation');
      expect(res.data?.resolved_by).toBe(superAdminUser.id);
    });

    it('FRAUD-3: Non-admin cannot resolve or dismiss integrity signals', async () => {
      const res = await reputationAnalyticsService.updateSignalStatus(
        {
          signal_id: 'sig-001',
          status: 'dismissed',
          notes: 'Tự hủy cảnh báo',
        },
        creatorUser
      );

      expect(res.data).toBeNull();
      expect(res.error).toContain('Chỉ Quản trị viên');
    });
  });
});
