import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  User,
  Shield,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import type { Reward, RewardStatus, RewardStatusHistory } from '../../types/outcome.types';
import type { PulsarUser } from '../../types/auth.types';
import { outcomeRewardService, isRewardTransitionAllowed } from '../../lib/outcome/outcomeRewardService';

interface RewardManagerProps {
  user: PulsarUser | null;
}

export const RewardManager: React.FC<RewardManagerProps> = ({ user }) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [history, setHistory] = useState<RewardStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadRewards();
  }, [user]);

  const loadRewards = async () => {
    setLoading(true);
    const { data } = await outcomeRewardService.getRewards();
    setRewards(data);
    if (data.length > 0 && !selectedReward) {
      handleSelectReward(data[0]);
    }
    setLoading(false);
  };

  const handleSelectReward = async (reward: Reward) => {
    setSelectedReward(reward);
    const { data: hist } = await outcomeRewardService.getRewardHistory(reward.id);
    setHistory(hist);
    setMessage(null);
  };

  const handleStatusChange = async (newStatus: RewardStatus) => {
    if (!selectedReward || !user) return;
    setActionLoading(true);
    setMessage(null);

    const { data, error } = await outcomeRewardService.updateRewardStatus(
      selectedReward.id,
      newStatus,
      user,
      actionNotes || undefined
    );

    if (error) {
      setMessage({ type: 'error', text: error });
    } else if (data) {
      setMessage({
        type: 'success',
        text:
          newStatus === 'paid'
            ? 'Đã ghi nhận attested-paid (xác nhận thủ công qua Mock Escrow Adapter — KHÔNG phải bằng chứng thanh toán; cần payment record để xác minh).'
            : `Đã cập nhật trạng thái giải thưởng sang "${newStatus}" thành công qua Mock Escrow Adapter.`,
      });
      setSelectedReward(data);
      setActionNotes('');
      // Refresh list & history
      await loadRewards();
      const { data: hist } = await outcomeRewardService.getRewardHistory(data.id);
      setHistory(hist);
    }
    setActionLoading(false);
  };

  // SP8A.2: UI mirrors the service matrix (service remains authoritative).
  // Only org owners/admins see actionable controls; illegal edges are disabled.
  const canManageReward =
    !!user &&
    !!selectedReward &&
    (user.role === 'admin' ||
      (user.organizations?.some(
        (m) =>
          m.organization.id === selectedReward.organization_id &&
          (m.membership_role === 'owner' || (m.membership_role as string) === 'admin')
      ) ??
        false));

  const edgeAllowed = (target: RewardStatus): boolean =>
    !!selectedReward && isRewardTransitionAllowed(selectedReward.status, target);

  const handleReprocess = async () => {
    if (!selectedReward || !user) return;
    if (actionNotes.trim().length < 15) {
      setMessage({ type: 'error', text: 'Yêu cầu xử lý lại cần lý do tối thiểu 15 ký tự (phục vụ kiểm toán).' });
      return;
    }
    setActionLoading(true);
    setMessage(null);
    const { data, error } = await outcomeRewardService.requestRewardReprocessing(
      selectedReward.id,
      user,
      actionNotes.trim()
    );
    if (error) {
      setMessage({ type: 'error', text: error });
    } else if (data) {
      setMessage({ type: 'success', text: 'Đã mở xử lý lại (paid → processing) qua workflow kiểm toán chuyên biệt.' });
      setSelectedReward(data);
      setActionNotes('');
      await loadRewards();
      const { data: hist } = await outcomeRewardService.getRewardHistory(data.id);
      setHistory(hist);
    }
    setActionLoading(false);
  };

  const filteredRewards = rewards.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status: RewardStatus) => {
    switch (status) {
      case 'paid':
        return (
          <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Đã Giải Ngân (Paid)
          </span>
        );
      case 'processing':
        return (
          <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Đang Xử Lý (Processing)
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Đã Phê Duyệt (Approved)
          </span>
        );
      case 'pending_approval':
        return (
          <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Chờ Phê Duyệt
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Thất Bại (Failed)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase font-mono bg-slate-800 text-slate-400 border border-slate-700">
            {status}
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
            <DollarSign className="w-6 h-6 text-amber-400" />
            Quản Lý Giải Thưởng & Tiến Độ Giải Ngân (Reward Tracking)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi dòng tiền ký quỹ (Escrow), phân quyền giải ngân hai lớp và lưu nhật ký kiểm toán không thể sửa đổi (immutable audit history).
          </p>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Lọc:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="pending_approval">Pending Approval</option>
          </select>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-800'
              : 'bg-rose-950/80 text-rose-200 border border-rose-800'
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

      {/* Main Grid: List left, Detail right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Reward List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">
            Danh sách giải thưởng ({filteredRewards.length})
          </h3>

          {loading ? (
            <div className="text-center py-8 text-xs text-slate-500">Đang tải giải thưởng...</div>
          ) : filteredRewards.length === 0 ? (
            <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
              Không có giải thưởng nào phù hợp.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredRewards.map((reward) => (
                <div
                  key={reward.id}
                  onClick={() => handleSelectReward(reward)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                    selectedReward?.id === reward.id
                      ? 'bg-slate-900 border-amber-500/60 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-500">{reward.reference_code}</span>
                    <span className="text-sm font-extrabold text-amber-400 font-mono">
                      ${reward.amount.toLocaleString()} {reward.currency}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mt-1 line-clamp-1">
                    {reward.challenge_title}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between mt-2">
                    <span>Nhận: {reward.recipient_name}</span>
                    <div>{getStatusBadge(reward.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detailed View & Action Controls */}
        <div className="lg:col-span-2">
          {selectedReward ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
              {/* Top details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Mã tham chiếu: {selectedReward.reference_code}
                    </span>
                    <span className="text-xs text-slate-500">
                      Tạo ngày: {new Date(selectedReward.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {selectedReward.challenge_title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Đơn vị trao giải: <span className="text-slate-300 font-medium">{selectedReward.organization_name}</span>
                  </p>
                </div>

                <div className="text-right sm:shrink-0 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-500">Giá trị giải thưởng</div>
                  <div className="text-xl font-black text-amber-400 font-mono">
                    ${selectedReward.amount.toLocaleString()} {selectedReward.currency}
                  </div>
                  <div className="mt-1">{getStatusBadge(selectedReward.status)}</div>
                </div>
              </div>

              {/* Recipient & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Người thụ hưởng (Recipient)
                  </div>
                  <div className="text-sm font-bold text-white">{selectedReward.recipient_name}</div>
                  <div className="text-xs text-slate-500 font-mono">ID: {selectedReward.recipient_id}</div>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    Phương thức giải ngân
                  </div>
                  <div className="text-sm font-bold text-white">
                    {selectedReward.disbursement_method === 'mock_escrow_adapter'
                      ? 'Mock Escrow Smart Adapter'
                      : selectedReward.disbursement_method}
                  </div>
                  <div className="text-xs text-emerald-400 font-mono">
                    {selectedReward.is_mock_disbursement ? 'Môi trường mô phỏng an toàn (Demo Sandbox)' : 'Thực tế'}
                  </div>
                </div>
              </div>

              {/* Disbursement Status Action Controls (RBAC) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Cập nhật tiến trình giải ngân (Dành cho Doanh nghiệp & Admin)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Vai trò hiện tại: <strong className="text-violet-400 uppercase">{user?.role || 'Guest'}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={actionLoading || !canManageReward || !edgeAllowed('processing')}
                    title={
                      !canManageReward
                        ? 'Chỉ chủ tổ chức hoặc quản trị viên được đổi trạng thái'
                        : !edgeAllowed('processing')
                        ? `Không thể chuyển ${selectedReward.status} → processing (ma trận SP8A.1)`
                        : 'Chuyển sang processing'
                    }
                    onClick={() => handleStatusChange('processing')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-900/40 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-700/50 disabled:opacity-50 transition"
                  >
                    Chuyển sang Đang Xử Lý (Processing)
                  </button>

                  <button
                    disabled={actionLoading || !canManageReward || !edgeAllowed('paid')}
                    title={
                      !canManageReward
                        ? 'Chỉ chủ tổ chức hoặc quản trị viên được đổi trạng thái'
                        : !edgeAllowed('paid')
                        ? `Không thể chuyển ${selectedReward.status} → paid (ghi nhận attested, cần qua processing)`
                        : 'Ghi nhận attested-paid (KHÔNG phải bằng chứng thanh toán)'
                    }
                    onClick={() => handleStatusChange('paid')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 disabled:opacity-50 transition"
                  >
                    Xác nhận Đã Giải Ngân (Mark as Paid)
                  </button>

                  <button
                    disabled={actionLoading || !canManageReward || !edgeAllowed('cancelled')}
                    title={
                      !canManageReward
                        ? 'Chỉ chủ tổ chức hoặc quản trị viên được đổi trạng thái'
                        : !edgeAllowed('cancelled')
                        ? `Không thể chuyển ${selectedReward.status} → cancelled (trạng thái cuối)`
                        : 'Hủy giải ngân'
                    }
                    onClick={() => handleStatusChange('cancelled')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 border border-rose-700/50 disabled:opacity-50 transition"
                  >
                    Hủy giải ngân (Cancel)
                  </button>

                  {selectedReward.status === 'paid' && (
                    <button
                      disabled={actionLoading || !canManageReward}
                      title={
                        canManageReward
                          ? 'Mở xử lý lại qua workflow kiểm toán chuyên biệt (cần lý do ≥ 15 ký tự)'
                          : 'Chỉ chủ tổ chức hoặc quản trị viên được yêu cầu xử lý lại'
                      }
                      onClick={handleReprocess}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-700/50 disabled:opacity-50 transition"
                    >
                      Yêu cầu xử lý lại (Reprocessing có kiểm toán)
                    </button>
                  )}
                </div>
                {!canManageReward && (
                  <p className="text-[11px] text-slate-500">
                    Bạn đang xem ở chế độ chỉ đọc. Đổi trạng thái cần quyền chủ tổ chức hoặc quản trị viên (service sẽ từ chối 403 nếu không đủ quyền).
                  </p>
                )}

                <div>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Ghi chú lý do chuyển trạng thái (VD: Mã ủy nhiệm chi, số hóa đơn)..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status Audit History */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nhật ký thay đổi trạng thái (Audit Trail)
                </h4>

                <div className="space-y-2">
                  {history.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">Chưa có lịch sử trạng thái.</div>
                  ) : (
                    history.map((hist, index) => (
                      <div
                        key={hist.id}
                        className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-500">#{index + 1}</span>
                          <div>
                            <span className="font-semibold text-slate-200">
                              {hist.previous_status ? `${hist.previous_status} → ` : 'Khởi tạo → '}
                              <span className="text-amber-400 font-bold">{hist.new_status}</span>
                            </span>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Người thực hiện: <span className="text-slate-300">{hist.changer_name || hist.changed_by}</span>
                              {hist.reason && ` • Ghi chú: ${hist.reason}`}
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono shrink-0">
                          {new Date(hist.created_at).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              Vui lòng chọn một giải thưởng ở cột bên trái để xem chi tiết.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
