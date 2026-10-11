import { z } from 'zod';

export const outcomeStatusEnum = z.enum(['proposed', 'finalized', 'cancelled']);
export const rewardStatusEnum = z.enum([
  'planned',
  'pending_approval',
  'approved',
  'processing',
  'paid',
  'failed',
  'cancelled',
]);
export const disbursementMethodEnum = z.enum([
  'manual_bank_wire',
  'mock_escrow_adapter',
  'crypto_transfer',
  'corporate_invoice',
]);

export const finalizeOutcomeSchema = z
  .object({
    challenge_id: z.string().min(1, { message: 'ID thử thách không hợp lệ' }),
    organization_id: z.string().min(1, { message: 'ID tổ chức không hợp lệ' }),
    has_winner: z.boolean(),
    winning_submission_id: z.string().nullable().optional(),
    winner_id: z.string().nullable().optional(),
    decision_reason: z
      .string()
      .min(15, { message: 'Lý do chốt kết quả phải có tối thiểu 15 ký tự' })
      .max(1000, { message: 'Lý do chốt kết quả không được vượt quá 1000 ký tự' }),
    final_score: z.number().min(0).max(100).optional(),
    awarded_prize_amount: z.number().min(0, { message: 'Giải thưởng không được là số âm' }),
    currency: z.enum(['USD', 'VND', 'EUR']),
  })
  .refine(
    (data) => {
      if (data.has_winner) {
        return !!data.winning_submission_id && !!data.winner_id;
      }
      return !data.winning_submission_id && !data.winner_id && data.awarded_prize_amount === 0;
    },
    {
      message: 'Nếu chọn người thắng cuộc, phải chỉ định bài dự thi và người nhận giải. Nếu không có người thắng, giải thưởng phải bằng 0.',
      path: ['winning_submission_id'],
    }
  );

export const updateRewardStatusSchema = z.object({
  reward_id: z.string().min(1, { message: 'ID giải thưởng không hợp lệ' }),
  new_status: rewardStatusEnum,
  notes: z.string().max(500, { message: 'Ghi chú tối đa 500 ký tự' }).optional(),
});

export const updatePortfolioVisibilitySchema = z.object({
  portfolio_id: z.string().min(1, { message: 'ID portfolio không hợp lệ' }),
  is_public: z.boolean(),
});

export type FinalizeOutcomeInput = z.infer<typeof finalizeOutcomeSchema>;
export type UpdateRewardStatusInput = z.infer<typeof updateRewardStatusSchema>;
