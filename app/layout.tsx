import React from 'react';

export const metadata = {
  title: 'PULSAR Platform - Core Auth & RBAC',
  description: 'Enterprise-ready foundation for PULSAR: Supabase Auth, PostgreSQL RLS migrations, strict role-based access control, organization management, and audit logging.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
