'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCurrentUser, type AuthUser } from '@/lib/auth';
import {
  dashboardCache,
  loadKelasListCache,
  topProgress,
} from '@/lib/dashboard-navigation';
import {
  ChevronRight,
  Layers,
  GraduationCap,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface CourseItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  totalSessions: number;
}

export default function StudentClassroomListPage() {
  const cached = dashboardCache.kelasList;

  const [courses, setCourses] = useState<CourseItem[]>(
    (cached?.courses as CourseItem[]) || [],
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((u) => {
      if (mounted) setCurrentUser(u);
    });

    if (dashboardCache.kelasList) return;
    const fetchCourses = async () => {
      topProgress.start();
      try {
        const data = await loadKelasListCache();
        if (mounted) {
          setCourses((data.courses as CourseItem[]) || []);
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memuat kelas.';
          setError(msg);
        }
      } finally {
        if (mounted) setIsLoading(false);
        topProgress.done();
      }
    };

    fetchCourses();
    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <header className="flex flex-col gap-2 border-b border-fd-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
          Kelas & Materi Pembelajaran
        </h1>
        <p className="text-sm text-fd-muted-foreground">
          Pilih kelas untuk mengakses kurikulum, materi pembelajaran berbasis MDX, dan tugas praktikum per sesi pertemuan.
        </p>
      </header>

      {error && !isLoading && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State: Belum Terdaftar di Batch Aktif */}
      {!isLoading && !error && courses.length === 0 && (
        <div className="rounded-xl border border-fd-border bg-fd-card p-8 sm:p-12 text-center space-y-4 shadow-2xs">
          <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <Layers className="size-7" />
          </div>
          <div className="max-w-lg mx-auto">
            <h2 className="text-base font-semibold text-fd-foreground">
              Belum Terdaftar di Batch Aktif
            </h2>
            <p className="text-xs sm:text-sm text-fd-muted-foreground mt-1.5 leading-relaxed">
              Materi pembelajaran saat ini belum dibuka karena Anda belum terdaftar dalam batch aktif atau pembayaran pendaftaran sedang diverifikasi oleh Mentor.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard/batch"
              className="w-full sm:w-auto inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-fd-primary px-5 py-2 text-xs font-semibold text-fd-primary-foreground hover:bg-fd-primary/90 transition shadow-2xs"
            >
              <Layers className="size-4" />
              <span>Lihat Katalog & Daftar Batch</span>
            </Link>
          </div>
        </div>
      )}

      {/* Course Cards Grid */}
      {!isLoading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="group relative flex flex-col justify-between p-5 rounded-xl border border-fd-border bg-fd-card hover:border-fd-primary/40 transition-colors shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-10 rounded-xl bg-fd-primary/10 text-fd-primary flex items-center justify-center border border-fd-primary/20">
                    <GraduationCap className="size-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fd-muted text-fd-foreground font-medium text-xs border border-fd-border">
                      <Layers className="size-3 text-fd-primary" />
                      <span>{course.totalSessions} Pertemuan</span>
                    </span>
                    {currentUser?.role === 'admin' && (
                      <Link
                        href={`/dashboard/dosen/kelas/${course.slug}`}
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'sm' }),
                          'h-7 px-2.5 text-xs gap-1 font-medium shadow-2xs'
                        )}
                        title="Edit Modul & Materi Kelas (Admin)"
                      >
                        <Pencil className="size-3" />
                        <span>Edit</span>
                      </Link>
                    )}
                  </div>
                </div>

                <Link
                  href={`/dashboard/kelas/${course.slug}`}
                  className="font-semibold text-base text-fd-foreground group-hover:text-fd-primary transition-colors block"
                >
                  {course.title}
                </Link>
                <p className="text-fd-muted-foreground text-xs leading-relaxed mt-1.5 line-clamp-3">
                  {course.description || 'Pelajari kurikulum, materi, dan tugas praktikum untuk kelas ini.'}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-fd-border/60 flex items-center justify-between text-xs font-semibold text-fd-primary">
                <Link
                  href={`/dashboard/kelas/${course.slug}`}
                  className="flex items-center justify-between w-full group/link hover:underline"
                >
                  <span>Buka Materi Sesi</span>
                  <ChevronRight className="size-4 group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
