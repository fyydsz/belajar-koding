import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) {
    redirect('/login');
  }
  const initialRole = cookieStore.get('auth_role')?.value;

  return (
    <DashboardLayoutClient initialRole={initialRole}>
      {children}
    </DashboardLayoutClient>
  );
}
