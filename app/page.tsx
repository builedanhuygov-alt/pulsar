import React from 'react';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 mx-auto flex items-center justify-center shadow-lg text-white font-bold text-xl">
          P
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">PULSAR Sprint 1</h1>
        <p className="text-sm text-slate-400">
          Nền tảng kết nối doanh nghiệp với sinh viên & chuyên gia để giải quyết bài toán thực tế.
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <a
            href="/login"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
          >
            Đăng nhập
          </a>
          <a
            href="/register"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition"
          >
            Đăng ký
          </a>
        </div>
      </div>
    </main>
  );
}
