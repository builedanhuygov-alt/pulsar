import React, { useEffect, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import type { CurrencyCode, LedgerTransaction, LedgerTransactionStatus } from '../../types/finance.types';
import { financialService, financeRoleFor } from '../../lib/finance/financialService';
import { getFinancialReadRepository } from '../../lib/finance/financeRepository';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import { formatMinor } from '../../lib/finance/money';

interface Props {
  user: PulsarUser;
  organizationId: string;
  currency: CurrencyCode;
  onChanged: () => void;
}

export const LedgerExplorer: React.FC<Props> = ({ user, organizationId, currency, onChanged }) => {
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<LedgerTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<'live' | 'demo'>('demo');
  const [loading, setLoading] = useState(true);

  const role = financeRoleFor(user, organizationId);
  const canPost = role === 'approver';

  // SP8B-1: prefer live reads when Supabase is configured; fall back to the
  // local/demo adapter on any failure. Writes always stay local for now.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const filters = {
      organization_id: organizationId,
      kind: kind === 'all' ? null : (kind as never),
      status: status === 'all' ? null : (status as LedgerTransactionStatus),
      currency,
      page,
      limit: 10,
    };
    if (isSupabaseConfigured) {
      financialService.enableLiveSource(getFinancialReadRepository());
      financialService
        .fetchTransactionsLive(filters, user)
        .then((res) => {
          if (cancelled) return;
          setRows(res.rows);
          setTotal(res.total);
          setSource(res.source);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          const local = financialService.getTransactions(filters, user);
          setRows(local.rows);
          setTotal(local.total);
          setSource('demo');
          setLoading(false);
        });
    } else {
      financialService.enableLiveSource(null);
      const local = financialService.getTransactions(filters, user);
      setRows(local.rows);
      setTotal(local.total);
      setSource('demo');
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, currency, kind, status, page, user.id, tick]);

  const [detail, setDetail] = useState<ReturnType<typeof financialService.getTransactionDetail>>(null);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setDetail(null);
      return;
    }
    if (isSupabaseConfigured && financialService.isLiveSource()) {
      financialService.fetchTransactionDetailLive(selectedId, organizationId, user).then((d) => {
        if (!cancelled) setDetail(d);
      });
    } else {
      setDetail(financialService.getTransactionDetail(selectedId, user));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, organizationId, user.id, tick]);

  const totalPages = Math.max(1, Math.ceil(total / 10));

  const refresh = () => {
    setTick((v) => v + 1);
    onChanged();
  };

  const handlePost = async (id: string) => {
    setError(null);
    setSuccess(null);
    const res = await financialService.postJournal(id, user);
    if (!res.success) setError(res.error || 'Ghi sổ thất bại.');
    else {
      setSuccess(res.deduplicated ? 'Bút toán đã được ghi sổ trước đó (idempotency).' : 'Đã ghi sổ bút toán.');
      refresh();
    }
  };

  const handleReverse = async (id: string) => {
    setError(null);
    setSuccess(null);
    if (reverseReason.trim().length < 10) {
      setError('Lý do đảo bút toán tối thiểu 10 ký tự.');
      return;
    }
    const res = await financialService.reverseTransaction(id, user, reverseReason.trim());
    if (!res.success) setError(res.error || 'Đảo bút toán thất bại.');
    else {
      setSuccess('Đã đảo bút toán bằng bút toán đảo liên kết (bản gốc được giữ nguyên).');
      setReverseReason('');
      refresh();
    }
  };

  if (role === 'none') {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl" role="alert">
        <div className="text-sm font-semibold text-slate-200">Không có quyền xem sổ cái</div>
        <p className="text-xs text-slate-400 mt-1">Bạn không phải thành viên tổ chức này. Creator ngoài tổ chức không đọc được dữ liệu tài chính.</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-800 text-slate-300',
    pending: 'bg-amber-900/50 text-amber-300',
    posted: 'bg-emerald-900/50 text-emerald-300',
    reversed: 'bg-purple-900/50 text-purple-300',
    failed: 'bg-rose-900/50 text-rose-300',
    cancelled: 'bg-slate-900 text-slate-500',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" aria-label="Sổ cái">
      <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300" aria-label="Lọc loại bút toán">
            <option value="all">Mọi loại</option>
            <option value="liability_recognition">Ghi nhận nợ</option>
            <option value="payment_attestation">Attestation (ghi nhớ)</option>
            <option value="reversal">Đảo</option>
            <option value="adjustment">Điều chỉnh</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300" aria-label="Lọc trạng thái">
            <option value="all">Mọi trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="pending">Chờ ghi</option>
            <option value="posted">Đã ghi sổ</option>
            <option value="reversed">Đã đảo</option>
            <option value="failed">Lỗi</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <span className="ml-auto text-slate-500 font-mono">{total} bút toán • trang {page}/{totalPages}</span>
          <span
            title={source === 'live' ? 'Đọc từ Supabase staging (RLS thực thi ở server)' : 'Dữ liệu demo local — chưa nối Supabase'}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${source === 'live' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}
          >
            {source === 'live' ? 'LIVE' : 'DEMO'}
          </span>
        </div>

        {error && <div role="alert" className="p-2.5 text-xs bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-lg">{error}</div>}
        {success && <div role="status" className="p-2.5 text-xs bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-lg">{success}</div>}

        {loading ? (
          <div className="text-center py-8 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg" role="status">Đang tải sổ cái…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">Không có bút toán nào khớp bộ lọc.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${selectedId === t.id ? 'bg-indigo-950/40 border-indigo-700/60' : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{t.id.slice(0, 14)}…</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${statusColor[t.status]}`}>{t.status}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{t.kind}</span>
                    <span className="ml-auto text-sm font-mono font-semibold text-slate-200">{formatMinor(t.total_minor, t.currency)}</span>
                  </div>
                  {t.memo && <p className="mt-1 text-[11px] text-slate-500 truncate">{t.memo}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40">← Trước</button>
            <span className="text-slate-500 font-mono">{page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40">Sau →</button>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3" aria-label="Chi tiết bút toán" aria-live="polite">
        <h3 className="text-sm font-semibold text-slate-100">Chi tiết bút toán</h3>
        {!detail ? (
          <div className="text-sm text-slate-500">Chọn một bút toán để xem các dòng nợ/có và thao tác.</div>
        ) : (
          <>
            <dl className="text-xs space-y-1">
              <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Trạng thái</dt><dd className="font-mono text-slate-200">{detail.transaction.status}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Nguồn</dt><dd className="font-mono text-slate-400">{detail.transaction.source_type}:{detail.transaction.source_id?.slice(0, 12) ?? '—'}</dd></div>
              {detail.transaction.reverses_transaction_id && <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Đảo của</dt><dd className="font-mono text-purple-300">{detail.transaction.reverses_transaction_id.slice(0, 14)}…</dd></div>}
              {detail.transaction.idempotency_key && <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Idempotency</dt><dd className="font-mono text-slate-400">{detail.transaction.idempotency_key}</dd></div>}
            </dl>
            <ul className="space-y-1.5">
              {detail.entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-xs bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5">
                  <span>
                    <span className={`font-mono font-bold ${e.side === 'debit' ? 'text-sky-300' : 'text-amber-300'}`}>{e.side === 'debit' ? 'Nợ' : 'Có'}</span>{' '}
                    <span className="text-slate-300">{e.account_code}</span>
                    <span className="block text-[10px] text-slate-600">{e.account_name}</span>
                  </span>
                  <span className="font-mono text-slate-200">{formatMinor(e.amount_minor, e.currency)}</span>
                </li>
              ))}
            </ul>
            {(detail.transaction.status === 'draft' || detail.transaction.status === 'pending') && (
              <button
                onClick={() => handlePost(detail.transaction.id)}
                disabled={!canPost}
                title={canPost ? 'Ghi sổ (bất biến sau khi post)' : 'Chỉ chủ tổ chức/quản trị viên được ghi sổ'}
                className="w-full px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium"
              >
                Ghi sổ (Post) — bất biến sau khi ghi
              </button>
            )}
            {detail.transaction.status === 'posted' && (
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label htmlFor="reverse-reason" className="text-[11px] text-slate-400">Lý do đảo (≥10 ký tự, bản gốc được giữ nguyên)</label>
                <input
                  id="reverse-reason"
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="vd. Ghi nhận nhầm số tiền, đảo để lập lại…"
                  maxLength={500}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600"
                />
                <button
                  onClick={() => handleReverse(detail.transaction.id)}
                  disabled={!canPost}
                  title={canPost ? 'Đảo bằng bút toán đảo liên kết' : 'Chỉ chủ tổ chức/quản trị viên được đảo'}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium"
                >
                  Đảo bút toán (Reversal)
                </button>
              </div>
            )}
            {!canPost && <p className="text-[10px] text-slate-600">Bạn có quyền đọc. Ghi sổ/đảo cần quyền chủ tổ chức hoặc quản trị viên.</p>}
          </>
        )}
      </div>
    </div>
  );
};
