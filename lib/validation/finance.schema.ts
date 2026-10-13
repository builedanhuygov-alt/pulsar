import { z } from 'zod';

const currencyEnum = z.enum(['USD', 'VND', 'EUR']);

/** Integer minor units: safe integer, > 0. Never float — enforced at the boundary. */
export const amountMinorSchema = z
  .number({ message: 'Số tiền phải là số nguyên (đơn vị nhỏ nhất)' })
  .int({ message: 'Số tiền phải là số nguyên, không dùng số thập phân' })
  .positive({ message: 'Số tiền phải lớn hơn 0' })
  .max(Number.MAX_SAFE_INTEGER, { message: 'Số tiền vượt giới hạn an toàn' });

export const optionalAmountMinorSchema = z
  .number()
  .int({ message: 'Số tiền phải là số nguyên, không dùng số thập phân' })
  .nonnegative({ message: 'Số tiền không được âm' })
  .max(Number.MAX_SAFE_INTEGER)
  .optional()
  .nullable();

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/, { message: 'Idempotency key chỉ gồm chữ, số và . _ : -' })
  .optional()
  .nullable();

const journalLineSchema = z.object({
  account_id: z.string().min(1, { message: 'account_id không hợp lệ' }),
  side: z.enum(['debit', 'credit']),
  amount_minor: amountMinorSchema,
  currency: currencyEnum,
});

export const postJournalSchema = z
  .object({
    organization_id: z.string().min(1, { message: 'organization_id không hợp lệ' }),
    kind: z.enum(['liability_recognition', 'payment_attestation', 'reversal', 'adjustment']),
    currency: currencyEnum,
    lines: z.array(journalLineSchema).min(2, { message: 'Bút toán cần tối thiểu 1 dòng nợ và 1 dòng có' }),
    source_type: z.enum(['reward', 'payment_record', 'adjustment', 'manual']),
    source_id: z.string().min(1).optional().nullable(),
    reverses_transaction_id: z.string().min(1).optional().nullable(),
    idempotency_key: idempotencyKeySchema,
    memo: z.string().max(500).optional().nullable(),
  })
  .refine((d) => d.lines.some((l) => l.side === 'debit') && d.lines.some((l) => l.side === 'credit'), {
    message: 'Bút toán phải có ít nhất một dòng nợ (debit) và một dòng có (credit)',
  });

export const recognizePayableSchema = z.object({
  reward_id: z.string().min(1, { message: 'reward_id không hợp lệ' }),
  idempotency_key: idempotencyKeySchema,
});

export const recordPaymentSchema = z.object({
  reward_id: z.string().min(1, { message: 'reward_id không hợp lệ' }),
  amount_minor: amountMinorSchema,
  currency: currencyEnum,
  evidence_type: z.enum(['simulated_statement', 'manual_attestation']),
  external_ref: z.string().min(1).max(200),
  paid_at: z.string().min(1).optional().nullable(),
  idempotency_key: idempotencyKeySchema,
  note: z.string().max(500).optional().nullable(),
});

export const draftAdjustmentSchema = z.object({
  organization_id: z.string().min(1),
  target_transaction_id: z.string().min(1).optional().nullable(),
  reason: z.string().min(10, { message: 'Lý do điều chỉnh tối thiểu 10 ký tự' }).max(1000),
  currency: currencyEnum,
  lines: z.array(journalLineSchema).min(2, { message: 'Điều chỉnh cần tối thiểu 2 dòng cân đối' }),
  idempotency_key: idempotencyKeySchema,
});

export const reviewAdjustmentSchema = z.object({
  adjustment_id: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  review_note: z.string().max(500).optional().nullable(),
});

export const reconciliationRunSchema = z.object({
  organization_id: z.string().min(1).optional().nullable(),
});

export const resolveDiscrepancySchema = z.object({
  item_id: z.string().min(1),
  state: z.enum(['resolved', 'acknowledged']),
  resolution_note: z.string().min(1).max(500),
});

export const financeFilterSchema = z.object({
  organization_id: z.string().optional().nullable(),
  challenge_id: z.string().optional().nullable(),
  reward_id: z.string().optional().nullable(),
  currency: currencyEnum.optional().nullable(),
  status: z.string().optional().nullable(),
  date_from: z.string().optional().nullable(),
  date_to: z.string().optional().nullable(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PostJournalInput = z.input<typeof postJournalSchema>;
export type RecognizePayableInput = z.input<typeof recognizePayableSchema>;
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type DraftAdjustmentInput = z.input<typeof draftAdjustmentSchema>;
export type ReviewAdjustmentInput = z.input<typeof reviewAdjustmentSchema>;
export type FinanceFilterInput = z.input<typeof financeFilterSchema>;
