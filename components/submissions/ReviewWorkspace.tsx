import React, { useState, useMemo } from 'react';
import type { Challenge } from '../../types/challenge.types';
import type {
  Submission,
  SubmissionReview,
  SubmissionStatus,
  RubricScoreItem,
} from '../../types/submission.types';
import type { PulsarUser } from '../../types/auth.types';
import { challengeService } from '../../lib/challenge/challengeService';
import { submissionService } from '../../lib/submission/submissionService';
import {
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Lock,
  Layers,
  Building2,
  ExternalLink,
  FileCode,
  Send,
  Save,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface ReviewWorkspaceProps {
  user: PulsarUser;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({ user }) => {
  const isBusinessOrAdmin = user.role === 'business' || user.role === 'admin';

  // Available organizations user belongs to
  const userOrgs = user.organizations.map((m) => m.organization);
  const defaultOrgId = userOrgs[0]?.id || 'org-lab-01';
  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultOrgId);

  // Challenges belonging to this org
  const orgChallenges = useMemo(() => {
    return challengeService.getOrganizationChallenges(selectedOrgId);
  }, [selectedOrgId]);

  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    orgChallenges[0]?.id || 'ch-demo-001'
  );

  const selectedChallenge =
    orgChallenges.find((c) => c.id === selectedChallengeId) || orgChallenges[0];

  // Fetch submissions for this challenge with strict authorization
  const { submissions = [], error: authError } = useMemo(() => {
    if (!selectedChallenge) return { submissions: [] };
    const res = submissionService.getChallengeSubmissions(
      selectedChallenge.id,
      user.id,
      user.role,
      true // Authenticated as org member in this view
    );
    return res.success ? { submissions: res.submissions || [] } : { submissions: [], error: res.error };
  }, [selectedChallenge, user.id, user.role]);

  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(
    submissions[0] || null
  );

  // Rubric Scoring State
  const initialCriteria = selectedChallenge?.evaluation_criteria || [
    { id: 'crit-1', name: 'Độ chính xác kỹ thuật', weight: 50, description: '' },
    { id: 'crit-2', name: 'Kiến trúc & Tối ưu hiệu năng', weight: 30, description: '' },
    { id: 'crit-3', name: 'Tài liệu & Test Coverage', weight: 20, description: '' },
  ];

  const [rubricScores, setRubricScores] = useState<Record<string, { score: number; comments: string }>>({
    'crit-1': { score: 85, comments: 'Triển khai tốt, đáp ứng đúng yêu cầu đề bài.' },
    'crit-2': { score: 90, comments: 'Kiến trúc module sạch sẽ, dễ mở rộng.' },
    'crit-3': { score: 80, comments: 'Tài liệu hướng dẫn đầy đủ.' },
  });

  const [feedback, setFeedback] = useState('Giải pháp rất chất lượng, đáp ứng tốt các tiêu chuẩn kỹ thuật.');
  const [decision, setDecision] = useState<'shortlist' | 'accept' | 'reject' | 'needs_revision'>('shortlist');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Calculate live weighted score
  const totalWeightedScore = useMemo(() => {
    let sum = 0;
    let totalWeight = 0;
    initialCriteria.forEach((crit) => {
      const scoreObj = rubricScores[crit.id] || { score: 0 };
      sum += (scoreObj.score * crit.weight) / 100;
      totalWeight += crit.weight;
    });
    return totalWeight > 0 ? Number(((sum / totalWeight) * 100).toFixed(1)) : 0;
  }, [initialCriteria, rubricScores]);

  // Anti Self-Review Check
  const isSelfSubmission = activeSubmission?.submitted_by === user.id;

  const handleScoreChange = (critId: string, val: number) => {
    setRubricScores((prev) => ({
      ...prev,
      [critId]: { ...prev[critId], score: Math.min(100, Math.max(0, val)) },
    }));
  };

  const handleCommentChange = (critId: string, comment: string) => {
    setRubricScores((prev) => ({
      ...prev,
      [critId]: { ...prev[critId], comments: comment },
    }));
  };

  const handleSubmitReview = (isDraft: boolean) => {
    if (!activeSubmission) return;
    setReviewMessage(null);
    setIsSubmitting(true);

    const scoresList: RubricScoreItem[] = initialCriteria.map((c) => ({
      criterion_id: c.id,
      criterion_name: c.name,
      weight: c.weight,
      score: rubricScores[c.id]?.score ?? 75,
      comments: rubricScores[c.id]?.comments ?? '',
    }));

    const res = submissionService.submitReview(
      activeSubmission.id,
      {
        submission_id: activeSubmission.id,
        status: isDraft ? 'draft' : 'submitted',
        rubric_scores: scoresList,
        total_weighted_score: totalWeightedScore,
        feedback: feedback.trim(),
        decision,
      },
      user.id,
      user.profile.display_name,
      user.role,
      true
    );

    if (res.success && res.submission) {
      setReviewMessage({
        type: 'success',
        text: `Đã lưu đánh giá bài thi "${activeSubmission.title}" thành công. Điểm tổng: ${totalWeightedScore}/100.`,
      });
      setActiveSubmission(res.submission);
    } else {
      setReviewMessage({
        type: 'error',
        text: res.error || 'Lỗi xử lý đánh giá bài thi.',
      });
    }
    setIsSubmitting(false);
  };

  if (!isBusinessOrAdmin) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Yêu Cầu Quyền Doanh Nghiệp Hoặc Quản Trị Viên</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Chỉ các tài khoản Doanh nghiệp chủ quản hoặc Super Admin mới có quyền truy cập không gian chấm điểm và xem bài thi của thí sinh. Vui lòng đổi Persona sang Business hoặc Admin để sử dụng.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Org Selector */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Ban Giám Khảo Doanh Nghiệp • Không Gian Thẩm Định</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Chấm Điểm & Đánh Giá Bài Dự Thi (Review Workspace)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Đánh giá giải pháp theo khung tiêu chí Rubric minh bạch, chấm điểm theo trọng số và ra quyết định trao giải.
          </p>
        </div>

        {/* Org & Challenge Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {orgChallenges.length > 0 && (
            <select
              value={selectedChallengeId}
              onChange={(e) => {
                setSelectedChallengeId(e.target.value);
                const firstSub = submissionService.getChallengeSubmissions(
                  e.target.value,
                  user.id,
                  user.role,
                  true
                ).submissions?.[0];
                setActiveSubmission(firstSub || null);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-medium"
            >
              {orgChallenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.status})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {authError && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {reviewMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in ${
            reviewMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          {reviewMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{reviewMessage.text}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Submissions List & Selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Danh sách bài nộp ({submissions.length})</span>
            <span className="text-[10px] text-slate-500 font-mono">Bảo mật IDOR</span>
          </div>

          {submissions.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Chưa có bài dự thi nào được nộp cho thử thách này.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {submissions.map((sub) => {
                const isSelected = activeSubmission?.id === sub.id;
                return (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setActiveSubmission(sub);
                      setReviewMessage(null);
                    }}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-violet-950/40 border-violet-500 shadow-lg shadow-violet-950/30'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {sub.status}
                      </span>
                      {sub.average_score !== undefined && (
                        <span className="text-[11px] font-mono font-bold text-amber-400">
                          {sub.average_score}/100
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                      {sub.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
                      <span>Tác giả: {sub.creator_name || 'Creator'}</span>
                      <span>v{sub.version}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Review & Rubric Evaluation Form (8 Cols) */}
        <div className="lg:col-span-8">
          {activeSubmission ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              {/* Submission Header */}
              <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                      Bài thi: {activeSubmission.id}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Tác giả: {activeSubmission.creator_name} ({activeSubmission.creator_email})
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {activeSubmission.title}
                  </h3>
                </div>

                <div className="text-right font-mono">
                  <div className="text-[10px] text-slate-400">Điểm tổng theo trọng số</div>
                  <div className="text-xl font-bold text-amber-400">{totalWeightedScore} / 100</div>
                </div>
              </div>

              {/* Anti Self-Review Warning Guard */}
              {isSelfSubmission && (
                <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    <strong>QUY TẮC AN NINH (Segregation of Duties):</strong> Bạn chính là tác giả của bài dự thi này. Theo quy định bảo mật, bạn không được phép tự chấm điểm bài thi của chính mình.
                  </span>
                </div>
              )}

              {/* Solution Summary & Content */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Tóm tắt giải pháp
                </h4>
                <p className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
                  {activeSubmission.solution_summary}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Thuyết minh kỹ thuật chi tiết
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
                  {activeSubmission.solution_content}
                </p>
              </div>

              {/* Attachments & Link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                    Đường dẫn Repository / Demo
                  </div>
                  {activeSubmission.solution_url ? (
                    <a
                      href={activeSubmission.solution_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:underline break-all font-mono"
                    >
                      {activeSubmission.solution_url}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Không có đường dẫn demo</span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Tệp đính kèm ({activeSubmission.files.length} tệp bảo mật)
                  </div>
                  {activeSubmission.files.length > 0 ? (
                    <div className="space-y-1">
                      {activeSubmission.files.map((f) => (
                        <div key={f.id} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-300 truncate max-w-[180px]">{f.name}</span>
                          {f.signed_url && (
                            <a
                              href={f.signed_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-violet-400 hover:underline font-mono"
                            >
                              Tải về có chữ ký
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Không đính kèm tệp</span>
                  )}
                </div>
              </div>

              {/* Rubric Evaluation Form */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Award className="w-4 h-4" /> Khung Chấm Điểm Rubric Theo Trọng Số
                  </h4>
                  <span className="text-xs font-mono text-slate-400">
                    Thang điểm: 0 - 100 điểm/tiêu chí
                  </span>
                </div>

                <div className="space-y-3">
                  {initialCriteria.map((crit) => {
                    const score = rubricScores[crit.id]?.score ?? 75;
                    const comment = rubricScores[crit.id]?.comments ?? '';

                    return (
                      <div
                        key={crit.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-slate-200">
                              {crit.name}
                            </span>
                            <span className="text-[11px] text-amber-400 font-mono ml-2">
                              (Trọng số: {crit.weight}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={score}
                              disabled={isSelfSubmission}
                              onChange={(e) =>
                                handleScoreChange(crit.id, parseInt(e.target.value) || 0)
                              }
                              className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-xs text-slate-500 font-mono">/ 100</span>
                          </div>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={score}
                          disabled={isSelfSubmission}
                          onChange={(e) => handleScoreChange(crit.id, parseInt(e.target.value) || 0)}
                          className="w-full accent-amber-500 cursor-pointer"
                        />

                        <input
                          type="text"
                          placeholder="Nhận xét riêng cho tiêu chí này..."
                          value={comment}
                          disabled={isSelfSubmission}
                          onChange={(e) => handleCommentChange(crit.id, e.target.value)}
                          className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Overall Feedback */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Nhận xét đánh giá chuyên môn tổng quát (Tối thiểu 10 ký tự) *</span>
                    <span className="text-[10px] text-slate-500 font-mono">{feedback.length} ký tự</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ghi nhận điểm mạnh, mặt cần cải thiện và lý do đưa ra quyết định đánh giá..."
                    value={feedback}
                    disabled={isSelfSubmission}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Decision Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Quyết định thẩm định (Decision):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { key: 'shortlist', label: 'Vào Chung Tuyển', color: 'border-purple-500 text-purple-300 bg-purple-950/40' },
                      { key: 'accept', label: 'Chấp Nhận / Trao Giải', color: 'border-emerald-500 text-emerald-300 bg-emerald-950/40' },
                      { key: 'needs_revision', label: 'Yêu Cầu Bổ Sung', color: 'border-amber-500 text-amber-300 bg-amber-950/40' },
                      { key: 'reject', label: 'Từ Chối Bài Thi', color: 'border-rose-500 text-rose-300 bg-rose-950/40' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={isSelfSubmission}
                        onClick={() => setDecision(opt.key as any)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                          decision === opt.key
                            ? opt.color
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isSelfSubmission || isSubmitting}
                    onClick={() => handleSubmitReview(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                  >
                    <Save className="w-3.5 h-3.5 inline mr-1" />
                    Lưu Nháp Đánh Giá
                  </button>

                  <button
                    type="button"
                    disabled={isSelfSubmission || isSubmitting}
                    onClick={() => handleSubmitReview(false)}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Xác Nhận & Gửi Quyết Định
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              Vui lòng chọn một bài dự thi từ cột danh sách bên trái để xem nội dung và chấm điểm.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
