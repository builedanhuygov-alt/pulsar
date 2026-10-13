import React, { useEffect, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import type { FinancialAuditEvent } from '../../types/finance.types';
import { financialService } from '../../lib/finance/financialService';

interface Props {
  user: PulsarUser;
  organizationId: string;
  refreshTick: number;
}

export const FinancialAuditTimeline: React.FC<Props> = ({ user, organizationId, refreshTick }) => {
  const [events, setEvents] = useState<FinancialAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      setEvents(financialService.getAuditEvents(organizationId, user, 50));
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, [user, organizationId, refreshTick]);

  if (loading) return <div className="p-6 text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl" role="status">Đang tải nhật ký…</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2" aria-label="Nhật ký kiểm toán tài chính">
      <h3 className="text-sm font-semibold text-slate-100">Nhật ký kiểm toán ({events.length})</h3>
      {events.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">Chưa có sự kiện kiểm toán nào trong phạm vi này.</div>
      ) : (
        <ol className="relative border-l border-slate-800 ml-2 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="ml-4">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-teal-500 ring-4 ring-slate-950" aria-hidden />
              <div className="text-xs bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                <span className="font-mono text-teal-300">{e.action}</span>{' '}
                <span className="text-slate-300">{e.detail}</span>
                <span className="block text-[10px] text-slate-600 font-mono mt-0.5">
                  {e.entity_type}:{e.entity_id.slice(0, 12)}… • {new Date(e.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
