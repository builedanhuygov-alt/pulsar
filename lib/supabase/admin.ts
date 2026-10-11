import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('CRITICAL SECURITY VIOLATION: createAdminClient must never be called on the client browser.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is missing in environment variables.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
