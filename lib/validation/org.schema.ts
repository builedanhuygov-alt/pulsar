import { z } from 'zod';

export const organizationTypeSchema = z.enum([
  'business',
  'agency',
  'school',
  'partner',
]);

export const membershipRoleSchema = z.enum(['owner', 'member']);

export const createOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Tên tổ chức phải có ít nhất 2 ký tự')
      .max(100, 'Tên tổ chức không được vượt quá 100 ký tự'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, 'Slug phải có ít nhất 2 ký tự')
      .max(50, 'Slug không được vượt quá 50 ký tự')
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug chỉ chứa chữ thường, số và dấu gạch nối (ví dụ: pulsar-tech-hub)'
      ),
    organizationType: organizationTypeSchema,
  })
  .strict();

export const inviteMemberSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Địa chỉ email không hợp lệ'),
    membershipRole: membershipRoleSchema,
  })
  .strict();

export const updateMemberRoleSchema = z
  .object({
    membershipRole: membershipRoleSchema,
  })
  .strict();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
