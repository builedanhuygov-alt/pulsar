import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building2,
  ExternalLink,
  ChevronRight,
  Filter,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import type {
  ChallengeOutcome,
  Reward,
  BusinessImpactMetrics,
} from '../../types/outcome.types';
import type { PulsarUser } from '../../types/auth.types';
import { outcomeRewardService } from '../../lib/outcome/outcomeRewardService';

interface OutcomeDashboardProps {
  user: PulsarUser | null;
  onNavigateToPortfolios?: () => void;
  onNavigateToRewards?: () => void;
}

export const OutcomeDashboard: React.FC<OutcomeDashboardProps> = ({
  user,
  onNavigateToPortfolios,
  onNavigateToRewards,
}) => {
  const [outcomes, setOutcomes] = useState<ChallengeOutcome[]>([]);
  const [metrics, setMetrics] = useState<BusinessImpactMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: outcomeList } = await outcomeRewardService.getOutcomes();
    setOutcomes(outcomeList);

    const { data: impact } = await outcomeRewardService.getBusinessImpactMetrics(
      user?.organizations?.[0]?.organization.id || 'org-tech-01'
    );
    if (impact) setMetrics(impact);

    setLoading(false);
  };

  const totalPrizeDisbursed = outcomes
    .filter((o) => o.status === 'finalized')
    .reduce((sum, o) => sum + o.awarded_prize_amount, 0);

  const totalWinners = outcomes.filter((o) => o.has_winner).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <Trophy className="w-3.5 h-3.5" />
            <span>Sprint 4: Outcome & Reward Engine • Kết Quả & Vinh Danh</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Bảng Vàng Kết Quả & Tác Động Thực Tế (Business Impact)
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Mọi bài toán thực tế sau khi nghiệm thu được ghi nhận minh bạch: người thắng cuộc, giá trị giải thưởng được giải ngân, hồ sơ năng lực xác minh điện tử và chỉ số tác động kinh doanh đo lường được cho Doanh nghiệp.
          </p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 font-medium">Đề Bài Đã Chốt</div>
              <div className="text-xl font-bold text-white mt-1">{outcomes.length}</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 font-medium">Giải Pháp Xuất Sắc</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{totalWinners}</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 font-medium">Tổng Giải Ngân (USD)</div>
              <div className="text-xl font-bold text-amber-400 mt-1">
                ${totalPrizeDisbursed.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 font-medium">Xác Thực Portfolio</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">100% Verified</div>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Metric Cards for Enterprise */}
      {metrics && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Chỉ Số Đo Lường Hiệu Quả Đổi Mới (Business Impact Metrics)
              </h3>
              <p className="text-xs text-slate-400">
                Tổ chức: <span className="font-semibold text-slate-300">{metrics.organization_name}</span> • Benchmark thực nghiệm
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Thời gian trung bình ra giải pháp: {metrics.avg_time_to_outcome_days} ngày
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Tỷ lệ nghiệm thu thành công</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {metrics.acceptance_rate_percent}%
              </div>
              <div className="text-[11px] text-slate-500">
                {metrics.total_submissions_accepted} giải pháp vượt qua vòng thẩm định gắt gao
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Ngân sách ký quỹ giải ngân</div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                ${metrics.total_prizes_disbursed.toLocaleString()} / ${metrics.total_prizes_allocated.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Qua cơ chế Mock Escrow an toàn, bảo vệ cả hai bên
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Chỉ số chuyển đổi giá trị</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">18.4% KPI Tối Ưu</div>
              <div className="text-[11px] text-slate-500">
                Tiết kiệm năng lượng và giảm 48h thẩm định hợp đồng
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List of Outcomes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Danh Sách Kết Quả Đã Chốt & Vinh Danh
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {outcomes.length} kết quả đã chốt
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Đang tải dữ liệu kết quả...</div>
        ) : outcomes.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl p-6 text-slate-400">
            Chưa có thử thách nào được chốt kết quả nghiệm thu.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {outcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="p-5 bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {outcome.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        Chốt ngày {new Date(outcome.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-white mt-1">
                      {outcome.challenge_title}
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      {outcome.organization_name} • Ra quyết định bởi: <span className="text-slate-300 font-medium">{outcome.decider_name}</span>
                    </p>
                  </div>

                  <div className="text-right sm:shrink-0 bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-500">Giải thưởng trao tặng</div>
                    <div className="text-lg font-extrabold text-amber-400 font-mono">
                      ${outcome.awarded_prize_amount.toLocaleString()} {outcome.currency}
                    </div>
                  </div>
                </div>

                {outcome.has_winner ? (
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-900/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-slate-300">
                          Người chiến thắng: <span className="text-emerald-400">{outcome.winner_name}</span>
                        </span>
                      </div>
                      {outcome.final_score && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Điểm Rubric: {outcome.final_score}/100
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 font-medium">
                      Bài giải pháp: "{outcome.winning_submission_title}"
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-emerald-500/50 pl-3 py-0.5">
                      "{outcome.decision_reason}"
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400 italic">
                    Không có người chiến thắng cho đề bài này. {outcome.decision_reason}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Chứng chỉ số đã cấp cho Creator</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onNavigateToPortfolios && (
                      <button
                        onClick={onNavigateToPortfolios}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs font-medium"
                      >
                        Xem Portfolio Xác Minh
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
