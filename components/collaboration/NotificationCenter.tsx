import React, { useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import { notificationService } from '../../lib/collaboration/notificationService';

/**
 * Sprint 7 §6 — NotificationCenter.
 * Chỉ hiển thị thông báo của người nhận (strict isolation), body chung chung
 * không chứa dữ liệu bí mật, làm mới thủ công (không claim realtime/email/push).
 */
interface Props {
  user: PulsarUser;
}

export const NotificationCenter: React.FC<Props> = ({ user }) => {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const notifications = useMemo(
    () => notificationService.listForRecipient(user, { unreadOnly }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.id, unreadOnly, tick]
  );
  const unread = useMemo(() => notificationService.unreadCount(user), [user.id, tick, notifications]);

  const markOne = (id: string) => {
    const res = notificationService.markRead(id, user);
    if (!res.success) setError(res.error || 'Đánh dấu thất bại.');
    else {
      setError(null);
      setTick((v) => v + 1);
    }
  };

  const markAll = () => {
    notificationService.markAllRead(user);
    setTick((v) => v + 1);
  };

  const typeLabel: Record<string, string> = {
    new_message: 'Tin nhắn mới',
    workspace_invitation: 'Mời workspace',
    task_assigned: 'Giao việc',
    task_deadline_changed: 'Đổi deadline',
    deliverable_reviewed: 'Duyệt bàn giao',
    milestone_due_soon: 'Sắp đến hạn',
    revision_requested: 'Yêu cầu sửa',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4" aria-label="Trung tâm thông báo">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Thông báo {unread > 0 && <span className="ml-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-600 text-white">{unread} chưa đọc</span>}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Chỉ bạn xem được • Nội dung tóm tắt, không chứa dữ liệu bí mật • Không có email/push realtime</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="accent-indigo-500" />
            Chưa đọc
          </label>
          <button onClick={markAll} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
            Đọc hết
          </button>
          <button onClick={() => setTick((v) => v + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-2.5 text-xs bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-lg">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">
          {unreadOnly ? 'Không có thông báo chưa đọc. Bỏ lọc để xem tất cả.' : 'Chưa có thông báo nào.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`p-3 rounded-lg border text-sm ${n.read_at ? 'bg-slate-950/60 border-slate-800' : 'bg-indigo-950/30 border-indigo-800/50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-violet-300">
                    {typeLabel[n.type] ?? n.type}
                  </span>
                  <div className="mt-1 font-medium text-slate-200 text-[13px]">{n.title}</div>
                  <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                  <div className="text-[10px] text-slate-600 font-mono mt-1">
                    {n.entity_type}:{n.entity_id.slice(0, 12)}… • {new Date(n.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                {!n.read_at && (
                  <button
                    onClick={() => markOne(n.id)}
                    className="shrink-0 px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:text-white"
                  >
                    Đánh dấu đọc
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
