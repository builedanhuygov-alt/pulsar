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
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
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
});

export const addMemberSchema = z.object({
  user_id: z.string().min(1, { message: 'User ID không hợp lệ' }),
  name: z.string().min(2, { message: 'Họ tên tối thiểu 2 ký tự' }),
  email: z.string().email({ message: 'Email không hợp lệ' }),
  role: z.enum(['creator', 'reviewer', 'member', 'observer', 'admin']),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type SubmitDeliverableInput = z.infer<typeof submitDeliverableSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
