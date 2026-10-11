import React, { useState, useEffect } from 'react';
import {
  Trophy,
  CheckCircle2,
  AlertTriangle,
  Building2,
  DollarSign,
  User,
  Shield,
  FileText,
  Lock,
} from 'lucide-react';
import type { Challenge } from '../../types/challenge.types';
import type { Submission } from '../../types/submission.types';
import type { PulsarUser } from '../../types/auth.types';
import { challengeService } from '../../lib/challenge/challengeService';
import { submissionService } from '../../lib/submission/submissionService';
import { outcomeRewardService } from '../../lib/outcome/outcomeRewardService';

interface OutcomeFinalizerModalProps {
  challengeId: string;
  user: PulsarUser;
  onClose: () => void;
  onSuccess: () => void;
}

export const OutcomeFinalizerModal: React.FC<OutcomeFinalizerModalProps> = ({
  challengeId,
  user,
  onClose,
  onSuccess,
}) => {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [hasWinner, setHasWinner] = useState<boolean>(true);
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [prizeAmount, setPrizeAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<'USD' | 'VND' | 'EUR'>('USD');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChallengeAndSubmissions();
  }, [challengeId]);

  const loadChallengeAndSubmissions = async () => {
    setLoading(true);
    const chalRes = challengeService.getChallengeById(challengeId);
    if (chalRes.challenge) {
      setChallenge(chalRes.challenge);
      setPrizeAmount(chalRes.challenge.prize_pool || chalRes.challenge.budget_max || 0);
      setCurrency((chalRes.challenge.currency as any) || 'USD');

      // Load submissions for this challenge
      const subsRes = submissionService.getChallengeSubmissions(
        challengeId,
        user.id,
        user.role,
        true // Org member
      );
      if (subsRes.submissions) {
        setSubmissions(subsRes.submissions);
        if (subsRes.submissions.length > 0) {
          setSelectedSubId(subsRes.submissions[0].id);
        }
      }
    }
    setLoading(false);
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setSubmitting(true);
    setError(null);

    const winningSub = submissions.find((s) => s.id === selectedSubId);

    const res = await outcomeRewardService.finalizeOutcome(
      {
        challenge_id: challenge.id,
        organization_id: challenge.organization_id,
        has_winner: hasWinner,
        winning_submission_id: hasWinner && winningSub ? winningSub.id : null,
        winner_id: hasWinner && winningSub ? winningSub.submitted_by : null,
        decision_reason: decisionReason,
        final_score: winningSub?.average_score,
        awarded_prize_amount: hasWinner ? prizeAmount : 0,
        currency,
      },
      user
    );

    if (res.error) {
      setError(res.error);
      setSubmitting(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">
              Nghiệm Thu & Chốt Kết Quả Đề Bài (Finalize Outcome)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-500">Đang tải dữ liệu...</div>
        ) : !challenge ? (
          <div className="text-xs text-rose-400">Không tìm thấy thông tin đề bài</div>
        ) : (
          <form onSubmit={handleFinalize} className="space-y-4">
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Đề bài mục tiêu:</div>
              <div className="text-sm font-bold text-white">{challenge.title}</div>
              <div className="text-xs text-slate-500">
                Tổ chức: {challenge.organization_name} • Ngân sách: ${challenge.prize_pool || challenge.budget_max} {challenge.currency}
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Winner selection toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Kết quả lựa chọn:</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="hasWinner"
                    checked={hasWinner}
                    onChange={() => setHasWinner(true)}
                    className="text-indigo-600 focus:ring-0"
                  />
                  <span>Đã chọn được người thắng cuộc (Có giải thưởng)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="hasWinner"
                    checked={!hasWinner}
                    onChange={() => setHasWinner(false)}
                    className="text-indigo-600 focus:ring-0"
                  />
                  <span>Không có giải pháp đạt yêu cầu (Không trao giải)</span>
                </label>
              </div>
            </div>

            {hasWinner && (
              <>
                {/* Select submission */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Chọn bài dự thi chiến thắng:
                  </label>
                  {submissions.length === 0 ? (
                    <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs">
                      Chưa có bài dự thi nào được nộp cho đề bài này.
                    </div>
                  ) : (
                    <select
                      value={selectedSubId}
                      onChange={(e) => setSelectedSubId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {submissions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} — {s.creator_name} ({s.average_score ? `Điểm: ${s.average_score}/100` : 'Chưa có điểm'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Prize amount */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Giá trị giải thưởng trao tặng:
                    </label>
                    <input
                      type="number"
                      value={prizeAmount}
                      onChange={(e) => setPrizeAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Tiền tệ:</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="USD">USD</option>
                      <option value="VND">VND</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Decision Reason */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Lý do ra quyết định & Nhận xét nghiệm thu (tối thiểu 15 ký tự):
              </label>
              <textarea
                rows={3}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Nêu rõ lý do lựa chọn giải pháp này, mức độ đáp ứng KPI, chất lượng kỹ thuật hoặc lý do không chọn người thắng..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Warning about Separation of Duties */}
            <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Kiểm toán an toàn:</strong> Kết quả sau khi chốt sẽ đóng đề bài, tự động khởi tạo bản ghi Giải Thưởng (Reward) và cấp Chứng chỉ số cho Creator. Người tạo đề bài không được tự duyệt trừ khi có vai trò Owner tổ chức hoặc Admin.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs rounded-lg text-slate-400 hover:text-slate-200 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {submitting ? 'Đang xử lý...' : 'Xác Nhận & Chốt Kết Quả'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
