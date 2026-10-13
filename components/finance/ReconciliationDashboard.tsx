import React, { useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import { reconciliationService } from '../../lib/finance/reconciliationService';
import { financeRoleFor } from '../../lib/finance/financialService';
import { formatMinor } from '../../lib/finance/money';

interface Props {
  user: PulsarUser;
  organizationId: string;
  onChanged: () => void;
}

export const ReconciliationDashboard: React.FC<Props> = ({ user, organizationId, onChanged }) => {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);

  const runs = useMemo(
    () => reconciliationService.getRuns(user, organizationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.id, organizationId, tick]
  );
  const openIssues = useMemo(
    () => reconciliationService.getOpenIssues(user, organizationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.id, organizationId, tick, runs.length]
  );
  const selectedItems = selectedRunId ? reconciliationService.getRunItems(selectedRunId, user) : [];

  const canRun = financeRoleFor(user, organizationId) !== 'none';
  const canResolve = financeRoleFor(user, organizationId) === 'approver';

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setSuccess(null);
    const res = await reconciliationService.runReconciliation(organizationId, user);
    setRunning(false);
    if (!res.success || !res.run) {
      setError(res.error || 'Đối soát thất bại.');
      return;
    }
    setSelectedRunId(res.run.id);
    setSuccess(
      `Hoàn tất: ${res.run.rewards_examined} rewards, ${res.run.transactions_examined} bút toán, ${res.run.payments_examined} payments — ${res.run.issues_open} mở / ${res.run.issues_resolved} đã xử lý. Chỉ đọc, không tạo bút toán.`
    );
    setTick((v) => v + 1);
    onChanged();
  };

  const handleResolve = (itemId: string, state: 'resolved' | 'acknowledged') => {
    const res = reconciliationService.resolveItem(itemId, state, noteMap[itemId] || '', user);
    if (!res.success) setError(res.error || 'Xử lý thất bại.');
    else {
      setError(null);
      setTick((v) => v + 1);
      onChanged();
    }
  };

  const sevColor: Record<string, string> = {
    critical: 'bg-rose-900/50 text-rose-300 border border-rose-800/60',
    warning: 'bg-amber-900/50 text-amber-300 border border-amber-800/60',
    info: 'bg-sky-900/50 text-sky-300 border border-sky-800/60',
  };

  return (
    <div className="space-y-4" aria-label="Đối soát">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Đối soát (read-only)</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            So sánh reward SP4 ↔ sổ cái ↔ payment records. Chạy lặp không tạo trùng. Không tự sửa mismatch.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running || !canRun}
          className="px-4 py-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium self-start"
        >
          {running ? 'Đang đối soát…' : 'Chạy đối soát'}
        </button>
      </div>

      {error && <div role="alert" className="p-2.5 text-xs bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-lg">{error}</div>}
      {success && <div role="status" className="p-2.5 text-xs bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-lg">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-200">Các lần chạy ({runs.length})</h4>
          {runs.length === 0 ? (
            <div className="text-xs text-slate-500">Chưa có lần chạy nào. Nhấn "Chạy đối soát".</div>
          ) : (
            <ul className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {runs.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedRunId(r.id === selectedRunId ? null : r.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs ${selectedRunId === r.id ? 'bg-indigo-950/40 border-indigo-700/60' : 'bg-slate-950/70 border-slate-800'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400">{r.id.slice(0, 12)}…</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${r.status === 'completed' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      R:{r.rewards_examined} T:{r.transactions_examined} P:{r.payments_examined} • mở {r.issues_open} • {new Date(r.finished_at).toLocaleString('vi-VN')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-2 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-200">Hàng đợi bất thường mở ({openIssues.length})</h4>
            <p className="text-[10px] text-slate-600">Trạng thái mới nhất theo fingerprint (không trùng lặp giữa các lần chạy).</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-200">
            {selectedRunId ? `Chi tiết lần chạy ${selectedRunId.slice(0, 12)}… (${selectedItems.length})` : 'Chọn một lần chạy để xem discrepancies'}
          </h4>
          {!selectedRunId ? (
            <div className="text-xs text-slate-500">Chưa chọn lần chạy.</div>
          ) : selectedItems.length === 0 ? (
            <div className="text-center py-6 text-sm text-emerald-300 bg-emerald-950/20 border border-emerald-900/40 rounded-lg">
              Không phát hiện bất thường — sổ cái khớp rewards và payments trong phạm vi đã xét.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto">
              {selectedItems.map((it) => (
                <li key={it.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-violet-300">{it.code}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${sevColor[it.severity]}`}>{it.severity}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${it.state === 'open' ? 'bg-rose-950/60 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>{it.state}</span>
                    {it.currency && <span className="text-[10px] font-mono text-slate-500">{it.currency}</span>}
                  </div>
                  <p className="text-xs text-slate-300">{it.detail}</p>
                  <div className="text-[10px] font-mono text-slate-600">
                    {it.expected_minor != null && <>kỳ vọng {formatMinor(it.expected_minor, it.currency ?? 'USD')} • </>}
                    {it.actual_minor != null && <>thực tế {formatMinor(it.actual_minor, it.currency ?? 'USD')} • </>}
                    {it.reward_id && <>reward:{it.reward_id.slice(0, 8)}… </>}
                    {it.transaction_id && <>txn:{it.transaction_id.slice(0, 8)}… </>}
                    {it.payment_id && <>pay:{it.payment_id.slice(0, 8)}…</>}
                  </div>
                  {it.state === 'open' && (
                    <div className="flex flex-col sm:flex-row gap-1.5 pt-1">
                      <input
                        value={noteMap[it.id] || ''}
                        onChange={(e) => setNoteMap((m) => ({ ...m, [it.id]: e.target.value }))}
                        placeholder="Ghi chú xử lý…"
                        maxLength={500}
                        className="flex-1 px-2 py-1.5 text-[11px] rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600"
                        aria-label={`Ghi chú cho ${it.code}`}
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleResolve(it.id, 'acknowledged')}
                          className="px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          Ghi nhận
                        </button>
                        <button
                          onClick={() => handleResolve(it.id, 'resolved')}
                          disabled={!canResolve}
                          title={canResolve ? 'Đóng discrepancy (không tự sửa số liệu)' : 'Chỉ chủ tổ chức/quản trị viên được đóng'}
                          className="px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-900/50 text-emerald-300 border border-emerald-800/60 disabled:opacity-40"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
