import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { BookOpen } from 'lucide-react';

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-col items-center justify-center flex-1 px-4 py-24 sm:py-32 text-center">
        <span className="text-7xl sm:text-8xl font-bold text-fd-primary/80 mb-4 tracking-tighter">
          404
        </span>
        <h1 className="text-2xl sm:text-3xl font-semibold text-fd-foreground mb-3">
          Halaman Tidak Ditemukan
        </h1>
        <p className="text-base text-fd-muted-foreground max-w-md mb-8">
          Halaman yang kamu tuju tidak tersedia atau telah dipindahkan. Web ini saat ini difokuskan untuk dokumentasi materi pembelajaran.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <BookOpen className="size-4" />
            <span>Buka Dokumentasi</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-fd-border bg-fd-secondary/70 hover:bg-fd-accent text-fd-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    </HomeLayout>
  );
}
