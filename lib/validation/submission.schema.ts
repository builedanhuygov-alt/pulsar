import { z } from 'zod';

export const submissionFileSchema = z.object({
  id: z.string().default(() => `file-${Math.random().toString(36).substring(2, 9)}`),
  name: z.string().min(1, 'Tên tệp không được để trống').max(255),
  size: z.number().int().min(1, 'Dung lượng tệp phải lớn hơn 0').max(25 * 1024 * 1024, 'Dung lượng tệp không được vượt quá 25MB'),
  mime_type: z.string().min(1),
  storage_path: z.string().min(1),
  uploaded_at: z.string().default(() => new Date().toISOString()),
  is_private: z.boolean().default(true),
  signed_url: z.string().optional(),
});

export const submissionFormSchema = z.object({
  challenge_id: z.string().min(1, 'Thử thách là bắt buộc'),
  title: z
    .string()
    .min(5, 'Tiêu đề giải pháp phải có ít nhất 5 ký tự')
    .max(150, 'Tiêu đề giải pháp không vượt quá 150 ký tự'),
  solution_summary: z
    .string()
    .min(20, 'Tóm tắt giải pháp phải có ít nhất 20 ký tự')
    .max(1000, 'Tóm tắt giải pháp tối đa 1000 ký tự'),
  solution_content: z
    .string()
    .min(50, 'Thuyết minh kiến trúc & giải pháp kỹ thuật chi tiết phải có ít nhất 50 ký tự'),
  solution_url: z
    .string()
    .url('Đường dẫn demo hoặc repository phải là URL hợp lệ (http:// hoặc https://)')
    .optional()
    .or(z.literal('')),
  files: z.array(submissionFileSchema).default([]),
  idempotency_key: z.string().optional(),
});

export type SubmissionFormData = z.infer<typeof submissionFormSchema>;

export const rubricScoreItemSchema = z.object({
  criterion_id: z.string().min(1),
  criterion_name: z.string().min(1),
  weight: z.number().min(1).max(100),
  score: z
    .number()
    .min(0, 'Điểm số không được nhỏ hơn 0')
    .max(100, 'Điểm số tối đa là 100 điểm'),
  comments: z.string().default(''),
});

export const submissionReviewSchema = z
  .object({
    submission_id: z.string().min(1),
    status: z.enum(['draft', 'submitted']).default('submitted'),
    rubric_scores: z
      .array(rubricScoreItemSchema)
      .min(1, 'Phải có ít nhất 1 tiêu chí được đánh giá'),
    feedback: z
      .string()
      .min(10, 'Nhận xét đánh giá chuyên môn phải có ít nhất 10 ký tự'),
    decision: z.enum(['shortlist', 'accept', 'reject', 'needs_revision']).optional(),
    total_weighted_score: z.number().optional(),
  })
  .refine(
    (data) => {
      // If decision is 'reject', feedback must be at least 20 chars explaining the reasons
      if (data.decision === 'reject') {
        return data.feedback.trim().length >= 20;
      }
      return true;
    },
    {
      message: 'Khi từ chối bài thi, bắt buộc phải nêu rõ lý do và góp ý chi tiết tối thiểu 20 ký tự.',
      path: ['feedback'],
    }
  );

export type SubmissionReviewFormData = z.infer<typeof submissionReviewSchema>;
