import { describe, it, expect } from 'vitest';
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../lib/validation/auth.schema';
import { profileUpdateSchema } from '../lib/validation/profile.schema';
import { createOrganizationSchema } from '../lib/validation/org.schema';
import { auditLogPayloadSchema } from '../lib/validation/audit.schema';

describe('A. Auth Validation Schemas', () => {
  it('should accept valid sign-up input', () => {
    const valid = {
      email: 'creator@pulsar.dev',
      password: 'StrongPassword123',
      displayName: 'Alex Creator',
      role: 'creator',
    };
    const result = signUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('creator@pulsar.dev');
    }
  });

  it('should reject sign-up with invalid email', () => {
    const invalid = {
      email: 'not-an-email',
      password: 'StrongPassword123',
      displayName: 'Alex',
      role: 'creator',
    };
    const result = signUpSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject sign-up with password shorter than 8 characters', () => {
    const invalid = {
      email: 'user@pulsar.dev',
      password: 'Pass1',
      displayName: 'User',
      role: 'creator',
    };
    const result = signUpSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject sign-up with password missing numbers', () => {
    const invalid = {
      email: 'user@pulsar.dev',
      password: 'PasswordOnlyNoDigits',
      displayName: 'User',
      role: 'creator',
    };
    const result = signUpSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('CRITICAL: should reject public sign-up attempting to register as "admin"', () => {
    const malicious = {
      email: 'hacker@pulsar.dev',
      password: 'Password123',
      displayName: 'Hacker Admin',
      role: 'admin', // FORBIDDEN!
    };
    const result = signUpSchema.safeParse(malicious);
    expect(result.success).toBe(false);
  });

  it('should accept valid sign-in input', () => {
    const valid = {
      email: 'user@pulsar.dev',
      password: 'secretPassword',
    };
    const result = signInSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate password reset confirmation matching', () => {
    const mismatched = {
      password: 'NewPassword123',
      confirmPassword: 'DifferentPassword123',
    };
    const result = resetPasswordSchema.safeParse(mismatched);
    expect(result.success).toBe(false);

    const matched = {
      password: 'NewPassword123',
      confirmPassword: 'NewPassword123',
    };
    const matchedResult = resetPasswordSchema.safeParse(matched);
    expect(matchedResult.success).toBe(true);
  });
});

describe('B. Profile Update Validation', () => {
  it('should accept valid profile changes', () => {
    const valid = {
      displayName: 'Pulsar Expert',
      bio: 'Fullstack AI builder',
      avatarUrl: 'https://images.unsplash.com/avatar.png',
    };
    const result = profileUpdateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('SECURITY: should strictly reject injected system fields (id, role, created_at)', () => {
    const injected = {
      displayName: 'Tampered Profile',
      id: '00000000-0000-0000-0000-000000000000',
      role: 'admin',
      created_at: '2020-01-01T00:00:00Z',
    };
    const result = profileUpdateSchema.safeParse(injected);
    expect(result.success).toBe(false);
  });
});

describe('C. Organization Validation', () => {
  it('should accept valid organization slug and type', () => {
    const valid = {
      name: 'Acme Corporation',
      slug: 'acme-corporation',
      organizationType: 'business',
    };
    const result = createOrganizationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid slug with spaces or uppercase', () => {
    const invalid = {
      name: 'Acme Corp',
      slug: 'Acme Corp with spaces',
      organizationType: 'business',
    };
    const result = createOrganizationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('D. Audit Log Payload Validation', () => {
  it('should accept valid audit log payload', () => {
    const payload = {
      actorUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      action: 'user.login',
      resourceType: 'auth',
      resourceId: 'session_123',
      metadata: { ip: '127.0.0.1', device: 'Firefox' },
    };
    const result = auditLogPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('SECURITY: should reject audit logs with oversized metadata payload (> 8KB)', () => {
    const hugeMetadata: Record<string, string> = {};
    for (let i = 0; i < 500; i++) {
      hugeMetadata[`key_${i}`] = 'x'.repeat(50);
    }
    const payload = {
      action: 'test.overflow',
      resourceType: 'test',
      metadata: hugeMetadata,
    };
    const result = auditLogPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
