'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function PresensiRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((user) => {
      if (!mounted) return;
      if (user?.role === 'student') {
        router.replace('/dashboard/siswa/presensi');
      } else {
        router.replace('/dashboard/mentor/presensi');
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-fd-muted-foreground">
      <Loader2 className="size-6 animate-spin text-fd-primary" />
      <p className="text-sm">Mengarahkan ke halaman presensi...</p>
    </div>
  );
}
