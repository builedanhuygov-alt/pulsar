import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Award,
} from 'lucide-react';
import type { ChallengeCreatorMatch } from '../../types/matching.types';

interface MatchExplanationPanelProps {
  match: ChallengeCreatorMatch;
  compact?: boolean;
}

export const MatchExplanationPanel: React.FC<MatchExplanationPanelProps> = ({
  match,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(!compact);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-indigo-400';
    return 'text-amber-400';
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">High Confidence</span>;
      case 'medium':
        return <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Medium Confidence</span>;
      default:
        return <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">Insufficient Data</span>;
    }
  };

  return (
    <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 space-y-3 text-xs">
      {/* Top summary row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-slate-200">
            Độ Phù Hợp: <span className={`font-mono ${getScoreColor(match.composite_match_score)}`}>{match.composite_match_score}%</span>
          </span>
          {getConfidenceBadge(match.confidence)}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono text-[11px]"
        >
          {expanded ? <>Thu gọn <ChevronUp className="w-3.5 h-3.5" /></> : <>Chi tiết giải trình <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      </div>

      {/* Highlights */}
      {match.reasons.length > 0 && (
        <div className="space-y-1">
          {match.reasons.map((r, i) => (
            <div key={i} className="text-slate-300 flex items-start gap-1.5 leading-relaxed">
              <span className="text-emerald-400 font-bold shrink-0">✓</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded 5 component breakdown */}
      {expanded && (
        <div className="pt-3 border-t border-slate-900 space-y-3 animate-fadeIn">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Phân Rã 5 Tiêu Chí Trọng Số (Transparent Breakdown):
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.entries(match.components).map(([key, comp]) => (
              <div key={key} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-medium text-slate-300">{comp.name}</span>
                  <span className="font-mono font-bold text-slate-200">
                    {comp.score}/100 <span className="text-slate-500 font-normal">({comp.weight}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${comp.score}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  {comp.explanation}
                </div>
              </div>
            ))}
          </div>

          {match.skill_gaps.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/30 text-[11px] text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Khoảng trống kỹ năng cần lưu ý:</strong> {match.skill_gaps.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
