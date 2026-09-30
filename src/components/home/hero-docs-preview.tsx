import Link from 'next/link';
import { BookText, ChevronRight, Code2, Cpu, FileText, Search } from 'lucide-react';

export function HeroDocsPreview() {
  return (
    <div className="relative w-full max-w-5xl mx-auto rounded-t-2xl border-t border-x border-fd-border bg-fd-card/95 shadow-2xl overflow-hidden backdrop-blur-md text-left select-none pointer-events-auto max-h-[240px] sm:max-h-[280px] md:max-h-[320px]">
      {/* Top window bar */}
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-2.5 bg-fd-secondary/30 text-xs text-fd-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full bg-fd-primary/80" />
          <span className="font-semibold text-fd-foreground font-mono text-[11px]">
            belajar-koding / docs
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-fd-border/60 bg-fd-background text-[11px]">
          <Search className="size-3" />
          <span>Cari materi...</span>
          <kbd className="ms-2 font-mono text-[10px] text-fd-muted-foreground">⌘K</kbd>
        </div>
      </div>

      {/* Main 3-column docs mockup layout */}
      <div className="grid grid-cols-12 min-h-[300px] text-xs">
        {/* Left Column: Mini Docs Sidebar */}
        <div className="hidden md:flex md:col-span-3 lg:col-span-3 border-r border-fd-border p-3 flex-col gap-3 bg-fd-secondary/15">
          <div className="px-2 py-1 font-semibold text-[11px] text-fd-muted-foreground uppercase tracking-wider">
            Modul Materi
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-fd-muted-foreground font-medium">
              <Code2 className="size-3.5 text-fd-primary" />
              <span>Python Dasar</span>
            </div>
            <div className="ms-4 space-y-0.5 border-l border-fd-border/70 ps-2">
              <div className="px-1.5 py-1 text-fd-muted-foreground">Instalasi & Setup</div>
              <div className="px-1.5 py-1 text-fd-muted-foreground">Sintaks & Variabel</div>
              <div className="px-1.5 py-1 rounded-md bg-fd-primary/10 text-fd-primary font-medium flex items-center justify-between">
                <span>Percabangan (If)</span>
                <span className="size-1.5 rounded-full bg-fd-primary" />
              </div>
              <div className="px-1.5 py-1 text-fd-muted-foreground">Perulangan (Loop)</div>
            </div>
          </div>
        </div>

        {/* Center Column: Active Document Content */}
        <div className="col-span-12 md:col-span-9 lg:col-span-6 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-[11px] text-fd-muted-foreground mb-3">
              <span>Dokumentasi</span>
              <ChevronRight className="size-3" />
              <span>Python</span>
              <ChevronRight className="size-3" />
              <span className="text-fd-foreground font-medium">Percabangan</span>
            </div>

            {/* Document H1 */}
            <h3 className="text-xl sm:text-2xl font-semibold text-fd-foreground mb-2">
              Percabangan Logika
            </h3>
            <p className="text-xs sm:text-sm text-fd-muted-foreground mb-4 leading-relaxed">
              Percabangan digunakan untuk mengeksekusi blok kode tertentu hanya ketika suatu kondisi bernilai benar (True).
            </p>

            {/* Code Block Mockup */}
            <div className="rounded-xl border border-fd-border bg-fd-secondary/30 p-3.5 font-mono text-[12px] leading-relaxed text-fd-foreground overflow-hidden">
              <div className="text-fd-muted-foreground mb-1"># Contoh sintaks if-elif-else</div>
              <div><span className="text-fd-primary font-semibold">if</span> nilai &gt;= 75:</div>
              <div className="ps-4 text-emerald-500 dark:text-emerald-400">print(&quot;Lulus&quot;)</div>
              <div><span className="text-fd-primary font-semibold">else</span>:</div>
              <div className="ps-4 text-amber-500 dark:text-amber-400">print(&quot;Remedial&quot;)</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-fd-border/60 flex items-center justify-between text-[11px]">
            <span className="text-fd-muted-foreground">Status: Bab 04 dari 05</span>
            <Link
              href="/docs/python/percabangan"
              className="text-fd-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <span>Buka bab ini</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Right Column: Mini Table of Contents (On this page) */}
        <div className="hidden lg:flex lg:col-span-3 border-l border-fd-border p-4 flex-col gap-2 bg-fd-secondary/10">
          <div className="text-[11px] font-semibold text-fd-foreground mb-1 flex items-center gap-1.5">
            <BookText className="size-3.5 text-fd-muted-foreground" />
            <span>Di halaman ini</span>
          </div>

          <div className="space-y-1.5 text-[11px] text-fd-muted-foreground">
            <div className="text-fd-primary font-medium border-l-2 border-fd-primary ps-2">
              Pengantar Percabangan
            </div>
            <div className="ps-2 hover:text-fd-foreground">Kondisi If Sederhana</div>
            <div className="ps-2 hover:text-fd-foreground">Penggunaan Elif &amp; Else</div>
            <div className="ps-2 hover:text-fd-foreground">Operator Perbandingan</div>
            <div className="ps-2 hover:text-fd-foreground">Latihan Soal Mandiri</div>
          </div>
        </div>
      </div>

      {/* Blurry fade out gradient di bagian bawah */}
      <div
        className="absolute inset-x-0 bottom-0 h-28 sm:h-36 bg-gradient-to-t from-fd-card via-fd-card/80 to-transparent pointer-events-none z-10 backdrop-blur-[1px]"
        aria-hidden="true"
      />
    </div>
  );
}
