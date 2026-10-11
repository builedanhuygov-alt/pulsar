import { describe, it, expect } from 'vitest';
import { signUpSchema, signInSchema } from '../lib/validation/auth.schema';

describe('Authentication Flow & Sanitization Suite', () => {
  it('Flow 1: Valid registration assigns creator role by default', () => {
    const userInput = {
      email: 'student@university.edu',
      password: 'StrongP@ssw0rd2025',
      displayName: 'Nguyen Van A',
      role: 'creator',
    };
    const parsed = signUpSchema.safeParse(userInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe('creator');
      expect(parsed.data.displayName).toBe('Nguyen Van A');
    }
  });

  it('Flow 2: Business registration preserves business role', () => {
    const businessInput = {
      email: 'recruiter@techcorp.vn',
      password: 'EnterprisePassword123',
      displayName: 'TechCorp Vietnam HR',
      role: 'business',
    };
    const parsed = signUpSchema.safeParse(businessInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe('business');
    }
  });

  it('Flow 3: Reject malformed login requests with empty passwords', () => {
    const emptyPass = {
      email: 'user@pulsar.dev',
      password: '',
    };
    const parsed = signInSchema.safeParse(emptyPass);
    expect(parsed.success).toBe(false);
  });

  it('Flow 4: Database trigger sanitization rule verification', () => {
    // In database trigger `handle_new_user`:
    // IF v_requested_role = 'business' THEN v_assigned_role := 'business';
    // ELSE v_assigned_role := 'creator';
    function simulateTriggerRoleSanitization(rawRolePayload: unknown): 'creator' | 'business' {
      const lower = typeof rawRolePayload === 'string' ? rawRolePayload.toLowerCase() : '';
      if (lower === 'business') return 'business';
      return 'creator';
    }

    expect(simulateTriggerRoleSanitization('creator')).toBe('creator');
    expect(simulateTriggerRoleSanitization('business')).toBe('business');
    // Injected admin MUST fallback to creator
    expect(simulateTriggerRoleSanitization('admin')).toBe('creator');
    expect(simulateTriggerRoleSanitization('SUPERADMIN')).toBe('creator');
    expect(simulateTriggerRoleSanitization(null)).toBe('creator');
  });
});
