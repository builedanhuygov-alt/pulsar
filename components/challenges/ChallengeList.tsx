import React, { useState } from 'react';
import type { Challenge, ChallengeStatus } from '../../types/challenge.types';
import type { PulsarUser } from '../../types/auth.types';
import { challengeService } from '../../lib/challenge/challengeService';
import { ChallengeEditor } from './ChallengeEditor';
import { OutcomeFinalizerModal } from '../outcomes/OutcomeFinalizerModal';
import { BusinessTalentMatches } from '../matching/BusinessTalentMatches';
import {
  Plus,
  Filter,
  Layers,
  Sparkles,
  Calendar,
  Clock,
  DollarSign,
  Award,
  Edit3,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileQuestion,
  ChevronRight,
  ShieldCheck,
  Building2,
  Trophy,
  Users,
} from 'lucide-react';

interface ChallengeListProps {
  user: PulsarUser;
}

const STATUS_BADGES: Record<
  ChallengeStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Bản Nháp (Draft)',
    color: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: <Edit3 className="w-3 h-3 text-slate-400" />,
  },
  pending_review: {
    label: 'Chờ Quản Trị Duyệt',
    color: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
    icon: <Clock className="w-3 h-3 text-amber-400" />,
  },
  changes_requested: {
    label: 'Yêu Cầu Chỉnh Sửa',
    color: 'bg-orange-950/60 text-orange-300 border-orange-800/80',
    icon: <AlertCircle className="w-3 h-3 text-orange-400" />,
  },
  approved: {
    label: 'Đã Duyệt (Sẵn sàng Xuất bản)',
    color: 'bg-sky-950/60 text-sky-300 border-sky-800/80',
    icon: <ShieldCheck className="w-3 h-3 text-sky-400" />,
  },
  published: {
    label: 'Đang Công Khai (Sàn)',
    color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  },
  rejected: {
    label: 'Bị Từ Chối',
    color: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
    icon: <XCircle className="w-3 h-3 text-rose-400" />,
  },
  closed: {
    label: 'Đã Kết Thúc (Closed)',
    color: 'bg-slate-900 text-slate-400 border-slate-800',
    icon: <CheckCircle2 className="w-3 h-3 text-slate-500" />,
  },
  cancelled: {
    label: 'Đã Hủy (Cancelled)',
    color: 'bg-zinc-900 text-zinc-500 border-zinc-800',
    icon: <XCircle className="w-3 h-3 text-zinc-500" />,
  },
};

export const ChallengeList: React.FC<ChallengeListProps> = ({ user }) => {
  const userOrgs = user.organizations.map((m) => m.organization);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    userOrgs[0]?.id || 'org-lab-01'
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [viewingChallenge, setViewingChallenge] = useState<Challenge | null>(null);
  const [talentMatchingChallenge, setTalentMatchingChallenge] = useState<Challenge | null>(null);
  const [finalizingChallengeId, setFinalizingChallengeId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch challenges for organization
  const challenges = challengeService.getOrganizationChallenges(selectedOrgId);

  // Filtered by status
  const filtered = statusFilter === 'all'
    ? challenges
    : challenges.filter((c) => c.status === statusFilter);

  // Stats calculation
  const totalCount = challenges.length;
  const draftCount = challenges.filter((c) => c.status === 'draft').length;
  const pendingCount = challenges.filter((c) => c.status === 'pending_review').length;
  const publishedCount = challenges.filter((c) => c.status === 'published').length;

  const currentOrg = userOrgs.find((o) => o.id === selectedOrgId) || {
    name: 'AI Innovators Hub',
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  // Quick Action Handlers
  const handleSubmitForReview = (challenge: Challenge) => {
    const res = challengeService.transitionStatus(challenge.id, 'pending_review', {
      userId: user.id,
      userRole: user.role,
      isOrgMember: true,
      notes: 'Doanh nghiệp nộp đề bài để quản trị viên thẩm định và duyệt.',
    });

    if (res.success) {
      showNotification('success', `Đã gửi duyệt thành công thử thách "${challenge.title}".`);
      setRefreshKey((k) => k + 1);
    } else {
      showNotification('error', res.error || 'Gửi duyệt thất bại.');
    }
  };

  const handlePublishChallenge = (challenge: Challenge) => {
    const res = challengeService.transitionStatus(challenge.id, 'published', {
      userId: user.id,
      userRole: user.role,
      isOrgMember: true,
      notes: 'Xuất bản công khai lên Sàn Thử Thách PULSAR Marketplace.',
    });

    if (res.success) {
      showNotification('success', `Đã xuất bản thành công thử thách "${challenge.title}" lên Sàn.`);
      setRefreshKey((k) => k + 1);
    } else {
      showNotification('error', res.error || 'Xuất bản thất bại.');
    }
  };

  const handleCloseChallenge = (challenge: Challenge) => {
    const res = challengeService.transitionStatus(challenge.id, 'closed', {
      userId: user.id,
      userRole: user.role,
      isOrgMember: true,
      notes: 'Đóng thử thách sau khi hết hạn nộp bài.',
    });

    if (res.success) {
      showNotification('success', `Đã đóng thử thách "${challenge.title}".`);
      setRefreshKey((k) => k + 1);
    } else {
      showNotification('error', res.error || 'Đóng thử thách thất bại.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Org Selector */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Quản Lý Thử Thách Của Tổ Chức</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Danh Sách Đề Bài & Thử Thách Kỹ Thuật
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tạo mới, chỉnh sửa bản nháp, gửi duyệt và theo dõi trạng thái các thử thách thuộc tổ chức <strong>{currentOrg.name}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {userOrgs.length > 1 && (
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            >
              {userOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              setEditingChallenge(null);
              setIsEditorOpen(true);
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Tạo Thử Thách Mới
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-150 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400">Tổng thử thách</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">{totalCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400">Bản nháp (Draft)</div>
          <div className="text-2xl font-bold text-slate-300 mt-1 font-mono">{draftCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-amber-400">Đang chờ Admin duyệt</div>
          <div className="text-2xl font-bold text-amber-300 mt-1 font-mono">{pendingCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-emerald-400">Đã công khai trên sàn</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1 font-mono">{publishedCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: `Tất cả (${totalCount})` },
          { key: 'draft', label: `Bản nháp (${draftCount})` },
          { key: 'pending_review', label: `Chờ duyệt (${pendingCount})` },
          { key: 'changes_requested', label: 'Cần sửa đổi' },
          { key: 'approved', label: 'Đã duyệt' },
          { key: 'published', label: `Đang chạy (${publishedCount})` },
          { key: 'closed', label: 'Đã kết thúc' },
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

      {/* Challenge Cards / List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <FileQuestion className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-300">Không có thử thách nào</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Chưa có thử thách nào trong danh mục này hoặc bạn chưa tạo thử thách nào cho tổ chức.
          </p>
          <button
            onClick={() => {
              setEditingChallenge(null);
              setIsEditorOpen(true);
            }}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Tạo Thử Thách Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((challenge) => {
            const badge = STATUS_BADGES[challenge.status];
            const deadlineFormatted = new Date(challenge.deadline_at).toLocaleDateString(
              'vi-VN',
              { year: 'numeric', month: 'short', day: 'numeric' }
            );

            return (
              <div
                key={challenge.id}
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
                      {challenge.category.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-400" />
                      {challenge.prize_pool.toLocaleString()} {challenge.currency}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                    {challenge.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 max-w-3xl">
                    {challenge.short_description}
                  </p>

                  {/* Review feedback note if changes requested or rejected */}
                  {challenge.latest_review_note &&
                    ['changes_requested', 'rejected'].includes(challenge.status) && (
                      <div className="p-2.5 rounded-lg bg-orange-950/40 border border-orange-800/60 text-xs text-orange-300 flex items-start gap-2 mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-orange-400 mt-0.5" />
                        <div>
                          <span className="font-bold">Phản hồi từ Ban Quản Trị: </span>
                          <span>{challenge.latest_review_note}</span>
                        </div>
                      </div>
                    )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Hạn: {deadlineFormatted}
                    </span>
                    <span>•</span>
                    <span>Tạo bởi: {challenge.creator_name || 'Thành viên'}</span>
                    <span>•</span>
                    <span>Slug: /{challenge.slug}</span>
                  </div>
                </div>

                {/* Challenge Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <button
                    onClick={() => setViewingChallenge(challenge)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-xs flex items-center gap-1"
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Chi tiết</span>
                  </button>

                  {/* Edit Draft */}
                  {['draft', 'changes_requested'].includes(challenge.status) && (
                    <button
                      onClick={() => {
                        setEditingChallenge(challenge);
                        setIsEditorOpen(true);
                      }}
                      className="p-2 bg-indigo-900/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-xl transition text-xs flex items-center gap-1"
                      title="Chỉnh sửa thử thách"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Sửa</span>
                    </button>
                  )}

                  {/* Submit for Review */}
                  {['draft', 'changes_requested'].includes(challenge.status) && (
                    <button
                      onClick={() => handleSubmitForReview(challenge)}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition text-xs font-medium flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Gửi Duyệt
                    </button>
                  )}

                  {/* Publish after approval */}
                  {challenge.status === 'approved' && (
                    <button
                      onClick={() => handlePublishChallenge(challenge)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition text-xs font-medium flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Xuất Bản Ngay
                    </button>
                  )}

                  {/* Close or Finalize challenge */}
                  {challenge.status === 'published' && (
                    <>
                      <button
                        onClick={() => setTalentMatchingChallenge(challenge)}
                        className="px-3 py-2 bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-200 border border-indigo-700/50 rounded-xl transition text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Gợi Ý Nhân Tài
                      </button>
                      <button
                        onClick={() => setFinalizingChallengeId(challenge.id)}
                        className="px-3 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl transition text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        Chốt Kết Quả
                      </button>
                      <button
                        onClick={() => handleCloseChallenge(challenge)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-xs font-medium"
                      >
                        Đóng Đề Bài
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <ChallengeEditor
          user={user}
          initialChallenge={editingChallenge}
          onClose={() => setIsEditorOpen(false)}
          onSaved={(saved) => {
            setIsEditorOpen(false);
            setRefreshKey((k) => k + 1);
            showNotification(
              'success',
              `Thử thách "${saved.title}" đã được lưu thành công (Trạng thái: ${saved.status}).`
            );
          }}
        />
      )}

      {/* Detail Modal */}
      {viewingChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border mb-2 ${
                    STATUS_BADGES[viewingChallenge.status].color
                  }`}
                >
                  {STATUS_BADGES[viewingChallenge.status].icon}
                  {STATUS_BADGES[viewingChallenge.status].label}
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {viewingChallenge.title}
                </h2>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  Tổ chức: {viewingChallenge.organization_name} • Giải thưởng:{' '}
                  {viewingChallenge.prize_pool.toLocaleString()} {viewingChallenge.currency}
                </div>
              </div>
              <button
                onClick={() => setViewingChallenge(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-violet-400">
                Thực trạng & Đề bài toán
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {viewingChallenge.problem_statement}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Kết quả kỳ vọng
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {viewingChallenge.desired_outcome}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Yêu cầu kỹ thuật
                </h4>
                <ul className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  {viewingChallenge.requirements.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Sản phẩm bàn giao
                </h4>
                <ul className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  {viewingChallenge.deliverables.map((d, i) => (
                    <li key={i}>• {d}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Tiêu chí chấm điểm & Trọng số
              </h4>
              <div className="space-y-2">
                {viewingChallenge.evaluation_criteria.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{c.name}</div>
                      <div className="text-slate-400 text-[11px]">{c.description}</div>
                    </div>
                    <div className="font-mono font-bold text-amber-400 text-sm">
                      {c.weight}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outcome Finalizer Modal */}
      {finalizingChallengeId && (
        <OutcomeFinalizerModal
          challengeId={finalizingChallengeId}
          user={user}
          onClose={() => setFinalizingChallengeId(null)}
          onSuccess={() => {
            setFinalizingChallengeId(null);
            setRefreshKey((k) => k + 1);
            showNotification(
              'success',
              'Đã chốt kết quả đề bài, khởi tạo giải thưởng ký quỹ và chứng chỉ số thành công!'
            );
          }}
        />
      )}

      {/* Business Talent Matching Modal */}
      {talentMatchingChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-mono text-indigo-400 font-semibold">TÌM KIẾM NHÂN TÀI PHÙ HỢP</span>
              <button
                onClick={() => setTalentMatchingChallenge(null)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <BusinessTalentMatches
              challengeId={talentMatchingChallenge.id}
              challengeTitle={talentMatchingChallenge.title}
              user={user}
            />
          </div>
        </div>
      )}
    </div>
  );
};
