'use client';

import React from 'react';
import { BookOpenCheck, Calendar, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function KrsPage() {
  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Kartu Rencana Studi (KRS)
          </h1>
          <p className="text-xs text-fd-muted-foreground sm:text-sm">
            Rencana pengambilan mata kuliah dan modul peminatan untuk semester berjalan.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-fd-border bg-fd-secondary/50 px-3 py-1 text-xs font-semibold text-fd-foreground">
          <Calendar className="size-3.5 text-fd-muted-foreground" />
          <span>Semester Ganjil 2026/2027</span>
        </span>
      </div>

      {/* Konten Kosong / Placeholder SIAKAD */}
      <div className="rounded-2xl border border-fd-border bg-fd-card p-10 text-center shadow-2xs">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-fd-muted text-fd-muted-foreground">
          <BookOpenCheck className="size-7 text-fd-foreground/80" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fd-foreground">
          Periode Pengisian KRS Belum Dibuka
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-fd-muted-foreground leading-relaxed">
          Pendaftaran mata kuliah dilakukan secara terpusat oleh administrator. Semua materi kurikulum inti dapat langsung kamu pelajari di dokumentasi.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-fd-border bg-fd-background px-4 py-2 text-xs font-semibold text-fd-foreground shadow-2xs transition hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <BookOpen className="size-4 text-fd-muted-foreground" />
            <span>Akses Materi Kuliah</span>
          </Link>
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
