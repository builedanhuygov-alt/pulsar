import { z } from 'zod';

export const recommendationActionSchema = z.object({
  challenge_id: z.string().min(1, { message: 'ID thử thách không hợp lệ' }),
  target_creator_id: z.string().optional(),
  feed_type: z.enum(['creator_feed', 'business_talent_match']),
  action: z.enum(['viewed', 'dismissed', 'interested', 'applied']),
  match_score: z.number().min(0).max(100),
  confidence_level: z.enum(['high', 'medium', 'low', 'insufficient_data']),
});

export const copilotAnalysisRequestSchema = z.object({
  title: z.string().min(5, { message: 'Tiêu đề tối thiểu 5 ký tự' }),
  short_description: z.string().min(10, { message: 'Mô tả ngắn tối thiểu 10 ký tự' }),
  problem_statement: z.string().min(20, { message: 'Bài toán chi tiết tối thiểu 20 ký tự' }),
  desired_outcome: z.string().min(15, { message: 'Kết quả kỳ vọng tối thiểu 15 ký tự' }),
  category: z.string().min(1),
  requirements: z.array(z.string()).min(1, { message: 'Cần ít nhất 1 yêu cầu' }),
  deliverables: z.array(z.string()).min(1, { message: 'Cần ít nhất 1 sản phẩm bàn giao' }),
  budget_min: z.number().min(0),
  budget_max: z.number().min(0),
  deadline_at: z.string().min(1),
  start_at: z.string().optional(),
});

export const copilotApplySuggestionSchema = z.object({
  challenge_id: z.string().min(1),
  updated_requirements: z.array(z.string()).optional(),
  updated_deliverables: z.array(z.string()).optional(),
  updated_evaluation_criteria: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        weight: z.number(),
        description: z.string(),
      })
    )
    .optional(),
});

export type RecommendationActionInput = z.infer<typeof recommendationActionSchema>;
export type CopilotAnalysisRequestInput = z.infer<typeof copilotAnalysisRequestSchema>;
export type CopilotApplySuggestionInput = z.infer<typeof copilotApplySuggestionSchema>;
