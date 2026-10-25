import React from 'react';
import { cookies } from 'next/headers';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialRole = cookieStore.get('auth_role')?.value;

  return (
    <DashboardLayoutClient initialRole={initialRole}>
      {children}
    </DashboardLayoutClient>
  );
}
