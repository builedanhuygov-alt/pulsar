import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Filter,
  DollarSign,
  Clock,
  Building2,
  ExternalLink,
  Heart,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { CreatorFeedItem } from '../../types/matching.types';
import type { PulsarUser } from '../../types/auth.types';
import { matchingService } from '../../lib/matching/matchingService';
import { MatchExplanationPanel } from './MatchExplanationPanel';

interface CreatorRecommendationFeedProps {
  user: PulsarUser | null;
  onSelectChallenge?: (challengeId: string) => void;
}

export const CreatorRecommendationFeed: React.FC<CreatorRecommendationFeedProps> = ({
  user,
  onSelectChallenge,
}) => {
  const [feedItems, setFeedItems] = useState<CreatorFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, [user, categoryFilter]);

  const loadFeed = async () => {
    setLoading(true);
    const creatorId = user?.id || 'usr-creator-001';
    const items = await matchingService.getCreatorFeed(creatorId, {
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
    });
    setFeedItems(items);
    setLoading(false);
  };

  const handleAction = async (challengeId: string, action: 'interested' | 'dismissed', score: number) => {
    if (!user) return;
    await matchingService.recordFeedback(
      {
        challenge_id: challengeId,
        feed_type: 'creator_feed',
        action,
        match_score: score,
        confidence_level: 'high',
      },
      user
    );

    if (action === 'dismissed') {
      setFeedItems((prev) => prev.filter((item) => item.challenge.id !== challengeId));
      setNotification('Đã ẩn thử thách khỏi luồng gợi ý của bạn.');
    } else {
      setNotification('Đã lưu vào danh sách thử thách quan tâm!');
      await loadFeed();
    }
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-950/60 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Matching Engine • Đề Xuất Cá Nhân Hóa Có Thể Giải Thích</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Luồng Thử Thách Dành Riêng Cho Bạn (Creator Feed)
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Hệ thống đối chiếu hồ sơ kỹ năng, các chứng thực số đã nghiệm thu và xếp hạng uy tín của bạn với đề bài mở của doanh nghiệp. Chỉ đề xuất các thử thách còn hạn nộp, kèm điểm phù hợp và minh bạch cơ sở gợi ý.
          </p>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-violet-950/80 border border-violet-800 text-violet-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Lọc theo chuyên môn:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả danh mục</option>
            <option value="ai_ml">AI & Machine Learning</option>
            <option value="blockchain">Blockchain & Smart Contract</option>
            <option value="cloud_devops">Cloud & DevOps</option>
            <option value="fintech">Fintech & Payments</option>
          </select>
        </div>

        <span className="text-slate-500 font-mono">
          Tìm thấy <strong className="text-slate-300">{feedItems.length}</strong> thử thách phù hợp
        </span>
      </div>

      {/* Feed list */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-500">Đang phân tích độ phù hợp hồ sơ...</div>
      ) : feedItems.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-2">
          <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">Chưa có đề xuất phù hợp mới</div>
          <p className="max-w-md mx-auto text-slate-500">
            Hãy cập nhật thêm kỹ năng hoặc nộp bằng chứng chứng chỉ trong hồ sơ để thuật toán Matching đối chiếu chuẩn xác hơn.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {feedItems.map(({ challenge, match }) => (
            <div
              key={challenge.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition"
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-indigo-900/50">
                      {challenge.category}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      {challenge.organization_name}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white hover:text-indigo-300 transition">
                    {challenge.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {challenge.short_description}
                  </p>
                </div>

                <div className="text-right sm:shrink-0 bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-500">Giải thưởng đề bài</div>
                  <div className="text-lg font-black text-amber-400 font-mono">
                    ${challenge.prize_pool || challenge.budget_max} {challenge.currency}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" /> Hạn: {new Date(challenge.deadline_at).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>

              {/* Match Explanation Panel */}
              <MatchExplanationPanel match={match} compact={false} />

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(challenge.id, 'interested', match.composite_match_score)}
                    className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                      match.is_interested
                        ? 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5" /> {match.is_interested ? 'Đã Quan Tâm' : 'Quan Tâm'}
                  </button>

                  <button
                    onClick={() => handleAction(challenge.id, 'dismissed', match.composite_match_score)}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800 transition flex items-center gap-1.5"
                  >
                    <EyeOff className="w-3.5 h-3.5" /> Ẩn Đề Xuất
                  </button>
                </div>

                {onSelectChallenge && (
                  <button
                    onClick={() => onSelectChallenge(challenge.id)}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                  >
                    Xem Chi Tiết & Nộp Bài
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
