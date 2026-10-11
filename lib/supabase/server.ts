import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '../../types/database.types';

export function createNextServerClient(cookieStore: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey =
    (process.env.VITE_SUPABASE_ANON_KEY?.startsWith('eyJ') ? process.env.VITE_SUPABASE_ANON_KEY : null) ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (typeof cookieStore.getAll === 'function') {
          return cookieStore.getAll();
        }
        return [];
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set?.(name, value, options);
          });
        } catch {
          // Handled if invoked from a Server Component where setting cookies is restricted
        }
      },
    },
  });
}
