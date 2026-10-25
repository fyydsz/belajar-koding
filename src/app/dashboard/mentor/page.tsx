'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  CalendarCheck,
  Layers,
  Clock,
  Users,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface AssignmentItem {
  id: string;
  courseId: string;
  courseTitle: string | null;
  batchId?: string | null;
  type?: 'tugas' | 'quiz' | 'uts' | 'uas';
  title: string;
  description: string | null;
  createdAt: string;
  expiredAt: string;
  isExpired: boolean;
}

interface DosenCourseSession {
  id: string;
  sessionNumber: number;
  title: string;
}

interface DosenCourseItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  totalSessions: number;
  sessions?: DosenCourseSession[];
}

interface BatchSummaryItem {
  id: string;
  name: string;
  status: string;
  studentCount?: number;
}

function formatDeadline(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export default function MentorDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);

  const [dosenCourses, setDosenCourses] = useState<DosenCourseItem[]>([]);
  const [dosenAssignments, setDosenAssignments] = useState<AssignmentItem[]>([]);
  const [batches, setBatches] = useState<BatchSummaryItem[]>([]);
  const [isDosenLoading, setIsDosenLoading] = useState(true);
  const [dosenError, setDosenError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((user) => {
        if (!mounted) return;
        if (!user) {
          router.replace('/login');
          return;
        }
        if (user.role === 'student') {
          router.replace('/dashboard/siswa');
          return;
        }
        setCurrentUser(user);
      })
      .finally(() => {
        if (mounted) setIsAuthResolved(true);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const fetchDosenOverview = useCallback(async () => {
    setIsDosenLoading(true);
    topProgress.start();
    setDosenError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        setDosenError('Sesi login telah berakhir. Silakan masuk kembali.');
        return;
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const [coursesRes, assignRes, batchesRes] = await Promise.all([
        fetch(`${apiUrl}/v1/classroom/courses`, { headers }),
        fetch(`${apiUrl}/v1/assignments`, { headers }),
        fetch(`${apiUrl}/v1/batches`, { headers }),
      ]);

      const [coursesJson, assignJson, batchesJson] = await Promise.all([
        coursesRes.json(),
        assignRes.json(),
        batchesRes.json(),
      ]);

      if (!coursesRes.ok || !coursesJson.success) {
        throw new Error(coursesJson.message || 'Gagal memuat daftar kelas.');
      }
      if (!assignRes.ok || !assignJson.success) {
        throw new Error(assignJson.message || 'Gagal memuat daftar penugasan.');
      }

      setDosenCourses(coursesJson.data || []);
      setDosenAssignments(assignJson.data || []);
      if (batchesRes.ok && batchesJson.success && Array.isArray(batchesJson.data)) {
        setBatches(batchesJson.data);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Terjadi kendala saat menghubungi server akademik.';
      setDosenError(message);
    } finally {
      setIsDosenLoading(false);
      topProgress.done();
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!isAuthResolved) return;
    fetchDosenOverview();
  }, [isAuthResolved, fetchDosenOverview]);

  const activeAssignments = dosenAssignments.filter((item) => !item.isExpired);
  const totalSessionsCount = dosenCourses.reduce(
    (acc, course) => acc + (course.totalSessions || 0),
    0
  );
  const activeBatchesCount = batches.filter((b) => b.status === 'active').length;
  const totalEnrolledStudents = batches.reduce((acc, b) => acc + (b.studentCount || 0), 0);

  if (!isAuthResolved || isDosenLoading) {
    return null;
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header Beranda Mentor */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Beranda Mentor
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Kelola sesi presensi, publikasi materi pembelajaran, penugasan siswa, dan rekap nilai akhir.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <Link
            href="/dashboard/mentor/presensi"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <CalendarCheck className="size-4 text-fd-muted-foreground" />
            <span>Presensi Sesi</span>
          </Link>
          <Link
            href="/dashboard/dosen/tugas"
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            <ClipboardList className="size-4" />
            <span>Kelola Tugas</span>
          </Link>
        </div>
      </header>

      {/* Ringkasan Statistik Utama (Kartu Interaktif Terpadu) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/dosen/kelas"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Kelas &amp; Kurikulum</span>
              <div className="size-8 rounded-lg bg-fd-primary/10 text-fd-primary flex items-center justify-center">
                <BookOpen className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground mt-2">
              {isDosenLoading ? '...' : dosenCourses.length}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">{totalSessionsCount} sesi pertemuan</span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Kelola</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/dosen/verifikasi-batch"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Batch Aktif</span>
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Layers className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground mt-2">
              {isDosenLoading ? '...' : activeBatchesCount}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">{batches.length} total batch</span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Lihat Batch</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/dosen/nilai"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Siswa Terdaftar</span>
              <div className="size-8 rounded-lg bg-fd-primary/10 text-fd-primary flex items-center justify-center">
                <Users className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground mt-2">
              {isDosenLoading ? '...' : totalEnrolledStudents}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">Peserta batch aktif</span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Rekap Nilai</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/dosen/tugas"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Tugas &amp; Praktikum</span>
              <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <ClipboardList className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground mt-2">
              {isDosenLoading ? '...' : activeAssignments.length}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">{dosenAssignments.length} total penugasan</span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Koreksi</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>
      </div>

      {dosenError && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{dosenError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDosenOverview}>
            <RefreshCw className="size-3.5" />
            <span>Coba Lagi</span>
          </Button>
        </div>
      )}

      {/* Grid: Kelas & Tugas Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Kolom 1 & 2: Daftar Kelas Diampu */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="p-5 pb-4 border-b border-fd-border flex flex-row items-center justify-between gap-4">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="size-4 text-fd-primary" />
                  <span>Kelas &amp; Kurikulum Pembelajaran</span>
                </CardTitle>
                <CardDescription>
                  Kelola sesi pertemuan, modul materi MDX, dan penugasan siswa.
                </CardDescription>
              </div>
              <Link
                href="/dashboard/dosen/kelas"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
              >
                <span>Kelola Semua</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isDosenLoading ? (
                <div className="p-8 text-center text-xs text-fd-muted-foreground">Memuat daftar kelas...</div>
              ) : dosenCourses.length === 0 ? (
                <div className="p-8 text-center text-xs text-fd-muted-foreground">
                  Belum ada kelas yang terdaftar. Buat kelas baru di menu Kelola Kelas &amp; Materi.
                </div>
              ) : (
                <div className="divide-y divide-fd-border">
                  {dosenCourses.map((course) => (
                    <div
                      key={course.id}
                      className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-fd-muted/20 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-fd-foreground">
                            {course.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {course.totalSessions} Pertemuan
                          </Badge>
                        </div>
                        <p className="text-xs text-fd-muted-foreground line-clamp-1 max-w-lg">
                          {course.description || 'Kurikulum modular terstruktur dengan penugasan dan evaluasi.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/dashboard/dosen/kelas/${course.slug}`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          <span>Kelola Sesi</span>
                          <ChevronRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom 3: Tugas Aktif & Verifikasi Batch */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="p-5 pb-4 border-b border-fd-border flex flex-row items-center justify-between gap-4">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ClipboardList className="size-4 text-fd-primary" />
                  <span>Penugasan Siswa</span>
                </CardTitle>
                <CardDescription>
                  Daftar tugas terbaru yang dibuat.
                </CardDescription>
              </div>
              <Link
                href="/dashboard/dosen/tugas"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
              >
                <span>Semua</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {isDosenLoading ? (
                <div className="p-6 text-center text-xs text-fd-muted-foreground">Memuat tugas...</div>
              ) : dosenAssignments.length === 0 ? (
                <div className="p-6 text-center text-xs text-fd-muted-foreground">
                  Belum ada penugasan yang dibuat.
                </div>
              ) : (
                <div className="divide-y divide-fd-border">
                  {dosenAssignments.slice(0, 5).map((task) => (
                    <div key={task.id} className="p-4 sm:px-5 space-y-1 hover:bg-fd-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-fd-foreground truncate max-w-[180px]">
                          {task.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] shrink-0',
                            task.isExpired
                              ? 'text-destructive border-destructive/30'
                              : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          )}
                        >
                          {task.isExpired ? 'Ditutup' : 'Aktif'}
                        </Badge>
                      </div>
                      <p className="text-xs text-fd-muted-foreground flex items-center gap-1">
                        <Clock className="size-3 text-fd-muted-foreground" />
                        <span>Tenggat: {formatDeadline(task.expiredAt)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-4 border-b border-fd-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardCheck className="size-4 text-fd-primary" />
                <span>Verifikasi Pendaftaran Batch</span>
              </CardTitle>
              <CardDescription>
                Periksa bukti pembayaran pendaftaran batch dari siswa baru.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <Link
                href="/dashboard/dosen/verifikasi-batch"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-between')}
              >
                <span>Buka Antrean Verifikasi</span>
                <ChevronRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
