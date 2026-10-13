import React, { useEffect, useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import { financialService } from '../../lib/finance/financialService';
import { FinancialOverview } from './FinancialOverview';
import { LedgerExplorer } from './LedgerExplorer';
import { ReconciliationDashboard } from './ReconciliationDashboard';
import { AdjustmentReviewPanel } from './AdjustmentReviewPanel';
import { FinancialAuditTimeline } from './FinancialAuditTimeline';

/**
 * SP8A §8 — FinancialOperations area.
 * Tab "Tài Chính" — demo/local bookkeeping data only (seeded, labelled).
 * No real-money activity; no payment provider connected.
 */
interface Props {
  user: PulsarUser | null;
}

type SubTab = 'overview' | 'ledger' | 'recon' | 'adjust' | 'audit';

export const FinancialOperations: React.FC<Props> = ({ user }) => {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [orgId, setOrgId] = useState<string>('org-tech-01');
  const [currency, setCurrency] = useState<'USD' | 'VND' | 'EUR'>('USD');
  const [tick, setTick] = useState(0);

  const userOrgs = useMemo(() => (user?.organizations ?? []).map((m) => m.organization), [user]);
  const orgOptions = useMemo(() => {
    const map = new Map(userOrgs.map((o) => [o.id, o.name]));
    if (!map.has('org-tech-01')) map.set('org-tech-01', 'Việt Nam Tech Hub (demo)');
    return [...map.entries()];
  }, [userOrgs]);

  useEffect(() => {
    if (user) {
      try {
        financialService._seedDemo(user);
      } catch {
        /* seed is best-effort */
      }
      setTick((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-200">Đăng nhập để xem Tài chính</h3>
        <p className="text-sm text-slate-400 mt-1">Sổ cái tài chính chỉ hiển thị cho thành viên tổ chức và quản trị viên.</p>
      </div>
    );
  }

  const tabs: Array<{ key: SubTab; label: string }> = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'ledger', label: 'Sổ cái' },
    { key: 'recon', label: 'Đối soát' },
    { key: 'adjust', label: 'Điều chỉnh' },
    { key: 'audit', label: 'Kiểm toán' },
  ];

  return (
    <div className="space-y-4" aria-label="Điều hành tài chính">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Điều hành tài chính (SP8A)</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Sổ cái kép ghi nhớ nội bộ • Nhãn <span className="font-mono">LIVE</span> = đọc từ Supabase (RLS server), <span className="font-mono">DEMO</span> = dữ liệu local — không phải hoạt động tiền thật, không kết nối cổng thanh toán.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-slate-500" htmlFor="fin-org">Tổ chức</label>
          <select
            id="fin-org"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
          >
            {orgOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <label className="text-slate-500" htmlFor="fin-ccy">Tiền tệ</label>
          <select
            id="fin-ccy"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as 'USD' | 'VND' | 'EUR')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono"
          >
            <option value="USD">USD</option>
            <option value="VND">VND</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Chế độ xem tài chính">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={subTab === t.key}
            onClick={() => setSubTab(t.key)}
            className={`shrink-0 px-3.5 py-1.5 text-xs rounded-lg border transition ${
              subTab === t.key ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && <FinancialOverview user={user} organizationId={orgId} currency={currency} refreshTick={tick} />}
      {subTab === 'ledger' && <LedgerExplorer user={user} organizationId={orgId} currency={currency} onChanged={() => setTick((v) => v + 1)} />}
      {subTab === 'recon' && <ReconciliationDashboard user={user} organizationId={orgId} onChanged={() => setTick((v) => v + 1)} />}
      {subTab === 'adjust' && <AdjustmentReviewPanel user={user} organizationId={orgId} currency={currency} onChanged={() => setTick((v) => v + 1)} />}
      {subTab === 'audit' && <FinancialAuditTimeline user={user} organizationId={orgId} refreshTick={tick} />}
    </div>
  );
};
