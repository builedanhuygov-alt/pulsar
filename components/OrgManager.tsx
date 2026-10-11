import React, { useState } from 'react';
import { Building2, Plus, Users, Shield, Check, AlertCircle, Trash2, UserPlus } from 'lucide-react';
import { createOrganizationSchema, inviteMemberSchema } from '../lib/validation/org.schema';
import type { PulsarUser } from '../types/auth.types';
import type { Organization, OrganizationType, MembershipRole } from '../types/database.types';

interface OrgManagerProps {
  user: PulsarUser;
  onOrganizationsChanged: (updatedUser: PulsarUser) => void;
}

export const OrgManager: React.FC<OrgManagerProps> = ({ user, onOrganizationsChanged }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [orgType, setOrgType] = useState<OrganizationType>('business');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>('member');
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    user.organizations.length > 0 ? user.organizations[0].organization.id : null
  );

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto slug generation helper
  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setSlug(generatedSlug);
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = createOrganizationSchema.safeParse({
      name,
      slug,
      organizationType: orgType,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Dữ liệu tổ chức không hợp lệ');
      return;
    }

    const newOrg: Organization = {
      id: 'org-' + Math.random().toString(36).substring(2, 9),
      name,
      slug,
      organization_type: orgType,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // The SQL trigger `on_organization_created` automatically assigns creator as 'owner'
    const updatedOrgs = [
      ...user.organizations,
      {
        organization: newOrg,
        membership_role: 'owner' as MembershipRole,
      },
    ];

    const updatedUser = {
      ...user,
      organizations: updatedOrgs,
    };

    onOrganizationsChanged(updatedUser);
    setActiveOrgId(newOrg.id);
    setShowCreateModal(false);
    setName('');
    setSlug('');
    setSuccess(`Tổ chức "${name}" đã được tạo. Bạn được tự động gán quyền "owner".`);
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeMembership = user.organizations.find((o) => o.organization.id === activeOrgId);
    if (!activeMembership || activeMembership.membership_role !== 'owner') {
      setError('BỊ CHẶN BỞI RLS: Chỉ thành viên có vai trò "owner" mới có quyền mời thành viên mới.');
      return;
    }

    const validation = inviteMemberSchema.safeParse({
      email: inviteEmail,
      membershipRole: inviteRole,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Thông tin mời không hợp lệ');
      return;
    }

    setSuccess(`Lời mời thành viên (${inviteRole}) đã được gửi an toàn tới ${inviteEmail}.`);
    setInviteEmail('');
  };

  const currentOrg = user.organizations.find((o) => o.organization.id === activeOrgId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Quản lý Tổ chức & Thành viên</h2>
            <p className="text-xs text-slate-400">
              RLS: Chỉ thành viên được đọc tổ chức; chỉ "owner" được mời và phân quyền.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setError(null);
          }}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition shadow flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tạo Tổ chức mới
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Organization List / Tabs */}
      {user.organizations.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Bạn chưa tham gia tổ chức nào.</p>
          <p className="text-xs text-slate-500 mt-1">
            Bấm "Tạo Tổ chức mới" để đăng ký doanh nghiệp, trường học hoặc tổ chức đối tác.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800/80">
            {user.organizations.map((item) => (
              <button
                key={item.organization.id}
                onClick={() => {
                  setActiveOrgId(item.organization.id);
                  setError(null);
                  setSuccess(null);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 shrink-0 border ${
                  activeOrgId === item.organization.id
                    ? 'bg-slate-800 border-sky-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{item.organization.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                    item.membership_role === 'owner'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.membership_role}
                </span>
              </button>
            ))}
          </div>

          {currentOrg && (
            <div className="mt-5 space-y-5">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">{currentOrg.organization.name}</h3>
                    <p className="text-xs font-mono text-slate-500">
                      slug: <span className="text-slate-300">/{currentOrg.organization.slug}</span> • loại:{' '}
                      <span className="text-indigo-400 uppercase">{currentOrg.organization.organization_type}</span>
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Quyền của bạn:{' '}
                    <span
                      className={`font-semibold uppercase ${
                        currentOrg.membership_role === 'owner' ? 'text-amber-400' : 'text-slate-300'
                      }`}
                    >
                      {currentOrg.membership_role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Members & Invite Section */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Users className="w-4 h-4 text-sky-400" />
                    <span>Thành viên trong tổ chức</span>
                  </div>
                  {currentOrg.membership_role !== 'owner' && (
                    <span className="text-[11px] text-amber-400/90 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50">
                      Chế độ Xem (Thành viên thông thường không thể mời thêm)
                    </span>
                  )}
                </div>

                {/* Invite form (Only enabled for owner) */}
                {currentOrg.membership_role === 'owner' ? (
                  <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email-thanh-vien@pulsar.dev"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="member">Thành viên (member)</option>
                      <option value="owner">Đồng sở hữu (owner)</option>
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Mời
                    </button>
                  </form>
                ) : null}

                {/* Simulated membership list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                        {user.profile.display_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{user.profile.display_name} (Bạn)</div>
                        <div className="text-[10px] text-slate-500">{user.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                      {currentOrg.membership_role}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Tạo Tổ chức mới</h3>
            <p className="text-xs text-slate-400 mb-4">
              Người tạo sẽ được tự động thêm vào bảng <code className="text-sky-400">organization_members</code> với quyền "owner".
            </p>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tên tổ chức</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ví dụ: Đại học Bách Khoa / FPT Software"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Slug URL (Duy nhất)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="fpt-software"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Loại tổ chức</label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value as OrganizationType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="business">Doanh nghiệp (business)</option>
                  <option value="agency">Agency đối tác (agency)</option>
                  <option value="school">Trường học / Viện đào tạo (school)</option>
                  <option value="partner">Đối tác chiến lược (partner)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-700 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition shadow"
                >
                  Xác nhận tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
