import React, { useMemo, useState } from 'react';
import type { PulsarUser } from '../../types/auth.types';
import { collaborationService } from '../../lib/collaboration/collaborationService';
import { MessagingCenter } from './MessagingCenter';
import { ProjectTaskBoard } from './ProjectTaskBoard';
import { MilestoneTimeline } from './MilestoneTimeline';
import { DeliverableReviewPanel } from './DeliverableReviewPanel';
import { NotificationCenter } from './NotificationCenter';

/**
 * Sprint 7 §2+§8 — CollaborationWorkspace.
 * Liệt kê workspace của user, xem chi tiết (challenge, members/roles, tiến độ,
 * tasks, milestones, hoạt động) + tạo workspace mới (đúng workflow SP2–SP4).
 * Không tự cấp quyền chỉ vì matching: eligibility = org member / admin /
 * outcome winner / accepted submission (enforced trong service).
 */
interface Props {
  user: PulsarUser | null;
}

type SubTab = 'overview' | 'messages' | 'tasks' | 'milestones' | 'deliverables' | 'activity';

export const CollaborationWorkspace: React.FC<Props> = ({ user }) => {
  const [selectedId, setSelectedId] = useState<string>('ws-demo-001');
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState('');
  const [cChallenge, setCChallenge] = useState('ch-001');
  const [cDesc, setCDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'creator' | 'reviewer' | 'member' | 'observer'>('member');

  const workspaces = useMemo(
    () => (user ? collaborationService.listWorkspacesForUser(user) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, tick]
  );

  const detail = useMemo(
    () => (user && selectedId ? collaborationService.getWorkspace(selectedId, user) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, selectedId, tick]
  );
  const ws = detail?.workspace ?? null;

  const tasks = useMemo(
    () => (user && selectedId ? collaborationService.getTasks(selectedId, user) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, selectedId, tick]
  );
  const milestones = useMemo(
    () => (user && selectedId ? collaborationService.getMilestones(selectedId, user) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, selectedId, tick]
  );
  const activities = useMemo(
    () => (user && selectedId ? collaborationService.getActivities(selectedId, user) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, selectedId, tick]
  );

  if (!user) {
    return (
      <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-200">Đăng nhập để cộng tác</h3>
        <p className="text-sm text-slate-400 mt-1">Không gian cộng tác chỉ dành cho thành viên workspace (org / creator được chọn / reviewer / admin).</p>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const res = await collaborationService.createWorkspace(
      { challenge_id: cChallenge.trim(), name: cName.trim(), description: cDesc.trim() || undefined },
      user
    );
    if (!res.success) setError(res.error || 'Tạo workspace thất bại.');
    else {
      setSuccess(`Đã tạo "${res.workspace?.name}".`);
      setCName('');
      setCDesc('');
      setShowCreate(false);
      if (res.workspace) setSelectedId(res.workspace.id);
      setTick((v) => v + 1);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    setSuccess(null);
    const res = await collaborationService.addMember(
      selectedId,
      { user_id: `usr-${Date.now()}`, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole },
      user
    );
    if (!res.success) setError(res.error || 'Mời thất bại.');
    else {
      setSuccess(`Đã mời ${inviteName.trim()} (${inviteRole}).`);
      setInviteEmail('');
      setInviteName('');
      setTick((v) => v + 1);
    }
  };

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'messages', label: 'Tin nhắn' },
    { key: 'tasks', label: 'Nhiệm vụ' },
    { key: 'milestones', label: 'Mốc & Bàn giao' },
    { key: 'deliverables', label: 'Duyệt bàn giao' },
    { key: 'activity', label: 'Hoạt động' },
  ];

  return (
    <div className="space-y-4" aria-label="Không gian cộng tác">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Không gian cộng tác ({workspaces.length})</h2>
          <p className="text-[11px] text-slate-500">Gắn với challenge + submission hợp lệ • Dữ liệu demo local (chưa phải Cloud)</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-3.5 py-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium self-start"
        >
          {showCreate ? 'Đóng' : '+ Tạo workspace'}
        </button>
      </div>

      {error && (
        <div role="alert" className="p-2.5 text-xs bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="p-2.5 text-xs bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 rounded-lg">
          {success}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <input
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            placeholder="Tên workspace (≥3 ký tự)"
            maxLength={150}
            className="px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600"
            aria-label="Tên workspace"
          />
          <input
            value={cChallenge}
            onChange={(e) => setCChallenge(e.target.value)}
            placeholder="Challenge ID (vd. ch-001)"
            className="px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 font-mono"
            aria-label="Challenge ID"
          />
          <div className="flex gap-2">
            <input
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              placeholder="Mô tả (tùy chọn)"
              maxLength={1000}
              className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600"
              aria-label="Mô tả workspace"
            />
            <button type="submit" className="px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              Tạo
            </button>
          </div>
          <p className="text-[10px] text-slate-600 sm:col-span-3">Chỉ org member của challenge, admin, hoặc creator thắng giải/bài accepted mới tạo được (403 nếu không đủ điều kiện).</p>
        </form>
      )}

      {workspaces.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400 bg-slate-900/50 border border-slate-800 rounded-xl">
          Bạn chưa thuộc workspace nào. Workspace chỉ mở sau khi được kết nối/lựa chọn chính thức — không tự mở từ danh sách matching.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Danh sách workspace">
          {workspaces.map((w) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={selectedId === w.id}
              onClick={() => {
                setSelectedId(w.id);
                setSubTab('overview');
              }}
              className={`shrink-0 px-3.5 py-2 text-xs rounded-lg border text-left transition ${
                selectedId === w.id
                  ? 'bg-indigo-950/60 border-indigo-600 text-indigo-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold max-w-[220px] truncate">{w.name}</div>
              <div className="text-[10px] font-mono opacity-70">{w.stage} • {w.tasks_progress?.percentage ?? 0}% tasks</div>
            </button>
          ))}
        </div>
      )}

      {detail && !detail.success ? (
        <div className="p-4 text-sm text-rose-300 bg-rose-950/20 border border-rose-900/40 rounded-xl">{detail.error}</div>
      ) : ws ? (
        <div className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Chế độ xem workspace">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={subTab === t.key}
                onClick={() => setSubTab(t.key)}
                className={`shrink-0 px-3 py-1.5 text-xs rounded-lg border transition ${
                  subTab === t.key ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {subTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-100">Thông tin dự án</h3>
                <dl className="text-xs space-y-1.5">
                  <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Thử thách</dt><dd className="text-slate-300">{ws.challenge_title} <span className="font-mono text-slate-600">({ws.challenge_id})</span></dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Tổ chức</dt><dd className="text-slate-300">{ws.organization_name ?? ws.organization_id}</dd></div>
                  {ws.winning_submission_title && <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Bài thắng giải</dt><dd className="text-slate-300">{ws.winning_submission_title}</dd></div>}
                  <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Giai đoạn</dt><dd className="text-slate-300 font-mono">{ws.stage} • {ws.status}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Tiến độ</dt><dd className="text-slate-300">{ws.tasks_progress?.completed ?? 0}/{ws.tasks_progress?.total ?? 0} ({ws.tasks_progress?.percentage ?? 0}%) • {tasks.length} tasks • {milestones.length} milestones</dd></div>
                </dl>
                {ws.description && <p className="text-xs text-slate-400 pt-1">{ws.description}</p>}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-100">Thành viên ({ws.members.length})</h3>
                <ul className="space-y-1.5">
                  {ws.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-xs bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
                      <span className="text-slate-200">{m.name} <span className="text-slate-600 font-mono">• {m.email}</span></span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-violet-300">{m.role}</span>
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-1.5 pt-2">
                  <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Tên" className="flex-1 px-2 py-1.5 text-[11px] rounded-lg bg-slate-950 border border-slate-700 text-slate-200" aria-label="Tên người mời" />
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" type="email" className="flex-1 px-2 py-1.5 text-[11px] rounded-lg bg-slate-950 border border-slate-700 text-slate-200" aria-label="Email người mời" />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className="px-2 py-1.5 text-[11px] rounded-lg bg-slate-950 border border-slate-700 text-slate-300" aria-label="Vai trò">
                    <option value="member">member</option>
                    <option value="creator">creator</option>
                    <option value="reviewer">reviewer</option>
                    <option value="observer">observer</option>
                  </select>
                  <button type="submit" className="px-2.5 py-1.5 text-[11px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Mời</button>
                </form>
                <p className="text-[10px] text-slate-600">Chỉ Owner/Admin workspace được mời (creator thường bị 403).</p>
              </div>
            </div>
          )}

          {subTab === 'messages' && <MessagingCenter workspaceId={ws.id} user={user} workspaceName={ws.name} />}
          {subTab === 'tasks' && <ProjectTaskBoard workspaceId={ws.id} user={user} />}
          {subTab === 'milestones' && <MilestoneTimeline workspaceId={ws.id} user={user} />}
          {subTab === 'deliverables' && <DeliverableReviewPanel workspaceId={ws.id} user={user} />}
          {subTab === 'activity' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2" aria-label="Lịch sử hoạt động">
              <h3 className="text-sm font-semibold text-slate-100">Lịch sử hoạt động ({activities.length})</h3>
              {activities.length === 0 ? (
                <div className="text-sm text-slate-500">Chưa có hoạt động nào.</div>
              ) : (
                <ul className="space-y-1.5 max-h-[380px] overflow-y-auto">
                  {activities.map((a) => (
                    <li key={a.id} className="text-xs bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                      <span className="text-slate-200 font-medium">{a.actor_name}</span>{' '}
                      <span className="text-slate-400">{a.details}</span>
                      <span className="block text-[10px] text-slate-600 font-mono mt-0.5">{a.action} • {new Date(a.created_at).toLocaleString('vi-VN')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : null}

      <details className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <summary className="text-xs font-semibold text-slate-300 cursor-pointer">Thông báo của tôi (recipient isolation)</summary>
        <div className="pt-3">
          <NotificationCenter user={user} />
        </div>
      </details>
    </div>
  );
};
