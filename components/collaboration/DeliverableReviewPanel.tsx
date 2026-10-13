import React, { useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import type { DeliverableStatus } from '../../types/collaboration.types';
import { collaborationService } from '../../lib/collaboration/collaborationService';

/**
 * Sprint 7 §5b — DeliverableReviewPanel.
 * - Creator nộp (URL/metadata only — upload Storage CHƯA tích hợp).
 * - Chỉ Owner/Reviewer/Admin duyệt; Creator không tự nghiệm thu chính mình.
 * - Nghiệm thu công việc TÁCH KHỎI thanh toán và challenge outcome cuối cùng.
 */
interface Props {
  workspaceId: string;
  user: PulsarUser;
}

export const DeliverableReviewPanel: React.FC<Props> = ({ workspaceId, user }) => {
  const [tick, setTick] = useState(0);
  const [milestoneId, setMilestoneId] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const milestones = useMemo(
    () => collaborationService.getMilestones(workspaceId, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, user.id, tick]
  );
  const role = collaborationService.getMemberRole(workspaceId, user.id);
  const canReview = role === 'owner' || role === 'reviewer' || role === 'admin' || user.role === 'admin';

  React.useEffect(() => {
    if (!milestoneId && milestones.length > 0) setMilestoneId(milestones[0].id);
  }, [milestones, milestoneId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!milestoneId) {
      setError('Chọn mốc bàn giao trước khi nộp.');
      return;
    }
    const res = await collaborationService.submitDeliverable(
      workspaceId,
      { milestone_id: milestoneId, title: title.trim(), url: url.trim(), notes: notes.trim() || undefined },
      user
    );
    if (!res.success) setError(res.error || 'Nộp thất bại.');
    else {
      setSuccess(`Đã nộp "${title.trim()}" (lưu URL/metadata — upload Storage chưa tích hợp).`);
      setTitle('');
      setUrl('');
      setNotes('');
      setTick((v) => v + 1);
    }
  };

  const handleReview = (deliverableId: string, decision: DeliverableStatus, submitterId: string) => {
    setError(null);
    setSuccess(null);
    if (submitterId === user.id && decision === 'accepted' && user.role !== 'admin') {
      setError('QUY TẮC AN NINH: Creator không thể tự nghiệm thu deliverable của chính mình.');
      return;
    }
    const res = collaborationService.reviewDeliverable(
      workspaceId,
      { deliverable_id: deliverableId, decision, feedback: feedbackMap[deliverableId] || '' },
      user
    );
    if (!res.success) setError(res.error || 'Duyệt thất bại.');
    else {
      setSuccess(`Deliverable đã chuyển sang "${decision}". Nghiệm thu công việc — không ảnh hưởng outcome/thanh toán.`);
      setTick((v) => v + 1);
    }
  };

  const allDeliverables = milestones.flatMap((ms) => ms.deliverables.map((d) => ({ ms, d })));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4" aria-label="Duyệt sản phẩm bàn giao">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Duyệt bàn giao ({allDeliverables.length})</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Upload thực tế <span className="text-amber-400">chưa tích hợp Storage</span> — chỉ lưu URL + metadata + phiên bản.
          Dùng private storage + signed URL khi có Supabase Storage. Nghiệm thu ≠ thanh toán ≠ outcome cuối cùng.
        </p>
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
        <select
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
          aria-label="Chọn milestone"
        >
          {milestones.map((ms) => (
            <option key={ms.id} value={ms.id}>
              {ms.title}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên sản phẩm (vd. GNN Weights v2 + Benchmark PDF)"
          maxLength={150}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600"
          aria-label="Tên sản phẩm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Liên kết bàn giao (https://… hoặc đường dẫn repo)"
          className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600"
          aria-label="Liên kết bàn giao"
        />
        <div className="flex gap-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú (tùy chọn)"
            maxLength={1000}
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600"
            aria-label="Ghi chú bàn giao"
          />
          <button type="submit" className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
            Nộp
          </button>
        </div>
      </form>

      {allDeliverables.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg">
          Chưa có sản phẩm bàn giao nào.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {allDeliverables.map(({ ms, d }) => {
            const isOwn = d.submitted_by === user.id;
            return (
              <li key={d.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{d.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">v{d.version ?? 1}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{d.status ?? 'submitted'}</span>
                  <span className="text-[10px] text-slate-500">Mốc: {ms.title}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Nộp bởi {d.submitter_name ?? d.submitted_by} • {new Date(d.submitted_at).toLocaleString('vi-VN')} •{' '}
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
                    {d.url}
                  </a>
                </div>
                {d.feedback && <div className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900/40 rounded p-2">Feedback: {d.feedback}</div>}
                {canReview ? (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      value={feedbackMap[d.id] || ''}
                      onChange={(e) => setFeedbackMap((m) => ({ ...m, [d.id]: e.target.value }))}
                      placeholder="Nhận xét duyệt…"
                      maxLength={2000}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600"
                      aria-label={`Nhận xét cho ${d.title}`}
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleReview(d.id, 'under_review', d.submitted_by)}
                        className="px-2.5 py-1.5 text-[11px] rounded-lg bg-sky-900/50 text-sky-300 border border-sky-800/60"
                      >
                        Xem xét
                      </button>
                      <button
                        onClick={() => handleReview(d.id, 'changes_requested', d.submitted_by)}
                        className="px-2.5 py-1.5 text-[11px] rounded-lg bg-amber-900/50 text-amber-300 border border-amber-800/60"
                      >
                        Yêu cầu sửa
                      </button>
                      <button
                        onClick={() => handleReview(d.id, 'accepted', d.submitted_by)}
                        disabled={isOwn && user.role !== 'admin'}
                        title={isOwn ? 'Bạn không thể tự nghiệm thu sản phẩm của chính mình' : 'Nghiệm thu'}
                        className="px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-900/50 text-emerald-300 border border-emerald-800/60 disabled:opacity-40"
                      >
                        Nghiệm thu
                      </button>
                      <button
                        onClick={() => handleReview(d.id, 'rejected', d.submitted_by)}
                        className="px-2.5 py-1.5 text-[11px] rounded-lg bg-rose-900/50 text-rose-300 border border-rose-800/60"
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-600">Chỉ Owner/Reviewer mới được duyệt. {isOwn ? 'Đây là sản phẩm của bạn — bạn không thể tự nghiệm thu.' : ''}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
