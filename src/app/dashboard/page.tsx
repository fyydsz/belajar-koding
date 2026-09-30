'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, CheckSquare, Award, RefreshCw, AlertCircle } from 'lucide-react';

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

export default function DashboardHomePage() {
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Sesi login telah berakhir. Silakan masuk kembali.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/v1/grades/my`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memuat data nilai.');
      }

      setGrades(json.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kendala saat memuat data nilai.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // Hitung rata-rata nilai akhir
  const averageFinalScore =
    grades.length > 0
      ? Math.round(
          (grades.reduce((sum, g) => sum + g.evaluation.finalScore, 0) / grades.length) * 100
        ) / 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header Beranda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Beranda Akademik
          </h1>
          <p className="text-xs text-fd-muted-foreground sm:text-sm">
            Ringkasan status akademik, rekapitulasi penilaian tugas, quiz, UTS, dan UAS.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/assignments"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-fd-border bg-fd-card px-4 py-2 text-xs font-semibold text-fd-foreground shadow-2xs transition hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <CheckSquare className="size-4" />
            <span>Tugas Aktif</span>
          </Link>
          <Link
            href="/docs"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-fd-primary px-4 py-2 text-xs font-semibold text-fd-primary-foreground shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <BookOpen className="size-4" />
            <span>Materi Kelas</span>
          </Link>
        </div>
      </div>

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-fd-border bg-fd-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-fd-muted-foreground">Rata-rata Nilai Akhir</p>
            <Award className="size-4 text-fd-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-fd-foreground">
            {isLoading ? '...' : averageFinalScore > 0 ? averageFinalScore : '0.00'}
          </p>
          <p className="mt-1 text-xs text-fd-muted-foreground">Skala penilaian 0 sampai 100</p>
        </div>
        <div className="rounded-2xl border border-fd-border bg-fd-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-fd-muted-foreground">Mata Kuliah Dinilai</p>
            <BookOpen className="size-4 text-fd-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-fd-foreground">
            {isLoading ? '...' : grades.length}
          </p>
          <p className="mt-1 text-xs text-fd-muted-foreground">Modul yang telah memiliki evaluasi</p>
        </div>
        <div className="rounded-2xl border border-fd-border bg-fd-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-fd-muted-foreground">Bobot Penilaian</p>
            <span className="rounded bg-fd-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-fd-primary">
              Standar SIAKAD
            </span>
          </div>
          <p className="mt-2 text-xs font-medium leading-relaxed text-fd-foreground">
            Tugas 20%, Quiz 20%, UTS 30%, UAS 30%
          </p>
          <p className="mt-1 text-xs text-fd-muted-foreground">Perhitungan otomatis oleh sistem</p>
        </div>
      </div>

      {/* State: Loading */}
      {isLoading && (
        <div className="rounded-2xl border border-fd-border bg-fd-card p-8">
          <div className="space-y-4">
            <div className="h-6 w-1/3 animate-pulse rounded-lg bg-fd-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-fd-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-fd-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-fd-muted" />
          </div>
        </div>
      )}

      {/* State: Error */}
      {!isLoading && error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm"
        >
          <AlertCircle className="mx-auto size-6 text-red-600 dark:text-red-400" />
          <p className="mt-2 font-semibold text-red-600 dark:text-red-400">{error}</p>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Pastikan server backend Elysia telah berjalan pada port 3001.
          </p>
          <button
            type="button"
            onClick={fetchGrades}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 justify-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <RefreshCw className="size-3.5" />
            <span>Coba Muat Ulang</span>
          </button>
        </div>
      )}

      {/* State: Empty */}
      {!isLoading && !error && grades.length === 0 && (
        <div className="rounded-2xl border border-fd-border bg-fd-card p-10 text-center shadow-2xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-fd-muted text-fd-muted-foreground">
            <Award className="size-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-fd-foreground">Belum Ada Nilai</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-fd-muted-foreground">
            Pengajar atau mentor belum memasukkan nilai evaluasi untuk akun Anda. Silakan selesaikan tugas yang tersedia.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard/assignments"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-fd-primary px-4 py-2 text-xs font-semibold text-fd-primary-foreground shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              Cek Tugas Aktif
            </Link>
          </div>
        </div>
      )}

      {/* State: Data Tersedia (Tabel KHS) */}
      {!isLoading && !error && grades.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-fd-border bg-fd-card shadow-2xs">
          <div className="border-b border-fd-border px-5 py-4">
            <h2 className="text-sm font-semibold text-fd-foreground">Rincian Nilai per Mata Kuliah</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-fd-border bg-fd-muted/50 text-fd-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Mata Kuliah</th>
                  <th className="px-4 py-3 font-medium text-center">Tugas (20%)</th>
                  <th className="px-4 py-3 font-medium text-center">Quiz (20%)</th>
                  <th className="px-4 py-3 font-medium text-center">UTS (30%)</th>
                  <th className="px-4 py-3 font-medium text-center">UAS (30%)</th>
                  <th className="px-4 py-3 font-medium text-center">Nilai Akhir</th>
                  <th className="px-4 py-3 font-medium text-center">Huruf Mutu</th>
                  <th className="px-4 py-3 font-medium text-center">Predikat</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fd-border">
                {grades.map((item) => (
                  <tr key={item.gradeId} className="transition hover:bg-fd-muted/30">
                    <td className="px-4 py-3 font-semibold text-fd-foreground">
                      {item.courseTitle || 'Materi Umum'}
                    </td>
                    <td className="px-4 py-3 text-center">{item.tugas}</td>
                    <td className="px-4 py-3 text-center">{item.quiz}</td>
                    <td className="px-4 py-3 text-center">{item.uts}</td>
                    <td className="px-4 py-3 text-center">{item.uas}</td>
                    <td className="px-4 py-3 text-center font-bold text-fd-foreground">
                      {item.evaluation.finalScore}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-fd-primary/10 font-bold text-fd-primary">
                        {item.evaluation.gradeLetter}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-fd-muted-foreground">
                      {item.evaluation.predicate}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.evaluation.isPassing ? (
                        <span className="inline-block rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Lulus
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                          Mengulang
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
