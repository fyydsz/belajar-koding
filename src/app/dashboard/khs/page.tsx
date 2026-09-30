'use client';

import React from 'react';
import { GraduationCap, Award, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function KhsPage() {
  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Kartu Hasil Studi (KHS)
          </h1>
          <p className="text-xs text-fd-muted-foreground sm:text-sm">
            Laporan resmi perolehan Indeks Prestasi Semester (IPS) dan transkrip akademik.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-fd-border bg-fd-secondary/50 px-3 py-1 text-xs font-semibold text-fd-foreground">
          <Award className="size-3.5 text-fd-muted-foreground" />
          <span>Transkrip Resmi</span>
        </span>
      </div>

      {/* Konten Kosong / Placeholder SIAKAD */}
      <div className="rounded-2xl border border-fd-border bg-fd-card p-10 text-center shadow-2xs">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-fd-muted text-fd-muted-foreground">
          <GraduationCap className="size-7 text-fd-foreground/80" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fd-foreground">
          KHS Semester Ini Sedang Diproses
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-fd-muted-foreground leading-relaxed">
          Penerbitan Kartu Hasil Studi resmi akan disahkan setelah seluruh rangkaian ujian akhir semester (UAS) dan penilaian dosen selesai direkapitulasi.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-fd-primary px-4 py-2 text-xs font-semibold text-fd-primary-foreground shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <span>Lihat Evaluasi Nilai di Beranda</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
