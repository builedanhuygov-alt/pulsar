import type { ChallengeStatus } from '../../types/challenge.types';

export interface TransitionContext {
  userId: string;
  userRole: 'creator' | 'business' | 'admin';
  isOrgMember: boolean;
  isCreator: boolean;
  notes?: string;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  newStatus?: ChallengeStatus;
}

/**
 * Evaluates whether a user can transition a challenge from its current status to target status.
 * Enforces strict enterprise business logic & prevents unauthorized jumps.
 */
export function canTransitionChallengeStatus(
  currentStatus: ChallengeStatus,
  targetStatus: ChallengeStatus,
  context: TransitionContext
): TransitionResult {
  const { userId, userRole, isOrgMember, isCreator, notes } = context;

  // 1. Terminal / Closed state protection
  if (currentStatus === 'closed' || currentStatus === 'cancelled') {
    return {
      allowed: false,
      reason: `Thử thách đã ở trạng thái kết thúc (${currentStatus}), không thể chuyển đổi trạng thái nữa.`,
    };
  }

  // 2. Self-transition is a no-op / allowed
  if (currentStatus === targetStatus) {
    return { allowed: true, newStatus: currentStatus };
  }

  // 3. Draft transitions
  if (currentStatus === 'draft') {
    if (targetStatus === 'pending_review') {
      if (!isOrgMember) {
        return { allowed: false, reason: 'Chỉ thành viên của tổ chức mới có quyền gửi thử thách duyệt.' };
      }
      return { allowed: true, newStatus: 'pending_review' };
    }
    if (targetStatus === 'cancelled') {
      if (!isOrgMember) {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức mới có thể hủy bản nháp.' };
      }
      return { allowed: true, newStatus: 'cancelled' };
    }
    return {
      allowed: false,
      reason: `Bản nháp (draft) chỉ có thể chuyển sang "pending_review" hoặc "cancelled", không được nhảy cóc sang "${targetStatus}".`,
    };
  }

  // 4. Pending Review transitions (Strict Admin Review Area)
  if (currentStatus === 'pending_review') {
    if (['approved', 'changes_requested', 'rejected'].includes(targetStatus)) {
      if (userRole !== 'admin') {
        return { allowed: false, reason: 'Chỉ quản trị viên hệ thống (Admin) mới có quyền duyệt, từ chối hoặc yêu cầu sửa đổi thử thách.' };
      }

      // CRITICAL SECURITY GUARD: Creator CANNOT approve their own challenge!
      if (isCreator && targetStatus === 'approved') {
        return { allowed: false, reason: 'QUY TẮC AN NINH: Người tạo thử thách không được phép tự phê duyệt thử thách của chính mình.' };
      }

      if (['changes_requested', 'rejected'].includes(targetStatus) && (!notes || notes.trim().length < 5)) {
        return { allowed: false, reason: 'Bắt buộc phải ghi rõ lý do hoặc ghi chú phản hồi tối thiểu 5 ký tự khi yêu cầu sửa hoặc từ chối.' };
      }

      return { allowed: true, newStatus: targetStatus };
    }

    if (targetStatus === 'cancelled') {
      if (!isOrgMember && userRole !== 'admin') {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức hoặc quản trị viên mới có thể hủy thử thách đang chờ duyệt.' };
      }
      return { allowed: true, newStatus: 'cancelled' };
    }

    return {
      allowed: false,
      reason: `Thử thách đang chờ duyệt (pending_review) không thể chuyển sang "${targetStatus}".`,
    };
  }

  // 5. Changes Requested transitions
  if (currentStatus === 'changes_requested') {
    if (targetStatus === 'pending_review') {
      if (!isOrgMember) {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức mới có thể nộp lại thử thách sau khi đã chỉnh sửa.' };
      }
      return { allowed: true, newStatus: 'pending_review' };
    }
    if (targetStatus === 'cancelled') {
      if (!isOrgMember) {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức mới có thể hủy thử thách.' };
      }
      return { allowed: true, newStatus: 'cancelled' };
    }
    return {
      allowed: false,
      reason: `Thử thách đang yêu cầu chỉnh sửa chỉ có thể gửi duyệt lại ("pending_review") hoặc hủy ("cancelled").`,
    };
  }

  // 6. Approved transitions
  if (currentStatus === 'approved') {
    if (targetStatus === 'published') {
      if (!isOrgMember && userRole !== 'admin') {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức hoặc quản trị viên mới có quyền xuất bản thử thách đã duyệt.' };
      }
      return { allowed: true, newStatus: 'published' };
    }
    if (targetStatus === 'cancelled') {
      if (!isOrgMember && userRole !== 'admin') {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức hoặc quản trị viên mới có thể hủy thử thách.' };
      }
      return { allowed: true, newStatus: 'cancelled' };
    }
    return {
      allowed: false,
      reason: `Thử thách đã được duyệt chỉ có thể chuyển sang "published" hoặc "cancelled".`,
    };
  }

  // 7. Published transitions
  if (currentStatus === 'published') {
    if (targetStatus === 'closed') {
      if (!isOrgMember && userRole !== 'admin') {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức hoặc quản trị viên mới có quyền đóng thử thách.' };
      }
      return { allowed: true, newStatus: 'closed' };
    }
    if (targetStatus === 'cancelled') {
      if (userRole !== 'admin') {
        return { allowed: false, reason: 'Chỉ quản trị viên mới có thể hủy thử thách đã công khai trên sàn.' };
      }
      return { allowed: true, newStatus: 'cancelled' };
    }
    return {
      allowed: false,
      reason: `Thử thách đã công khai (published) chỉ có thể đóng ("closed") khi hết hạn hoặc hủy bởi Admin.`,
    };
  }

  // 8. Rejected transitions
  if (currentStatus === 'rejected') {
    if (targetStatus === 'draft') {
      if (!isOrgMember) {
        return { allowed: false, reason: 'Chỉ thành viên tổ chức mới có thể khôi phục thử thách bị từ chối thành bản nháp.' };
      }
      return { allowed: true, newStatus: 'draft' };
    }
    return {
      allowed: false,
      reason: 'Thử thách bị từ chối chỉ có thể đưa về bản nháp để làm lại hoàn toàn.',
    };
  }

  return { allowed: false, reason: `Chuyển đổi trạng thái từ ${currentStatus} sang ${targetStatus} không hợp lệ.` };
}
