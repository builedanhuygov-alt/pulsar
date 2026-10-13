import React, { useEffect, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import type { CurrencyCode, FinancialSummary } from '../../types/finance.types';
import { financialService } from '../../lib/finance/financialService';
import { reconciliationService } from '../../lib/finance/reconciliationService';
import { formatMinor } from '../../lib/finance/money';

interface Props {
  user: PulsarUser;
  organizationId: string;
  currency: CurrencyCode;
  refreshTick: number;
}

/** Each bucket has a distinct, documented meaning — never conflate them. */
export const FinancialOverview: React.FC<Props> = ({ user, organizationId, currency, refreshTick }) => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [unresolved, setUnresolved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    financialService
      .getSummary(organizationId, currency, user)
      .then((s) => {
        if (cancelled) return;
        setSummary(s);
        try {
          setUnresolved(reconciliationService.getOpenIssues(user, organizationId).length);
        } catch {
          setUnresolved(0);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || 'Không tải được tổng quan.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, organizationId, currency, refreshTick]);

  if (loading) return <div className="p-6 text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl" role="status">Đang tải số liệu…</div>;
  if (error || !summary) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl" role="alert">
        <div className="text-sm font-semibold text-slate-200">Không có quyền xem</div>
        <p className="text-xs text-slate-400 mt-1">{error ?? 'Tài chính chỉ hiển thị cho thành viên tổ chức và quản trị viên.'}</p>
      </div>
    );
  }

  const cards: Array<{ label: string; value: number; meaning: string; accent: string }> = [
    { label: 'Ngân sách dự kiến', value: summary.planned_budget_minor, meaning: 'Ước tính prize_pool — KHÔNG phải nợ phải trả.', accent: 'text-slate-300' },
    { label: 'Thưởng đã duyệt', value: summary.approved_rewards_minor, meaning: 'Reward approved/processing/paid theo SP4 (đã bao gồm attested).', accent: 'text-sky-300' },
    { label: 'Nợ phải trả còn lại', value: summary.payable_outstanding_minor, meaning: 'Số dư Có ròng trên REWARD_PAYABLE — số tiền được ghi nhận còn nợ.', accent: 'text-amber-300' },
    { label: 'Chờ thanh toán', value: summary.pending_payment_minor, meaning: 'SP4 paid nhưng thiếu (một phần) chứng từ có thẩm quyền.', accent: 'text-orange-300' },
    { label: 'Đã xác minh thanh toán', value: summary.verified_paid_minor, meaning: 'Chỉ phần có payment record đối ứng. Không đồng nghĩa tiền đã đến tay.', accent: 'text-emerald-300' },
    { label: 'Bất thường chưa xử lý', value: unresolved, meaning: 'Discrepancy mở từ đối soát gần nhất.', accent: unresolved > 0 ? 'text-rose-300' : 'text-slate-400' },
  ];

  return (
    <div className="space-y-3" aria-label="Tổng quan tài chính">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{c.label}</div>
            <div className={`mt-1 text-xl font-bold font-mono ${c.accent}`}>
              {c.label === 'Bất thường chưa xử lý' ? c.value : formatMinor(c.value, currency)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 leading-snug">{c.meaning}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-600">
        Số liệu demo local ({currency}) • Ngân sách ≠ thưởng duyệt ≠ nợ phải trả ≠ tiền đã xác minh. Không gộp nhiều tiền tệ khi chưa có chính sách chuyển đổi.
      </p>
    </div>
  );
};
