import React from 'react';
import { ShieldAlert, Lock, CheckCircle2, AlertOctagon, Terminal } from 'lucide-react';
import type { PulsarUser } from '../types/auth.types';
import type { AuditLog } from '../types/database.types';

interface AuditLogViewerProps {
  user: PulsarUser;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ user }) => {
  // Demonstration immutable logs adhering strictly to PostgreSQL audit_logs schema
  const mockAuditLogs: AuditLog[] = [
    {
      id: 'log-001',
      actor_user_id: user.id,
      action: 'auth.user_logged_in',
      resource_type: 'auth_session',
      resource_id: 'sess-849204',
      metadata: { ip: '127.0.0.1', client: 'Pulsar Web Client v1.0', mode: 'secure_jwt' },
      created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    },
    {
      id: 'log-002',
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      action: 'admin.bootstrap_system',
      resource_type: 'system',
      resource_id: 'init_migration',
      metadata: { version: 'Sprint 1.0', migration: '20240101000003_admin_bootstrap_procedure.sql' },
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: 'log-003',
      actor_user_id: user.id,
      action: 'profile.updated',
      resource_type: 'profiles',
      resource_id: user.id,
      metadata: { fields_changed: ['display_name', 'bio'], rls_policy: 'Users can update only their own profile' },
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
  ];

  const isAdmin = user.role === 'admin';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Bảo mật & Audit Logs Bất biến</h2>
            <p className="text-xs text-slate-400">
              Chỉ backend service_role đặc quyền mới có quyền ghi. Client hoàn toàn bị chặn INSERT / UPDATE / DELETE.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-md font-mono ${
              isAdmin
                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isAdmin ? 'Đặc quyền: Xem toàn bộ audit log' : 'Xem log cá nhân (Actor scope)'}
          </span>
        </div>
      </div>

      {/* Database Security Constraint Notice */}
      <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3 text-xs text-amber-200/90 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">RLS Immutability Enforcement:</span> Bảng{' '}
          <code className="text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded font-mono">public.audit_logs</code> đã được
          thực thi lệnh SQL:{' '}
          <code className="text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded font-mono">
            REVOKE INSERT, UPDATE, DELETE FROM public, anon, authenticated;
          </code>
          . Mọi hành vi sửa xóa log bảo mật đều bị chặn ngay ở tầng PostgreSQL.
        </div>
      </div>

      {/* Log Entries Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Thời gian (UTC)</th>
              <th className="py-2.5 px-3">Hành động</th>
              <th className="py-2.5 px-3">Tài nguyên</th>
              <th className="py-2.5 px-3">Actor ID</th>
              <th className="py-2.5 px-3">Chi tiết Metadata (JSONB)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
            {mockAuditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/30 transition">
                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('vi-VN')}
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded bg-indigo-950/50 text-indigo-300 border border-indigo-800/40 text-[11px]">
                    {log.action}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {log.resource_type} <span className="text-slate-500">({log.resource_id})</span>
                </td>
                <td className="py-2.5 px-3 text-slate-400 truncate max-w-[120px]">{log.actor_user_id || 'system'}</td>
                <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                  {JSON.stringify(log.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
