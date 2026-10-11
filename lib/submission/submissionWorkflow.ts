import type { SubmissionStatus } from '../../types/submission.types';
import type { Challenge } from '../../types/challenge.types';

export interface SubmissionWorkflowContext {
  userId: string;
  userRole: 'creator' | 'business' | 'admin';
  isOwnerOfSubmission: boolean;
  isChallengeOrgMember: boolean;
  notes?: string;
}

export interface SubmissionTransitionResult {
  allowed: boolean;
  reason?: string;
  newStatus?: SubmissionStatus;
}

/**
 * Validates whether a user can submit a solution to a challenge
 * Enforces strict deadline & published status checks.
 */
export function canSubmitToChallenge(challenge: Challenge, now: Date = new Date()): {
  allowed: boolean;
  reason?: string;
} {
  // 1. Must be published
  if (challenge.status !== 'published') {
    return {
      allowed: false,
      reason: `Thử thách hiện ở trạng thái "${challenge.status}". Chỉ thử thách đã được phê duyệt và xuất bản (published) mới được phép nộp giải pháp.`,
    };
  }

  // 2. Must not be expired (Server-side deadline guard)
  const deadline = new Date(challenge.deadline_at);
  if (now.getTime() > deadline.getTime()) {
    return {
      allowed: false,
      reason: `Đã quá hạn nộp bài (${deadline.toLocaleString('vi-VN')}). Cổng nộp giải pháp cho thử thách này đã chính thức đóng.`,
    };
  }

  return { allowed: true };
}

/**
 * Validates status transitions for submissions.
 * Prevents unauthorized jumps and self-escalations.
 */
export function canTransitionSubmissionStatus(
  currentStatus: SubmissionStatus,
  targetStatus: SubmissionStatus,
  context: SubmissionWorkflowContext
): SubmissionTransitionResult {
  const { userId, userRole, isOwnerOfSubmission, isChallengeOrgMember, notes } = context;

  if (currentStatus === targetStatus) {
    return { allowed: true, newStatus: currentStatus };
  }

  // 1. Draft transitions
  if (currentStatus === 'draft') {
    if (targetStatus === 'submitted') {
      if (!isOwnerOfSubmission) {
        return { allowed: false, reason: 'Chỉ tác giả bài dự thi mới có quyền nộp bài chính thức.' };
      }
      return { allowed: true, newStatus: 'submitted' };
    }
    if (targetStatus === 'withdrawn') {
      if (!isOwnerOfSubmission) {
        return { allowed: false, reason: 'Chỉ tác giả mới có thể hủy bản nháp bài dự thi.' };
      }
      return { allowed: true, newStatus: 'withdrawn' };
    }
    return {
      allowed: false,
      reason: `Bản nháp (draft) chỉ có thể chuyển sang "submitted" hoặc "withdrawn", không được nhảy cóc sang "${targetStatus}".`,
    };
  }

  // 2. Submitted transitions
  if (currentStatus === 'submitted') {
    if (targetStatus === 'under_review') {
      if (!isChallengeOrgMember && userRole !== 'admin') {
        return {
          allowed: false,
          reason: 'Chỉ doanh nghiệp tổ chức hoặc Quản trị viên mới có quyền đưa bài thi vào thẩm định (under_review).',
        };
      }
      return { allowed: true, newStatus: 'under_review' };
    }

    if (targetStatus === 'draft') {
      if (!isOwnerOfSubmission) {
        return { allowed: false, reason: 'Chỉ tác giả mới có thể rút bài về bản nháp để chỉnh sửa trước khi chấm.' };
      }
      return { allowed: true, newStatus: 'draft' };
    }

    if (targetStatus === 'withdrawn') {
      if (!isOwnerOfSubmission) {
        return { allowed: false, reason: 'Chỉ tác giả mới có quyền rút bài dự thi.' };
      }
      return { allowed: true, newStatus: 'withdrawn' };
    }

    // Direct decisions from submitted
    if (['shortlisted', 'accepted', 'rejected'].includes(targetStatus)) {
      if (!isChallengeOrgMember && userRole !== 'admin') {
        return {
          allowed: false,
          reason: 'Chỉ doanh nghiệp tổ chức hoặc Quản trị viên mới có thẩm quyền đưa ra quyết định đánh giá.',
        };
      }
      if (isOwnerOfSubmission && targetStatus === 'accepted') {
        return {
          allowed: false,
          reason: 'QUY TẮC AN NINH: Tác giả không được phép tự chấp nhận hoặc trao giải cho bài dự thi của chính mình.',
        };
      }
      return { allowed: true, newStatus: targetStatus };
    }

    return { allowed: false, reason: `Không thể chuyển đổi trạng thái từ submitted sang ${targetStatus}.` };
  }

  // 3. Under review transitions
  if (currentStatus === 'under_review') {
    if (['shortlisted', 'accepted', 'rejected'].includes(targetStatus)) {
      if (!isChallengeOrgMember && userRole !== 'admin') {
        return {
          allowed: false,
          reason: 'Chỉ doanh nghiệp tổ chức hoặc Quản trị viên mới có thẩm quyền đưa ra quyết định đánh giá.',
        };
      }
      if (isOwnerOfSubmission && targetStatus === 'accepted') {
        return {
          allowed: false,
          reason: 'QUY TẮC AN NINH: Tác giả không được phép tự phê duyệt bài của chính mình.',
        };
      }
      return { allowed: true, newStatus: targetStatus };
    }

    if (targetStatus === 'withdrawn') {
      if (!isOwnerOfSubmission) {
        return { allowed: false, reason: 'Chỉ tác giả mới có quyền rút bài dự thi.' };
      }
      return { allowed: true, newStatus: 'withdrawn' };
    }
  }

  // 4. Shortlisted transitions
  if (currentStatus === 'shortlisted') {
    if (['accepted', 'rejected'].includes(targetStatus)) {
      if (!isChallengeOrgMember && userRole !== 'admin') {
        return {
          allowed: false,
          reason: 'Chỉ doanh nghiệp tổ chức hoặc Quản trị viên mới có thẩm quyền trao giải hoặc từ chối bài thi trong danh sách rút gọn.',
        };
      }
      if (isOwnerOfSubmission && targetStatus === 'accepted') {
        return {
          allowed: false,
          reason: 'QUY TẮC AN NINH: Tác giả không được phép tự trao giải cho bài của chính mình.',
        };
      }
      return { allowed: true, newStatus: targetStatus };
    }
  }

  // 5. Terminal states
  if (['accepted', 'rejected', 'withdrawn'].includes(currentStatus)) {
    return {
      allowed: false,
      reason: `Bài dự thi đã ở trạng thái kết thúc (${currentStatus}), không thể thay đổi trạng thái nữa.`,
    };
  }

  return { allowed: false, reason: `Chuyển đổi trạng thái từ ${currentStatus} sang ${targetStatus} không hợp lệ.` };
}

/**
 * Validates reviewer permissions and anti-self-review constraints
 */
export function canReviewSubmission(
  submission: { submitted_by: string; status: SubmissionStatus; challenge_id: string },
  challenge: { organization_id: string; status: string },
  reviewerId: string,
  reviewerRole: 'creator' | 'business' | 'admin',
  isOrgMember: boolean
): { allowed: boolean; reason?: string } {
  // 1. ANTI-SELF-REVIEW GUARD
  if (submission.submitted_by === reviewerId) {
    return {
      allowed: false,
      reason: 'QUY TẮC AN NINH: Tác giả bài dự thi không được phép tự chấm điểm hoặc đánh giá bài thi của chính mình.',
    };
  }

  // 2. Draft & Withdrawn submissions cannot be reviewed
  if (['draft', 'withdrawn'].includes(submission.status)) {
    return {
      allowed: false,
      reason: `Bài dự thi đang ở trạng thái "${submission.status}", chưa sẵn sàng để ban giám khảo đánh giá.`,
    };
  }

  // 3. Organization membership or Admin check
  if (!isOrgMember && reviewerRole !== 'admin') {
    return {
      allowed: false,
      reason: 'Chỉ thành viên của doanh nghiệp sở hữu thử thách hoặc Quản trị viên hệ thống mới có quyền chấm điểm bài thi này.',
    };
  }

  return { allowed: true };
}
