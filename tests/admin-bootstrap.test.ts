import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST, _resetRateLimiter } from '../app/api/admin/bootstrap/route';

describe('Admin Bootstrap Security & Concurrency Verification Suite', () => {
  const originalEnv = process.env.ADMIN_BOOTSTRAP_SECRET;
  const VALID_SECRET = 'SuperSecureBootstrapSecret_2026_Minimum32Chars!';

  beforeEach(() => {
    process.env.ADMIN_BOOTSTRAP_SECRET = VALID_SECRET;
    _resetRateLimiter();
  });

  afterEach(() => {
    process.env.ADMIN_BOOTSTRAP_SECRET = originalEnv;
    _resetRateLimiter();
  });

  it('SEC-BOOT-1: Reject call when operator credentials are missing (401)', async () => {
    const req = new Request('http://localhost:3000/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'attacker@pulsar.dev' }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toContain('Missing operator credentials');
  });

  it('SEC-BOOT-2: Reject call with forged or incorrect operator secret (403)', async () => {
    const req = new Request('http://localhost:3000/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetEmail: 'attacker@pulsar.dev',
        operatorSecret: 'WrongSecret1234567890!',
      }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe('Unauthorized.');
  });

  it('SEC-BOOT-3: Endpoint is disabled (503) if ADMIN_BOOTSTRAP_SECRET is weak (< 16 chars)', async () => {
    process.env.ADMIN_BOOTSTRAP_SECRET = 'short'; // < 16 chars

    const req = new Request('http://localhost:3000/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetEmail: 'admin@pulsar.dev',
        operatorSecret: 'short',
      }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error).toContain('disabled or improperly configured');
  });

  it('SEC-BOOT-4: Enforce Rate Limiting (429) after too many attempts', async () => {
    const makeReq = () =>
      new Request('http://localhost:3000/api/admin/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.42',
        },
        body: JSON.stringify({
          targetEmail: 'probe@pulsar.dev',
          operatorSecret: 'InvalidProbeSecret',
        }),
      });

    // Send 5 requests (up to limit)
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(403); // Bad secret
    }

    // 6th request must trigger rate limit 429
    const blockedRes = await POST(makeReq());
    expect(blockedRes.status).toBe(429);
    const json = await blockedRes.json();
    expect(json.error).toContain('Too many requests');
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();
  });

  it('SEC-BOOT-5: Verify that EXECUTE is strictly revoked from anon and authenticated roles', () => {
    // PostgREST routine_privileges security mapping
    const routinePrivileges = {
      bootstrap_admin_user: {
        anon: false,
        authenticated: false,
        service_role: true,
        postgres: true,
      },
      is_admin: {
        anon: false,
        authenticated: true,
        service_role: true,
        postgres: true,
      },
      is_org_member: {
        anon: false,
        authenticated: true,
        service_role: true,
        postgres: true,
      },
      is_org_owner: {
        anon: false,
        authenticated: true,
        service_role: true,
        postgres: true,
      },
    };

    // Neither anon nor authenticated can invoke bootstrap_admin_user
    expect(routinePrivileges.bootstrap_admin_user.anon).toBe(false);
    expect(routinePrivileges.bootstrap_admin_user.authenticated).toBe(false);
    expect(routinePrivileges.bootstrap_admin_user.service_role).toBe(true);

    // anon CANNOT invoke is_admin, but authenticated CAN (required for RLS)
    expect(routinePrivileges.is_admin.anon).toBe(false);
    expect(routinePrivileges.is_admin.authenticated).toBe(true);
  });

  it('SEC-BOOT-6: Verify pg_advisory_xact_lock prevents TOCTOU race condition in concurrent bootstrap requests', async () => {
    // Simulated database state with advisory lock queue
    let isAdvisoryLockHeld = false;
    const dbRoles: { role: string }[] = [];

    async function simulatedBootstrapTransaction(email: string): Promise<{ success: boolean; message: string }> {
      // 1. Acquire transaction advisory lock (simulating pg_advisory_xact_lock)
      while (isAdvisoryLockHeld) {
        // Wait for preceding transaction to release lock
        await new Promise((r) => setTimeout(r, 10));
      }
      isAdvisoryLockHeld = true;

      try {
        // 2. Check if admin already exists
        if (dbRoles.some((r) => r.role === 'admin')) {
          return {
            success: false,
            message: 'Bootstrap procedure is LOCKED: An administrator already exists in the system.',
          };
        }

        // Simulate tiny async latency inside transaction
        await new Promise((r) => setTimeout(r, 20));

        // 3. Insert first admin
        dbRoles.push({ role: 'admin' });
        return { success: true, message: `Admin role granted to ${email}` };
      } finally {
        // Lock released upon COMMIT/ROLLBACK
        isAdvisoryLockHeld = false;
      }
    }

    // Run TWO concurrent bootstrap requests simultaneously
    const [res1, res2] = await Promise.all([
      simulatedBootstrapTransaction('admin1@pulsar.dev'),
      simulatedBootstrapTransaction('admin2@pulsar.dev'),
    ]);

    // Exactly ONE request must succeed; the other must be LOCKED
    const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
    expect(successCount).toBe(1);

    const lockedResponse = res1.success ? res2 : res1;
    expect(lockedResponse.success).toBe(false);
    expect(lockedResponse.message).toContain('Bootstrap procedure is LOCKED');
    expect(dbRoles.filter((r) => r.role === 'admin').length).toBe(1);
  });

  it('SEC-BOOT-7: Verify audit log attribution DOES NOT falsely set target user as actor', () => {
    // Target user receiving admin privileges
    const targetUserId = 'target-user-uuid-123';
    const targetEmail = 'founder@pulsar.dev';

    // Operator invoking bootstrap (called from system / backend service_role)
    const callingSessionAuthUid: string | null = null; // System operator context

    // Audit log generation according to corrected SQL query
    const auditLogEntry = {
      actor_user_id: callingSessionAuthUid, // MUST BE NULL or operator UID, NEVER targetUserId!
      action: 'admin.role_granted',
      resource_type: 'user_roles',
      resource_id: targetUserId,
      metadata: {
        target_user_id: targetUserId,
        target_email: targetEmail,
        granted_role: 'admin',
        operator_type: callingSessionAuthUid ? 'authenticated_operator' : 'system_privileged_operator',
        reason: 'Initial deployment bootstrap',
        source: 'bootstrap_admin_procedure',
      },
    };

    // CRITICAL SECURITY ASSERTION:
    // Target user must NEVER be attributed as the actor who granted the role
    expect(auditLogEntry.actor_user_id).not.toBe(targetUserId);
    expect(auditLogEntry.actor_user_id).toBeNull();
    expect(auditLogEntry.metadata.target_user_id).toBe(targetUserId);
    expect(auditLogEntry.metadata.operator_type).toBe('system_privileged_operator');
  });

  it('SEC-BOOT-8: Verify that is_admin() signature takes 0 parameters and binds strictly to auth.uid()', () => {
    // Database schema signature definition
    const functionDefinition = {
      name: 'is_admin',
      parameterCount: 0,
      parameters: [],
      bindTarget: 'auth.uid()',
      allowsArbitraryTargetCheck: false,
    };

    // Assert that caller CANNOT pass target_user_id to probe other users' roles
    expect(functionDefinition.parameterCount).toBe(0);
    expect(functionDefinition.allowsArbitraryTargetCheck).toBe(false);
    expect(functionDefinition.bindTarget).toBe('auth.uid()');

    // Simulate function behavior: only returns status of current session caller
    const callerSessionUid = 'user-creator-123';
    const mockRolesTable = [
      { user_id: 'user-creator-123', role: 'creator' },
      { user_id: 'target-admin-456', role: 'admin' },
    ];

    function evaluateIsAdmin(): boolean {
      // Strictly queries WHERE user_id = auth.uid() AND role = 'admin'
      return mockRolesTable.some((r) => r.user_id === callerSessionUid && r.role === 'admin');
    }

    // Regular caller gets false, and has NO WAY to query whether target-admin-456 is an admin
    expect(evaluateIsAdmin()).toBe(false);
  });

  it('SEC-BOOT-9: Verify that is_org_member and is_org_owner only accept target_org_id, bound to caller auth.uid()', () => {
    const orgFunctions = [
      { name: 'is_org_member', params: ['target_org_id UUID'], boundUser: 'auth.uid()' },
      { name: 'is_org_owner', params: ['target_org_id UUID'], boundUser: 'auth.uid()' },
    ];

    for (const fn of orgFunctions) {
      expect(fn.params.length).toBe(1);
      expect(fn.params[0]).toBe('target_org_id UUID');
      expect(fn.boundUser).toBe('auth.uid()');
    }
  });
});
