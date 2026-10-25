'use client';

import React from 'react';
import { Layers, BookOpen, CheckSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export default function KrsPage() {
  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-2 border-b border-fd-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
          Sistem Pendaftaran & Plotting Batch
        </h1>
        <p className="text-sm text-fd-muted-foreground">
          Informasi mekanisme pendaftaran dan penetapan batch siswa Belajar Koding.
        </p>
      </header>

      <div className="rounded-xl border border-fd-border bg-fd-card p-8 sm:p-10 text-center shadow-2xs">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-fd-primary/10 text-fd-primary border border-fd-primary/20">
          <Layers className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fd-foreground">
          Pendaftaran Terpusat Berbasis Batch
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-fd-muted-foreground leading-relaxed">
          Siswa dapat memilih batch kelas yang sedang dibuka pada menu Pendaftaran Batch atau di-plot langsung oleh Admin ke dalam batch aktif bersama Mentor pendamping.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard/batch"
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'min-h-[40px] px-4 gap-2')}
          >
            <span>Buka Pendaftaran Batch</span>
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/dashboard/assignments"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-[40px] px-4 gap-2')}
          >
            <CheckSquare className="size-4" />
            <span>Lihat Tugas & Proyek</span>
          </Link>
          <Link
            href="/dashboard/kelas"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-[40px] px-4 gap-2')}
          >
            <BookOpen className="size-4" />
            <span>Daftar Kelas</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
