import React, { useState } from 'react';
import type {
  Challenge,
  ChallengeReviewRecord,
} from '../../types/challenge.types';
import type { PulsarUser } from '../../types/auth.types';
import { challengeService } from '../../lib/challenge/challengeService';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Building2,
  Award,
  Layers,
  FileText,
  Send,
  MessageSquare,
  Lock,
} from 'lucide-react';

interface AdminChallengeReviewProps {
  user: PulsarUser;
}

export const AdminChallengeReview: React.FC<AdminChallengeReviewProps> = ({ user }) => {
  const isAdmin = user.role === 'admin';
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'request_changes'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // If not admin, render strict access denied banner
  if (!isAdmin) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Truy Cập Bị Từ Chối (403 Forbidden)</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Chỉ tài khoản Quản trị viên hệ thống (Super Admin) mới có thẩm quyền thẩm định và phê duyệt các thử thách của doanh nghiệp. Vui lòng chuyển sang Persona Admin để kiểm thử tính năng này.
        </p>
      </div>
    );
  }

  // Get pending review challenges
  const pendingChallenges = challengeService.getPendingReviewQueue(user.id, true);

  const handleDecision = () => {
    if (!selectedChallenge) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    if (['reject', 'request_changes'].includes(reviewAction) && reviewNotes.trim().length < 5) {
      setErrorMsg('Vui lòng nhập lý do hoặc ghi chú phản hồi tối thiểu 5 ký tự.');
      setIsSubmitting(false);
      return;
    }

    const res = challengeService.processAdminReview(
      selectedChallenge.id,
      {
        action: reviewAction,
        notes: reviewNotes.trim() || 'Thử thách đáp ứng đầy đủ tiêu chuẩn kỹ thuật của PULSAR.',
      },
      user.id,
      user.profile.display_name,
      true
    );

    if (res.success && res.challenge) {
      setSuccessMsg(
        `Đã xử lý thẩm định thành công thử thách "${selectedChallenge.title}". Trạng thái mới: ${res.challenge.status.toUpperCase()}.`
      );
      setSelectedChallenge(null);
      setReviewNotes('');
      setRefreshKey((k) => k + 1);
    } else {
      setErrorMsg(res.error || 'Có lỗi xảy ra khi xử lý đánh giá.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Admin Review Header */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hàng Đợi Thẩm Định Đề Bài (Admin Review Queue)</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Ban Quản Trị Hệ Thống PULSAR
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Rà soát tính khả thi, ngân sách và tính hợp lệ của đề bài trước khi mở công khai trên Sàn Thử Thách.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-mono font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Đang chờ duyệt: {pendingChallenges.length} đề bài
          </span>
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Queue Grid */}
      {pendingChallenges.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-200">
            Hàng đợi hiện tại đã được giải quyết hết!
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Không có thử thách nào đang ở trạng thái <code>pending_review</code> cần xử lý.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pendingChallenges.map((challenge) => {
            const isCreatorSelf = challenge.created_by === user.id;

            return (
              <div
                key={challenge.id}
                className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Chờ thẩm định
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-400" />
                      {challenge.prize_pool.toLocaleString()} {challenge.currency}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {challenge.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {challenge.short_description}
                  </p>

                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Doanh nghiệp:</span>
                      <span className="font-semibold text-slate-200">
                        {challenge.organization_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Người tạo:</span>
                      <span className="font-mono text-slate-300">
                        {challenge.creator_name || challenge.created_by}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Ngân sách dự kiến:</span>
                      <span className="font-mono text-emerald-400">
                        {challenge.budget_min.toLocaleString()} - {challenge.budget_max.toLocaleString()} {challenge.currency}
                      </span>
                    </div>
                  </div>

                  {/* Anti Self-Approval Warning */}
                  {isCreatorSelf && (
                    <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        <strong>QUY TẮC AN NINH:</strong> Bạn là người tạo thử thách này. Theo nguyên tắc Segregation of Duties, bạn không được tự phê duyệt đề bài của chính mình.
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono text-slate-500">
                    ID: {challenge.id}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedChallenge(challenge);
                      setReviewAction('approve');
                      setReviewNotes('');
                      setErrorMsg(null);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-xl transition shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Thẩm Định & Ra Quyết Định
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      {selectedChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  Thẩm Định Đề Bài
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-1">
                  {selectedChallenge.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Tổ chức: {selectedChallenge.organization_name} • Người tạo:{' '}
                  {selectedChallenge.creator_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedChallenge(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Anti Self-Approval Notice */}
            {selectedChallenge.created_by === user.id && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Bạn là tác giả đề bài. Quyền Phê Duyệt bị khóa theo quy tắc an ninh PULSAR. Bạn chỉ có thể yêu cầu sửa đổi hoặc từ chối.
                </span>
              </div>
            )}

            {/* Decision Radio Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Lựa chọn quyết định thẩm định:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={selectedChallenge.created_by === user.id}
                  onClick={() => setReviewAction('approve')}
                  className={`p-3 rounded-xl border text-xs font-medium text-left transition flex flex-col gap-1 ${
                    selectedChallenge.created_by === user.id
                      ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500'
                      : reviewAction === 'approve'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Phê Duyệt (Approve)
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Đề bài đạt chuẩn, cho phép xuất bản.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('request_changes')}
                  className={`p-3 rounded-xl border text-xs font-medium text-left transition flex flex-col gap-1 ${
                    reviewAction === 'request_changes'
                      ? 'bg-orange-950/80 border-orange-500 text-orange-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    Yêu Cầu Sửa Đổi
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Yêu cầu doanh nghiệp bổ sung thông tin.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('reject')}
                  className={`p-3 rounded-xl border text-xs font-medium text-left transition flex flex-col gap-1 ${
                    reviewAction === 'reject'
                      ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    Từ Chối (Reject)
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Đề bài vi phạm quy định hoặc không phù hợp.
                  </span>
                </button>
              </div>
            </div>

            {/* Review Notes / Audit Feedback */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>
                  Ghi chú phản hồi / Lý do quyết định{' '}
                  {['reject', 'request_changes'].includes(reviewAction) && (
                    <span className="text-rose-400">* (Bắt buộc tối thiểu 5 ký tự)</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {reviewNotes.length} ký tự
                </span>
              </label>
              <textarea
                rows={3}
                placeholder={
                  reviewAction === 'approve'
                    ? 'Đề bài đạt chuẩn chất lượng, nội dung chi tiết và tiêu chí chấm điểm minh bạch.'
                    : 'Chỉ rõ các nội dung doanh nghiệp cần sửa đổi hoặc lý do không phê duyệt...'
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400 font-mono">
                Quản trị viên thực hiện: {user.profile.display_name}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChallenge(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDecision}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Xác Nhận Quyết Định
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
