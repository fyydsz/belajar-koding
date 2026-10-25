'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap,
  Award,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { useMounted } from '@/lib/use-mounted';
import {
  dashboardCache,
  loadKhsCache,
  topProgress,
} from '@/lib/dashboard-navigation';
import { cn } from '@/lib/cn';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import Link from 'next/link';

interface GradeEvaluation {
  finalScore: number;
  gradeLetter: 'A' | 'B' | 'C' | 'D' | 'E';
  gradePoint: number;
  predicate: string;
  isPassing: boolean;
}

interface StudentGradeRecord {
  gradeId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  tugas: number;
  quiz: number;
  uts: number;
  uas: number;
  updatedAt: string;
  evaluation: GradeEvaluation;
}

export default function KhsPage() {
  const mounted = useMounted();
  const cached = dashboardCache.khs;

  const [grades, setGrades] = useState<StudentGradeRecord[]>(
    (cached?.grades as StudentGradeRecord[]) || [],
  );
  const [isLoading, setIsLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGrades = useCallback(async (isSilent = false) => {
    if (isSilent) {
      setIsRefreshing(true);
    }
    topProgress.start();
    setErrorMessage(null);
    try {
      const data = await loadKhsCache();
      setGrades((data.grades as StudentGradeRecord[]) || []);
    } catch {
      setErrorMessage('Koneksi ke server terputus.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      topProgress.done();
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!dashboardCache.khs) {
      loadGrades();
    }
  }, [mounted, loadGrades]);

  if (!mounted || isLoading) {
    return null;
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Halaman */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-fd-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
            Laporan Hasil Belajar (KHS)
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Rekapitulasi perolehan nilai akademik terstruktur berdasarkan evaluasi penugasan dan proyek.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="px-3 py-1 font-medium text-xs flex items-center gap-1.5">
            <Award className="size-3.5 text-fd-primary" />
            <span>Bobot: Tugas 20% &middot; Quiz 20% &middot; UTS 30% &middot; UAS 30%</span>
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadGrades(true)}
            disabled={isLoading || isRefreshing}
            className="min-h-[36px] gap-2"
          >
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
            <span>Segarkan</span>
          </Button>
        </div>
      </header>

      {/* Konten Utama */}
      {errorMessage ? (
        <Card className="border-red-500/30 bg-red-500/5 p-6 text-center">
          <AlertCircle className="size-8 mx-auto text-red-500 mb-2" />
          <h3 className="text-sm font-semibold text-fd-foreground">{errorMessage}</h3>
          <p className="text-xs text-fd-muted-foreground mt-1">
            Pastikan Anda telah masuk dengan akun siswa yang terdaftar.
          </p>
        </Card>
      ) : grades.length === 0 ? (
        <Empty className="py-12 border border-fd-border bg-fd-card shadow-2xs">
          <EmptyMedia variant="icon">
            <GraduationCap className="size-4 text-fd-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-semibold">
              Belum Ada Catatan Nilai Resmi
            </EmptyTitle>
            <EmptyDescription className="text-xs">
              Nilai akhir semester akan ditampilkan di sini setelah mentor menyelesaikan penilaian pada penugasan dan proyek kelas Anda.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/dashboard/assignments"
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              Lihat Status Penugasan Saya
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6">
          {grades.map((item) => {
            const isPassing = item.evaluation.isPassing;
            return (
              <Card key={item.gradeId || item.courseId} className="border-fd-border bg-fd-card shadow-2xs">
                <CardHeader className="border-b border-fd-border pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold text-fd-foreground">
                        {item.courseTitle}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Diperbarui: {new Date(item.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-medium text-fd-muted-foreground block">
                          Nilai Akhir
                        </span>
                        <span className="text-2xl font-black font-mono text-fd-foreground">
                          {item.evaluation.finalScore}
                        </span>
                      </div>
                      <div
                        className={`size-12 rounded-xl flex items-center justify-center font-black text-xl font-mono ${
                          isPassing
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}
                      >
                        {item.evaluation.gradeLetter}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-5">
                  {/* Grid Komponen Penilaian */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border border-fd-border bg-fd-muted/30">
                      <p className="text-[11px] font-semibold text-fd-muted-foreground">Tugas (20%)</p>
                      <p className="text-lg font-bold font-mono text-fd-foreground mt-0.5">{item.tugas}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-fd-border bg-fd-muted/30">
                      <p className="text-[11px] font-semibold text-fd-muted-foreground">Quiz (20%)</p>
                      <p className="text-lg font-bold font-mono text-fd-foreground mt-0.5">{item.quiz}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-fd-border bg-fd-muted/30">
                      <p className="text-[11px] font-semibold text-fd-muted-foreground">UTS Proyek (30%)</p>
                      <p className="text-lg font-bold font-mono text-fd-foreground mt-0.5">{item.uts}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-fd-border bg-fd-muted/30">
                      <p className="text-[11px] font-semibold text-fd-muted-foreground">UAS Capstone (30%)</p>
                      <p className="text-lg font-bold font-mono text-fd-foreground mt-0.5">{item.uas}</p>
                    </div>
                  </div>

                  {/* Ringkasan Kelulusan & Predikat */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border border-fd-border bg-fd-background gap-3">
                    <div className="flex items-center gap-2.5">
                      {isPassing ? (
                        <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="size-5 text-red-600 shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-fd-foreground">
                          Status Kelulusan:{' '}
                          <span className={isPassing ? 'text-emerald-600 font-extrabold' : 'text-red-600 font-extrabold'}>
                            {isPassing ? 'LULUS' : 'BELUM LULUS'}
                          </span>
                        </p>
                        <p className="text-[11px] text-fd-muted-foreground">
                          Predikat: {item.evaluation.predicate} (Bobot IP: {item.evaluation.gradePoint.toFixed(1)})
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/kelas/${item.courseSlug}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Buka Materi Kelas
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
