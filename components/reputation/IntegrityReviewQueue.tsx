import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  ArrowRight,
  User,
  Building2,
  FileText,
  Search,
} from 'lucide-react';
import type { IntegritySignal, SignalReviewStatus } from '../../types/reputation.types';
import type { PulsarUser } from '../../types/auth.types';
import { reputationAnalyticsService } from '../../lib/reputation/reputationService';

interface IntegrityReviewQueueProps {
  user: PulsarUser | null;
}

const SEVERITY_BADGES = {
  critical: 'bg-rose-950 text-rose-300 border-rose-800',
  high: 'bg-orange-950 text-orange-300 border-orange-800',
  medium: 'bg-amber-950 text-amber-300 border-amber-800',
  low: 'bg-slate-900 text-slate-400 border-slate-800',
};

export const IntegrityReviewQueue: React.FC<IntegrityReviewQueueProps> = ({ user }) => {
  const [signals, setSignals] = useState<IntegritySignal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<IntegritySignal | null>(null);
  const [actionStatus, setActionStatus] = useState<SignalReviewStatus>('under_investigation');
  const [actionNotes, setActionNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSignals();
  }, [user]);

  const loadSignals = async () => {
    if (!user) return;
    setLoading(true);
    const data = await reputationAnalyticsService.getIntegritySignals(user);
    setSignals(data);
    if (data.length > 0 && !selectedSignal) {
      setSelectedSignal(data[0]);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSignal || !user) return;
    setActionLoading(true);
    setMessage(null);

    const res = await reputationAnalyticsService.updateSignalStatus(
      {
        signal_id: selectedSignal.id,
        status: actionStatus,
        notes: actionNotes,
      },
      user
    );

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({
        type: 'success',
        text: `Đã cập nhật trạng thái rà soát tín hiệu sang "${actionStatus}" thành công.`,
      });
      setSelectedSignal(res.data);
      setActionNotes('');
      await loadSignals();
    }
    setActionLoading(false);
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400 text-xs">
        <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        Khu vực bảo mật: Chỉ Quản trị viên hệ thống (Admin) mới có quyền truy cập Hàng Đợi Rà Soát Tín Hiệu Bất Thường.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-2">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Integrity & Fraud Signals • Giám Sát Minh Bạch Theo Quy Tắc</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Hàng Đợi Rà Soát Bất Thường & Liêm Chính (Integrity Review Queue)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Hệ thống phát hiện theo quy tắc có thể giải thích (Explainable Rules). Tuyệt đối không tự động khoá tài khoản hay kết luận tội danh; chỉ tạo tín hiệu ưu tiên để Quản trị viên rà soát thủ công.
        </p>
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
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Signals list left, detail right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Signal List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Danh sách cảnh báo ({signals.length})</span>
            <span className="font-mono text-amber-400">
              Đang mở: {signals.filter((s) => s.review_status === 'open').length}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Đang tải cảnh báo...</div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {signals.map((sig) => (
                <div
                  key={sig.id}
                  onClick={() => setSelectedSignal(sig)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                    selectedSignal?.id === sig.id
                      ? 'bg-slate-900 border-rose-500/60 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${
                        SEVERITY_BADGES[sig.severity]
                      }`}
                    >
                      {sig.severity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {sig.review_status}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-200 mt-1.5 line-clamp-1">
                    {sig.target_entity_label || sig.detection_rule_name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {sig.explanation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail View & Investigation Action */}
        <div className="lg:col-span-2">
          {selectedSignal ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold uppercase border ${
                        SEVERITY_BADGES[selectedSignal.severity]
                      }`}
                    >
                      Mức độ: {selectedSignal.severity}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      Mã quy tắc: {selectedSignal.detection_rule_name}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">
                    {selectedSignal.target_entity_label || 'Tín hiệu cần kiểm tra'}
                  </h3>
                </div>

                <div className="text-right sm:shrink-0 text-xs">
                  <div className="text-slate-500">Trạng thái rà soát</div>
                  <div className="text-sm font-bold text-amber-400 font-mono mt-0.5 uppercase">
                    {selectedSignal.review_status}
                  </div>
                </div>
              </div>

              {/* Explanation & Evidence */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Cơ sở phát hiện & Bằng chứng hỗ trợ:
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed">
                  {selectedSignal.explanation}
                </div>
                <pre className="p-3 bg-slate-950 rounded-lg border border-slate-900 text-slate-400 font-mono text-xs overflow-x-auto">
                  <code>{JSON.stringify(selectedSignal.supporting_evidence, null, 2)}</code>
                </pre>
              </div>

              {/* Resolution History if any */}
              {selectedSignal.resolution_notes && (
                <div className="p-3.5 bg-indigo-950/40 rounded-xl border border-indigo-800/50 text-xs space-y-1">
                  <div className="text-indigo-300 font-semibold">Ghi chú rà soát gần nhất:</div>
                  <p className="text-slate-300 italic">"{selectedSignal.resolution_notes}"</p>
                  <div className="text-[11px] text-slate-400">
                    Bởi: {selectedSignal.resolved_by_name || 'Admin'} • Ngày {new Date(selectedSignal.resolved_at || '').toLocaleDateString('vi-VN')}
                  </div>
                </div>
              )}

              {/* Action Form */}
              <form onSubmit={handleUpdateStatus} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  Cập nhật tiến trình rà soát (Audit Log):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Trạng thái tiếp theo:</label>
                    <select
                      value={actionStatus}
                      onChange={(e) => setActionStatus(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value="under_investigation">Đang điều tra (Under Investigation)</option>
                      <option value="dismissed">Bỏ qua / Dương tính giả (Dismissed)</option>
                      <option value="resolved">Đã xử lý xong (Resolved)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Ghi chú kết luận & giải trình:</label>
                  <textarea
                    rows={2}
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Ghi rõ kết luận sau khi kiểm tra chéo (>= 5 ký tự)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={actionLoading || actionNotes.length < 5}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Đang lưu...' : 'Ghi Nhận Quyết Định'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              Vui lòng chọn một tín hiệu ở cột bên trái.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
