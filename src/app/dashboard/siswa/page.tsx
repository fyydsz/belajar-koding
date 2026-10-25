'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getAuthToken, handleUnauthorizedRedirect, type AuthUser } from '@/lib/auth';
import { useMounted } from '@/lib/use-mounted';
import {
  dashboardCache,
  loadSiswaOverviewCache,
  topProgress,
} from '@/lib/dashboard-navigation';
import {
  BookOpen,
  CheckSquare,
  Award,
  RefreshCw,
  AlertCircle,
  CalendarCheck,
  Layers,
  Clock,
  ArrowRight,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { cn } from '@/lib/cn';

interface GradeItem {
  gradeId: string;
  courseId: string;
  courseTitle: string | null;
  courseSlug: string | null;
  tugas: number;
  quiz: number;
  uts: number;
  uas: number;
  evaluation: {
    finalScore: number;
    gradeLetter: 'A' | 'B' | 'C' | 'D' | 'E';
    gradePoint: number;
    predicate: string;
    isPassing: boolean;
  };
  updatedAt: string;
}

interface StudentBatchItem {
  batchId: string;
  batchName: string;
  batchStatus: string;
  courseTitle: string;
  courseSlug: string;
  mentorName: string | null;
  enrolledAt: string;
  status: string;
}

interface AttendanceSummary {
  enrolled: boolean;
  totalSessionsOpened: number;
  attendedCount: number;
  attendanceRate: number;
  recentLogs: Array<{
    id: string;
    sessionNumber: number;
    checkedInAt: string;
    channel: string;
  }>;
}

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

export default function SiswaDashboardPage() {
  const mounted = useMounted();
  const cached = dashboardCache.siswaOverview;

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => cached?.user ?? null);
  const [grades, setGrades] = useState<GradeItem[]>(() => cached?.grades ?? []);
  const [studentBatches, setStudentBatches] = useState<StudentBatchItem[]>(
    () => cached?.studentBatches ?? []
  );
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(
    () => cached?.attendanceSummary ?? null
  );
  const [studentAssignments, setStudentAssignments] = useState<AssignmentItem[]>(
    () => cached?.studentAssignments ?? []
  );
  const [isLoadingStudent, setIsLoadingStudent] = useState(() => !cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const fetchStudentOverview = useCallback(async (isSilent = false) => {
    if (isSilent) {
      setIsRefreshing(true);
    } else if (!dashboardCache.siswaOverview) {
      setIsLoadingStudent(true);
    }
    setStudentError(null);
    topProgress.start();
    try {
      const token = getAuthToken();
      if (!token) {
        handleUnauthorizedRedirect();
        return;
      }

      const data = await loadSiswaOverviewCache();
      if (!data.user) {
        handleUnauthorizedRedirect();
        return;
      }
      setCurrentUser(data.user);
      setGrades(data.grades);
      setStudentBatches(data.studentBatches);
      setAttendanceSummary(data.attendanceSummary);
      setStudentAssignments(data.studentAssignments);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Terjadi kendala saat memuat data akademik.';
      setStudentError(message);
    } finally {
      setIsLoadingStudent(false);
      setIsRefreshing(false);
      topProgress.done();
    }
  }, []);

  useEffect(() => {
    if (mounted && !dashboardCache.siswaOverview) {
      fetchStudentOverview();
    }
  }, [mounted, fetchStudentOverview]);

  if (!mounted || isLoadingStudent) {
    return null;
  }

  const averageFinalScore =
    grades.length > 0
      ? Math.round(
          (grades.reduce((sum, g) => sum + g.evaluation.finalScore, 0) / grades.length) * 100
        ) / 100
      : 0;

  const enrolledActiveBatch = studentBatches.find((b) => b.status === 'active') || null;
  const pendingBatch = studentBatches.find((b) => b.status === 'pending') || null;
  const rejectedBatch = studentBatches.find((b) => b.status === 'rejected') || null;
  const activeBatch = enrolledActiveBatch;
  const activeAssignments = studentAssignments.filter((a) => !a.isExpired);

  const hasOpenedSessions = (attendanceSummary?.totalSessionsOpened ?? 0) > 0;
  const displayAttendanceRate = hasOpenedSessions ? `${attendanceSummary?.attendanceRate ?? 0}%` : '0%';

  return (
    <div className="space-y-6 pb-10">
      {/* Header Beranda Siswa */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Selamat Datang, {currentUser?.fullName || 'Siswa'}
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Pantau status angkatan batch, presensi kehadiran, penugasan proyek, dan laporan hasil belajar Anda.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchStudentOverview(true)}
            disabled={isRefreshing}
            className="min-h-[38px] gap-2"
          >
            <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            <span>Segarkan</span>
          </Button>
        </div>
      </header>

      {/* Banner Status Batch (Satu Sumber Kebenaran) */}
      {activeBatch ? (
        <Card className="border-fd-primary/30 bg-fd-primary/5">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-lg bg-fd-primary/15 text-fd-primary flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                    Angkatan Aktif
                  </Badge>
                  <span className="text-xs text-fd-muted-foreground">Terdaftar Resmi</span>
                </div>
                <h2 className="text-base font-bold text-fd-foreground">
                  {activeBatch.courseTitle}
                </h2>
                <p className="text-xs text-fd-muted-foreground">
                  Angkatan: <span className="font-semibold text-fd-foreground">{activeBatch.batchName}</span> &middot; Mentor:{' '}
                  <span className="font-semibold text-fd-foreground">
                    {activeBatch.mentorName || 'Mentor Akademik'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/dashboard/kelas/${activeBatch.courseSlug}`}
                className={buttonVariants({ variant: 'default', size: 'sm' })}
              >
                <span>Buka Ruang Kelas</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={cn(
            pendingBatch
              ? 'border-amber-500/30 bg-amber-500/5'
              : rejectedBatch
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-fd-border bg-fd-card'
          )}
        >
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={cn(
                  'size-10 rounded-lg flex items-center justify-center shrink-0 border',
                  pendingBatch
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : rejectedBatch
                    ? 'bg-destructive/15 text-destructive border-destructive/30'
                    : 'bg-fd-muted text-fd-muted-foreground border-fd-border'
                )}
              >
                {pendingBatch ? (
                  <Clock className="size-5" />
                ) : rejectedBatch ? (
                  <AlertCircle className="size-5" />
                ) : (
                  <Layers className="size-5" />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-fd-foreground">
                  {pendingBatch
                    ? `Pendaftaran Batch ${pendingBatch.batchName} Sedang Diverifikasi`
                    : rejectedBatch
                    ? `Pendaftaran Batch ${rejectedBatch.batchName} Ditolak`
                    : 'Anda Belum Terdaftar di Batch Aktif'}
                </h2>
                <p className="text-xs text-fd-muted-foreground leading-relaxed">
                  {pendingBatch
                    ? 'Bukti pembayaran Anda sedang diperiksa oleh Mentor atau Admin. Materi kelas akan terbuka otomatis setelah disetujui.'
                    : rejectedBatch
                    ? 'Pembayaran pendaftaran batch Anda belum dapat disetujui. Silakan periksa catatan verifikasi dan unggah ulang bukti transfer.'
                    : 'Daftar ke batch kelas yang tersedia untuk mengakses sesi pertemuan, tugas praktikum, dan evaluasi nilai.'}
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/batch"
              className={cn(
                buttonVariants({
                  variant: 'default',
                  size: 'sm',
                }),
                'shrink-0',
                rejectedBatch && 'bg-red-600 text-white hover:bg-red-700'
              )}
            >
              <span>
                {pendingBatch
                  ? 'Lihat Status Pendaftaran'
                  : rejectedBatch
                  ? 'Unggah Ulang Bukti'
                  : 'Buka Katalog Batch'}
              </span>
              <ChevronRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Ringkasan Metrik Siswa (Kartu Interaktif Terpadu) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/khs"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Rata-rata Nilai</span>
              <div className="size-8 rounded-lg bg-fd-primary/10 text-fd-primary flex items-center justify-center">
                <Award className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground mt-2">
              {averageFinalScore > 0 ? averageFinalScore : '0.00'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">Bobot 20-20-30-30</span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Lihat KHS</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/siswa/presensi"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Tingkat Kehadiran</span>
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CalendarCheck className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground mt-2">
              {displayAttendanceRate}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">
              {hasOpenedSessions
                ? `${attendanceSummary?.attendedCount ?? 0}/${attendanceSummary?.totalSessionsOpened ?? 0} sesi hadir`
                : 'Belum ada sesi'}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Presensi</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/assignments"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Tugas Aktif</span>
              <div className="size-8 rounded-lg bg-fd-primary/10 text-fd-primary flex items-center justify-center">
                <CheckSquare className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground mt-2">
              {activeAssignments.length}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">{studentAssignments.length} total tugas</span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Buka Tugas</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/profil"
          className="group flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/20"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fd-muted-foreground">Status Akademik</span>
              <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <GraduationCap className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-fd-foreground mt-2">
              {activeBatch ? 'Aktif' : pendingBatch ? 'Verifikasi' : 'Terdaftar'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-xs">
            <span className="text-fd-muted-foreground">Portal Siswa</span>
            <span className="inline-flex items-center gap-1 font-medium text-fd-foreground group-hover:text-fd-primary transition-colors">
              <span>Profil</span>
              <ChevronRight className="size-3.5 text-fd-muted-foreground group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
        </Link>
      </div>

      {studentError && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{studentError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchStudentOverview()}>
            <RefreshCw className="size-3.5" />
            <span>Coba Lagi</span>
          </Button>
        </div>
      )}

      {/* Grid Utama: KHS + Penugasan + Presensi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Kolom 1 & 2: Laporan Hasil Belajar & Tugas Aktif */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="p-5 pb-4 border-b border-fd-border flex flex-row items-center justify-between gap-4">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Award className="size-4 text-fd-primary" />
                  <span>Laporan Hasil Belajar (KHS) Siswa</span>
                </CardTitle>
                <CardDescription>
                  Rekapitulasi penilaian resmi (Tugas 20%, Quiz 20%, UTS 30%, UAS 30%).
                </CardDescription>
              </div>
              <Link
                href="/dashboard/khs"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
              >
                <span>Lihat Detail</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {grades.length === 0 ? (
                <Empty className="py-8">
                  <EmptyMedia variant="icon">
                    <Award className="size-4 text-fd-muted-foreground" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle className="text-sm font-semibold">Belum Ada Catatan Nilai</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Komponen nilai akan tampil otomatis setelah dievaluasi oleh mentor kelas Anda.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="divide-y divide-fd-border">
                  {grades.map((grade) => (
                    <div key={grade.gradeId} className="p-4 sm:px-5 flex items-center justify-between hover:bg-fd-muted/20 transition-colors">
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-fd-foreground">
                          {grade.courseTitle || 'Kelas Belajar Koding'}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-fd-muted-foreground">
                          <span>Tugas: {grade.tugas}</span>
                          <span>&middot;</span>
                          <span>Quiz: {grade.quiz}</span>
                          <span>&middot;</span>
                          <span>UTS: {grade.uts}</span>
                          <span>&middot;</span>
                          <span>UAS: {grade.uas}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-fd-muted-foreground">Nilai Akhir:</span>
                          <span className="font-mono font-bold text-sm text-fd-foreground">
                            {grade.evaluation.finalScore}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs font-semibold px-2 py-0.5',
                              grade.evaluation.isPassing
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : 'bg-destructive/10 text-destructive border-destructive/30'
                            )}
                          >
                            {grade.evaluation.gradeLetter} ({grade.evaluation.predicate})
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Akses Tugas & Proyek Mendatang */}
          <Card>
            <CardHeader className="p-5 pb-4 border-b border-fd-border flex flex-row items-center justify-between gap-4">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckSquare className="size-4 text-fd-primary" />
                  <span>Penugasan &amp; Praktikum Aktif</span>
                </CardTitle>
                <CardDescription>
                  Tugas kelas yang perlu dikerjakan dan dikumpulkan sebelum tenggat waktu.
                </CardDescription>
              </div>
              <Link
                href="/dashboard/assignments"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
              >
                <span>Semua Tugas</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {activeAssignments.length === 0 ? (
                <Empty className="py-8">
                  <EmptyMedia variant="icon">
                    <CheckSquare className="size-4 text-fd-muted-foreground" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle className="text-sm font-semibold">Tidak Ada Tugas Aktif</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Semua tugas telah dikumpulkan atau belum ada penugasan baru dari mentor.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="divide-y divide-fd-border">
                  {activeAssignments.slice(0, 4).map((task) => (
                    <div key={task.id} className="p-4 sm:px-5 flex items-center justify-between hover:bg-fd-muted/20 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {task.type || 'Tugas'}
                          </Badge>
                          <p className="font-semibold text-sm text-fd-foreground">{task.title}</p>
                        </div>
                        <p className="text-xs text-fd-muted-foreground flex items-center gap-1.5">
                          <Clock className="size-3 text-fd-muted-foreground" />
                          <span>Tenggat: {formatDeadline(task.expiredAt)}</span>
                        </p>
                      </div>
                      <Link
                        href="/dashboard/assignments"
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        <span>Kumpulkan</span>
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom 3: Presensi & Kurikulum Kelas */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="p-5 pb-4 border-b border-fd-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarCheck className="size-4 text-emerald-500" />
                <span>Presensi &amp; Kehadiran</span>
              </CardTitle>
              <CardDescription>
                Validasi kehadiran sesi via token web atau bot Discord.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-fd-muted/40 border border-fd-border/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-fd-muted-foreground">Tingkat Kehadiran</span>
                  <span className="font-bold font-mono text-fd-foreground">
                    {displayAttendanceRate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-fd-muted-foreground">Sesi Dibuka Mentor</span>
                  <span className="font-medium font-mono text-fd-foreground">
                    {attendanceSummary?.totalSessionsOpened ?? 0} Pertemuan
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-fd-muted-foreground">Sesi Dihadiri</span>
                  <span className="font-medium font-mono text-fd-foreground">
                    {attendanceSummary?.attendedCount ?? 0} Pertemuan
                  </span>
                </div>
              </div>

              <Link
                href="/dashboard/siswa/presensi"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-between')}
              >
                <span>Buka Halaman Presensi</span>
                <ChevronRight className="size-4" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-4 border-b border-fd-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="size-4 text-fd-primary" />
                <span>Modul &amp; Sesi Kelas</span>
              </CardTitle>
              <CardDescription>
                Akses materi bacaan, rekaman video, dan latihan per pertemuan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {activeBatch ? (
                <>
                  <div className="rounded-xl border border-fd-border/60 bg-fd-muted/30 p-3.5 space-y-1">
                    <p className="text-xs font-semibold text-fd-foreground">
                      {activeBatch.courseTitle}
                    </p>
                    <p className="text-xs text-fd-muted-foreground">
                      Batch: {activeBatch.batchName}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/kelas/${activeBatch.courseSlug}`}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-between')}
                  >
                    <span>Lihat Semua Pertemuan</span>
                    <ChevronRight className="size-4" />
                  </Link>
                </>
              ) : (
                <p className="text-xs text-fd-muted-foreground leading-relaxed">
                  Daftar modul dan sesi pertemuan akan tampil di sini secara otomatis setelah Anda terdaftar aktif pada batch kelas.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
