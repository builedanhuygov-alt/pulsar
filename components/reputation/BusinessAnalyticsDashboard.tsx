import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  Building2,
  FileText,
  AlertTriangle,
  Info,
  Calendar,
} from 'lucide-react';
import type { BusinessAnalyticsOverview } from '../../types/reputation.types';
import type { PulsarUser } from '../../types/auth.types';
import { reputationAnalyticsService } from '../../lib/reputation/reputationService';

interface BusinessAnalyticsDashboardProps {
  user: PulsarUser | null;
}

export const BusinessAnalyticsDashboard: React.FC<BusinessAnalyticsDashboardProps> = ({ user }) => {
  const [analytics, setAnalytics] = useState<BusinessAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const orgId = user.organizations?.[0]?.organization.id || 'org-tech-01';
    const res = await reputationAnalyticsService.getOrganizationAnalytics(orgId, user);

    if (res.error) {
      setError(res.error);
    } else {
      setAnalytics(res.data);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400 text-xs">
        Vui lòng đăng nhập với tư cách Doanh nghiệp hoặc Quản trị viên để xem phân tích.
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Đang tổng hợp dữ liệu KPI...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-950/40 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!analytics) return null;

  const kpis = analytics.kpis;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Trung Tâm Phân Tích Đổi Mới Doanh Nghiệp (Business Analytics)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tổ chức: <strong className="text-slate-200">{analytics.organization_name}</strong> • Mỗi chỉ số đều có công thức tính toán và nguồn gốc xác định.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono">
            Khoảng thời gian: Toàn thời gian
          </span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Challenges count */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs text-slate-400">{kpis.total_challenges_created.label}</div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {kpis.total_challenges_created.value}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {kpis.published_challenges.value} đang mở • {kpis.closed_and_finalized.value} đã chốt
          </div>
        </div>

        {/* KPI 2: Acceptance rate */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs text-slate-400">{kpis.acceptance_rate.label}</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {kpis.acceptance_rate.formatted}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {kpis.acceptance_rate.numerator}/{kpis.acceptance_rate.denominator} bài giải pháp đạt chuẩn
          </div>
        </div>

        {/* KPI 3: Turnaround time */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs text-slate-400">{kpis.avg_turnaround_days.label}</div>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono">
            {kpis.avg_turnaround_days.formatted}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Từ công khai đến ra quyết định
          </div>
        </div>

        {/* KPI 4: Evidence-backed outcomes */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs text-slate-400">{kpis.evidence_backed_outcomes.label}</div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">
            {kpis.evidence_backed_outcomes.value}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Đã cấp chứng chỉ & giải ngân
          </div>
        </div>
      </div>

      {/* Financial Discipline: Planned vs Approved vs Disbursed */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            Kỷ Luật Tài Chính: Dự Kiến vs Phê Duyệt vs Thực Tế Đã Thanh Toán
          </h3>
          <p className="text-xs text-slate-400">
            PULSAR phân định nghiêm ngặt giữa ngân sách ước lượng và dòng tiền ký quỹ đã giải ngân thực tế (Không gộp lẫn).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">1. {kpis.budget_planned.label}</div>
            <div className="text-2xl font-bold text-slate-300 font-mono">
              ${kpis.budget_planned.value.toLocaleString()} {kpis.budget_planned.currency}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Công thức: {kpis.budget_planned.formula}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-xs text-indigo-400">2. {kpis.prizes_approved.label}</div>
            <div className="text-2xl font-bold text-indigo-300 font-mono">
              ${kpis.prizes_approved.value.toLocaleString()} {kpis.prizes_approved.currency}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Công thức: {kpis.prizes_approved.formula}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-900/40 space-y-1">
            <div className="text-xs text-emerald-400">3. {kpis.prizes_disbursed.label}</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              ${kpis.prizes_disbursed.value.toLocaleString()} {kpis.prizes_disbursed.currency}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Công thức: {kpis.prizes_disbursed.formula}
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Hiệu Suất Theo Danh Mục Thử Thách</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">Danh Mục</th>
                <th className="p-3">Số Đề Bài</th>
                <th className="p-3">Số Bài Giải Pháp</th>
                <th className="p-3">Đã Giải Ngân</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {analytics.breakdown_by_category.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-950/50">
                  <td className="p-3 font-semibold text-slate-200">{row.category}</td>
                  <td className="p-3 font-mono">{row.challenges_count}</td>
                  <td className="p-3 font-mono">{row.submissions_count}</td>
                  <td className="p-3 font-mono text-amber-400">${row.disbursed_amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
