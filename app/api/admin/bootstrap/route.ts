import crypto from 'crypto';
import { createAdminClient } from '../../../../lib/supabase/admin';

// In-Memory Sliding Window Rate Limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(identifier: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// Constant-time string comparison to resist timing attacks
function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Log Sanitizer: strips carriage returns, newlines, and ANSI escape sequences
function sanitizeLogInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\r\n\x00-\x1F\x7F]/g, '')
    .substring(0, 120)
    .trim();
}

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting Check
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'global-client';
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      console.warn(`[SECURITY] Rate limit exceeded on /api/admin/bootstrap for client: ${sanitizeLogInput(clientIp)}`);
      return Response.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // 2. Body Parsing with Generic Error Response
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid request format.' }, { status: 400 });
    }

    const { targetEmail, operatorSecret } = body || {};

    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

    // 3. Defense-in-depth: Secret must be configured and meet minimal entropy
    if (!expectedSecret || expectedSecret.length < 16) {
      console.error('[SECURITY ALERT] ADMIN_BOOTSTRAP_SECRET is unconfigured or has insufficient length (< 16 chars).');
      return Response.json(
        { error: 'Bootstrap endpoint is disabled or improperly configured.' },
        { status: 503 }
      );
    }

    if (!operatorSecret || typeof operatorSecret !== 'string') {
      return Response.json({ error: 'Missing operator credentials.' }, { status: 401 });
    }

    // 4. Constant-Time Authentication
    if (!secureCompare(operatorSecret, expectedSecret)) {
      const sanitizedEmail = sanitizeLogInput(String(targetEmail || ''));
      console.warn(`[SECURITY WARNING] Unauthorized bootstrap attempt for target: "${sanitizedEmail}"`);
      return Response.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    // 5. Input Validation
    if (!targetEmail || typeof targetEmail !== 'string' || !targetEmail.includes('@')) {
      return Response.json({ error: 'Valid targetEmail is required.' }, { status: 400 });
    }

    const cleanedEmail = targetEmail.trim().toLowerCase();

    // 6. Invoke Privileged Stored Procedure
    const adminSupabase = createAdminClient();

    const { data, error } = await (adminSupabase.rpc as any)('bootstrap_admin_user', {
      target_user_email: cleanedEmail,
      operator_reason: 'Invoked via privileged API route',
    });

    if (error) {
      // Log sanitized error internally, return generic error to client
      console.error('[BOOTSTRAP RPC ERROR]', error.code, sanitizeLogInput(error.message));
      return Response.json({ error: 'Failed to complete bootstrap operation.' }, { status: 500 });
    }

    // 7. Check Stored Procedure Business Results
    const resultRow = Array.isArray(data) ? data[0] : data;
    if (resultRow && resultRow.success === false) {
      const msg: string = resultRow.message || '';
      if (msg.includes('LOCKED')) {
        return Response.json(
          {
            error: 'Bootstrap procedure is locked: an administrator already exists in the system.',
            code: 'BOOTSTRAP_LOCKED',
          },
          { status: 409 }
        );
      }
      if (msg.includes('not found')) {
        return Response.json(
          {
            error: 'Target user was not found. Please register the user account first.',
            code: 'USER_NOT_FOUND',
          },
          { status: 404 }
        );
      }
      return Response.json(
        {
          error: 'Bootstrap request could not be processed.',
          code: 'BOOTSTRAP_FAILED',
        },
        { status: 400 }
      );
    }

    return Response.json(
      {
        result: {
          success: true,
          userId: resultRow?.user_id,
          assignedRole: resultRow?.assigned_role,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Internal server error without leaking stack trace
    console.error('[BOOTSTRAP UNCAUGHT EXCEPTION]', sanitizeLogInput(err?.message || ''));
    return Response.json({ error: 'An unexpected internal error occurred.' }, { status: 500 });
  }
}

// Exported for testing reset capability
export function _resetRateLimiter() {
  rateLimitMap.clear();
}
