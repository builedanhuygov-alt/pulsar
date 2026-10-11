import React, { useState, useEffect } from 'react';
import type {
  Challenge,
  ChallengeCategory,
  EvaluationCriterion,
} from '../../types/challenge.types';
import type { PulsarUser } from '../../types/auth.types';
import {
  challengeFormSchema,
  type ChallengeFormData,
} from '../../lib/validation/challenge.schema';
import { challengeService } from '../../lib/challenge/challengeService';
import { ChallengeAICopilot } from '../matching/ChallengeAICopilot';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Save,
  Send,
  HelpCircle,
  Building2,
  Calendar,
  DollarSign,
  Layers,
  Award,
} from 'lucide-react';

interface ChallengeEditorProps {
  user: PulsarUser;
  initialChallenge?: Challenge | null;
  onClose: () => void;
  onSaved: (challenge: Challenge) => void;
}

const CATEGORIES: { value: ChallengeCategory; label: string }[] = [
  { value: 'ai_ml', label: 'AI & Machine Learning' },
  { value: 'blockchain', label: 'Blockchain & Web3' },
  { value: 'cloud_devops', label: 'Cloud & DevOps' },
  { value: 'mobile_iot', label: 'Mobile & IoT' },
  { value: 'fintech', label: 'Fintech & Payments' },
  { value: 'security', label: 'Security & Zero-Trust' },
];

export const ChallengeEditor: React.FC<ChallengeEditorProps> = ({
  user,
  initialChallenge,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(initialChallenge);

  // Available organizations user belongs to
  const userOrgs = user.organizations.map((m) => m.organization);
  const defaultOrgId =
    initialChallenge?.organization_id || userOrgs[0]?.id || 'org-lab-01';

  // Form states
  const [title, setTitle] = useState(initialChallenge?.title || '');
  const [slug, setSlug] = useState(initialChallenge?.slug || '');
  const [isSlugManual, setIsSlugManual] = useState(Boolean(initialChallenge));
  const [shortDescription, setShortDescription] = useState(
    initialChallenge?.short_description || ''
  );
  const [problemStatement, setProblemStatement] = useState(
    initialChallenge?.problem_statement || ''
  );
  const [desiredOutcome, setDesiredOutcome] = useState(
    initialChallenge?.desired_outcome || ''
  );
  const [category, setCategory] = useState<ChallengeCategory>(
    initialChallenge?.category || 'ai_ml'
  );

  const [requirements, setRequirements] = useState<string[]>(
    initialChallenge?.requirements?.length
      ? initialChallenge.requirements
      : ['Triển khai backend RESTful API chuẩn OpenAPI', 'Cung cấp Docker compose cho môi trường chạy thử']
  );
  const [newReq, setNewReq] = useState('');

  const [deliverables, setDeliverables] = useState<string[]>(
    initialChallenge?.deliverables?.length
      ? initialChallenge.deliverables
      : ['Mã nguồn GitHub repository hoàn chỉnh', 'Tài liệu hướng dẫn cài đặt và vận hành']
  );
  const [newDeliv, setNewDeliv] = useState('');

  const [criteria, setCriteria] = useState<EvaluationCriterion[]>(
    initialChallenge?.evaluation_criteria?.length
      ? initialChallenge.evaluation_criteria
      : [
          {
            id: 'crit-1',
            name: 'Độ hoàn thiện tính năng',
            weight: 40,
            description: 'Đáp ứng đầy đủ các yêu cầu đề bài và không có lỗi nghiêm trọng',
          },
          {
            id: 'crit-2',
            name: 'Kiến trúc & Tối ưu hiệu năng',
            weight: 35,
            description: 'Thiết kế modular, clean architecture, xử lý tải tốt',
          },
          {
            id: 'crit-3',
            name: 'Tài liệu & Kiểm thử',
            weight: 25,
            description: 'Độ phủ test >= 80% kèm tài liệu kỹ thuật rõ ràng',
          },
        ]
  );

  const [budgetMin, setBudgetMin] = useState<number>(
    initialChallenge?.budget_min ?? 2000
  );
  const [budgetMax, setBudgetMax] = useState<number>(
    initialChallenge?.budget_max ?? 5000
  );
  const [currency, setCurrency] = useState<'USD' | 'VND' | 'EUR'>(
    initialChallenge?.currency || 'USD'
  );
  const [prizePool, setPrizePool] = useState<number>(
    initialChallenge?.prize_pool ?? 5000
  );

  // Default dates: start today, deadline 30 days later
  const defaultStart = new Date().toISOString().slice(0, 10);
  const defaultDeadline = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [startAt, setStartAt] = useState<string>(
    initialChallenge?.start_at ? initialChallenge.start_at.slice(0, 10) : defaultStart
  );
  const [deadlineAt, setDeadlineAt] = useState<string>(
    initialChallenge?.deadline_at
      ? initialChallenge.deadline_at.slice(0, 10)
      : defaultDeadline
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultOrgId);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate slug when title changes if user hasn't edited slug manually
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugManual) {
      setSlug(generateSlug(val));
    }
  };

  // Calculate total evaluation weight
  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  // Criteria manipulation
  const addCriterion = () => {
    const remainingWeight = Math.max(0, 100 - totalWeight);
    setCriteria([
      ...criteria,
      {
        id: `crit-${Date.now()}`,
        name: 'Tiêu chí mới',
        weight: remainingWeight || 10,
        description: 'Mô tả chi tiết cách đánh giá tiêu chí này',
      },
    ]);
  };

  const updateCriterion = (index: number, field: keyof EvaluationCriterion, val: any) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: val };
    setCriteria(updated);
  };

  const removeCriterion = (index: number) => {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  // Requirements manipulation
  const addRequirement = () => {
    if (!newReq.trim()) return;
    setRequirements([...requirements, newReq.trim()]);
    setNewReq('');
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  // Deliverables manipulation
  const addDeliverable = () => {
    if (!newDeliv.trim()) return;
    setDeliverables([...deliverables, newDeliv.trim()]);
    setNewDeliv('');
  };

  const removeDeliverable = (index: number) => {
    setDeliverables(deliverables.filter((_, i) => i !== index));
  };

  // Handle Save
  const handleSave = async (submitForReview: boolean) => {
    setValidationErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    const formData: ChallengeFormData = {
      title: title.trim(),
      slug: slug.trim(),
      short_description: shortDescription.trim(),
      problem_statement: problemStatement.trim(),
      desired_outcome: desiredOutcome.trim(),
      category,
      requirements,
      deliverables,
      evaluation_criteria: criteria.map((c) => ({
        ...c,
        weight: Number(c.weight) || 0,
      })),
      budget_min: Number(budgetMin),
      budget_max: Number(budgetMax),
      currency,
      prize_pool: Number(prizePool),
      start_at: new Date(startAt).toISOString(),
      deadline_at: new Date(deadlineAt).toISOString(),
      organization_id: selectedOrgId,
    };

    // Client-side schema validation via Zod
    const result = challengeFormSchema.safeParse(formData);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        errs[path] = issue.message;
      });
      setValidationErrors(errs);
      setIsSubmitting(false);
      return;
    }

    try {
      const currentOrg = userOrgs.find((o) => o.id === selectedOrgId) || {
        name: 'AI Innovators Hub',
        slug: 'ai-innovators-hub',
      };

      let savedChallenge: Challenge;

      if (isEditing && initialChallenge) {
        const updateRes = challengeService.updateChallenge(
          initialChallenge.id,
          formData,
          user.id,
          true
        );
        if (!updateRes.success || !updateRes.challenge) {
          setSubmitError(updateRes.error || 'Cập nhật thử thách thất bại.');
          setIsSubmitting(false);
          return;
        }
        savedChallenge = updateRes.challenge;
      } else {
        const createRes = challengeService.createChallenge(
          formData,
          user.id,
          user.profile.display_name,
          currentOrg.name,
          currentOrg.slug
        );
        if (!createRes.success || !createRes.challenge) {
          setSubmitError(createRes.error || 'Tạo thử thách thất bại.');
          setIsSubmitting(false);
          return;
        }
        savedChallenge = createRes.challenge;
      }

      // If user chose to submit for review immediately
      if (submitForReview) {
        const transitionRes = challengeService.transitionStatus(
          savedChallenge.id,
          'pending_review',
          {
            userId: user.id,
            userRole: user.role,
            isOrgMember: true,
            notes: 'Gửi đề bài lên hàng đợi kiểm duyệt của Quản trị viên.',
          }
        );
        if (!transitionRes.success || !transitionRes.challenge) {
          setSubmitError(transitionRes.error || 'Gửi phê duyệt thất bại.');
          setIsSubmitting(false);
          return;
        }
        savedChallenge = transitionRes.challenge;
      }

      onSaved(savedChallenge);
    } catch (err: any) {
      setSubmitError(err?.message || 'Có lỗi xảy ra trong quá trình lưu thử thách.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isEditing ? 'Chỉnh Sửa Thử Thách' : 'Tạo Thử Thách Doanh Nghiệp Mới'}
              </h2>
              <p className="text-xs text-slate-400">
                Thiết kế đề bài toán kỹ thuật, tiêu chí đánh giá và giải thưởng để tìm kiếm giải pháp xuất sắc.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {submitError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Challenge AI Copilot Assistant */}
          <ChallengeAICopilot
            formData={{
              title,
              slug,
              short_description: shortDescription,
              problem_statement: problemStatement,
              desired_outcome: desiredOutcome,
              category,
              requirements,
              deliverables,
              evaluation_criteria: criteria.map((c) => ({
                ...c,
                weight: Number(c.weight) || 0,
              })),
              budget_min: Number(budgetMin) || 0,
              budget_max: Number(budgetMax) || 0,
              currency,
              prize_pool: Number(prizePool) || 0,
              start_at: new Date(startAt).toISOString(),
              deadline_at: new Date(deadlineAt).toISOString(),
              organization_id: selectedOrgId,
            }}
            onApplyRubric={(newCriteria) => {
              setCriteria(newCriteria);
            }}
            onApplyDeliverableSuggestion={(newDel) => {
              setDeliverables((prev) => [...prev, newDel]);
            }}
          />

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              1. Thông Tin Cơ Bản & Định Danh
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Tiêu đề thử thách <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Xây dựng Hệ thống Trích xuất Hóa đơn Tự động bằng AI"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                    validationErrors.title
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-slate-800 focus:border-violet-500'
                  }`}
                />
                {validationErrors.title && (
                  <p className="text-[11px] text-rose-400">{validationErrors.title}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Tổ chức chủ quản <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                >
                  {userOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.organization_type})
                    </option>
                  ))}
                  {userOrgs.length === 0 && (
                    <option value="org-lab-01">AI Innovators Hub (Mặc định)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Slug URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ai-invoice-extraction-system"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setIsSlugManual(true);
                  }}
                  className={`w-full font-mono bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                    validationErrors.slug
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-slate-800 focus:border-violet-500'
                  }`}
                />
                {validationErrors.slug ? (
                  <p className="text-[11px] text-rose-400">{validationErrors.slug}</p>
                ) : (
                  <p className="text-[10px] text-slate-500 font-mono">
                    URL: /challenges/{slug || '...'}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Lĩnh vực / Danh mục <span className="text-rose-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ChallengeCategory)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">
                  Mô tả tóm tắt (20 - 300 ký tự) <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {shortDescription.length}/300
                </span>
              </div>
              <textarea
                rows={2}
                placeholder="Mô tả súc tích mục tiêu đề bài để hiển thị trên danh sách thẻ và kết quả tìm kiếm..."
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                  validationErrors.short_description
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-800 focus:border-violet-500'
                }`}
              />
              {validationErrors.short_description && (
                <p className="text-[11px] text-rose-400">
                  {validationErrors.short_description}
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Detailed Problem Statement & Outcome */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              2. Đề Bài Chi Tiết & Kết Quả Kỳ Vọng
            </h3>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">
                  Thực trạng & Vấn đề cần giải quyết (Tối thiểu 50 ký tự){' '}
                  <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {problemStatement.length} ký tự
                </span>
              </div>
              <textarea
                rows={4}
                placeholder="Trình bày bối cảnh kinh doanh, khó khăn hiện tại, nguyên nhân và động lực khiến doanh nghiệp đưa ra bài toán này..."
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                  validationErrors.problem_statement
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-800 focus:border-sky-500'
                }`}
              />
              {validationErrors.problem_statement && (
                <p className="text-[11px] text-rose-400">
                  {validationErrors.problem_statement}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">
                  Kết quả kỳ vọng (Desired Outcome - Tối thiểu 30 ký tự){' '}
                  <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {desiredOutcome.length} ký tự
                </span>
              </div>
              <textarea
                rows={3}
                placeholder="Các chỉ số KPI kỹ thuật mong đợi, độ chính xác, tốc độ xử lý hoặc tác động kinh doanh cụ thể..."
                value={desiredOutcome}
                onChange={(e) => setDesiredOutcome(e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                  validationErrors.desired_outcome
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-800 focus:border-sky-500'
                }`}
              />
              {validationErrors.desired_outcome && (
                <p className="text-[11px] text-rose-400">
                  {validationErrors.desired_outcome}
                </p>
              )}
            </div>
          </div>

          {/* Section 3: Requirements & Deliverables */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              3. Yêu Cầu Kỹ Thuật & Sản Phẩm Bàn Giao
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Requirements */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Yêu cầu kỹ thuật (Tối thiểu 1)</span>
                  <span className="text-[10px] text-slate-400">
                    {requirements.length} yêu cầu
                  </span>
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Thêm yêu cầu mới..."
                    value={newReq}
                    onChange={(e) => setNewReq(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={addRequirement}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {requirements.map((req, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300"
                    >
                      <span className="truncate">{req}</span>
                      <button
                        type="button"
                        onClick={() => removeRequirement(idx)}
                        className="text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {validationErrors.requirements && (
                  <p className="text-[11px] text-rose-400">
                    {validationErrors.requirements}
                  </p>
                )}
              </div>

              {/* Deliverables */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Sản phẩm bàn giao (Tối thiểu 1)</span>
                  <span className="text-[10px] text-slate-400">
                    {deliverables.length} sản phẩm
                  </span>
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Thêm sản phẩm bàn giao..."
                    value={newDeliv}
                    onChange={(e) => setNewDeliv(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDeliverable())}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={addDeliverable}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {deliverables.map((deliv, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300"
                    >
                      <span className="truncate">{deliv}</span>
                      <button
                        type="button"
                        onClick={() => removeDeliverable(idx)}
                        className="text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {validationErrors.deliverables && (
                  <p className="text-[11px] text-rose-400">
                    {validationErrors.deliverables}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Evaluation Criteria with 100% Weight Guard */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Award className="w-4 h-4" />
                4. Tiêu Chí Đánh Giá & Trọng Số (Tổng phải bằng 100%)
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    totalWeight === 100
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                  }`}
                >
                  Tổng trọng số: {totalWeight}%
                </span>
                <button
                  type="button"
                  onClick={addCriterion}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm tiêu chí
                </button>
              </div>
            </div>

            {totalWeight !== 100 && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Tổng trọng số các tiêu chí hiện tại là <strong>{totalWeight}%</strong>. Hệ thống yêu cầu tổng phải chính xác <strong>100%</strong> để đảm bảo công bằng.
                </span>
              </div>
            )}

            <div className="space-y-3">
              {criteria.map((crit, idx) => (
                <div
                  key={crit.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Tên tiêu chí (ví dụ: Độ chính xác AI)"
                        value={crit.name}
                        onChange={(e) => updateCriterion(idx, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-semibold"
                      />
                    </div>
                    <div className="w-28 flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="30"
                        value={crit.weight}
                        onChange={(e) =>
                          updateCriterion(idx, 'weight', parseInt(e.target.value) || 0)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 text-right focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <span className="text-xs text-slate-400 font-mono">%</span>
                    </div>
                    {criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCriterion(idx)}
                        className="text-slate-500 hover:text-rose-400 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Mô tả tiêu chuẩn đạt và benchmark điểm..."
                    value={crit.description}
                    onChange={(e) => updateCriterion(idx, 'description', e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Budget, Prize Pool & Timeline */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              5. Ngân Sách, Giải Thưởng & Lịch Trình
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Ngân sách tối thiểu
                </label>
                <input
                  type="number"
                  min="0"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Ngân sách tối đa
                </label>
                <input
                  type="number"
                  min="0"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
                {validationErrors.budget_max && (
                  <p className="text-[11px] text-rose-400">
                    {validationErrors.budget_max}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Tổng quỹ thưởng (Prize Pool)
                </label>
                <input
                  type="number"
                  min="0"
                  value={prizePool}
                  onChange={(e) => setPrizePool(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Loại tiền tệ
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="VND">VND (₫)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Ngày bắt đầu thử thách
                </label>
                <input
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Hạn chót nộp bài (Deadline) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={deadlineAt}
                  onChange={(e) => setDeadlineAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
                {validationErrors.deadline_at && (
                  <p className="text-[11px] text-rose-400">
                    {validationErrors.deadline_at}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>
              {isEditing
                ? 'Đang cập nhật thử thách'
                : 'Mặc định thử thách sẽ được lưu dưới dạng Bản Nháp (Draft)'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition w-full sm:w-auto"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSubmitting || totalWeight !== 100}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <Save className="w-3.5 h-3.5" />
              Lưu Bản Nháp (Draft)
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSubmitting || totalWeight !== 100}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <Send className="w-3.5 h-3.5" />
              Gửi Phê Duyệt Ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
