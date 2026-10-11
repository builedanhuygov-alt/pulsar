import { z } from 'zod';

export const auditLogPayloadSchema = z.object({
  actorUserId: z.string().uuid().nullable().optional(),
  action: z
    .string()
    .trim()
    .min(2, 'Tên hành động phải có ít nhất 2 ký tự')
    .max(100, 'Tên hành động không quá 100 ký tự'),
  resourceType: z
    .string()
    .trim()
    .min(2, 'Resource type phải có ít nhất 2 ký tự')
    .max(50, 'Resource type không quá 50 ký tự'),
  resourceId: z.string().trim().nullable().optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .default({})
    .refine(
      (val) => {
        try {
          const serialized = JSON.stringify(val);
          // Limit metadata size to 8KB to avoid DOS
          return serialized.length <= 8192;
        } catch {
          return false;
        }
      },
      { message: 'Kích thước metadata log vượt quá giới hạn 8KB cho phép' }
    ),
});

export type AuditLogPayload = z.infer<typeof auditLogPayloadSchema>;
