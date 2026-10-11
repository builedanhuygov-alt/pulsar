import { z } from 'zod';

export const skillCategoryEnum = z.enum([
  'ai_machine_learning',
  'blockchain_web3',
  'cloud_devops',
  'software_architecture',
  'security_compliance',
  'data_engineering',
  'frontend_mobile',
  'domain_expertise',
]);

export const declareSkillSchema = z.object({
  skill_id: z.string().min(1, { message: 'ID kỹ năng không được để trống' }),
  evidence_type: z
    .enum(['challenge_outcome', 'submission_benchmark', 'verified_portfolio', 'third_party_credential'])
    .optional(),
  evidence_challenge_id: z.string().optional(),
  evidence_submission_id: z.string().optional(),
  evidence_portfolio_id: z.string().optional(),
  evidence_notes: z.string().max(500, { message: 'Ghi chú bằng chứng tối đa 500 ký tự' }).optional(),
  is_public: z.boolean().default(true),
});

export const verifySkillSchema = z.object({
  creator_skill_id: z.string().min(1, { message: 'ID bản ghi kỹ năng không hợp lệ' }),
  decision: z.enum(['verify', 'reject']),
  reason: z.string().min(5, { message: 'Lý do đánh giá/xác minh phải có ít nhất 5 ký tự' }).max(500),
});

export const updateSignalStatusSchema = z.object({
  signal_id: z.string().min(1, { message: 'ID cảnh báo không hợp lệ' }),
  status: z.enum(['open', 'under_investigation', 'dismissed', 'resolved']),
  notes: z.string().min(5, { message: 'Ghi chú xử lý phải có ít nhất 5 ký tự' }).max(1000),
});

export type DeclareSkillInput = z.infer<typeof declareSkillSchema>;
export type VerifySkillInput = z.infer<typeof verifySkillSchema>;
export type UpdateSignalStatusInput = z.infer<typeof updateSignalStatusSchema>;
