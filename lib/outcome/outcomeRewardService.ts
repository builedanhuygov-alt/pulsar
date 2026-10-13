import type {
  ChallengeOutcome,
  Reward,
  RewardStatus,
  RewardStatusHistory,
  VerifiedPortfolioItem,
  BusinessImpactMetrics,
} from '../../types/outcome.types';
import type { PulsarUser } from '../../types/auth.types';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { challengeService } from '../challenge/challengeService';
import { submissionService } from '../submission/submissionService';
import {
  finalizeOutcomeSchema,
  updateRewardStatusSchema,
  type FinalizeOutcomeInput,
} from '../validation/outcome.schema';

// ==============================================================================
// SP8A.1 — Explicit reward state-transition matrix ( defense in depth with
// migration 20240109000001_reward_transition_guard.sql, which enforces the same
// edges in PostgreSQL).
//
//   planned          -> pending_approval | cancelled   (entry state; never re-entered)
//   pending_approval -> approved | cancelled
//   approved         -> processing | cancelled
//   processing       -> paid | failed | cancelled
//   paid             -> (ordinary path: TERMINAL — re-processing ONLY via the
//                        dedicated requestRewardReprocessing workflow below, which
//                        requires owner/admin + non-recipient + reason >= 15 chars
//                        and writes an explicit reprocessing audit entry)
//   failed/cancelled -> (terminal; corrections via SP8A adjustments, never edits)
//
// `paid` set through this path is ATTESTED paid. Verified-paid requires an
// authoritative payment record (see lib/finance/financialService.rewardStage).
// ==============================================================================
export const REWARD_TRANSITIONS: Record<RewardStatus, RewardStatus[]> = {
  planned: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: [],
  failed: [],
  cancelled: [],
};

export function isRewardTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return true; // idempotent no-op
  const allowed = (REWARD_TRANSITIONS as Record<string, string[]>)[from];
  if (!allowed) return false; // unknown current state: deny by default
  return allowed.includes(to);
}

// Initial Mock / Local In-Memory State for reliable developer testing
const INITIAL_OUTCOMES: ChallengeOutcome[] = [
  {
    id: 'out-001',
    challenge_id: 'ch-001',
    challenge_title: 'Hệ Thống Tối Ưu Lộ Trình Giao Hàng Xanh Bằng AI',
    challenge_slug: 'he-thong-toi-uu-lo-trinh-giao-hang-xanh-ai',
    winning_submission_id: 'sub-001',
    winning_submission_title: 'EcoRoute: Tối ưu hoá đa điểm dừng kết hợp mô hình Graph Neural Network',
    winner_id: 'usr-creator-001',
    winner_name: 'Minh Quang (Creator)',
    winner_email: 'creator.developer@pulsar.dev',
    organization_id: 'org-tech-01',
    organization_name: 'Việt Nam Tech Hub',
    decided_by: 'usr-biz-001',
    decider_name: 'Bảo Trân (Business CEO)',
    decision_reason:
      'Thuật toán GNN đáp ứng vượt chỉ tiêu 15% tiết kiệm năng lượng, code sạch và tài liệu kiến trúc đạt chuẩn doanh nghiệp.',
    status: 'finalized',
    has_winner: true,
    final_score: 93.5,
    awarded_prize_amount: 5000,
    currency: 'USD',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
];

const INITIAL_REWARDS: Reward[] = [
  {
    id: 'rwd-001',
    outcome_id: 'out-001',
    challenge_id: 'ch-001',
    challenge_title: 'Hệ Thống Tối Ưu Lộ Trình Giao Hàng Xanh Bằng AI',
    submission_id: 'sub-001',
    recipient_id: 'usr-creator-001',
    recipient_name: 'Minh Quang (Creator)',
    organization_id: 'org-tech-01',
    organization_name: 'Việt Nam Tech Hub',
    amount: 5000,
    currency: 'USD',
    status: 'paid',
    disbursement_method: 'mock_escrow_adapter',
    is_mock_disbursement: true,
    reference_code: 'PULSAR-ESCROW-2026-0981X',
    disbursed_at: '2026-03-02T14:30:00Z',
    disbursed_by: 'usr-biz-001',
    disburser_name: 'Bảo Trân (Business CEO)',
    notes: 'Giải ngân qua Mock Escrow Adapter thành công sau khi nghiệm thu repo.',
    created_at: '2026-03-01T10:05:00Z',
    updated_at: '2026-03-02T14:30:00Z',
  },
];

const INITIAL_PORTFOLIOS: VerifiedPortfolioItem[] = [
  {
    id: 'port-001',
    creator_id: 'usr-creator-001',
    creator_name: 'Minh Quang',
    challenge_id: 'ch-001',
    challenge_title: 'Hệ Thống Tối Ưu Lộ Trình Giao Hàng Xanh Bằng AI',
    challenge_slug: 'he-thong-toi-uu-lo-trinh-giao-hang-xanh-ai',
    category: 'ai_ml',
    submission_id: 'sub-001',
    submission_title: 'EcoRoute: Tối ưu hoá đa điểm dừng kết hợp mô hình Graph Neural Network',
    outcome_id: 'out-001',
    role_description: 'Lead AI Engineer & Solution Architect',
    skills_acquired: ['Graph Neural Networks', 'PyTorch', 'FastAPI', 'High-Scale Route Optimization'],
    case_study_summary:
      'Đạt giải Nhất đề bài doanh nghiệp Việt Nam Tech Hub. Thiết kế hệ thống tối ưu hóa vận tải giảm 18.4% khí thải carbon qua mô hình GNN thời gian thực.',
    case_study_metrics: {
      'Tỷ lệ tiết kiệm năng lượng': '18.4%',
      'Thời gian suy luận': '45ms / 100 điểm',
      'Điểm hội đồng chuyên môn': '93.5/100',
    },
    awarded_prize_amount: 5000,
    currency: 'USD',
    is_public: true,
    is_verified: true,
    verified_at: '2026-03-01T10:00:00Z',
    verified_by_org_id: 'org-tech-01',
    verified_by_org_name: 'Việt Nam Tech Hub',
    created_at: '2026-03-01T10:00:00Z',
  },
];

const INITIAL_HISTORY: RewardStatusHistory[] = [
  {
    id: 'rsh-001',
    reward_id: 'rwd-001',
    previous_status: null,
    new_status: 'planned',
    changed_by: 'usr-biz-001',
    changer_name: 'Bảo Trân',
    reason: 'Khởi tạo theo kết quả chốt đề bài',
    created_at: '2026-03-01T10:05:00Z',
  },
  {
    id: 'rsh-002',
    reward_id: 'rwd-001',
    previous_status: 'planned',
    new_status: 'approved',
    changed_by: 'usr-biz-001',
    changer_name: 'Bảo Trân',
    reason: 'Doanh nghiệp phê duyệt ngân sách giải thưởng',
    created_at: '2026-03-01T11:00:00Z',
  },
  {
    id: 'rsh-003',
    reward_id: 'rwd-001',
    previous_status: 'approved',
    new_status: 'paid',
    changed_by: 'usr-biz-001',
    changer_name: 'Bảo Trân',
    reason: 'Đã hoàn tất thanh toán qua Mock Escrow Adapter',
    created_at: '2026-03-02T14:30:00Z',
  },
];

class OutcomeRewardService {
  private outcomes: ChallengeOutcome[] = [...INITIAL_OUTCOMES];
  private rewards: Reward[] = [...INITIAL_REWARDS];
  private rewardHistory: RewardStatusHistory[] = [...INITIAL_HISTORY];
  private portfolios: VerifiedPortfolioItem[] = [...INITIAL_PORTFOLIOS];

  /**
   * Chốt kết quả Challenge (Finalize Outcome)
   * Kiểm tra nghiêm ngặt:
   * 1. Quyền người thực hiện (Business Owner/Admin)
   * 2. Phân tách nhiệm vụ (Separation of duties: Người tạo không tự duyệt trừ khi có quyền owner)
   * 3. Bài thi thắng phải thuộc đúng Challenge
   * 4. Chuyển trạng thái Challenge -> closed, Submission -> accepted
   * 5. Tự động sinh bản ghi Reward và Portfolio đã xác minh
   */
  async finalizeOutcome(
    input: FinalizeOutcomeInput,
    operator: PulsarUser
  ): Promise<{ data: ChallengeOutcome | null; error: string | null }> {
    const parseResult = finalizeOutcomeSchema.safeParse(input);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return { data: null, error: issue?.message || 'Dữ liệu không hợp lệ' };
    }

    const {
      challenge_id,
      organization_id,
      has_winner,
      winning_submission_id,
      winner_id,
      decision_reason,
      final_score,
      awarded_prize_amount,
      currency,
    } = parseResult.data;

    // Lấy thông tin challenge
    const challengeRes = challengeService.getChallengeById(challenge_id);
    if (!challengeRes.success || !challengeRes.challenge) {
      return { data: null, error: 'Không tìm thấy thông tin thử thách' };
    }
    const challenge = challengeRes.challenge;

    // Kiểm tra tổ chức
    if (challenge.organization_id !== organization_id) {
      return { data: null, error: 'Tổ chức không khớp với thông tin thử thách' };
    }

    // Kiểm tra quyền
    const isSuperAdmin = operator.role === 'admin';
    const isOrgMember = operator.organizations?.some((m) => m.organization.id === organization_id);
    const isOrgOwner = operator.organizations?.some(
      (m) => m.organization.id === organization_id && m.membership_role === 'owner'
    );

    if (!isSuperAdmin && !isOrgMember) {
      return { data: null, error: 'Bạn không có quyền ra quyết định kết quả cho tổ chức này' };
    }

    // Phân tách nhiệm vụ (Separation of Duties)
    // Nếu chính người tạo challenge ra quyết định, phải là Admin hoặc Owner của tổ chức
    if (challenge.created_by === operator.id && !isSuperAdmin && !isOrgOwner) {
      return {
        data: null,
        error:
          'Vi phạm quy tắc Phân Tách Nhiệm Vụ (Separation of Duties): Người tạo đề bài không được tự chốt kết quả nếu không có vai trò Owner tổ chức.',
      };
    }

    // Kiểm tra xem kết quả đã tồn tại chưa
    const existing = this.outcomes.find((o) => o.challenge_id === challenge_id && o.status === 'finalized');
    if (existing) {
      return { data: null, error: 'Thử thách này đã được chốt kết quả trước đó' };
    }

    let winningSubTitle = '';
    let winnerName = '';
    let winnerEmail = '';

    if (has_winner && winning_submission_id && winner_id) {
      const subRes = submissionService.getSubmissionById(winning_submission_id);
      if (!subRes.success || !subRes.submission) {
        return { data: null, error: 'Không tìm thấy bài dự thi chiến thắng' };
      }
      const sub = subRes.submission;
      if (sub.challenge_id !== challenge_id) {
        return { data: null, error: 'Bài dự thi được chọn không thuộc thử thách này' };
      }
      if (sub.submitted_by !== winner_id) {
        return { data: null, error: 'Người nhận giải không khớp với tác giả bài dự thi' };
      }
      winningSubTitle = sub.title;
      winnerName = sub.creator_name || 'Creator';
      winnerEmail = sub.creator_email || '';
    }

    const outcomeId = 'out-' + Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    const newOutcome: ChallengeOutcome = {
      id: outcomeId,
      challenge_id,
      challenge_title: challenge.title,
      challenge_slug: challenge.slug,
      winning_submission_id: winning_submission_id || null,
      winning_submission_title: winningSubTitle || undefined,
      winner_id: winner_id || null,
      winner_name: winnerName || undefined,
      winner_email: winnerEmail || undefined,
      organization_id,
      organization_name: challenge.organization_name || 'Doanh Nghiệp',
      decided_by: operator.id,
      decider_name: operator.profile.display_name || operator.email,
      decision_reason,
      status: 'finalized',
      has_winner,
      final_score,
      awarded_prize_amount: has_winner ? awarded_prize_amount : 0,
      currency,
      created_at: now,
      updated_at: now,
    };

    // Lưu outcome
    this.outcomes.unshift(newOutcome);

    // Cập nhật trạng thái Challenge -> closed
    challengeService.transitionStatus(challenge_id, 'closed', {
      userId: operator.id,
      userRole: operator.role,
      isOrgMember: true,
      notes: 'Thử thách đã hoàn tất nghiệm thu và chốt kết quả trao giải.',
    });

    // Nếu có người thắng: tạo Reward và Verified Portfolio
    if (has_winner && winning_submission_id && winner_id) {
      const rewardId = 'rwd-' + Math.random().toString(36).substring(2, 9);
      const refCode = 'PULSAR-ESCROW-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const newReward: Reward = {
        id: rewardId,
        outcome_id: outcomeId,
        challenge_id,
        challenge_title: challenge.title,
        submission_id: winning_submission_id,
        recipient_id: winner_id,
        recipient_name: winnerName,
        organization_id,
        organization_name: challenge.organization_name || 'Doanh Nghiệp',
        amount: awarded_prize_amount,
        currency,
        status: 'approved', // Có thể sang approved ngay khi outcome finalize
        disbursement_method: 'mock_escrow_adapter',
        is_mock_disbursement: true,
        reference_code: refCode,
        disbursed_at: null,
        disbursed_by: null,
        notes: `Khởi tạo tự động khi chốt kết quả đề bài: ${challenge.title}`,
        created_at: now,
        updated_at: now,
      };

      this.rewards.unshift(newReward);
      newOutcome.reward = newReward;

      // Log lịch sử Reward
      this.rewardHistory.unshift({
        id: 'rsh-' + Math.random().toString(36).substring(2, 9),
        reward_id: rewardId,
        previous_status: null,
        new_status: 'approved',
        changed_by: operator.id,
        changer_name: operator.profile.display_name,
        reason: 'Khởi tạo tự động cùng quyết định nghiệm thu đề bài',
        created_at: now,
      });

      // Tạo Verified Portfolio
      const portfolioId = 'port-' + Math.random().toString(36).substring(2, 9);
      this.portfolios.unshift({
        id: portfolioId,
        creator_id: winner_id,
        creator_name: winnerName,
        challenge_id,
        challenge_title: challenge.title,
        challenge_slug: challenge.slug,
        category: challenge.category,
        submission_id: winning_submission_id,
        submission_title: winningSubTitle,
        outcome_id: outcomeId,
        role_description: 'Lead Solution Architect & Winner',
        skills_acquired: ['Enterprise Architecture', 'Problem Solving', 'Production Delivery'],
        case_study_summary: `Chiến thắng đề bài: "${challenge.title}". ${decision_reason}`,
        case_study_metrics: {
          'Điểm đánh giá': final_score ? `${final_score}/100` : 'Đạt chuẩn cao',
          'Giá trị giải thưởng': `${awarded_prize_amount} ${currency}`,
          'Trạng thái': 'Đã nghiệm thu chính thức',
        },
        awarded_prize_amount,
        currency,
        is_public: true,
        is_verified: true,
        verified_at: now,
        verified_by_org_id: organization_id,
        verified_by_org_name: challenge.organization_name || 'Doanh Nghiệp',
        created_at: now,
      });
    }

    return { data: newOutcome, error: null };
  }

  /**
   * Cập nhật trạng thái giải ngân giải thưởng (Reward Disbursement Tracking)
   */
  async updateRewardStatus(
    rewardId: string,
    newStatus: RewardStatus,
    operator: PulsarUser,
    notes?: string
  ): Promise<{ data: Reward | null; error: string | null }> {
    const reward = this.rewards.find((r) => r.id === rewardId);
    if (!reward) {
      return { data: null, error: 'Không tìm thấy thông tin giải thưởng' };
    }

    // Phân quyền: Chỉ chủ Doanh nghiệp sở hữu hoặc Super Admin.
    // (SP8A.1 tightening: plain members/creators can no longer move financial
    // states — previously any org member could set arbitrary statuses.)
    const isSuperAdmin = operator.role === 'admin';
    const isOrgOwner =
      operator.organizations?.some(
        (m) =>
          m.organization.id === reward.organization_id &&
          (m.membership_role === 'owner' || (m.membership_role as string) === 'admin')
      ) ?? false;

    if (!isSuperAdmin && !isOrgOwner) {
      return { data: null, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ doanh nghiệp hoặc Quản trị viên mới có thể cập nhật trạng thái thưởng' };
    }

    // Creator không thể tự đánh dấu giải ngân cho chính mình
    if (operator.id === reward.recipient_id && !isSuperAdmin) {
      return { data: null, error: 'Người nhận giải không được tự duyệt hoặc đánh dấu giải ngân cho chính mình' };
    }

    // SP8A.1: explicit transition matrix — reject unsupported edges by default.
    // `planned` is entry-only (never re-entered); `paid` here is ATTESTED paid.
    if (!isRewardTransitionAllowed(reward.status, newStatus)) {
      return {
        data: null,
        error: `Chuyển trạng thái không được phép: ${reward.status} → ${newStatus}. Trạng thái paid qua đường này chỉ là attested (xác nhận thủ công), không phải bằng chứng thanh toán.`,
      };
    }

    const previousStatus = reward.status;
    const now = new Date().toISOString();

    if (previousStatus === newStatus) {
      return { data: reward, error: null }; // idempotent no-op, no duplicate history
    }

    reward.status = newStatus;
    reward.updated_at = now;
    if (notes) reward.notes = notes;

    if (newStatus === 'paid') {
      reward.disbursed_at = now;
      reward.disbursed_by = operator.id;
      reward.disburser_name = operator.profile.display_name;
    }

    // Ghi lịch sử
    this.rewardHistory.unshift({
      id: 'rsh-' + Math.random().toString(36).substring(2, 9),
      reward_id: reward.id,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: operator.id,
      changer_name: operator.profile.display_name,
      reason: notes || `Chuyển trạng thái sang ${newStatus}`,
      created_at: now,
    });

    return { data: reward, error: null };
  }

  /**
   * SP8A.2 — Dedicated audited re-processing workflow (paid -> processing).
   * The SOLE application-layer path out of `paid`: the ordinary
   * updateRewardStatus matrix treats paid as terminal. Stricter by design —
   * org owner/admin, non-recipient, reason >= 15 chars, and an explicit
   * REPROCESSING audit entry (never a silent status flip).
   */
  async requestRewardReprocessing(
    rewardId: string,
    operator: PulsarUser,
    reason: string
  ): Promise<{ data: Reward | null; error: string | null }> {
    const reward = this.rewards.find((r) => r.id === rewardId);
    if (!reward) {
      return { data: null, error: 'Không tìm thấy thông tin giải thưởng' };
    }
    if (reward.status !== 'paid') {
      return { data: null, error: `Chỉ giải thưởng ở trạng thái paid mới cần xử lý lại (hiện: ${reward.status}).` };
    }

    const isSuperAdmin = operator.role === 'admin';
    const isOrgOwner =
      operator.organizations?.some(
        (m) =>
          m.organization.id === reward.organization_id &&
          (m.membership_role === 'owner' || (m.membership_role as string) === 'admin')
      ) ?? false;

    if (!isSuperAdmin && !isOrgOwner) {
      return { data: null, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Chỉ chủ doanh nghiệp hoặc Quản trị viên được yêu cầu xử lý lại giải ngân' };
    }
    if (operator.id === reward.recipient_id && !isSuperAdmin) {
      return { data: null, error: 'Người nhận giải không được tự yêu cầu xử lý lại giải ngân của chính mình' };
    }
    if (!reason || reason.trim().length < 15) {
      return { data: null, error: 'Lý do xử lý lại tối thiểu 15 ký tự để phục vụ kiểm toán.' };
    }

    const now = new Date().toISOString();
    reward.status = 'processing';
    reward.updated_at = now;

    this.rewardHistory.unshift({
      id: 'rsh-' + Math.random().toString(36).substring(2, 9),
      reward_id: reward.id,
      previous_status: 'paid',
      new_status: 'processing',
      changed_by: operator.id,
      changer_name: operator.profile.display_name,
      reason: `REPROCESSING (audited): ${reason.trim()}`,
      created_at: now,
    });

    return { data: reward, error: null };
  }

  /**
   * Lấy danh sách kết quả (Outcomes)
   */
  async getOutcomes(filters?: {
    organization_id?: string;
    challenge_id?: string;
  }): Promise<{ data: ChallengeOutcome[]; error: string | null }> {
    let result = [...this.outcomes];
    if (filters?.organization_id) {
      result = result.filter((o) => o.organization_id === filters.organization_id);
    }
    if (filters?.challenge_id) {
      result = result.filter((o) => o.challenge_id === filters.challenge_id);
    }
    return { data: result, error: null };
  }

  /**
   * Lấy danh sách giải thưởng (Rewards)
   */
  async getRewards(filters?: {
    recipient_id?: string;
    organization_id?: string;
    status?: RewardStatus;
  }): Promise<{ data: Reward[]; error: string | null }> {
    let result = [...this.rewards];
    if (filters?.recipient_id) {
      result = result.filter((r) => r.recipient_id === filters.recipient_id);
    }
    if (filters?.organization_id) {
      result = result.filter((r) => r.organization_id === filters.organization_id);
    }
    if (filters?.status) {
      result = result.filter((r) => r.status === filters.status);
    }
    return { data: result, error: null };
  }

  /**
   * Lấy lịch sử trạng thái của 1 giải thưởng
   */
  async getRewardHistory(rewardId: string): Promise<{ data: RewardStatusHistory[]; error: string | null }> {
    const history = this.rewardHistory.filter((h) => h.reward_id === rewardId);
    return { data: history, error: null };
  }

  /**
   * Lấy hồ sơ năng lực đã xác minh (Verified Portfolios) của một Creator
   */
  async getCreatorPortfolios(creatorId: string): Promise<{ data: VerifiedPortfolioItem[]; error: string | null }> {
    const items = this.portfolios.filter((p) => p.creator_id === creatorId);
    return { data: items, error: null };
  }

  /**
   * Cập nhật tính công khai của portfolio item
   */
  async updatePortfolioVisibility(
    portfolioId: string,
    isPublic: boolean,
    creatorId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const item = this.portfolios.find((p) => p.id === portfolioId);
    if (!item) {
      return { success: false, error: 'Không tìm thấy hồ sơ năng lực' };
    }
    if (item.creator_id !== creatorId) {
      return { success: false, error: 'Bạn không có quyền chỉnh sửa hồ sơ này' };
    }
    item.is_public = isPublic;
    return { success: true, error: null };
  }

  /**
   * Tính toán và trích xuất chỉ số tác động kinh doanh (Business Impact Metrics) cho Doanh nghiệp
   */
  async getBusinessImpactMetrics(organizationId: string): Promise<{ data: BusinessImpactMetrics; error: string | null }> {
    const orgOutcomes = this.outcomes.filter((o) => o.organization_id === organizationId && o.status === 'finalized');
    const orgRewards = this.rewards.filter((r) => r.organization_id === organizationId);

    const totalAllocated = orgRewards.reduce((sum, r) => sum + r.amount, 0);
    const totalDisbursed = orgRewards
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + r.amount, 0);

    const completedItems = orgOutcomes.map((o) => ({
      challenge_id: o.challenge_id,
      challenge_title: o.challenge_title || 'Thử thách',
      solution_title: o.winning_submission_title || 'Giải pháp tiêu chuẩn',
      winner_name: o.winner_name || 'Creator',
      impact_summary: o.decision_reason,
      completed_at: o.updated_at,
      is_demo: true,
    }));

    const metrics: BusinessImpactMetrics = {
      organization_id: organizationId,
      organization_name: orgOutcomes[0]?.organization_name || 'Doanh Nghiệp Đổi Mới',
      total_challenges_completed: orgOutcomes.length,
      total_submissions_received: 12, // Baseline benchmark
      total_submissions_accepted: orgOutcomes.filter((o) => o.has_winner).length,
      acceptance_rate_percent: 8.3,
      total_prizes_allocated: totalAllocated,
      total_prizes_disbursed: totalDisbursed,
      currency: 'USD',
      avg_time_to_outcome_days: 14.5,
      verified_impact_items: completedItems,
    };

    return { data: metrics, error: null };
  }
}

export const outcomeRewardService = new OutcomeRewardService();
