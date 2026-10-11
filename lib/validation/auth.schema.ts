import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(72, 'Mật khẩu không được vượt quá 72 ký tự')
  .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất một chữ số')
  .regex(/[a-zA-Z]/, 'Mật khẩu phải chứa ít nhất một chữ cái');

export const publicRoleSchema = z.enum(['creator', 'business']);

export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Địa chỉ email không hợp lệ')
    .max(255, 'Email quá dài'),
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .min(2, 'Tên hiển thị phải có ít nhất 2 ký tự')
    .max(50, 'Tên hiển thị không được vượt quá 50 ký tự'),
  role: publicRoleSchema,
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Địa chỉ email không hợp lệ'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Địa chỉ email không hợp lệ'),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không trùng khớp',
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
