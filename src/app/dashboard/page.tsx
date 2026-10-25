'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser, getCachedUser } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function DashboardHomePage() {
  const router = useRouter();

  useEffect(() => {
    const cached = getCachedUser();
    if (cached) {
      if (cached.role === 'admin') {
        router.replace('/dashboard/admin');
        return;
      } else if (cached.role === 'mentor') {
        router.replace('/dashboard/mentor');
        return;
      } else {
        router.replace('/dashboard/siswa');
        return;
      }
    }

    fetchCurrentUser().then((user) => {
      if (user) {
        if (user.role === 'admin') {
          router.replace('/dashboard/admin');
        } else if (user.role === 'mentor') {
          router.replace('/dashboard/mentor');
        } else {
          router.replace('/dashboard/siswa');
        }
      } else {
        router.replace('/login');
      }
    });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center p-20 text-fd-muted-foreground space-y-3">
      <Loader2 className="size-6 animate-spin text-fd-primary" />
      <span className="text-sm font-medium">Mengarahkan ke meja kerja Anda...</span>
    </div>
  );
}
