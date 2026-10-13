import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { AuthForms } from '../components/AuthForms';
import { ProfileManager } from '../components/ProfileManager';
import { OrgManager } from '../components/OrgManager';
import { AuditLogViewer } from '../components/AuditLogViewer';
import { RlsTester } from '../components/RlsTester';
import { TestRunnerPanel } from '../components/TestRunnerPanel';
import { MigrationViewer } from '../components/MigrationViewer';
import { ChallengeMarketplace } from '../components/challenges/ChallengeMarketplace';
import { ChallengeList } from '../components/challenges/ChallengeList';
import { AdminChallengeReview } from '../components/challenges/AdminChallengeReview';
import { MySubmissions } from '../components/submissions/MySubmissions';
import { ReviewWorkspace } from '../components/submissions/ReviewWorkspace';
import { OutcomeDashboard } from '../components/outcomes/OutcomeDashboard';
import { RewardManager } from '../components/outcomes/RewardManager';
import { VerifiedPortfolio } from '../components/outcomes/VerifiedPortfolio';
import { ReputationProfile } from '../components/reputation/ReputationProfile';
import { SkillEvidencePanel } from '../components/reputation/SkillEvidencePanel';
import { BusinessAnalyticsDashboard } from '../components/reputation/BusinessAnalyticsDashboard';
import { IntegrityReviewQueue } from '../components/reputation/IntegrityReviewQueue';
import { CreatorRecommendationFeed } from '../components/matching/CreatorRecommendationFeed';
import { CollaborationWorkspace } from '../components/collaboration/CollaborationWorkspace';
import { FinancialOperations } from '../components/finance/FinancialOperations';
import { isSupabaseConfigured } from '../lib/supabase/client';
import type { PulsarUser } from '../types/auth.types';
import { Shield, Sparkles, Building2, User, Database, Terminal, CheckCircle2, AlertTriangle, Layers, Award, Trophy, DollarSign } from 'lucide-react';

export default function App() {
  // Demo initial authenticated user (Developer / Creator)
  const [user, setUser] = useState<PulsarUser | null>({
    id: 'usr-creator-001',
    email: 'creator.developer@pulsar.dev',
    role: 'creator',
    profile: {
      id: 'usr-creator-001',
      display_name: 'Minh Quang (Creator)',
      avatar_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=creator',
      bio: 'Freelancer & Kỹ sư AI tại PULSAR, sẵn sàng giải quyết các bài toán thực tế.',
      created_at: '2026-01-15T08:00:00Z',
      updated_at: '2026-01-15T08:00:00Z',
    },
    organizations: [
      {
        membership_role: 'owner',
        organization: {
          id: 'org-lab-01',
          name: 'AI Innovators Hub',
          slug: 'ai-innovators-hub',
          organization_type: 'school',
          created_by: 'usr-creator-001',
          created_at: '2026-01-15T09:00:00Z',
          updated_at: '2026-01-15T09:00:00Z',
        },
      },
    ],
  });

  const [activeTab, setActiveTab] = useState<string>('marketplace');

  const handleLogout = () => {
    setUser(null);
    setActiveTab('auth');
  };

  const handleAuthSuccess = (authenticatedUser: PulsarUser) => {
    setUser(authenticatedUser);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        isLiveSupabase={isSupabaseConfigured}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-950/60 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sprint 7: Collaboration & Communication Engine • Workspace, Messaging, Tasks, Milestones & Notifications</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                PULSAR Collaboration & Communication Engine
              </h1>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Môi trường cộng tác an toàn giữa doanh nghiệp và Creator sau kết nối: workspace theo challenge/submission hợp lệ, hội thoại polling thủ công, kanban nhiệm vụ theo giờ thực, mốc bàn giao tách khỏi thanh toán/outcome, và thông báo cô lập theo người nhận.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded bg-slate-900/80 text-emerald-400 border border-emerald-900/50 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  113 Tests Vitest PASS
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-900/80 text-violet-400 border border-violet-900/50">
                  5-Component Weighted Matching
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-900/80 text-cyan-400 border border-cyan-900/50">
                  Verified-Skill Multiplier
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-900/80 text-indigo-400 border border-indigo-900/50">
                  Challenge AI Copilot (100% Rubric)
                </span>
              </div>
            </div>

            {/* Quick Persona Selector */}
            {user && (
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 shrink-0">
                <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                  <span>Chuyển đổi Vai trò (Persona):</span>
                  <span className="text-[10px] font-mono uppercase text-violet-400 font-bold">
                    {user.role}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2">
                  <button
                    onClick={() =>
                      setUser({
                        ...user,
                        role: 'creator',
                        profile: { ...user.profile, display_name: 'Minh Quang (Creator)' },
                      })
                    }
                    className={`px-3 py-1.5 text-xs rounded-lg border text-left transition flex items-center justify-between ${
                      user.role === 'creator'
                        ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>Creator / Freelancer</span>
                    <span className="text-[10px] font-mono text-slate-500">Xem Sàn & Nộp</span>
                  </button>
                  <button
                    onClick={() =>
                      setUser({
                        ...user,
                        role: 'business',
                        profile: { ...user.profile, display_name: 'Bảo Trân (Business CEO)' },
                      })
                    }
                    className={`px-3 py-1.5 text-xs rounded-lg border text-left transition flex items-center justify-between ${
                      user.role === 'business'
                        ? 'bg-sky-950/80 text-sky-200 border-sky-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>Business Doanh Nghiệp</span>
                    <span className="text-[10px] font-mono text-slate-500">Tạo & Quản lý</span>
                  </button>
                  <button
                    onClick={() =>
                      setUser({
                        ...user,
                        role: 'admin',
                        profile: { ...user.profile, display_name: 'Super Admin Hệ Thống' },
                      })
                    }
                    className={`px-3 py-1.5 text-xs rounded-lg border text-left transition flex items-center justify-between ${
                      user.role === 'admin'
                        ? 'bg-purple-950/80 text-purple-200 border-purple-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>Super Admin Ban Quản Trị</span>
                    <span className="text-[10px] font-mono text-slate-500">Duyệt & Thẩm định</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Tab Views */}
        {activeTab === 'marketplace' && (
          <ChallengeMarketplace
            user={user}
            onNavigateToSubmissions={() => setActiveTab('my-submissions')}
          />
        )}

        {activeTab === 'ai-recommendations' && (
          <CreatorRecommendationFeed
            user={user}
            onSelectChallenge={(chalId) => {
              setActiveTab('marketplace');
            }}
          />
        )}

        {activeTab === 'reputation' && (
          <ReputationProfile
            user={user}
            onNavigateToSkills={() => setActiveTab('skills-graph')}
          />
        )}

        {activeTab === 'skills-graph' && <SkillEvidencePanel user={user} />}

        {activeTab === 'analytics' && <BusinessAnalyticsDashboard user={user} />}

        {activeTab === 'integrity-signals' && <IntegrityReviewQueue user={user} />}

        {activeTab === 'outcomes' && (
          <OutcomeDashboard
            user={user}
            onNavigateToPortfolios={() => setActiveTab('portfolio')}
            onNavigateToRewards={() => setActiveTab('rewards')}
          />
        )}

        {activeTab === 'rewards' && <RewardManager user={user} />}

        {activeTab === 'portfolio' && <VerifiedPortfolio user={user} />}

        {activeTab === 'my-submissions' &&
          (user ? (
            <MySubmissions
              user={user}
              onExploreMarketplace={() => setActiveTab('marketplace')}
            />
          ) : (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">
                Đăng nhập để xem các bài dự thi của bạn
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                Vui lòng đăng nhập với tư cách Creator để nộp và quản lý các giải pháp kỹ thuật.
              </p>
              <button
                onClick={() => setActiveTab('auth')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition shadow-lg shadow-indigo-600/30"
              >
                Đăng nhập ngay
              </button>
            </div>
          ))}

        {activeTab === 'review-workspace' &&
          (user ? (
            <ReviewWorkspace user={user} />
          ) : (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">
                Yêu cầu quyền Doanh nghiệp / Quản trị viên
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                Vui lòng đăng nhập để truy cập không gian chấm điểm bài dự thi.
              </p>
            </div>
          ))}

        {activeTab === 'collaboration' &&
          (user ? (
            <CollaborationWorkspace user={user} />
          ) : (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">
                Đăng nhập để vào Không gian Cộng tác
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                Workspace chỉ mở cho thành viên được cấp quyền (org / creator được chọn / reviewer / admin).
              </p>
              <button
                onClick={() => setActiveTab('auth')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition shadow-lg shadow-indigo-600/30"
              >
                Đăng nhập ngay
              </button>
            </div>
          ))}

        {activeTab === 'finance' && <FinancialOperations user={user} />}

        {activeTab === 'challenges' &&
          (user ? (
            <ChallengeList user={user} />
          ) : (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">
                Cần đăng nhập để quản lý thử thách của tổ chức
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                Vui lòng đăng nhập với tư cách Doanh nghiệp hoặc Nhà sáng tạo để tạo và quản lý đề bài.
              </p>
              <button
                onClick={() => setActiveTab('auth')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition shadow-lg shadow-indigo-600/30"
              >
                Đăng nhập ngay
              </button>
            </div>
          ))}

        {activeTab === 'admin-reviews' &&
          (user ? (
            <AdminChallengeReview user={user} />
          ) : (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">
                Yêu cầu quyền Quản trị viên
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                Vui lòng đăng nhập tài khoản Quản trị viên hệ thống để truy cập hàng đợi duyệt.
              </p>
            </div>
          ))}

        {activeTab === 'auth' && (
          <div className="py-4">
            <AuthForms onSuccess={handleAuthSuccess} />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {user ? (
              <>
                {/* User Status Bar with Persona Switcher */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.profile.avatar_url || ''}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full bg-indigo-900/40 border border-indigo-700/50"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        {user.profile.display_name}
                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                            user.role === 'admin'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : user.role === 'business'
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          Role: {user.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">Chuyển Persona kiểm thử:</span>
                    <button
                      onClick={() =>
                        setUser({
                          ...user,
                          role: 'creator',
                          profile: { ...user.profile, display_name: 'Minh Quang (Creator)' },
                        })
                      }
                      className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                        user.role === 'creator'
                          ? 'bg-emerald-900/50 text-emerald-200 border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Creator
                    </button>
                    <button
                      onClick={() =>
                        setUser({
                          ...user,
                          role: 'business',
                          profile: { ...user.profile, display_name: 'Bảo Trân (Business CEO)' },
                        })
                      }
                      className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                        user.role === 'business'
                          ? 'bg-sky-900/50 text-sky-200 border-sky-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Business
                    </button>
                    <button
                      onClick={() =>
                        setUser({
                          ...user,
                          role: 'admin',
                          profile: { ...user.profile, display_name: 'Super Admin Hệ thống' },
                        })
                      }
                      className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                        user.role === 'admin'
                          ? 'bg-purple-900/50 text-purple-200 border-purple-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                {/* Profile and Organization Modules */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ProfileManager user={user} onProfileUpdated={(updated) => setUser(updated)} />
                  <OrgManager user={user} onOrganizationsChanged={(updated) => setUser(updated)} />
                </div>

                {/* Audit Logs Module */}
                <AuditLogViewer user={user} />
              </>
            ) : (
              <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-200">Bạn chưa đăng nhập</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                  Vui lòng đăng nhập hoặc chọn nhanh một Persona để kiểm thử các tính năng phân quyền và RLS.
                </p>
                <button
                  onClick={() => setActiveTab('auth')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition shadow-lg shadow-indigo-600/30"
                >
                  Mở Form Đăng nhập & Đăng ký
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rls-matrix' && <RlsTester />}

        {activeTab === 'test-suite' && <TestRunnerPanel />}

        {activeTab === 'migrations' && <MigrationViewer />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>PULSAR Sprint 1 • Production-Ready Auth, RLS & Database Architecture</div>
          <div className="flex gap-4 font-mono text-[11px]">
            <span>TypeScript Strict Mode</span>
            <span>PostgreSQL RLS</span>
            <span>Vitest 27 Passed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
