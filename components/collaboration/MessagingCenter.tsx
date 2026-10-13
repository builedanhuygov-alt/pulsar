import React, { useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';

/**
 * Sprint 7 §3 — MessagingCenter.
 * Polling thủ công có giới hạn (mặc định TẮT auto-refresh; nút "Làm mới" + toggle poll 15s).
 * Không giả vờ realtime. Phân trang, read receipts, idempotency chống gửi trùng khi retry.
 */
import { collaborationService } from '../../lib/collaboration/collaborationService';

interface Props {
  workspaceId: string;
  user: PulsarUser;
  workspaceName?: string;
}

const PAGE_SIZE = 20;

export const MessagingCenter: React.FC<Props> = ({ workspaceId, user, workspaceName }) => {
  const [page, setPage] = useState(1);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [autoPoll, setAutoPoll] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  // Manual bounded polling (15s) — explicit opt-in, labelled as polling.
  React.useEffect(() => {
    if (!autoPoll) return;
    const t = setInterval(() => setRefreshTick((v) => v + 1), 15000);
    return () => clearInterval(t);
  }, [autoPoll, workspaceId]);

  // Keep hook order stable: compute query (memoized on refreshTick/page/workspace).
  const query = React.useMemo(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    () => collaborationService.getMessages(workspaceId, user, { page, limit: PAGE_SIZE }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, user.id, page, refreshTick]
  );

  React.useEffect(() => {
    setLastRefreshAt(new Date().toISOString());
  }, [refreshTick, page, workspaceId]);

  const totalPages = query.totalPages ?? 1;
  const messages = query.messages ?? [];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Nội dung tin nhắn không được để trống.');
      return;
    }
    if (trimmed.length > 2000) {
      setError('Nội dung tin nhắn tối đa 2000 ký tự.');
      return;
    }
    setSending(true);
    try {
      // Idempotency key per send attempt — retry reuses same key, no duplicates.
      const idempotency_key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? (crypto as any).randomUUID()
          : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await collaborationService.sendMessage(
        workspaceId,
        { content: trimmed, message_type: 'text', idempotency_key },
        user
      );
      if (!res.success) {
        setError(res.error || 'Gửi tin nhắn thất bại.');
      } else {
        setContent('');
        setSuccess(res.deduplicated ? 'Tin nhắn đã gửi trước đó (chống trùng lặp).' : 'Đã gửi tin nhắn.');
        setRefreshTick((v) => v + 1);
      }
    } catch (err: any) {
      setError(err.message || 'Gửi tin nhắn thất bại.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4" aria-label="Trung tâm tin nhắn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Hội thoại {workspaceName ? `— ${workspaceName}` : ''}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {query.success ? (
              <>Tổng {query.total ?? 0} tin nhắn • Trang {page}/{totalPages} • </>
            ) : null}
            Chế độ: <span className="text-amber-400 font-medium">polling thủ công (không phải realtime)</span>
            {lastRefreshAt ? <> • Cập nhật: {new Date(lastRefreshAt).toLocaleTimeString('vi-VN')}</> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPoll}
              onChange={(e) => setAutoPoll(e.target.checked)}
              className="accent-indigo-500"
              aria-label="Tự động làm mới mỗi 15 giây"
            />
            Tự làm mới 15s
          </label>
          <button
            onClick={() => {
              setRefreshTick((v) => v + 1);
            }}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Làm mới
          </button>
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

      {!query.success ? (
        <div className="text-center py-8 text-sm text-rose-300 bg-rose-950/20 border border-rose-900/40 rounded-lg">
          {query.error || 'Không tải được tin nhắn.'}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">
          Chưa có tin nhắn nào. Hãy bắt đầu cuộc trao đổi đầu tiên.
        </div>
      ) : (
        <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1" aria-live="polite">
          {messages.map((m) => {
            const isOwn = m.sender_id === user.id;
            return (
              <li
                key={m.id}
                className={`p-3 rounded-lg border text-sm ${
                  isOwn ? 'bg-indigo-950/40 border-indigo-800/50 ml-4' : 'bg-slate-950/70 border-slate-800 mr-4'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-200">
                    {m.sender_name}
                    <span className="ml-1.5 text-[10px] font-mono uppercase text-slate-500">{m.sender_role}</span>
                    {m.message_type !== 'text' && (
                      <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {m.message_type}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(m.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className="text-[13px] text-slate-300 whitespace-pre-wrap break-words">{m.content}</p>
                {m.attachments?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-slate-700"
                      >
                        📎 {a.name}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-1 text-[10px] text-slate-500">
                  {m.read_by.length > 1 ? `Đã xem bởi ${m.read_by.length} thành viên` : 'Đã gửi'} • {m.read_by.length} lượt đọc
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-slate-500 font-mono">
            {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40"
          >
            Sau →
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={`msg-input-${workspaceId}`} className="sr-only">
          Nhập tin nhắn (tối đa 2000 ký tự)
        </label>
        <input
          id={`msg-input-${workspaceId}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          placeholder="Nhập tin nhắn… (Enter để gửi)"
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={sending}
          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition"
        >
          {sending ? 'Đang gửi…' : 'Gửi'}
        </button>
      </form>
      <p className="text-[10px] text-slate-600">{content.trim().length}/2000 ký tự • Chỉ thành viên workspace mới đọc/gửi được.</p>
    </div>
  );
};
