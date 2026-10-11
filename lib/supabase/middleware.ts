import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '../../types/database.types';

export interface MiddlewareRequest {
  cookies: {
    getAll: () => { name: string; value: string }[];
    set: (options: { name: string; value: string } & CookieOptions) => void;
  };
  nextUrl: {
    pathname: string;
  };
}

export async function updateSession(
  request: MiddlewareRequest,
  redirect: (path: string) => unknown,
  next: () => unknown
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey =
    (process.env.VITE_SUPABASE_ANON_KEY?.startsWith('eyJ') ? process.env.VITE_SUPABASE_ANON_KEY : null) ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  // IMPORTANT: Use getUser() instead of getSession() for authenticating server-side
  // getUser() sends a request to Supabase Auth server to validate JWT signature & revocation
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register') ||
    request.nextUrl.pathname.startsWith('/forgot-password');

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/organization') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/profile');

  if (!user && isProtectedRoute) {
    return redirect('/login');
  }

  if (user && isAuthRoute) {
    return redirect('/dashboard');
  }

  return next();
}
