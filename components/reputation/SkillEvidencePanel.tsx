import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Award,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Lock,
  Globe,
  Building2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import type {
  SkillTaxonomy,
  CreatorSkill,
  SkillVerificationStatus,
} from '../../types/reputation.types';
import type { PulsarUser } from '../../types/auth.types';
import { reputationAnalyticsService } from '../../lib/reputation/reputationService';

interface SkillEvidencePanelProps {
  user: PulsarUser | null;
}

export const SkillEvidencePanel: React.FC<SkillEvidencePanelProps> = ({ user }) => {
  const [taxonomies, setTaxonomies] = useState<SkillTaxonomy[]>([]);
  const [creatorSkills, setCreatorSkills] = useState<CreatorSkill[]>([]);
  const [selectedTaxonomyId, setSelectedTaxonomyId] = useState<string>('');
  const [evidenceType, setEvidenceType] = useState<string>('challenge_outcome');
  const [evidenceNotes, setEvidenceNotes] = useState<string>('');
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Verification modal for business/admin
  const [verifyingSkill, setVerifyingSkill] = useState<CreatorSkill | null>(null);
  const [verifyDecision, setVerifyDecision] = useState<'verify' | 'reject'>('verify');
  const [verifyReason, setVerifyReason] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const taxList = await reputationAnalyticsService.getSkillTaxonomies();
    setTaxonomies(taxList);
    if (taxList.length > 0) setSelectedTaxonomyId(taxList[0].id);

    const creatorId = user?.id || 'usr-creator-001';
    const skills = await reputationAnalyticsService.getCreatorSkills(
      creatorId,
      user?.id,
      user?.role === 'admin'
    );
    setCreatorSkills(skills);
    setLoading(false);
  };

  const handleDeclareSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionLoading(true);
    setMessage(null);

    const res = await reputationAnalyticsService.declareCreatorSkill(
      {
        skill_id: selectedTaxonomyId,
        evidence_type: evidenceType as any,
        evidence_notes: evidenceNotes,
        is_public: true,
      },
      user
    );

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({
        type: 'success',
        text: 'Đã nộp bằng chứng kỹ năng thành công! Kỹ năng đang ở trạng thái chờ thẩm định.',
      });
      setIsDeclareModalOpen(false);
      setEvidenceNotes('');
      await loadData();
    }
    setActionLoading(false);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingSkill || !user) return;
    setActionLoading(true);
    setMessage(null);

    const res = await reputationAnalyticsService.verifyCreatorSkill(
      {
        creator_skill_id: verifyingSkill.id,
        decision: verifyDecision,
        reason: verifyReason,
      },
      user
    );

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({
        type: 'success',
        text: `Đã ${verifyDecision === 'verify' ? 'xác nhận kỹ năng' : 'từ chối xác nhận'} thành công!`,
      });
      setVerifyingSkill(null);
      setVerifyReason('');
      await loadData();
    }
    setActionLoading(false);
  };

  const getStatusBadge = (status: SkillVerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Đã Xác Minh (Verified)
          </span>
        );
      case 'evidence_submitted':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Đã Nộp Bằng Chứng
          </span>
        );
      case 'self_declared':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase font-mono bg-slate-800 text-slate-400 border border-slate-700">
            Tự Khai Báo
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Chưa Đạt Yêu Cầu
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-cyan-400" />
            Hệ Thống Kỹ Năng & Bằng Chứng (Skill & Evidence Graph)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kỹ năng chuẩn hóa được liên kết với bài dự thi, điểm số rubric và đề bài đã nghiệm thu. Chỉ Doanh nghiệp hoặc Admin mới có quyền xác minh.
          </p>
        </div>

        {user?.role === 'creator' && (
          <button
            onClick={() => setIsDeclareModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Khai Báo & Nộp Bằng Chứng
          </button>
        )}
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Creator Skills List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Kỹ năng đã ghi nhận ({creatorSkills.length})</span>
          <span>
            Đã xác minh: <strong className="text-emerald-400 font-mono">{creatorSkills.filter((s) => s.status === 'verified').length}</strong>
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-500">Đang tải danh sách kỹ năng...</div>
        ) : creatorSkills.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
            Chưa có kỹ năng nào được khai báo.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creatorSkills.map((skill) => (
              <div
                key={skill.id}
                className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {skill.skill_category}
                    </span>
                    <h4 className="text-base font-bold text-white mt-1.5">{skill.skill_name}</h4>
                  </div>
                  <div>{getStatusBadge(skill.status)}</div>
                </div>

                {skill.evidence_notes && (
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                    <span className="text-slate-500 font-semibold">Bằng chứng liên kết: </span>
                    {skill.evidence_notes}
                  </div>
                )}

                {skill.status === 'verified' && skill.verified_by_org_name && (
                  <div className="text-xs text-emerald-400/90 flex items-center gap-1.5 pt-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Xác nhận bởi: <strong>{skill.verified_by_org_name}</strong></span>
                  </div>
                )}

                {/* Verify action button for business/admin */}
                {(user?.role === 'business' || user?.role === 'admin') &&
                  skill.status !== 'verified' &&
                  user.id !== skill.creator_id && (
                    <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                      <button
                        onClick={() => {
                          setVerifyingSkill(skill);
                          setVerifyDecision('verify');
                          setVerifyReason('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                      >
                        Thẩm định & Xác minh
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Declare Skill Modal */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Khai Báo Kỹ Năng & Nộp Bằng Chứng
              </h3>
              <button
                onClick={() => setIsDeclareModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeclareSkill} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Chọn kỹ năng chuẩn hóa:
                </label>
                <select
                  value={selectedTaxonomyId}
                  onChange={(e) => setSelectedTaxonomyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {taxonomies.map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.name} ({tax.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Nguồn bằng chứng:</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="challenge_outcome">Kết quả thử thách đã nghiệm thu</option>
                  <option value="submission_benchmark">Chỉ số benchmark từ bài dự thi</option>
                  <option value="verified_portfolio">Chứng thực từ Verified Portfolio</option>
                  <option value="third_party_credential">Chứng chỉ chuyên môn bên ngoài</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Mô tả bằng chứng & Số liệu benchmark:
                </label>
                <textarea
                  rows={3}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="Ghi rõ đề bài đã hoàn thành, chỉ số đo lường hoặc liên kết mã nguồn..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeclareModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-50"
                >
                  {actionLoading ? 'Đang lưu...' : 'Nộp Bằng Chứng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Modal for Business/Admin */}
      {verifyingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Thẩm Định Kỹ Năng
              </h3>
              <button
                onClick={() => setVerifyingSkill(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400">Kỹ năng mục tiêu:</div>
                <div className="text-sm font-bold text-white">{verifyingSkill.skill_name}</div>
                {verifyingSkill.evidence_notes && (
                  <div className="text-slate-400 italic">"{verifyingSkill.evidence_notes}"</div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Quyết định thẩm định:</label>
                <div className="flex gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={verifyDecision === 'verify'}
                      onChange={() => setVerifyDecision('verify')}
                      className="text-emerald-500 focus:ring-0"
                    />
                    <span>Xác nhận đạt chuẩn (Verify)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={verifyDecision === 'reject'}
                      onChange={() => setVerifyDecision('reject')}
                      className="text-rose-500 focus:ring-0"
                    />
                    <span>Từ chối (Reject)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Lý do thẩm định (tối thiểu 5 ký tự):</label>
                <textarea
                  rows={3}
                  value={verifyReason}
                  onChange={(e) => setVerifyReason(e.target.value)}
                  placeholder="Nêu rõ căn cứ nghiệm thu hoặc lý do từ chối..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingSkill(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || verifyReason.length < 5}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  {actionLoading ? 'Đang lưu...' : 'Xác Nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
