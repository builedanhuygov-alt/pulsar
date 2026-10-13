import React, { useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import { collaborationService } from '../../lib/collaboration/collaborationService';

/**
 * Sprint 7 §5a — MilestoneTimeline.
 * Dòng thời gian các mốc bàn giao, đếm ngược deadline, trạng thái, deliverables đính kèm.
 */
interface Props {
  workspaceId: string;
  user: PulsarUser;
}

function dueLabel(due: string | null): string {
  if (!due) return 'Chưa đặt hạn';
  const diff = new Date(due).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Đến hạn hôm nay';
  return `Còn ${days} ngày`;
}

export const MilestoneTimeline: React.FC<Props> = ({ workspaceId, user }) => {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const milestones = useMemo(
    () => collaborationService.getMilestones(workspaceId, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, user.id, tick]
  );
  const role = collaborationService.getMemberRole(workspaceId, user.id);
  const canManage = role === 'owner' || role === 'reviewer' || role === 'admin' || user.role === 'admin';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (title.trim().length < 3) {
      setError('Tiêu đề mốc tối thiểu 3 ký tự.');
      return;
    }
    const res = await collaborationService.createMilestone(
      workspaceId,
      {
        title: title.trim(),
        description: '',
        due_date: due ? new Date(due).toISOString() : null,
        order_index: milestones.length + 1,
      },
      user
    );
    if (!res.success) setError(res.error || 'Tạo milestone thất bại.');
    else {
      setSuccess(`Đã thiết lập mốc "${res.milestone?.title}".`);
      setTitle('');
      setDue('');
      setTick((v) => v + 1);
    }
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-slate-800 text-slate-400',
    in_progress: 'bg-sky-900/50 text-sky-300 border border-sky-800/60',
    submitted: 'bg-amber-900/50 text-amber-300 border border-amber-800/60',
    completed: 'bg-emerald-900/50 text-emerald-300 border border-emerald-800/60',
    cancelled: 'bg-slate-900 text-slate-600 border border-slate-800',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4" aria-label="Dòng thời gian milestones">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Mốc bàn giao ({milestones.length})</h3>
          <p className="text-[11px] text-slate-500">Chỉ Owner/Reviewer được thiết lập mốc • Nghiệm thu tách khỏi thanh toán/outcome</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-2.5 text-xs bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="p-2.5 text-xs bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-lg">
          {success}
        </div>
      )}

      {canManage && (
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tên mốc mới… (vd. Milestone 4: Triển khai staging)"
            maxLength={150}
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600"
            aria-label="Tên milestone"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
            aria-label="Hạn milestone"
          />
          <button type="submit" className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
            Thiết lập
          </button>
        </form>
      )}

      {milestones.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">
          Chưa có mốc bàn giao nào.
        </div>
      ) : (
        <ol className="relative border-l border-slate-800 ml-2 space-y-4">
          {milestones.map((ms, idx) => {
            const overdue = ms.due_date ? new Date(ms.due_date).getTime() < Date.now() && ms.status !== 'completed' && ms.status !== 'cancelled' : false;
            return (
              <li key={ms.id} className="ml-4">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-950" aria-hidden />
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">M{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-200">{ms.title}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${statusColor[ms.status] ?? statusColor.pending}`}>
                      {ms.status}
                    </span>
                  </div>
                  {ms.description && <p className="text-xs text-slate-400">{ms.description}</p>}
                  <div className={`text-[11px] font-mono ${overdue ? 'text-rose-400' : 'text-slate-500'}`}>
                    {overdue ? '⚠ ' : ''}{dueLabel(ms.due_date)}
                    {ms.due_date ? ` • ${new Date(ms.due_date).toLocaleDateString('vi-VN')}` : ''}
                  </div>
                  {ms.deliverables.length > 0 && (
                    <ul className="pt-1 space-y-1">
                      {ms.deliverables.map((d) => (
                        <li key={d.id} className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">v{d.version ?? 1}</span>
                          <a href={d.url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
                            {d.title}
                          </a>
                          {d.status && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{d.status}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
