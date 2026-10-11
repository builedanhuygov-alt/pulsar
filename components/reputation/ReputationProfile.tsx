import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Award,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  HelpCircle,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import type {
  CreatorReputationProfile,
  ReputationTier,
} from '../../types/reputation.types';
import type { PulsarUser } from '../../types/auth.types';
import { reputationAnalyticsService } from '../../lib/reputation/reputationService';

interface ReputationProfileProps {
  user: PulsarUser | null;
  onNavigateToSkills?: () => void;
}

const TIER_CONFIG: Record<
  ReputationTier,
  { label: string; color: string; bgColor: string; borderColor: string; description: string }
> = {
  insufficient_data: {
    label: 'Chưa Đủ Dữ Liệu',
    color: 'text-slate-400',
    bgColor: 'bg-slate-900',
    borderColor: 'border-slate-800',
    description: 'Cần tối thiểu 1 giải pháp được nghiệm thu để hệ thống tính toán điểm uy tín.',
  },
  emerging: {
    label: 'Tài Năng Mới (Emerging)',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950/60',
    borderColor: 'border-cyan-800',
    description: 'Đã hoàn thành các bài toán thực tế đầu tiên và có phản hồi tích cực.',
  },
  verified_talent: {
    label: 'Chuyên Gia Xác Thực (Verified)',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-950/60',
    borderColor: 'border-indigo-800',
    description: 'Có hồ sơ năng lực và kỹ năng được doanh nghiệp thẩm định chính thức.',
  },
  top_contributor: {
    label: 'Nhà Đóng Góp Xuất Sắc (Top Contributor)',
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/60',
    borderColor: 'border-amber-800',
    description: 'Hiệu suất giao bài cao, điểm Rubric ổn định trên 80%.',
  },
  elite_innovator: {
    label: 'Nhà Đổi Mới Hàng Đầu (Elite Innovator)',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/60',
    borderColor: 'border-emerald-800',
    description: 'Chiến thắng giải Nhất đề bài doanh nghiệp, đạt độ tin cậy và chất lượng cao nhất.',
  },
};

export const ReputationProfile: React.FC<ReputationProfileProps> = ({
  user,
  onNavigateToSkills,
}) => {
  const [profile, setProfile] = useState<CreatorReputationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReputation();
  }, [user]);

  const loadReputation = async () => {
    setLoading(true);
    const creatorId = user?.id || 'usr-creator-001';
    const rep = await reputationAnalyticsService.computeCreatorReputation(creatorId);
    setProfile(rep);
    setLoading(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Đang tải hồ sơ uy tín...</div>;
  }

  if (!profile) return null;

  const tier = TIER_CONFIG[profile.reputation_tier];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Reputation Engine • Uy Tín Dựa Trên Bằng Chứng Thực Tế</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Hồ Sơ Uy Tín Chuyên Môn (Reputation & Provenance)
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Điểm uy tín trên PULSAR được tính toán tự động dựa trên dữ liệu có nguồn gốc rõ ràng (provenance-backed): kết quả đề bài thực tế, điểm đánh giá Rubric độc lập, kỹ năng được kiểm chứng và cam kết bàn giao đúng hạn. Người dùng không thể tự can thiệp điểm số.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Score Summary */}
        <div className="lg:col-span-1 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5 text-center flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Điểm Uy Tín Tổng Hợp (Composite Score)
            </span>
            <div className="mt-4 flex items-center justify-center">
              {profile.composite_reputation_score !== null ? (
                <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-4 border-indigo-500/40 bg-slate-950 shadow-inner">
                  <span className="text-4xl font-extrabold text-white font-mono">
                    {profile.composite_reputation_score}
                  </span>
                  <span className="text-xs text-slate-500 absolute bottom-4">/100</span>
                </div>
              ) : (
                <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400">
                  <Info className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                  Chưa Đủ Dữ Liệu
                </div>
              )}
            </div>

            <div className={`mt-4 inline-block px-3 py-1 rounded-full text-xs font-semibold border ${tier.bgColor} ${tier.color} ${tier.borderColor}`}>
              {tier.label}
            </div>
            <p className="text-xs text-slate-400 mt-2 px-2 leading-relaxed">
              {tier.description}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Đề bài tham gia:</span>
              <strong className="text-slate-200 font-mono">{profile.total_challenges_participated}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Bài giải pháp được duyệt:</span>
              <strong className="text-emerald-400 font-mono">{profile.total_submissions_accepted}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Kết quả vinh danh:</span>
              <strong className="text-amber-400 font-mono">{profile.total_verified_outcomes}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Kỹ năng được xác thực:</span>
              <strong className="text-cyan-400 font-mono">{profile.verified_skills_count}</strong>
            </div>
          </div>
        </div>

        {/* Right Cards: Provenance Breakdown */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Nguồn Gốc & Giải Trình Dữ Liệu Điểm Số (Score Provenance)
              </h3>
              <p className="text-xs text-slate-400">
                Minh bạch cách tính điểm và dữ liệu đầu vào theo từng chỉ số thành phần
              </p>
            </div>
            {onNavigateToSkills && (
              <button
                onClick={onNavigateToSkills}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                Xem bằng chứng kỹ năng <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {profile.provenance_breakdown.map((item, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{item.metric}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono border border-slate-800">
                      Trọng số: {item.weight}%
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    Giá trị: {item.value !== null ? item.value : 'Chưa có dữ liệu'}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.explanation}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                  <span>Số mẫu dữ liệu: {item.data_points_count}</span>
                  <span className={item.is_reliable ? 'text-emerald-400' : 'text-amber-400'}>
                    {item.is_reliable ? '✓ Đủ độ tin cậy' : '⚠ Cần thêm mẫu'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
