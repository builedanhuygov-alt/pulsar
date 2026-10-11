import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Award,
  ExternalLink,
  Lock,
  Globe,
  Share2,
  CheckCircle2,
  Building2,
  FileText,
  Sparkles,
} from 'lucide-react';
import type { VerifiedPortfolioItem } from '../../types/outcome.types';
import type { PulsarUser } from '../../types/auth.types';
import { outcomeRewardService } from '../../lib/outcome/outcomeRewardService';

interface VerifiedPortfolioProps {
  user: PulsarUser | null;
}

export const VerifiedPortfolio: React.FC<VerifiedPortfolioProps> = ({ user }) => {
  const [portfolios, setPortfolios] = useState<VerifiedPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPortfolios();
  }, [user]);

  const loadPortfolios = async () => {
    setLoading(true);
    const creatorId = user?.id || 'usr-creator-001';
    const { data } = await outcomeRewardService.getCreatorPortfolios(creatorId);
    setPortfolios(data);
    setLoading(false);
  };

  const handleToggleVisibility = async (item: VerifiedPortfolioItem) => {
    if (!user) return;
    const newStatus = !item.is_public;
    const res = await outcomeRewardService.updatePortfolioVisibility(item.id, newStatus, user.id);
    if (res.success) {
      setActionMessage(
        `Đã chuyển hồ sơ sang chế độ ${newStatus ? 'Công khai (Public)' : 'Riêng tư (Private)'}`
      );
      setTimeout(() => setActionMessage(null), 3000);
      await loadPortfolios();
    } else {
      setActionMessage(res.error || 'Lỗi cập nhật hiển thị');
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Portfolio & Digital Credential</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Hồ Sơ Năng Lực Được Doanh Nghiệp Xác Thực Điện Tử
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Mỗi bài thi chiến thắng hoặc nghiệm thu thành công đều được Doanh nghiệp cấp chứng thực số không thể giả mạo. Bao gồm case study thực tế, chỉ số benchmark KPI và quyền kiểm soát hiển thị công khai.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Portfolio Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">
            Hồ sơ chứng chỉ năng lực ({portfolios.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Chủ tài khoản: <strong className="text-slate-300">{user?.profile.display_name || 'Creator'}</strong>
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-500">Đang tải hồ sơ năng lực...</div>
        ) : portfolios.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">Chưa có chứng thực số nào</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tham gia giải quyết các thử thách của doanh nghiệp và đạt kết quả nghiệm thu để nhận chứng chỉ năng lực chính thức.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {portfolios.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5 hover:border-slate-700 transition"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-3 h-3" /> Đã Xác Minh Điện Tử (Verified)
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Cấp ngày {new Date(item.verified_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white mt-1.5">{item.challenge_title}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      Xác nhận bởi tổ chức: <span className="text-slate-200 font-semibold">{item.verified_by_org_name}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    <button
                      onClick={() => handleToggleVisibility(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                        item.is_public
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {item.is_public ? (
                        <>
                          <Globe className="w-3.5 h-3.5 text-emerald-400" /> Công khai
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-slate-400" /> Riêng tư
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Solution Summary */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Đóng góp & Case Study Tóm Tắt
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    Giải pháp: "{item.submission_title}" • Vai trò: <span className="text-cyan-400">{item.role_description}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                    {item.case_study_summary}
                  </p>
                </div>

                {/* Skills acquired */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Kỹ Năng Đã Kiểm Chứng (Verified Skills)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.skills_acquired.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs rounded-lg bg-slate-950 text-indigo-300 border border-indigo-900/50 font-mono"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Case study metrics */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Chỉ Số Đo Lường Benchmark
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(item.case_study_metrics).map(([key, val], idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs"
                      >
                        <div className="text-slate-500">{key}</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                          {String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
