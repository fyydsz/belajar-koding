'use client';

import React from 'react';
import { CalendarCheck, Clock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function PresensiPage() {
  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Presensi Perkuliahan
          </h1>
          <p className="text-xs text-fd-muted-foreground sm:text-sm">
            Pencatatan daftar hadir pertemuan kelas tatap muka dan sesi mentoring.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-fd-border bg-fd-secondary/50 px-3 py-1 text-xs font-semibold text-fd-foreground">
          <Clock className="size-3.5 text-fd-muted-foreground" />
          <span>Semester Aktif</span>
        </span>
      </div>

      {/* Konten Kosong / Placeholder SIAKAD */}
      <div className="rounded-2xl border border-fd-border bg-fd-card p-10 text-center shadow-2xs">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-fd-muted text-fd-muted-foreground">
          <CalendarCheck className="size-7 text-fd-foreground/80" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fd-foreground">
          Belum Ada Sesi Presensi Aktif
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-fd-muted-foreground leading-relaxed">
          Presensi kehadiran akan dibuka secara otomatis oleh dosen atau mentor pada jadwal perkuliahan yang sedang berlangsung.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-fd-border bg-fd-background px-3.5 py-2 text-xs font-medium text-fd-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span>Validasi Kehadiran Digital</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-fd-primary px-4 py-2 text-xs font-semibold text-fd-primary-foreground shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
