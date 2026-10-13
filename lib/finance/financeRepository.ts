import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import { isSupabaseConfigured, supabase } from '../supabase/client';

/**
 * SP8B-1 (provisional) — Supabase-backed finance READ repository.
 *
 * Reads go through PostgREST with the anon-key browser client, so PostgreSQL
 * RLS policies remain the enforcing authority (owner-write / member-read /
 * recipient-isolated). This layer performs NO authorization itself beyond a
 * fail-closed pre-check; it never uses service_role (server-only).
 *
 * Writes intentionally stay on the local adapter for now: atomic multi-row
 * posting has no RPC endpoint yet and ledger RLS staging tests are pending.
 * See financialService for the local write path and its documented limits.
 */

type DbAccount = Database['public']['Tables']['financial_accounts']['Row'];
type DbTransaction = Database['public']['Tables']['ledger_transactions']['Row'];
type DbEntry = Database['public']['Tables']['ledger_entries']['Row'];
type DbLink = Database['public']['Tables']['reward_ledger_links']['Row'];
type DbPayment = Database['public']['Tables']['payment_records']['Row'];

export interface EntryWithAccount extends DbEntry {
  account_code: string | null;
  account_name: string | null;
}

export interface TransactionFilters {
  organization_id?: string | null;
  kind?: string | null;
  status?: string | null;
  currency?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  page?: number;
  limit?: number;
}

export interface TransactionPage {
  rows: DbTransaction[];
  total: number;
}

export interface IFinancialReadRepository {
  readonly source: 'live';
  listAccounts(organizationId: string): Promise<DbAccount[]>;
  listTransactions(filters: TransactionFilters): Promise<TransactionPage>;
  listEntries(transactionIds: string[]): Promise<EntryWithAccount[]>;
  listLinks(organizationId: string | null): Promise<DbLink[]>;
  listPayments(organizationId: string | null): Promise<DbPayment[]>;
}

/** Never expose raw PostgREST/database messages to callers. */
function sanitizedError(what: string): Error {
  return new Error(`Không tải được ${what} từ nguồn live. Đang dùng dữ liệu demo.`);
}

/** Minimal structural type for the PostgREST query builder used below. */
export interface QueryBuilder {
  select(columns: string, options?: { count?: 'exact' }): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  gte(column: string, value: unknown): QueryBuilder;
  lte(column: string, value: unknown): QueryBuilder;
  in_(column: string, values: unknown[]): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null; count: number | null }) => TResult1 | Promise<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

export type SupabaseLikeClient = {
  from(table: string): QueryBuilder;
};

export class SupabaseFinancialRepository implements IFinancialReadRepository {
  readonly source = 'live' as const;
  constructor(private readonly client: SupabaseLikeClient) {}

  async listAccounts(organizationId: string): Promise<DbAccount[]> {
    try {
      const { data, error } = await this.client
        .from('financial_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('code', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as DbAccount[];
    } catch {
      throw sanitizedError('tài khoản');
    }
  }

  async listTransactions(filters: TransactionFilters): Promise<TransactionPage> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    try {
      let query = this.client.from('ledger_transactions').select('*', { count: 'exact' });
      if (filters.organization_id) query = query.eq('organization_id', filters.organization_id);
      if (filters.kind) query = query.eq('kind', filters.kind);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.currency) query = query.eq('currency', filters.currency);
      if (filters.date_from) query = query.gte('created_at', filters.date_from);
      if (filters.date_to) query = query.lte('created_at', filters.date_to);
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
      if (error) throw new Error(error.message);
      return { rows: ((data ?? []) as DbTransaction[]), total: count ?? 0 };
    } catch {
      throw sanitizedError('sổ cái');
    }
  }

  async listEntries(transactionIds: string[]): Promise<EntryWithAccount[]> {
    if (transactionIds.length === 0) return [];
    try {
      const { data, error } = await this.client
        .from('ledger_entries')
        .select('*, financial_accounts!inner(code,name)')
        .in_('transaction_id', transactionIds);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const joined = row['financial_accounts'] as { code?: string; name?: string } | null;
        return {
          ...(row as unknown as DbEntry),
          account_code: joined?.code ?? null,
          account_name: joined?.name ?? null,
        };
      });
    } catch {
      throw sanitizedError('dòng bút toán');
    }
  }

  async listLinks(organizationId: string | null): Promise<DbLink[]> {
    try {
      let query = this.client.from('reward_ledger_links').select('*');
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as DbLink[];
    } catch {
      throw sanitizedError('liên kết reward');
    }
  }

  async listPayments(organizationId: string | null): Promise<DbPayment[]> {
    try {
      let query = this.client.from('payment_records').select('*');
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as DbPayment[];
    } catch {
      throw sanitizedError('payment records');
    }
  }
}

/**
 * Returns a live repository only when Supabase env is configured; otherwise
 * null (callers fall back to the local/demo adapter — never a crash).
 */
export function getFinancialReadRepository(
  client: SupabaseLikeClient = supabase as unknown as SupabaseLikeClient
): IFinancialReadRepository | null {
  if (!isSupabaseConfigured) return null;
  return new SupabaseFinancialRepository(client);
}

// Re-export the real client type for consumers that need typed queries.
export type { SupabaseClient };
