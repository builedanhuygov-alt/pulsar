import React, { useState } from 'react';
import type { Challenge } from '../../types/challenge.types';
import type { PulsarUser } from '../../types/auth.types';
import type { Submission, SubmissionFile } from '../../types/submission.types';
import {
  submissionFormSchema,
  type SubmissionFormData,
} from '../../lib/validation/submission.schema';
import { submissionService } from '../../lib/submission/submissionService';
import {
  X,
  Send,
  Save,
  UploadCloud,
  FileCode,
  Link,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  Award,
  Calendar,
  Clock,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface SubmissionModalProps {
  challenge: Challenge;
  user: PulsarUser;
  onClose: () => void;
  onSuccess: (submission: Submission) => void;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  challenge,
  user,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [solutionUrl, setSolutionUrl] = useState('');
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check deadline
  const isExpired = new Date().getTime() > new Date(challenge.deadline_at).getTime();

  // Simulated file upload with validation & mock signed URL
  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(15);

    setTimeout(() => {
      setUploadProgress(60);
      setTimeout(() => {
        const newFilesList: SubmissionFile[] = [];
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          if (file.size > 25 * 1024 * 1024) {
            setSubmitError(`Tệp ${file.name} vượt quá dung lượng tối đa 25MB.`);
            setIsUploading(false);
            setUploadProgress(null);
            return;
          }
          const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          newFilesList.push({
            id: fileId,
            name: file.name,
            size: file.size,
            mime_type: file.type || 'application/octet-stream',
            storage_path: `submissions/${challenge.id}/${fileId}/${file.name}`,
            uploaded_at: new Date().toISOString(),
            is_private: true,
            signed_url: `https://storage.pulsar.dev/signed/${challenge.id}/${fileId}?token=exp_7200`,
          });
        }
        setFiles((prev) => [...prev, ...newFilesList]);
        setIsUploading(false);
        setUploadProgress(null);
      }, 300);
    }, 200);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (submitImmediately: boolean) => {
    setValidationErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    const formData: SubmissionFormData = {
      challenge_id: challenge.id,
      title: title.trim(),
      solution_summary: summary.trim(),
      solution_content: content.trim(),
      solution_url: solutionUrl.trim() || undefined,
      files,
      idempotency_key: `idem-${user.id}-${challenge.id}-${Date.now()}`,
    };

    // Client-side schema validation via Zod
    const validationResult = submissionFormSchema.safeParse(formData);
    if (!validationResult.success) {
      const errs: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        errs[path] = issue.message;
      });
      setValidationErrors(errs);
      setIsSubmitting(false);
      return;
    }

    // Call submission service
    const res = submissionService.createSubmission(
      formData,
      user.id,
      user.profile.display_name,
      user.email,
      submitImmediately
    );

    if (res.success && res.submission) {
      onSuccess(res.submission);
    } else {
      setSubmitError(res.error || 'Nộp bài thi thất bại. Vui lòng thử lại.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800 font-semibold">
                Nộp Giải Pháp Kỹ Thuật
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                Quỹ thưởng: {challenge.prize_pool.toLocaleString()} {challenge.currency}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-1">
              {challenge.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Hạn chót: {new Date(challenge.deadline_at).toLocaleDateString('vi-VN')}</span>
              <span>•</span>
              <span>Tổ chức: {challenge.organization_name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expired Warning Banner */}
        {isExpired && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Thử thách này đã hết hạn nhận bài. Cổng nộp bài hiện đã bị khóa.</span>
          </div>
        )}

        {/* Error Banner */}
        {submitError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Tên giải pháp / Đề xuất của bạn <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Kiến trúc RAG Hybrid kết hợp Graph Neural Network"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isExpired || isSubmitting}
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

          {/* Short Summary */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300">
                Tóm tắt giải pháp (20 - 1000 ký tự) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {summary.length}/1000
              </span>
            </div>
            <textarea
              rows={2}
              placeholder="Tóm tắt ngắn gọn phương pháp tiếp cận cốt lõi và kết quả đạt được..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={isExpired || isSubmitting}
              className={`w-full bg-slate-950 border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                validationErrors.solution_summary
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-slate-800 focus:border-violet-500'
              }`}
            />
            {validationErrors.solution_summary && (
              <p className="text-[11px] text-rose-400">
                {validationErrors.solution_summary}
              </p>
            )}
          </div>

          {/* Detailed Solution Content */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300">
                Thuyết minh kỹ thuật & Kiến trúc chi tiết (Tối thiểu 50 ký tự){' '}
                <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {content.length} ký tự
              </span>
            </div>
            <textarea
              rows={5}
              placeholder="Trình bày chi tiết luồng xử lý, công nghệ sử dụng, giải pháp tối ưu hiệu năng, benchmark và đối chiếu với yêu cầu của đề bài..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isExpired || isSubmitting}
              className={`w-full bg-slate-950 border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                validationErrors.solution_content
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-slate-800 focus:border-violet-500'
              }`}
            />
            {validationErrors.solution_content && (
              <p className="text-[11px] text-rose-400">
                {validationErrors.solution_content}
              </p>
            )}
          </div>

          {/* Solution URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-slate-400" />
              Đường dẫn GitHub Repository / Live Demo / Whitepaper
            </label>
            <input
              type="url"
              placeholder="https://github.com/your-username/solution-repo"
              value={solutionUrl}
              onChange={(e) => setSolutionUrl(e.target.value)}
              disabled={isExpired || isSubmitting}
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition font-mono ${
                validationErrors.solution_url
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-slate-800 focus:border-violet-500'
              }`}
            />
            {validationErrors.solution_url && (
              <p className="text-[11px] text-rose-400">{validationErrors.solution_url}</p>
            )}
          </div>

          {/* Private Files Upload Area */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Đính kèm Tệp Bảo mật (Private Storage, tối đa 25MB/tệp)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {files.length} tệp đã đính kèm
              </span>
            </div>

            <div className="relative border-2 border-dashed border-slate-800 hover:border-violet-500/60 rounded-xl p-4 text-center transition cursor-pointer bg-slate-950/40">
              <input
                type="file"
                multiple
                disabled={isExpired || isUploading}
                onChange={handleSimulatedFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-6 h-6 text-slate-500 mx-auto mb-1" />
              <div className="text-xs text-slate-300 font-medium">
                Kéo thả hoặc nhấp để chọn tệp tài liệu (PDF, ZIP, CSV, MD)
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Tệp được lưu trữ riêng tư, chỉ Ban Giám khảo được cấp quyền truy cập qua URL ký có thời hạn.
              </p>
            </div>

            {isUploading && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                <span>Đang mã hóa và tải lên hệ thống lưu trữ an toàn ({uploadProgress}%)...</span>
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((file, idx) => (
                  <div
                    key={file.id}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span className="truncate font-mono">{file.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-500 hover:text-rose-400 transition p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Bảo mật IDOR • Chống nộp trùng (Idempotent)</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition w-full sm:w-auto"
            >
              Hủy
            </button>

            <button
              type="button"
              disabled={isExpired || isSubmitting}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <Save className="w-3.5 h-3.5" />
              Lưu Bản Nháp (Draft)
            </button>

            <button
              type="button"
              disabled={isExpired || isSubmitting}
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <Send className="w-3.5 h-3.5" />
              Nộp Bài Chính Thức
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
