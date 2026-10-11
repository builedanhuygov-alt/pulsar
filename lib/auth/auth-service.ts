import { supabase } from '../supabase/client';
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type SignUpInput,
  type SignInInput,
} from '../validation/auth.schema';
import type { UserRole } from '../../types/database.types';

export class AuthService {
  /**
   * Registers a new user with Supabase Auth
   * Note: The role is strictly validated. The database trigger on_auth_user_created
   * further sanitizes metadata to prevent privilege escalation to 'admin'.
   */
  static async signUp(input: SignUpInput) {
    const validated = signUpSchema.parse(input);

    const { data, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        data: {
          display_name: validated.displayName,
          role: validated.role, // 'creator' or 'business' only
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      user: data.user,
      session: data.session,
      requiresEmailVerification: !data.session && Boolean(data.user),
    };
  }

  /**
   * Authenticates user with email and password
   */
  static async signIn(input: SignInInput) {
    const validated = signInSchema.parse(input);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  /**
   * Logs out the current user session
   */
  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  }

  /**
   * Initiates password recovery email flow
   */
  static async forgotPassword(email: string, redirectTo?: string) {
    const validated = forgotPasswordSchema.parse({ email });

    const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
      redirectTo: redirectTo || `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }

  /**
   * Resets password for authenticated user (after clicking recovery link)
   */
  static async resetPassword(password: string, confirmPassword: string) {
    const validated = resetPasswordSchema.parse({ password, confirmPassword });

    const { data, error } = await supabase.auth.updateUser({
      password: validated.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { user: data.user };
  }

  /**
   * Verifies an email OTP / Token
   */
  static async verifyEmailOtp(email: string, token: string, type: 'signup' | 'recovery' = 'signup') {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }
}
