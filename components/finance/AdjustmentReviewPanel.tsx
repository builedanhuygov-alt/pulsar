import React, { useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import type { CurrencyCode } from '../../types/finance.types';
import { financialService, financeRoleFor } from '../../lib/finance/financialService';
import { formatMinor, parseMajorToMinor } from '../../lib/finance/money';

interface Props {
  user: PulsarUser;
  organizationId: string;
  currency: CurrencyCode;
  onChanged: () => void;
}

export const AdjustmentReviewPanel: React.FC<Props> = ({ user, organizationId, currency, onChanged }) => {
  const [reason, setReason] = useState('');
  const [amountMajor, setAmountMajor] = useState('');
  const [targetTxn, setTargetTxn] = useState('');
  const [reviewNoteMap, setReviewNoteMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const role = financeRoleFor(user, organizationId);
  const canDraft = role === 'approver';

  const adjustments = useMemo(
    () => financialService.getAdjustments(organizationId, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, user.id, tick]
  );
  const accounts = useMemo(
    () => financialService.ensureAccounts(organizationId, currency),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, currency, user.id]
  );

  const refresh = () => {
    setTick((v) => v + 1);
    onChanged();
  };

  const handleDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    let minor = 0;
    try {
      minor = parseMajorToMinor(amountMajor, currency);
    } catch (err: unknown) {
      setError((err as Error).message);
      return;
    }
    const expense = accounts.find((a) => a.code === 'CHALLENGE_EXPENSE');
    const contra = accounts.find((a) => a.code === 'ADJUSTMENT_CONTRA');
    if (!expense || !contra) {
      setError('Thiếu tài khoản sổ cái cho tổ chức/tiền tệ này.');
      return;
    }
    const res = await financialService.draftAdjustment(
      {
        organization_id: organizationId,
        target_transaction_id: targetTxn.trim() || null,
        reason: reason.trim(),
        currency,
        lines: [
          { account_id: expense.id, side: 'debit', amount_minor: minor, currency },
          { account_id: contra.id, side: 'credit', amount_minor: minor, currency },
        ],
      },
      user
    );
    if (!res.success) setError(res.error || 'Lập điều chỉnh thất bại.');
    else {
      setSuccess(`Đã lập điều chỉnh nháp ${res.adjustment?.id.slice(0, 12)}… — cần người khác duyệt (SoD).`);
      setReason('');
      setAmountMajor('');
      setTargetTxn('');
      refresh();
    }
  };

  const act = async (id: string, fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    setError(null);
    setSuccess(null);
    const res = await fn();
    if (!res.success) setError(res.error || 'Thao tác thất bại.');
    else {
      setSuccess(okMsg);
      refresh();
    }
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-800 text-slate-300',
    pending_review: 'bg-amber-900/50 text-amber-300',
    approved: 'bg-sky-900/50 text-sky-300',
    posted: 'bg-emerald-900/50 text-emerald-300',
    rejected: 'bg-rose-900/50 text-rose-300',
    cancelled: 'bg-slate-900 text-slate-500',
  };

  if (role === 'none') {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl" role="alert">
        <div className="text-sm font-semibold text-slate-200">Không có quyền điều chỉnh</div>
        <p className="text-xs text-slate-400 mt-1">Chỉ thành viên tổ chức và quản trị viên được xem/phê duyệt điều chỉnh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-label="Điều chỉnh tài chính">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Lập điều chỉnh (ghi nhận, không chuyển tiền)</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Người lập không được tự duyệt (SoD) • Bút toán gốc được giữ nguyên, đảo bằng bút toán liên kết • Chỉ chủ tổ chức/quản trị viên lập/duyệt.
          </p>
        </div>
        {error && <div role="alert" className="p-2.5 text-xs bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-lg">{error}</div>}
        {success && <div role="status" className="p-2.5 text-xs bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-lg">{success}</div>}
        <form onSubmit={handleDraft} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do (≥10 ký tự)"
            maxLength={1000}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 lg:col-span-2"
            aria-label="Lý do điều chỉnh"
          />
          <input
            value={amountMajor}
            onChange={(e) => setAmountMajor(e.target.value)}
            placeholder={`Số tiền (${currency})`}
            inputMode="decimal"
            className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 font-mono"
            aria-label="Số tiền điều chỉnh"
          />
          <div className="flex gap-2">
            <input
              value={targetTxn}
              onChange={(e) => setTargetTxn(e.target.value)}
              placeholder="ID bút toán gốc (tùy chọn)"
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 font-mono"
              aria-label="Bút toán gốc"
            />
            <button type="submit" disabled={!canDraft} className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium">
              Lập nháp
            </button>
          </div>
        </form>
        {!canDraft && <p className="text-[10px] text-slate-600">Bạn có quyền đọc. Lập/duyệt cần quyền chủ tổ chức hoặc quản trị viên.</p>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-100">Hàng đợi duyệt ({adjustments.length})</h3>
        {adjustments.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">Chưa có điều chỉnh nào.</div>
        ) : (
          <ul className="space-y-2">
            {adjustments.map((a) => {
              const isOwn = a.created_by === user.id;
              const lines = financialService.getAdjustmentLines(a.id, user);
              return (
                <li key={a.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-mono text-slate-400">{a.id.slice(0, 14)}…</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${statusColor[a.status]}`}>{a.status}</span>
                    <span className="text-[10px] font-mono text-slate-500">{a.proposed_currency}</span>
                    {a.target_transaction_id && <span className="text-[10px] font-mono text-purple-300">→ đảo {a.target_transaction_id.slice(0, 8)}…</span>}
                  </div>
                  <p className="text-xs text-slate-300">{a.reason}</p>
                  <div className="text-[11px] font-mono text-slate-500">
                    {lines.map((l) => `${l.side === 'debit' ? 'Nợ' : 'Có'} ${formatMinor(l.amount_minor, a.proposed_currency)}`).join(' • ')}
                  </div>
                  {a.status === 'draft' && (
                    <button onClick={() => act(a.id, () => financialService.submitAdjustment(a.id, user), 'Đã trình duyệt.')} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-sky-900/50 text-sky-300 border border-sky-800/60">
                      Trình duyệt
                    </button>
                  )}
                  {a.status === 'pending_review' && (
                    <div className="flex flex-col sm:flex-row gap-1.5">
                      <input
                        value={reviewNoteMap[a.id] || ''}
                        onChange={(e) => setReviewNoteMap((m) => ({ ...m, [a.id]: e.target.value }))}
                        placeholder="Ghi chú duyệt…"
                        maxLength={500}
                        className="flex-1 px-2 py-1.5 text-[11px] rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600"
                        aria-label={`Ghi chú duyệt ${a.id.slice(0, 8)}`}
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => act(a.id, () => financialService.reviewAdjustment(a.id, 'approve', user, reviewNoteMap[a.id]), 'Đã duyệt điều chỉnh.')}
                          disabled={isOwn}
                          title={isOwn ? 'Bạn là người lập — không được tự duyệt (SoD)' : 'Duyệt'}
                          className="px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-900/50 text-emerald-300 border border-emerald-800/60 disabled:opacity-40"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => act(a.id, () => financialService.reviewAdjustment(a.id, 'reject', user, reviewNoteMap[a.id]), 'Đã từ chối điều chỉnh.')}
                          disabled={isOwn}
                          title={isOwn ? 'Bạn là người lập — không được tự duyệt (SoD)' : 'Từ chối'}
                          className="px-2.5 py-1.5 text-[11px] rounded-lg bg-rose-900/50 text-rose-300 border border-rose-800/60 disabled:opacity-40"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  )}
                  {a.status === 'approved' && (
                    <button onClick={() => act(a.id, async () => { const r = await financialService.postAdjustment(a.id, user); return { success: r.success, error: r.error }; }, 'Đã ghi sổ điều chỉnh (đảo + bút toán hiệu chỉnh).')} className="px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">
                      Ghi sổ điều chỉnh
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
