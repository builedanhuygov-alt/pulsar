import React, { useState, useMemo } from 'react';
import type { Challenge, ChallengeCategory } from '../../types/challenge.types';
import type { PulsarUser } from '../../types/auth.types';
import { challengeService } from '../../lib/challenge/challengeService';
import { SubmissionModal } from '../submissions/SubmissionModal';
import {
  Search,
  Filter,
  Sparkles,
  Calendar,
  DollarSign,
  Building2,
  ChevronRight,
  X,
  Award,
  Layers,
  FileCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Send,
  Lock,
} from 'lucide-react';

interface ChallengeMarketplaceProps {
  user?: PulsarUser | null;
  onNavigateToSubmissions?: () => void;
}

const CATEGORY_LABELS: Record<ChallengeCategory, { label: string; color: string }> = {
  ai_ml: { label: 'AI & Machine Learning', color: 'border-violet-500/40 text-violet-300 bg-violet-950/40' },
  blockchain: { label: 'Blockchain & Web3', color: 'border-sky-500/40 text-sky-300 bg-sky-950/40' },
  security: { label: 'Security & Zero-Trust', color: 'border-rose-500/40 text-rose-300 bg-rose-950/40' },
  cloud_devops: { label: 'Cloud & DevOps', color: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40' },
  fintech: { label: 'Fintech & Payments', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40' },
  mobile_iot: { label: 'Mobile & IoT', color: 'border-amber-500/40 text-amber-300 bg-amber-950/40' },
};

export const ChallengeMarketplace: React.FC<ChallengeMarketplaceProps> = ({
  user,
  onNavigateToSubmissions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [submittingChallenge, setSubmittingChallenge] = useState<Challenge | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const { challenges } = useMemo(() => {
    return challengeService.getPublicMarketplace({
      searchQuery,
      category: selectedCategory as any,
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PULSAR Public Challenge Marketplace</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Sàn Thử Thách & Đề Bài Doanh Nghiệp</h2>
          <p className="text-xs text-slate-400 mt-1">
            Nơi kết nối các bài toán kỹ thuật thực tế với cộng đồng kỹ sư, freelancer và chuyên gia công nghệ.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề, bài toán..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Tất cả danh mục ({challenges.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([cat, { label }]) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              selectedCategory === cat
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Challenge Cards Grid */}
      {challenges.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <Filter className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-300">Không tìm thấy thử thách phù hợp</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Vui lòng thử tìm kiếm với từ khóa khác hoặc bỏ các bộ lọc đang chọn.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {challenges.map((challenge) => {
            const catBadge = CATEGORY_LABELS[challenge.category];
            const deadlineFormatted = new Date(challenge.deadline_at).toLocaleDateString('vi-VN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={challenge.id}
                onClick={() => setSelectedChallenge(challenge)}
                className="group p-5 bg-slate-900/90 border border-slate-800 hover:border-violet-500/50 rounded-2xl transition duration-200 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:shadow-violet-950/20"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${catBadge.color}`}
                    >
                      {catBadge.label}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-400" />
                      {challenge.prize_pool.toLocaleString()} {challenge.currency}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition line-clamp-2 leading-snug">
                    {challenge.title}
                  </h3>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {challenge.short_description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{challenge.organization_name || 'Doanh nghiệp đối tác'}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0 font-mono">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Hạn: {deadlineFormatted}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Challenge Detail Modal */}
      {selectedChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      CATEGORY_LABELS[selectedChallenge.category].color
                    }`}
                  >
                    {CATEGORY_LABELS[selectedChallenge.category].label}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    Giải thưởng: {selectedChallenge.prize_pool.toLocaleString()} {selectedChallenge.currency}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Trạng thái: {selectedChallenge.status.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                  {selectedChallenge.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                  <Building2 className="w-3.5 h-3.5 text-violet-400" />
                  <span>Tổ chức: {selectedChallenge.organization_name}</span>
                  <span>•</span>
                  <span>Slug: {selectedChallenge.slug}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedChallenge(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Problem Statement */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4" />
                Mô tả Bài toán Chi tiết
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                {selectedChallenge.problem_statement}
              </p>
            </div>

            {/* Desired Outcome */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Kết quả & Mục tiêu Kỳ vọng
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                {selectedChallenge.desired_outcome}
              </p>
            </div>

            {/* Technical Requirements & Deliverables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Yêu cầu Kỹ thuật
                </h4>
                <ul className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                  {selectedChallenge.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-violet-400 font-bold">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Sản phẩm Bàn giao
                </h4>
                <ul className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                  {selectedChallenge.deliverables.map((del, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{del}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Evaluation Criteria Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Tiêu chí Đánh giá & Chấm điểm (Tổng trọng số: 100%)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {selectedChallenge.evaluation_criteria.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{c.name}</span>
                      <span className="font-mono text-amber-400 font-bold">{c.weight}%</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline & Budget Summary */}
            <div className="p-4 bg-violet-950/20 border border-violet-900/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-4 text-slate-300">
                <span>
                  Bắt đầu: {new Date(selectedChallenge.start_at).toLocaleDateString('vi-VN')}
                </span>
                <span>•</span>
                <span className="text-amber-300 font-semibold">
                  Hạn chót: {new Date(selectedChallenge.deadline_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <div className="text-right text-emerald-300 font-bold">
                Ngân sách dự kiến: {selectedChallenge.budget_min.toLocaleString()} - {selectedChallenge.budget_max.toLocaleString()} {selectedChallenge.currency}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="text-[11px] text-slate-400 font-mono">
                {new Date().getTime() > new Date(selectedChallenge.deadline_at).getTime() ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Đã quá hạn nộp bài
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đang nhận bài dự thi
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedChallenge(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition w-full sm:w-auto"
                >
                  Đóng
                </button>

                {new Date().getTime() > new Date(selectedChallenge.deadline_at).getTime() ? (
                  <button
                    disabled
                    className="px-5 py-2 bg-slate-800 text-slate-500 text-xs font-medium rounded-xl cursor-not-allowed w-full sm:w-auto"
                  >
                    Đã Hết Hạn Nộp
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!user) {
                        alert('Vui lòng đăng nhập để nộp bài dự thi cho thử thách này.');
                        return;
                      }
                      setSubmittingChallenge(selectedChallenge);
                    }}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Nộp Giải Pháp Của Bạn
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Modal */}
      {submittingChallenge && user && (
        <SubmissionModal
          challenge={submittingChallenge}
          user={user}
          onClose={() => setSubmittingChallenge(null)}
          onSuccess={(sub) => {
            setSubmittingChallenge(null);
            setSelectedChallenge(null);
            setNotification(
              `Nộp giải pháp "${sub.title}" thành công! Trạng thái: ${sub.status.toUpperCase()}.`
            );
            setTimeout(() => setNotification(null), 6000);
            if (onNavigateToSubmissions) {
              onNavigateToSubmissions();
            }
          }}
        />
      )}
    </div>
  );
};
