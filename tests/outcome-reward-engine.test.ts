import { describe, it, expect, beforeEach } from 'vitest';
import { outcomeRewardService } from '../lib/outcome/outcomeRewardService';
import { finalizeOutcomeSchema, updateRewardStatusSchema } from '../lib/validation/outcome.schema';
import type { PulsarUser } from '../types/auth.types';

describe('PULSAR Sprint 4: Outcome & Reward Engine Suite', () => {
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

  const businessMemberUser: PulsarUser = {
    id: 'usr-biz-member',
    email: 'member@company.com',
    role: 'business',
    profile: {
      id: 'usr-biz-member',
      display_name: 'Biz Reviewer',
      avatar_url: null,
      bio: 'Business Reviewer',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    organizations: [
      {
        membership_role: 'member',
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

  const businessOwnerUser: PulsarUser = {
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

  describe('1. Zod Validation & Consistency Constraints', () => {
    it('SEC-OUT-1: Rejects outcome if winning submission is missing when has_winner is true', () => {
      const invalidData = {
        challenge_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        organization_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        has_winner: true,
        winning_submission_id: null,
        winner_id: null,
        decision_reason: 'Giải pháp rất xuất sắc nhưng thiếu ID nộp bài.',
        awarded_prize_amount: 3000,
        currency: 'USD',
      };
      const res = finalizeOutcomeSchema.safeParse(invalidData);
      expect(res.success).toBe(false);
    });

    it('SEC-OUT-2: Rejects outcome with negative prize amount or short decision reason', () => {
      const invalidData = {
        challenge_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        organization_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        has_winner: false,
        winning_submission_id: null,
        winner_id: null,
        decision_reason: 'Ngắn', // < 15 chars
        awarded_prize_amount: -500, // < 0
        currency: 'USD',
      };
      const res = finalizeOutcomeSchema.safeParse(invalidData);
      expect(res.success).toBe(false);
    });

    it('SEC-OUT-3: Accepts valid no-winner outcome when prize amount is 0 and reason is adequate', () => {
      const validData = {
        challenge_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        organization_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        has_winner: false,
        winning_submission_id: null,
        winner_id: null,
        decision_reason: 'Không có bài dự thi nào đáp ứng đủ 80% chỉ tiêu KPI đưa ra trong đề bài.',
        awarded_prize_amount: 0,
        currency: 'USD',
      };
      const res = finalizeOutcomeSchema.safeParse(validData);
      expect(res.success).toBe(true);
    });
  });

  describe('2. Separation of Duties & RBAC Enforcement', () => {
    it('SEC-OUT-4: Creator cannot finalize outcome or award prize to themselves', async () => {
      const res = await outcomeRewardService.finalizeOutcome(
        {
          challenge_id: 'ch-demo-001',
          organization_id: 'org-lab-01',
          has_winner: true,
          winning_submission_id: 'sub-demo-001',
          winner_id: 'usr-creator-001',
          decision_reason: 'Tự đánh giá bài của mình xuất sắc và nhận giải.',
          awarded_prize_amount: 5000,
          currency: 'USD',
        },
        creatorUser
      );
      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/không có quyền|Phân Tách Nhiệm Vụ/);
    });

    it('SEC-OUT-5: Creator cannot mark their own reward as paid (Self-Disbursement Guard)', async () => {
      const res = await outcomeRewardService.updateRewardStatus(
        'rwd-001',
        'paid',
        creatorUser,
        'Tự đánh dấu đã nhận tiền'
      );
      expect(res.error).toBeDefined();
    });

    it('SEC-OUT-6: Business Owner can successfully update reward workflow and log status history', async () => {
      const res = await outcomeRewardService.updateRewardStatus(
        'rwd-001',
        'processing',
        businessOwnerUser,
        'Đang chuyển lệnh ủy nhiệm chi qua ngân hàng đối tác'
      );
      expect(res.error).toBeNull();
      expect(res.data?.status).toBe('processing');

      // Check audit history
      const { data: history } = await outcomeRewardService.getRewardHistory('rwd-001');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].new_status).toBe('processing');
    });
  });

  describe('3. Verified Portfolios & Business Impact Metrics', () => {
    it('PORT-1: Creator can query and control visibility of their verified portfolio items', async () => {
      const { data: portfolios } = await outcomeRewardService.getCreatorPortfolios('usr-creator-001');
      expect(portfolios.length).toBeGreaterThan(0);
      expect(portfolios[0].is_verified).toBe(true);

      // Toggle public visibility
      const toggleRes = await outcomeRewardService.updatePortfolioVisibility(
        portfolios[0].id,
        false,
        'usr-creator-001'
      );
      expect(toggleRes.success).toBe(true);
    });

    it('PORT-2: Other users cannot tamper with creator portfolio visibility', async () => {
      const { data: portfolios } = await outcomeRewardService.getCreatorPortfolios('usr-creator-001');
      const toggleRes = await outcomeRewardService.updatePortfolioVisibility(
        portfolios[0].id,
        false,
        'usr-attacker'
      );
      expect(toggleRes.success).toBe(false);
      expect(toggleRes.error).toContain('không có quyền');
    });

    it('IMPACT-1: Computes accurate Business Impact Metrics for organizations', async () => {
      const { data: metrics } = await outcomeRewardService.getBusinessImpactMetrics('org-tech-01');
      expect(metrics.total_challenges_completed).toBeGreaterThan(0);
      expect(metrics.total_prizes_allocated).toBeGreaterThanOrEqual(0);
      expect(metrics.verified_impact_items.length).toBeGreaterThan(0);
    });
  });
});
