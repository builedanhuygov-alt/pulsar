import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

/**
 * Supabase Multi-Factor Authentication (MFA / TOTP) Service
 * Manages TOTP enrollment, challenge, verification, and Assurance Level (AAL) checks.
 */

export interface MfaEnrollmentResult {
  factorId: string;
  qrCodeUrl: string;
  secret: string;
}

export async function enrollAdminTotp(
  supabase: SupabaseClient<Database>,
  issuer: string = 'PULSAR Platform'
): Promise<{ data: MfaEnrollmentResult | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer,
    });

    if (error || !data) {
      return { data: null, error: error?.message || 'MFA enrollment failed' };
    }

    return {
      data: {
        factorId: data.id,
        qrCodeUrl: data.totp.qr_code,
        secret: data.totp.secret,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Unexpected error during MFA enrollment' };
  }
}

export async function verifyAdminTotp(
  supabase: SupabaseClient<Database>,
  factorId: string,
  code: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challengeData) {
      return { success: false, error: challengeError?.message || 'Failed to create MFA challenge' };
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      return { success: false, error: verifyError.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unexpected error during MFA verification' };
  }
}

export async function checkAdminAssuranceLevel(
  supabase: SupabaseClient<Database>
): Promise<{ isAal2: boolean; currentLevel: string; nextLevel: string }> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    return { isAal2: false, currentLevel: 'aal1', nextLevel: 'aal1' };
  }
  return {
    isAal2: data.currentLevel === 'aal2',
    currentLevel: data.currentLevel || 'aal1',
    nextLevel: data.nextLevel || 'aal1',
  };
}
