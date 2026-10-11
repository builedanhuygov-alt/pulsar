import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  FileCheck,
  RefreshCw,
  Plus,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { CopilotAnalysisResult } from '../../types/matching.types';
import type { ChallengeFormData } from '../../lib/validation/challenge.schema';
import { matchingService } from '../../lib/matching/matchingService';

interface ChallengeAICopilotProps {
  formData: ChallengeFormData;
  onApplyRubric: (criteria: any[]) => void;
  onApplyDeliverableSuggestion: (suggestion: string) => void;
}

export const ChallengeAICopilot: React.FC<ChallengeAICopilotProps> = ({
  formData,
  onApplyRubric,
  onApplyDeliverableSuggestion,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CopilotAnalysisResult | null>(null);
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setAppliedFeedback(null);
    try {
      const analysis = await matchingService.analyzeChallengeWithCopilot({
        title: formData.title || 'Thử thách mới',
        short_description: formData.short_description || 'Mô tả ngắn',
        problem_statement: formData.problem_statement || 'Nội dung bài toán',
        desired_outcome: formData.desired_outcome || 'Kết quả kỳ vọng',
        category: formData.category || 'ai_ml',
        requirements: formData.requirements || ['Yêu cầu kỹ thuật'],
        deliverables: formData.deliverables || ['Mã nguồn sản phẩm'],
        budget_min: formData.budget_min || 0,
        budget_max: formData.budget_max || 0,
        deadline_at: formData.deadline_at || new Date().toISOString(),
      });
      setResult(analysis);
    } catch (err: any) {
      console.error(err);
    }
    setAnalyzing(false);
  };

  const handleApplyCriteria = () => {
    if (!result) return;
    onApplyRubric(result.rubric_suggestions.suggested_criteria);
    setAppliedFeedback('Đã áp dụng khung chấm điểm Rubric chuẩn hóa 100% vào form!');
    setTimeout(() => setAppliedFeedback(null), 3000);
  };

  const handleApplyDeliverable = (suggestion: string) => {
    onApplyDeliverableSuggestion(suggestion);
    setAppliedFeedback(`Đã thêm sản phẩm bàn giao: "${suggestion}"`);
    setTimeout(() => setAppliedFeedback(null), 3000);
  };

  return (
    <div className="bg-slate-950/90 border border-indigo-900/40 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              Challenge AI Copilot • Trợ Lý Tinh Chỉnh Đề Bài
            </h4>
            <p className="text-[11px] text-slate-400">
              Phân tích mục tiêu, phát hiện mâu thuẫn và đề xuất rubric chuẩn hóa 100%
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={analyzing}
          onClick={handleRunAnalysis}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 self-start sm:self-auto"
        >
          {analyzing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang phân tích...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> Phân Tích & Đề Xuất
            </>
          )}
        </button>
      </div>

      {appliedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{appliedFeedback}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4 text-xs animate-fadeIn">
          {/* Clarity score meter */}
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-300">Điểm Độ Rõ Ràng & Khả Thi (Clarity Score)</div>
              <div className="text-[11px] text-slate-500">Mức độ hoàn thiện trước khi gửi Quản trị viên duyệt</div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-emerald-400">{result.clarity_score}/100</span>
            </div>
          </div>

          {/* Unclear objectives & suggestions */}
          {result.unclear_objectives.length > 0 && (
            <div className="p-3.5 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-1.5">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Điểm Cần Làm Rõ:
              </div>
              {result.unclear_objectives.map((obj, i) => (
                <div key={i} className="text-slate-300 pl-4 border-l-2 border-amber-500/50">
                  {obj}
                </div>
              ))}
            </div>
          )}

          {/* Deliverables refinements */}
          {result.deliverable_refinements.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-cyan-400" /> Đề Xuất Sản Phẩm Bàn Giao Cụ Thể Hóa:
              </div>
              <div className="space-y-2">
                {result.deliverable_refinements.map((del, i) => (
                  <div key={i} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-slate-200 font-medium">{del.suggestion}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{del.reason}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyDeliverable(del.suggestion)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium shrink-0"
                    >
                      + Thêm vào form
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rubric suggestion */}
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-indigo-400" /> Đề Xuất Rubric Chuẩn Hóa (Tổng Trọng Số = 100%):
              </div>
              <button
                type="button"
                onClick={handleApplyCriteria}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition shadow-sm"
              >
                Áp Dụng Khung Rubric Này
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {result.rubric_suggestions.suggested_criteria.map((c) => (
                <div key={c.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-850 space-y-0.5">
                  <div className="font-semibold text-slate-200 truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{c.description}</div>
                  <div className="font-mono text-emerald-400 font-bold text-[11px]">{c.weight}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
