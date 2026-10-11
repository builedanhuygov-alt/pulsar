import { z } from 'zod';

export const evaluationCriterionSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  name: z.string().min(2, 'Tên tiêu chí phải có ít nhất 2 ký tự').max(100),
  weight: z.number().int().min(1, 'Trọng số phải lớn hơn 0%').max(100, 'Trọng số không vượt quá 100%'),
  description: z.string().min(5, 'Mô tả tiêu chí phải có ít nhất 5 ký tự'),
});

export const challengeFormSchema = z
  .object({
    title: z.string().min(5, 'Tiêu đề thử thách phải có ít nhất 5 ký tự').max(120, 'Tiêu đề tối đa 120 ký tự'),
    slug: z
      .string()
      .min(3, 'Slug phải có ít nhất 3 ký tự')
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
    short_description: z
      .string()
      .min(20, 'Mô tả ngắn phải có ít nhất 20 ký tự')
      .max(300, 'Mô tả ngắn tối đa 300 ký tự'),
    problem_statement: z
      .string()
      .min(50, 'Mô tả bài toán chi tiết phải có ít nhất 50 ký tự'),
    desired_outcome: z
      .string()
      .min(30, 'Kết quả kỳ vọng phải có ít nhất 30 ký tự'),
    category: z.enum(['ai_ml', 'blockchain', 'cloud_devops', 'mobile_iot', 'fintech', 'security']),
    requirements: z
      .array(z.string().min(3, 'Yêu cầu không được để trống'))
      .min(1, 'Phải có ít nhất 1 yêu cầu kỹ thuật'),
    deliverables: z
      .array(z.string().min(3, 'Sản phẩm bàn giao không được để trống'))
      .min(1, 'Phải có ít nhất 1 sản phẩm bàn giao'),
    evaluation_criteria: z
      .array(evaluationCriterionSchema)
      .min(1, 'Phải có ít nhất 1 tiêu chí chấm điểm')
      .refine(
        (criteria) => {
          const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
          return totalWeight === 100;
        },
        {
          message: 'Tổng trọng số các tiêu chí đánh giá phải đúng bằng 100%',
        }
      ),
    budget_min: z.number().min(0, 'Ngân sách tối thiểu không được âm'),
    budget_max: z.number().min(0, 'Ngân sách tối đa không được âm'),
    currency: z.enum(['USD', 'VND', 'EUR']),
    prize_pool: z.number().min(0, 'Tổng giải thưởng không được âm'),
    start_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Thời gian bắt đầu không hợp lệ',
    }),
    deadline_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Hạn chót nộp bài không hợp lệ',
    }),
    organization_id: z.string().min(1, 'Tổ chức là bắt buộc'),
  })
  .refine(
    (data) => data.budget_max >= data.budget_min,
    {
      message: 'Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu',
      path: ['budget_max'],
    }
  )
  .refine(
    (data) => new Date(data.deadline_at) > new Date(data.start_at),
    {
      message: 'Hạn chót phải sau thời điểm bắt đầu',
      path: ['deadline_at'],
    }
  );

export type ChallengeFormData = z.infer<typeof challengeFormSchema>;

export const adminReviewActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  notes: z.string().min(5, 'Lý do hoặc ghi chú phản hồi phải có ít nhất 5 ký tự'),
});

export type AdminReviewActionPayload = z.infer<typeof adminReviewActionSchema>;
