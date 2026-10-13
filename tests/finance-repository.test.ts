import { describe, it, expect, beforeEach } from 'vitest';
import {
  SupabaseFinancialRepository,
  getFinancialReadRepository,
  type IFinancialReadRepository,
  type SupabaseLikeClient,
} from '../lib/finance/financeRepository';
import { financialService } from '../lib/finance/financialService';
import type { PulsarUser } from '../types/auth.types';

/** Fake PostgREST chain: records calls, resolves scripted responses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFakeClient(responses: Record<string, { data?: any[]; error?: { message: string } | null; count?: number | null }>) {
  const calls: Array<Record<string, unknown>> = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const methods = ['select', 'eq', 'gte', 'lte', 'in_', 'order', 'range'] as const;
  for (const m of methods) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ op: m, args });
      return chain;
    };
  }
  let table = '';
  const client = {
    from: (t: string) => {
      table = t;
      calls.push({ op: 'from', table: t });
      return chain;
    },
  };
  // Attach terminal resolution via `then`
  (chain as Record<string, unknown>)['then'] = (onFulfilled: (v: unknown) => unknown) => {
    const r = responses[table] ?? { data: [], error: null, count: null };
    return Promise.resolve(onFulfilled({ data: r.data ?? [], error: r.error ?? null, count: r.count ?? null }));
  };
  return { client: client as unknown as SupabaseLikeClient, calls };
}

function makeUser(id: string, email: string, role: PulsarUser['role'], orgs: PulsarUser['organizations'] = []): PulsarUser {
  return {
    id,
    email,
    role,
    organizations: orgs,
    profile: { id, display_name: email, avatar_url: null, bio: '', created_at: '', updated_at: '' } as never,
  } as unknown as PulsarUser;
}

function orgMember(orgId: string, membership_role: 'owner' | 'member' = 'owner') {
  return {
    membership_role,
    organization: { id: orgId, name: `Org ${orgId}`, slug: orgId, organization_type: 'business', created_by: 'x', created_at: '', updated_at: '' } as never,
  } as never;
}

const OWNER = () => makeUser('repo-owner', 'owner@orga.dev', 'business', [orgMember('org-tech-01', 'owner')]);
const OUTSIDER = () => makeUser('repo-outsider', 'out@pulsar.dev', 'creator', []);

describe('SP8B-1 finance read repository (mocked client — no live calls)', () => {
  beforeEach(() => {
    financialService._reset();
    financialService.enableLiveSource(null);
  });

  it('R1: listTransactions applies filters and exact pagination ranges', async () => {
    const { client, calls } = makeFakeClient({
      ledger_transactions: { data: [{ id: 't1', total_minor: 100 }], count: 42 },
    });
    const repo = new SupabaseFinancialRepository(client);
    const page = await repo.listTransactions({ organization_id: 'org-tech-01', status: 'posted', currency: 'USD', page: 2, limit: 10 });
    expect(page.total).toBe(42);
    expect(page.rows.length).toBe(1);
    expect(calls).toContainEqual({ op: 'eq', args: ['organization_id', 'org-tech-01'] });
    expect(calls).toContainEqual({ op: 'eq', args: ['status', 'posted'] });
    expect(calls).toContainEqual({ op: 'eq', args: ['currency', 'USD'] });
    expect(calls).toContainEqual({ op: 'range', args: [10, 19] });
  });

  it('R2: database errors are sanitized (no raw PostgREST text leaks)', async () => {
    const { client } = makeFakeClient({
      ledger_transactions: { data: [], error: { message: 'SECRET schema detail: permission denied for relation xyz' }, count: 0 },
    });
    const repo = new SupabaseFinancialRepository(client);
    await expect(repo.listTransactions({})).rejects.toThrowError(/Không tải được sổ cái/);
    try {
      await repo.listTransactions({});
    } catch (e) {
      expect((e as Error).message).not.toContain('SECRET');
      expect((e as Error).message).not.toContain('permission denied');
    }
  });

  it('R3: listEntries short-circuits on empty ids and maps the account join', async () => {
    const { client, calls } = makeFakeClient({});
    const repo = new SupabaseFinancialRepository(client);
    expect(await repo.listEntries([])).toEqual([]);
    expect(calls.length).toBe(0);
    const { client: c2 } = makeFakeClient({
      ledger_entries: {
        data: [{ id: 'e1', transaction_id: 't1', amount_minor: 5, financial_accounts: { code: 'REWARD_PAYABLE', name: 'Pay' } }],
      },
    });
    const repo2 = new SupabaseFinancialRepository(c2);
    const rows = await repo2.listEntries(['t1']);
    expect(rows[0].account_code).toBe('REWARD_PAYABLE');
    expect(rows[0].account_name).toBe('Pay');
  });

  it('R4: links/payments scope by org only when provided', async () => {
    const { client, calls } = makeFakeClient({ reward_ledger_links: { data: [] }, payment_records: { data: [] } });
    const repo = new SupabaseFinancialRepository(client);
    await repo.listLinks(null);
    await repo.listPayments('org-tech-01');
    const eqCalls = calls.filter((c) => c.op === 'eq');
    expect(eqCalls).toContainEqual({ op: 'eq', args: ['organization_id', 'org-tech-01'] });
    expect(eqCalls.length).toBe(1); // null org => no eq filter (admin-wide read)
  });

  it('R5: factory returns null when Supabase env is unconfigured (demo fallback)', () => {
    // Vitest has no VITE_SUPABASE_* env, so isSupabaseConfigured is false here.
    expect(getFinancialReadRepository()).toBeNull();
  });

  it('R6: service prefers live source, validates minor units, and falls back on failure', async () => {
    const live: IFinancialReadRepository = {
      source: 'live',
      listAccounts: async () => [],
      listTransactions: async () => ({
        rows: [
          { id: 'live-1', organization_id: 'org-tech-01', kind: 'liability_recognition', status: 'posted', currency: 'USD', total_minor: 1000, source_type: 'reward', source_id: 'r1', reverses_transaction_id: null, idempotency_key: null, memo: null, created_by: null, posted_at: null, created_at: '', updated_at: '' },
          // Corrupt row (non-integer) must be skipped, never trusted.
          { id: 'live-bad', organization_id: 'org-tech-01', kind: 'liability_recognition', status: 'posted', currency: 'USD', total_minor: 10.5, source_type: 'reward', source_id: 'r2', reverses_transaction_id: null, idempotency_key: null, memo: null, created_by: null, posted_at: null, created_at: '', updated_at: '' },
        ],
        total: 2,
      }),
      listEntries: async () => [],
      listLinks: async () => [],
      listPayments: async () => [],
    };
    financialService.enableLiveSource(live);
    expect(financialService.isLiveSource()).toBe(true);
    const res = await financialService.fetchTransactionsLive({ organization_id: 'org-tech-01' }, OWNER());
    expect(res.source).toBe('live');
    expect(res.rows.map((r) => r.id)).toEqual(['live-1']);

    // Failing live source -> demo fallback (same shape as sync path).
    const failing: IFinancialReadRepository = {
      source: 'live',
      listAccounts: async () => { throw new Error('boom'); },
      listTransactions: async () => { throw new Error('boom'); },
      listEntries: async () => { throw new Error('boom'); },
      listLinks: async () => { throw new Error('boom'); },
      listPayments: async () => { throw new Error('boom'); },
    };
    financialService.enableLiveSource(failing);
    const fb = await financialService.fetchTransactionsLive({ organization_id: 'org-tech-01' }, OWNER());
    expect(fb.source).toBe('demo');

    // Outsider pre-check fails closed without touching the live source.
    let touched = false;
    const counting: IFinancialReadRepository = {
      ...failing,
      listTransactions: async () => { touched = true; throw new Error('must not be called'); },
    };
    financialService.enableLiveSource(counting);
    const denied = await financialService.fetchTransactionsLive({ organization_id: 'org-tech-01' }, OUTSIDER());
    expect(denied.rows).toEqual([]);
    expect(touched).toBe(false);
    financialService.enableLiveSource(null);
  });

  it('R7: live detail enforces same-org scope (cross-org id returns null)', async () => {
    const live: IFinancialReadRepository = {
      source: 'live',
      listAccounts: async () => [],
      listTransactions: async () => ({
        rows: [{ id: 't-x', organization_id: 'org-other', kind: 'liability_recognition', status: 'posted', currency: 'USD', total_minor: 5, source_type: 'manual', source_id: null, reverses_transaction_id: null, idempotency_key: null, memo: null, created_by: null, posted_at: null, created_at: '', updated_at: '' }],
        total: 1,
      }),
      listEntries: async () => [],
      listLinks: async () => [],
      listPayments: async () => [],
    };
    financialService.enableLiveSource(live);
    const res = await financialService.fetchTransactionDetailLive('t-x', 'org-tech-01', OWNER());
    expect(res).toBeNull();
    financialService.enableLiveSource(null);
  });
});
