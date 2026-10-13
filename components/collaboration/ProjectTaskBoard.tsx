import React, { useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import type { TaskPriority, TaskStatus } from '../../types/collaboration.types';
import { collaborationService } from '../../lib/collaboration/collaborationService';

/**
 * Sprint 7 §4 — ProjectTaskBoard.
 * Kanban 5 cột (todo/in_progress/blocked/completed/cancelled), tạo/sửa/giao việc,
 * lọc theo người phụ trách + trạng thái + quá hạn (giờ thực), lịch sử thay đổi.
 */
interface Props {
  workspaceId: string;
  user: PulsarUser;
}

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: 'Cần làm', color: 'text-slate-300' },
  { key: 'in_progress', label: 'Đang làm', color: 'text-sky-300' },
  { key: 'blocked', label: 'Tắc nghẽn', color: 'text-rose-300' },
  { key: 'completed', label: 'Hoàn thành', color: 'text-emerald-300' },
  { key: 'cancelled', label: 'Đã hủy', color: 'text-slate-500' },
];

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: 'in_progress',
  in_progress: 'completed',
  blocked: 'in_progress',
};

export const ProjectTaskBoard: React.FC<Props> = ({ workspaceId, user }) => {
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);

  const membersRes = useMemo(
    () => collaborationService.getWorkspace(workspaceId, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, user.id, tick]
  );
  const members = membersRes.workspace?.members ?? [];

  const tasks = useMemo(
    () =>
      collaborationService.getTasks(workspaceId, user, {
        assignee_id: filterAssignee === 'all' ? 'all' : (filterAssignee as any),
        status: filterStatus === 'all' ? 'all' : (filterStatus as TaskStatus),
        overdueOnly,
        searchQuery: search || undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, user.id, tick, filterAssignee, filterStatus, overdueOnly, search]
  );

  const history = historyTaskId
    ? collaborationService.getTaskHistory(workspaceId, historyTaskId, user)
    : [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (title.trim().length < 3) {
      setError('Tiêu đề nhiệm vụ tối thiểu 3 ký tự.');
      return;
    }
    const res = await collaborationService.createTask(
      workspaceId,
      {
        title: title.trim(),
        description: '',
        priority,
        assignee_id: assignee || null,
        due_date: due ? new Date(due).toISOString() : null,
      },
      user
    );
    if (!res.success) setError(res.error || 'Tạo nhiệm vụ thất bại.');
    else {
      setSuccess(`Đã tạo nhiệm vụ "${res.task?.title}".`);
      setTitle('');
      setDue('');
      setAssignee('');
      setTick((v) => v + 1);
    }
  };

  const advance = (taskId: string, from: TaskStatus) => {
    const next = NEXT_STATUS[from];
    if (!next) return;
    const res = collaborationService.updateTaskStatus(workspaceId, taskId, next, user);
    if (!res.success) setError(res.error || 'Cập nhật thất bại.');
    else {
      setSuccess(null);
      setTick((v) => v + 1);
    }
  };

  const block = (taskId: string) => {
    const res = collaborationService.updateTaskStatus(workspaceId, taskId, 'blocked', user);
    if (!res.success) setError(res.error || 'Cập nhật thất bại.');
    else setTick((v) => v + 1);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4" aria-label="Bảng nhiệm vụ dự án">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Bảng nhiệm vụ ({tasks.length})</h3>
          <p className="text-[11px] text-slate-500">Quá hạn tính theo giờ thực • Chỉ thành viên mới tạo/sửa • Người ngoài workspace bị chặn</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300"
            aria-label="Lọc theo trạng thái"
          >
            <option value="all">Mọi trạng thái</option>
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300"
            aria-label="Lọc theo người phụ trách"
          >
            <option value="all">Mọi người</option>
            <option value="unassigned">Chưa giao</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="accent-rose-500" />
            Quá hạn
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm…"
            className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 placeholder:text-slate-600"
            aria-label="Tìm kiếm nhiệm vụ"
          />
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

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề nhiệm vụ mới…"
          maxLength={150}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600 lg:col-span-2"
          aria-label="Tiêu đề nhiệm vụ"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="px-2 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
          aria-label="Mức ưu tiên"
        >
          <option value="low">Thấp</option>
          <option value="medium">Trung bình</option>
          <option value="high">Cao</option>
          <option value="urgent">Khẩn cấp</option>
        </select>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
          aria-label="Giao cho thành viên"
        >
          <option value="">Chưa giao</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
            aria-label="Hạn hoàn thành"
          />
          <button type="submit" className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
            Tạo
          </button>
        </div>
      </form>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">
          Không có nhiệm vụ nào khớp bộ lọc.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 space-y-2 min-h-[120px]">
                <div className={`text-xs font-semibold ${col.color}`}>
                  {col.label} <span className="font-mono text-slate-500">({colTasks.length})</span>
                </div>
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                      t.is_overdue ? 'bg-rose-950/30 border-rose-800/60' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="font-medium text-slate-200 leading-snug">{t.title}</div>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{t.priority}</span>
                      {t.due_date && (
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono ${
                            t.is_overdue ? 'bg-rose-900/60 text-rose-300' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {t.is_overdue ? '⚠ Quá hạn ' : ''}
                          {new Date(t.due_date).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {t.assignee_id ? `Phụ trách: ${members.find((m) => m.user_id === t.assignee_id)?.name ?? t.assignee_id}` : 'Chưa giao'}
                    </div>
                    <div className="flex gap-1 pt-1">
                      {NEXT_STATUS[t.status] && (
                        <button
                          onClick={() => advance(t.id, t.status)}
                          className="px-2 py-1 text-[10px] rounded bg-emerald-900/50 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900"
                        >
                          {t.status === 'todo' ? 'Bắt đầu →' : t.status === 'blocked' ? 'Gỡ tắc →' : 'Hoàn thành →'}
                        </button>
                      )}
                      {(t.status === 'todo' || t.status === 'in_progress') && (
                        <button
                          onClick={() => block(t.id)}
                          className="px-2 py-1 text-[10px] rounded bg-rose-900/40 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60"
                        >
                          Tắc nghẽn
                        </button>
                      )}
                      <button
                        onClick={() => setHistoryTaskId(historyTaskId === t.id ? null : t.id)}
                        className="px-2 py-1 text-[10px] rounded bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200"
                      >
                        Lịch sử
                      </button>
                    </div>
                    {historyTaskId === t.id && (
                      <div className="pt-1 border-t border-slate-800 mt-1">
                        {history.length === 0 ? (
                          <div className="text-[10px] text-slate-600">Chưa có lịch sử chuyển trạng thái.</div>
                        ) : (
                          <ul className="space-y-1">
                            {history.map((h) => (
                              <li key={h.id} className="text-[10px] text-slate-500">
                                {h.previous_status ?? '—'} → <span className="text-slate-300">{h.new_status}</span> •{' '}
                                {new Date(h.created_at).toLocaleString('vi-VN')}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
