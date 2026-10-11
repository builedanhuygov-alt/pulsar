import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../types/database.types';

function resolveSupabaseUrl(): string {
  const url =
    (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL)) ||
    (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_SUPABASE_URL || (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL)) ||
    '';
  return url.trim();
}

function resolveAnonKey(): string {
  const nextKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    '';
  const viteKey =
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    '';

  // Prioritize valid JWT token format (starts with eyJ) for PostgREST & Auth compatibility
  if (viteKey && viteKey.startsWith('eyJ')) return viteKey.trim();
  if (nextKey && nextKey.startsWith('eyJ')) return nextKey.trim();
  return (nextKey || viteKey || '').trim();
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey = resolveAnonKey();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  supabaseUrl.startsWith('http')
);

export function createClient() {
  if (!isSupabaseConfigured) {
    // Return dummy client or client initialized with empty strings to avoid runtime crash before env is filled
    return createBrowserClient<Database>(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key'
    );
  }
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const supabase = createClient();
