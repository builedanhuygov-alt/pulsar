import React, { useState, useEffect } from 'react';
import {
  Users,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Award,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { TalentMatchItem } from '../../types/matching.types';
import type { PulsarUser } from '../../types/auth.types';
import { matchingService } from '../../lib/matching/matchingService';
import { MatchExplanationPanel } from './MatchExplanationPanel';

interface BusinessTalentMatchesProps {
  challengeId: string;
  challengeTitle: string;
  user: PulsarUser | null;
}

export const BusinessTalentMatches: React.FC<BusinessTalentMatchesProps> = ({
  challengeId,
  challengeTitle,
  user,
}) => {
  const [candidates, setCandidates] = useState<TalentMatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCandidates();
  }, [challengeId, user]);

  const loadCandidates = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const res = await matchingService.getTalentMatchesForChallenge(challengeId, user);
    if (res.error) {
      setError(res.error);
    } else {
      setCandidates(res.data);
    }
    setLoading(false);
  };

  if (!user || user.role === 'creator') {
    return (
      <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-400">
        Tính năng này dành cho Doanh nghiệp sở hữu đề bài để tìm kiếm nhân tài phù hợp.
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          Ứng Viên Phù Hợp Nhất (AI Talent Matching)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Đối chiếu tự động giữa yêu cầu của đề bài "<strong>{challengeTitle}</strong>" với năng lực, bằng chứng và uy tín của các chuyên gia.
        </p>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      ) : loading ? (
        <div className="text-center py-8 text-xs text-slate-500">Đang phân tích dữ liệu ứng viên...</div>
      ) : candidates.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-500">
          Chưa tìm thấy ứng viên phù hợp với đề bài này.
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((cand) => (
            <div
              key={cand.creator_id}
              className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4 hover:border-slate-700 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-900/40 border border-indigo-700/60 flex items-center justify-center font-bold text-indigo-300 text-sm">
                    {cand.creator_name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{cand.creator_name}</h4>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {cand.reputation_tier}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{cand.creator_bio}</p>
                  </div>
                </div>

                <div className="text-right sm:shrink-0 text-xs">
                  <div className="text-slate-500">Độ phù hợp đề bài</div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {cand.match.composite_match_score}%
                  </div>
                </div>
              </div>

              {/* Match Explanation */}
              <MatchExplanationPanel match={cand.match} compact={true} />

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <span>Tuân thủ nguyên tắc: Không tự ý liên hệ hay gửi lời mời tự động khi chưa có quyết định của con người.</span>
                <span className="text-indigo-400 font-mono text-[11px]">Sẵn sàng tiếp nhận đề bài</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
