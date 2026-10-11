import React, { useState } from 'react';
import { User, Shield, Check, AlertCircle, Edit3, Clock, Key } from 'lucide-react';
import { profileUpdateSchema } from '../lib/validation/profile.schema';
import type { PulsarUser } from '../types/auth.types';

interface ProfileManagerProps {
  user: PulsarUser;
  onProfileUpdated: (updatedUser: PulsarUser) => void;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({ user, onProfileUpdated }) => {
  const [displayName, setDisplayName] = useState(user.profile.display_name);
  const [avatarUrl, setAvatarUrl] = useState(user.profile.avatar_url || '');
  const [bio, setBio] = useState(user.profile.bio || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate via Zod schema
    const validation = profileUpdateSchema.safeParse({
      displayName,
      avatarUrl: avatarUrl || null,
      bio: bio || null,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Dữ liệu không hợp lệ');
      return;
    }

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      const updated: PulsarUser = {
        ...user,
        profile: {
          ...user.profile,
          display_name: displayName,
          avatar_url: avatarUrl || null,
          bio: bio || null,
          updated_at: new Date().toISOString(),
        },
      };
      onProfileUpdated(updated);
      setSuccess('Hồ sơ cá nhân đã được cập nhật thành công!');
    }, 300);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Hồ sơ người dùng (Profiles Table)</h2>
            <p className="text-xs text-slate-400">
              RLS Policy: Chỉ chủ sở hữu <code className="text-indigo-400">auth.uid() = id</code> mới được cập nhật.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-mono uppercase font-semibold border ${
              user.role === 'admin'
                ? 'bg-purple-950/60 text-purple-300 border-purple-800'
                : user.role === 'business'
                ? 'bg-sky-950/60 text-sky-300 border-sky-800'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
            }`}
          >
            Vai trò: {user.role}
          </span>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Tên hiển thị (display_name)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              placeholder="Tên của bạn"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Avatar URL</label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Tiểu sử & Chuyên môn (bio)</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="Mô tả kỹ năng hoặc giới thiệu doanh nghiệp..."
          />
        </div>

        {/* Read-Only System Fields Protected by Database & RLS */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs font-mono space-y-1.5">
          <div className="text-slate-400 font-sans font-semibold text-[11px] mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            Các trường hệ thống (Bất biến, chặn sửa đổi từ Client):
          </div>
          <div className="flex justify-between text-slate-400">
            <span>user_id (auth.uid()):</span>
            <span className="text-slate-200">{user.id}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>email (auth.users):</span>
            <span className="text-slate-200">{user.email}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>user_roles table:</span>
            <span className="text-indigo-400">{user.role} (Chỉ Admin / Bootstrap được gán)</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>created_at (UTC):</span>
            <span className="text-slate-300">{user.profile.created_at}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition shadow flex items-center gap-2"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {saving ? 'Đang lưu...' : 'Lưu thông tin hồ sơ'}
          </button>
        </div>
      </form>
    </div>
  );
};
