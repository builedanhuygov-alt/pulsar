import React, { useState } from 'react';
import type { Submission, SubmissionStatus } from '../../types/submission.types';
import type { PulsarUser } from '../../types/auth.types';
import { submissionService } from '../../lib/submission/submissionService';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Award,
  Layers,
  Link as LinkIcon,
  Eye,
  FileCode,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Lock,
} from 'lucide-react';

interface MySubmissionsProps {
  user: PulsarUser;
  onExploreMarketplace: () => void;
}

const STATUS_BADGES: Record<
  SubmissionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Bản Nháp (Draft)',
    color: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: <Clock className="w-3 h-3 text-slate-400" />,
  },
  submitted: {
    label: 'Đã Nộp (Chờ Đánh Giá)',
    color: 'bg-sky-950/60 text-sky-300 border-sky-800/80',
    icon: <Clock className="w-3 h-3 text-sky-400" />,
  },
  under_review: {
    label: 'Đang Thẩm Định',
    color: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
    icon: <Clock className="w-3 h-3 text-amber-400" />,
  },
  shortlisted: {
    label: 'Vào Vòng Chung Tuyển (Shortlisted)',
    color: 'bg-purple-950/60 text-purple-300 border-purple-800/80',
    icon: <Award className="w-3 h-3 text-purple-400" />,
  },
  accepted: {
    label: 'Được Chọn Trao Giải (Accepted)',
    color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  },
  rejected: {
    label: 'Không Được Chọn',
    color: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
    icon: <XCircle className="w-3 h-3 text-rose-400" />,
  },
  withdrawn: {
    label: 'Đã Rút Bài',
    color: 'bg-zinc-900 text-zinc-500 border-zinc-800',
    icon: <XCircle className="w-3 h-3 text-zinc-500" />,
  },
};

export const MySubmissions: React.FC<MySubmissionsProps> = ({
  user,
  onExploreMarketplace,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const submissions = submissionService.getCreatorSubmissions(user.id);

  const filtered =
    statusFilter === 'all'
      ? submissions
      : submissions.filter((s) => s.status === statusFilter);

  const handleWithdraw = (sub: Submission) => {
    if (!window.confirm('Bạn có chắc chắn muốn rút bài dự thi này không?')) return;
    const res = submissionService.transitionStatus(sub.id, 'withdrawn', {
      userId: user.id,
      userRole: user.role,
      isOwner: true,
      isOrgMember: false,
      notes: 'Tác giả tự nguyện rút bài dự thi.',
    });

    if (res.success) {
      setNotification('Đã rút bài dự thi thành công.');
      setRefreshKey((k) => k + 1);
      setTimeout(() => setNotification(null), 4000);
    } else {
      alert(res.error || 'Rút bài thất bại.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PULSAR Submission Engine • Không Gian Dự Thi</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Bài Dự Thi & Giải Pháp Của Bạn
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi tiến độ chấm điểm, điểm số theo tiêu chí rubric và nhận xét từ các doanh nghiệp tổ chức.
          </p>
        </div>

        <button
          onClick={onExploreMarketplace}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center gap-1.5 shrink-0"
        >
          <Layers className="w-4 h-4" />
          Khám Phá Sàn Thử Thách
        </button>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: `Tất cả (${submissions.length})` },
          { key: 'submitted', label: 'Đã nộp' },
          { key: 'under_review', label: 'Đang chấm' },
          { key: 'shortlisted', label: 'Chung tuyển' },
          { key: 'accepted', label: 'Trao giải' },
          { key: 'draft', label: 'Bản nháp' },
          { key: 'withdrawn', label: 'Đã rút' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              statusFilter === tab.key
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-300">
            Bạn chưa nộp bài dự thi nào trong mục này
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Hãy khám phá các bài toán thực tế trên Sàn Thử Thách và nộp giải pháp để nhận giải thưởng.
          </p>
          <button
            onClick={onExploreMarketplace}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition inline-flex items-center gap-1.5"
          >
            Xem Sàn Thử Thách Ngay
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((sub) => {
            const badge = STATUS_BADGES[sub.status];
            const hasReview = sub.reviews && sub.reviews.length > 0;

            return (
              <div
                key={sub.id}
                className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${badge.color}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Phiên bản v{sub.version}
                    </span>
                    {sub.average_score !== undefined && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold flex items-center gap-1">
                        <Award className="w-3 h-3 text-amber-400" />
                        Điểm: {sub.average_score}/100
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {sub.title}
                  </h3>

                  <div className="text-xs text-violet-400 font-medium">
                    Thử thách: {sub.challenge_title || 'Thử thách đối tác'}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 max-w-3xl">
                    {sub.solution_summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 font-mono">
                    <span>
                      Nộp lúc:{' '}
                      {sub.submitted_at
                        ? new Date(sub.submitted_at).toLocaleDateString('vi-VN')
                        : 'Bản nháp'}
                    </span>
                    <span>•</span>
                    <span>Đính kèm: {sub.files.length} tệp bảo mật</span>
                    {sub.solution_url && (
                      <>
                        <span>•</span>
                        <a
                          href={sub.solution_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Repo/Demo
                        </a>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <button
                    onClick={() => setSelectedSubmission(sub)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Xem Chi Tiết
                  </button>

                  {['draft', 'submitted'].includes(sub.status) && (
                    <button
                      onClick={() => handleWithdraw(sub)}
                      className="px-3 py-2 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 rounded-xl transition text-xs"
                      title="Rút bài thi"
                    >
                      Rút bài
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border mb-2 ${
                    STATUS_BADGES[selectedSubmission.status].color
                  }`}
                >
                  {STATUS_BADGES[selectedSubmission.status].icon}
                  {STATUS_BADGES[selectedSubmission.status].label}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {selectedSubmission.title}
                </h2>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  Đề bài: {selectedSubmission.challenge_title} • Phiên bản v
                  {selectedSubmission.version}
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Rubric Review Result (if reviewed) */}
            {selectedSubmission.reviews && selectedSubmission.reviews.length > 0 && (
              <div className="p-4 rounded-xl bg-violet-950/40 border border-violet-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    Kết Quả Đánh Giá Chuyên Môn
                  </h4>
                  <span className="text-sm font-mono font-bold text-amber-300">
                    Điểm tổng: {selectedSubmission.average_score}/100
                  </span>
                </div>

                {selectedSubmission.reviews.map((rev) => (
                  <div key={rev.id} className="space-y-2 text-xs">
                    <div className="text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="font-semibold text-slate-200">
                        Nhận xét từ {rev.reviewer_name || 'Ban Giám Khảo'}:{' '}
                      </span>
                      {rev.feedback}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {rev.rubric_scores.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 text-slate-300 text-[11px]"
                        >
                          <span>{r.criterion_name} (Trọng số {r.weight}%)</span>
                          <span className="font-mono font-bold text-amber-400">
                            {r.score}/100
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-violet-400">
                Thuyết Minh Kỹ Thuật Chi Tiết
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {selectedSubmission.solution_content}
              </p>
            </div>

            {/* Files with Expiring Signed URLs */}
            {selectedSubmission.files.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Tệp Tài Liệu Đính Kèm (Bảo Mật Private Storage)
                </h4>
                <div className="space-y-1.5">
                  {selectedSubmission.files.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-violet-400" />
                        <div>
                          <div className="font-mono text-slate-200">{file.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {(file.size / 1024).toFixed(0)} KB • Private Path:{' '}
                            {file.storage_path}
                          </div>
                        </div>
                      </div>
                      {file.signed_url && (
                        <a
                          href={file.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 bg-violet-950/60 text-violet-300 border border-violet-800/80 rounded-lg text-xs hover:bg-violet-900 transition flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3 text-amber-400" />
                          Truy cập tệp có chữ ký
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
