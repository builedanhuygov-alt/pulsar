import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  challenge_id: z.string().min(1, { message: 'ID thử thách không được để trống' }),
  submission_id: z.string().optional().nullable(),
  name: z
    .string()
    .min(3, { message: 'Tên không gian làm việc tối thiểu 3 ký tự' })
    .max(150, { message: 'Tên không gian làm việc tối đa 150 ký tự' }),
  description: z.string().max(1000, { message: 'Mô tả tối đa 1000 ký tự' }).optional(),
  initial_stage: z
    .enum(['briefing', 'in_progress', 'review', 'revision', 'completed', 'closed'])
    .default('briefing')
    .optional(),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1, { message: 'Nội dung tin nhắn không được để trống' })
    .refine((val) => val.length <= 2000, { message: 'Nội dung tin nhắn tối đa 2000 ký tự' }),
  message_type: z
    .enum(['text', 'system', 'file', 'milestone_update'])
    .default('text')
    .optional(),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
        size: z.number().optional(),
        type: z.string().optional(),
      })
    )
    .max(5, { message: 'Tối đa 5 tệp đính kèm' })
    .default([])
    .optional(),
  is_pinned: z.boolean().default(false).optional(),
  // Idempotency: client-generated UUID per send attempt; safe retry reuses same key.
  idempotency_key: z.string().min(1).max(100).optional().nullable(),
});

// Pagination for message history (bounded polling, not fake realtime)
export const messageHistoryQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  since: z.string().nullable().optional(),
});

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'Tiêu đề nhiệm vụ tối thiểu 3 ký tự' })
    .max(150, { message: 'Tiêu đề nhiệm vụ tối đa 150 ký tự' }),
  description: z.string().max(1000, { message: 'Mô tả tối đa 1000 ký tự' }).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  milestone_id: z.string().nullable().optional(),
  idempotency_key: z.string().min(1).max(100).optional().nullable(),
});

// Spec §4: canonical statuses todo/in_progress/blocked/completed/cancelled
export const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'completed', 'cancelled']),
});

export const updateTaskSchema = z.object({
  title: z.string().min(3, { message: 'Tiêu đề nhiệm vụ tối thiểu 3 ký tự' }).max(150).optional(),
  description: z.string().max(1000, { message: 'Mô tả tối đa 1000 ký tự' }).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'completed', 'cancelled']).optional(),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  milestone_id: z.string().nullable().optional(),
  change_reason: z.string().max(500).optional().nullable(),
});

export const createMilestoneSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'Tiêu đề mốc bàn giao tối thiểu 3 ký tự' })
    .max(150, { message: 'Tiêu đề mốc bàn giao tối đa 150 ký tự' }),
  description: z.string().max(1000).optional().default(''),
  due_date: z.string().nullable().optional(),
  order_index: z.number().int().min(1).default(1),
});

export const submitDeliverableSchema = z.object({
  milestone_id: z.string().min(1, { message: 'Mã mốc bàn giao không hợp lệ' }),
  title: z.string().min(3, { message: 'Tên sản phẩm bàn giao tối thiểu 3 ký tự' }),
  url: z.string().min(3, { message: 'Liên kết hoặc đường dẫn bàn giao tối thiểu 3 ký tự' }),
  notes: z.string().max(1000).optional(),
  // File metadata + versioning (no real upload: URL/metadata only until Storage integrated)
  file_metadata: z.record(z.string(), z.unknown()).optional(),
  idempotency_key: z.string().min(1).max(100).optional().nullable(),
});

// Spec §5: only owner/reviewer/admin may accept; creator can never self-accept.
export const reviewDeliverableSchema = z.object({
  deliverable_id: z.string().min(1, { message: 'Mã deliverable không hợp lệ' }),
  decision: z.enum(['under_review', 'changes_requested', 'accepted', 'rejected']),
  feedback: z.string().max(2000).optional().default(''),
});

export const addMemberSchema = z.object({
  user_id: z.string().min(1, { message: 'User ID không hợp lệ' }),
  name: z.string().min(2, { message: 'Họ tên tối thiểu 2 ký tự' }),
  email: z.string().email({ message: 'Email không hợp lệ' }),
  role: z.enum(['creator', 'reviewer', 'member', 'observer', 'admin']),
});

// Spec §6: notifications — generic body only (≤1000 chars), strict recipient isolation,
// idempotency dedup, no email/push provider claimed.
export const createNotificationSchema = z.object({
  recipient_id: z.string().min(1, { message: 'recipient_id không hợp lệ' }),
  type: z.enum([
    'new_message',
    'workspace_invitation',
    'task_assigned',
    'task_deadline_changed',
    'deliverable_reviewed',
    'milestone_due_soon',
    'revision_requested',
  ]),
  entity_type: z.enum(['workspace', 'message', 'task', 'milestone', 'deliverable']),
  entity_id: z.string().min(1, { message: 'entity_id không hợp lệ' }),
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(1000, { message: 'Notification body tối đa 1000 ký tự, không chứa dữ liệu bí mật' }),
  idempotency_key: z.string().min(1).max(100).optional().nullable(),
});

export type CreateWorkspaceInput = z.input<typeof createWorkspaceSchema>;
export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type MessageHistoryQuery = z.input<typeof messageHistoryQuerySchema>;
export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;
export type SubmitDeliverableInput = z.input<typeof submitDeliverableSchema>;
export type ReviewDeliverableInput = z.input<typeof reviewDeliverableSchema>;
export type AddMemberInput = z.input<typeof addMemberSchema>;
export type CreateNotificationInput = z.input<typeof createNotificationSchema>;
