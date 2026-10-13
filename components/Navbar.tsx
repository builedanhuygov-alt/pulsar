import React from 'react';
import { ShieldCheck, LogOut, User, Building2, Terminal, Database, CheckCircle2, Sparkles } from 'lucide-react';
import type { PulsarUser } from '../types/auth.types';

interface NavbarProps {
  user: PulsarUser | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isLiveSupabase: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  isLiveSupabase,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight text-lg">PULSAR</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  Sprint 7 Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">Collaboration • Messaging • Tasks • Milestones</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-800">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'marketplace'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Sàn Thử Thách
            </button>
            <button
              onClick={() => setActiveTab('ai-recommendations')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'ai-recommendations'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-violet-400 hover:text-violet-300 hover:bg-violet-950/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Gợi Ý Đề Bài
            </button>
            <button
              onClick={() => setActiveTab('reputation')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'reputation'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
              }`}
            >
              Hồ Sơ Uy Tín
            </button>
            <button
              onClick={() => setActiveTab('skills-graph')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'skills-graph'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40'
              }`}
            >
              Kỹ Năng & Bằng Chứng
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
              }`}
            >
              Phân Tích KPI
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('integrity-signals')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  activeTab === 'integrity-signals'
                    ? 'bg-rose-900/60 text-rose-200 border border-rose-700/60'
                    : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40'
                }`}
              >
                Cảnh Báo Gian Lận
              </button>
            )}
            <button
              onClick={() => setActiveTab('outcomes')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'outcomes'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Bảng Vàng
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'rewards'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              Giải Thưởng
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'portfolio'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40'
              }`}
            >
              Portfolio
            </button>
            <button
              onClick={() => setActiveTab('my-submissions')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'my-submissions'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Bài Dự Thi
            </button>
            <button
              onClick={() => setActiveTab('challenges')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'challenges'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Thử Thách Tổ Chức
            </button>
            {(user?.role === 'business' || user?.role === 'admin') && (
              <button
                onClick={() => setActiveTab('review-workspace')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'review-workspace'
                    ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700/60'
                    : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
                }`}
              >
                Chấm Điểm
              </button>
            )}
            <button
              onClick={() => setActiveTab('collaboration')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'collaboration'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-teal-400 hover:text-teal-300 hover:bg-teal-950/40'
              }`}
            >
              Cộng Tác
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'finance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
              }`}
            >
              Tài Chính
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin-reviews')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'admin-reviews'
                    ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60'
                    : 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/40'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                Duyệt Đề Bài
              </button>
            )}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Console
            </button>
            <button
              onClick={() => setActiveTab('rls-matrix')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'rls-matrix'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              RLS
            </button>
            <button
              onClick={() => setActiveTab('test-suite')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'test-suite'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              Tests
            </button>
            <button
              onClick={() => setActiveTab('migrations')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'migrations'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Database className="w-4 h-4 text-purple-400" />
              SQL
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${
                isLiveSupabase
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/80'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveSupabase ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isLiveSupabase ? 'Supabase Live' : 'Verified Secure Mode'}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200">{user.profile.display_name}</div>
                <div className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider">{user.role}</div>
              </div>
              <button
                onClick={onLogout}
                title="Đăng xuất"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors border border-slate-800"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('auth')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-md shadow-indigo-600/20"
            >
              Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
