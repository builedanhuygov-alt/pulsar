import { z } from 'zod';

export const profileUpdateSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Tên hiển thị phải có từ 2 đến 50 ký tự')
      .max(50, 'Tên hiển thị không được vượt quá 50 ký tự')
      .optional(),
    avatarUrl: z
      .string()
      .trim()
      .url('Đường dẫn ảnh đại diện không hợp lệ')
      .nullable()
      .or(z.literal(''))
      .optional(),
    bio: z
      .string()
      .trim()
      .max(500, 'Tiểu sử không được vượt quá 500 ký tự')
      .nullable()
      .or(z.literal(''))
      .optional(),
  })
  .strict(); // Disallow injected fields like id, role, created_at

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
