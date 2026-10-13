import type {
  CollaborationNotification,
  NotificationType,
} from '../../types/collaboration.types';
import type { PulsarUser } from '../../types/auth.types';
import { createNotificationSchema, type CreateNotificationInput } from '../validation/collaboration.schema';

/**
 * Sprint 7 §6 — NotificationCenter (local in-memory store).
 *
 * Guarantees:
 * - Strict recipient isolation: only recipient can list/read.
 * - No secrets in body (callers must pass generic summaries; validated ≤1000 chars).
 * - Idempotency: same idempotency_key returns existing record, no duplicates on retry.
 * - No email/push provider: in-app polling/manual refresh only. Never claim realtime.
 */

const INITIAL_NOTIFICATIONS: CollaborationNotification[] = [
  {
    id: 'notif-seed-001',
    recipient_id: 'usr-creator-001',
    type: 'workspace_invitation',
    entity_type: 'workspace',
    entity_id: 'ws-demo-001',
    title: 'Bạn được mời vào Không gian EcoRoute AI',
    body: 'Doanh nghiệp Việt Nam Tech Hub đã thêm bạn vào workspace. Mở tab Cộng Tác để xem chi tiết.',
    read_at: null,
    created_at: '2026-03-02T08:06:00Z',
  },
];

class NotificationService {
  private notifications: CollaborationNotification[] = [...INITIAL_NOTIFICATIONS];
  private idempotencyIndex: Map<string, string> = new Map();

  /** Create (or dedup by idempotency_key). Server/owner-side only in real backend. */
  public create(
    input: CreateNotificationInput
  ): { success: boolean; notification?: CollaborationNotification; error?: string; deduplicated?: boolean } {
    try {
      const validated = createNotificationSchema.parse(input);
      if (validated.idempotency_key) {
        const existingId = this.idempotencyIndex.get(validated.idempotency_key);
        if (existingId) {
          const existing = this.notifications.find((n) => n.id === existingId);
          if (existing) return { success: true, notification: existing, deduplicated: true };
        }
      }
      const now = new Date().toISOString();
      const notif: CollaborationNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recipient_id: validated.recipient_id,
        type: validated.type,
        entity_type: validated.entity_type,
        entity_id: validated.entity_id,
        title: validated.title,
        body: validated.body,
        read_at: null,
        idempotency_key: validated.idempotency_key ?? null,
        created_at: now,
      };
      this.notifications.unshift(notif);
      if (validated.idempotency_key) this.idempotencyIndex.set(validated.idempotency_key, notif.id);
      return { success: true, notification: notif };
    } catch (err: any) {
      return { success: false, error: err.errors?.[0]?.message || err.message || 'Lỗi tạo thông báo' };
    }
  }

  /** Strict isolation: only recipient's own notifications. */
  public listForRecipient(
    actor: PulsarUser,
    options?: { unreadOnly?: boolean; limit?: number }
  ): CollaborationNotification[] {
    let result = this.notifications.filter((n) => n.recipient_id === actor.id);
    if (options?.unreadOnly) result = result.filter((n) => !n.read_at);
    const limit = options?.limit ?? 50;
    return result.slice(0, limit);
  }

  public unreadCount(actor: PulsarUser): number {
    return this.notifications.filter((n) => n.recipient_id === actor.id && !n.read_at).length;
  }

  /** Only the recipient can mark their own notification read (IDOR-safe). */
  public markRead(
    notificationId: string,
    actor: PulsarUser
  ): { success: boolean; error?: string } {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (!notif) return { success: false, error: 'Không tìm thấy thông báo.' };
    if (notif.recipient_id !== actor.id) {
      return { success: false, error: 'TRUY CẬP BỊ TỪ CHỐI (403): Thông báo này không thuộc về bạn.' };
    }
    if (!notif.read_at) notif.read_at = new Date().toISOString();
    return { success: true };
  }

  public markAllRead(actor: PulsarUser): { marked: number } {
    let marked = 0;
    this.notifications.forEach((n) => {
      if (n.recipient_id === actor.id && !n.read_at) {
        n.read_at = new Date().toISOString();
        marked += 1;
      }
    });
    return { marked };
  }

  // --- Fan-out helpers (generic bodies, never private message content) ---
  public notifyNewMessage(workspaceId: string, workspaceName: string, recipientId: string, senderName: string) {
    if (recipientId === undefined || recipientId === '') return;
    this.create({
      recipient_id: recipientId,
      type: 'new_message',
      entity_type: 'workspace',
      entity_id: workspaceId,
      title: 'Tin nhắn mới trong workspace',
      body: `${senderName} đã gửi tin nhắn mới trong "${workspaceName}". Mở Cộng Tác để xem.`,
    });
  }

  public notifyInvitation(workspaceId: string, workspaceName: string, recipientId: string, inviterName: string) {
    this.create({
      recipient_id: recipientId,
      type: 'workspace_invitation',
      entity_type: 'workspace',
      entity_id: workspaceId,
      title: 'Bạn được mời vào workspace',
      body: `${inviterName} đã mời bạn tham gia "${workspaceName}".`,
    });
  }

  public notifyTaskAssigned(taskId: string, taskTitle: string, recipientId: string, assignerName: string) {
    this.create({
      recipient_id: recipientId,
      type: 'task_assigned',
      entity_type: 'task',
      entity_id: taskId,
      title: 'Nhiệm vụ mới được giao',
      body: `${assignerName} đã giao nhiệm vụ "${taskTitle}" cho bạn.`,
    });
  }

  public notifyTaskDeadlineChanged(taskId: string, taskTitle: string, recipientId: string, newDue: string | null) {
    this.create({
      recipient_id: recipientId,
      type: 'task_deadline_changed',
      entity_type: 'task',
      entity_id: taskId,
      title: 'Deadline nhiệm vụ thay đổi',
      body: `Nhiệm vụ "${taskTitle}" đổi deadline thành ${newDue ?? 'chưa xác định'}.`,
    });
  }

  public notifyDeliverableReviewed(
    deliverableId: string,
    kind: 'deliverable_reviewed' | 'revision_requested',
    recipientId: string,
    milestoneTitle: string
  ) {
    this.create({
      recipient_id: recipientId,
      type: kind,
      entity_type: 'deliverable',
      entity_id: deliverableId,
      title: kind === 'revision_requested' ? 'Yêu cầu chỉnh sửa deliverable' : 'Deliverable được phản hồi',
      body: `Sản phẩm bàn giao cho mốc "${milestoneTitle}" đã được reviewer phản hồi. Mở panel duyệt để xem.`,
    });
  }

  public notifyMilestoneDueSoon(milestoneId: string, milestoneTitle: string, recipientId: string, dueAt: string | null) {
    this.create({
      recipient_id: recipientId,
      type: 'milestone_due_soon',
      entity_type: 'milestone',
      entity_id: milestoneId,
      title: 'Milestone sắp đến hạn',
      body: `Mốc "${milestoneTitle}" đến hạn ${dueAt ?? 'sắp tới'}. Vui lòng kiểm tra tiến độ.`,
    });
  }

  /** Test helper: reset to seed. */
  public _reset() {
    this.notifications = [...INITIAL_NOTIFICATIONS];
    this.idempotencyIndex = new Map();
  }
}

export const notificationService = new NotificationService();
export type { NotificationType };
