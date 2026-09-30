import Link from 'next/link';
import { blogSource } from '@/lib/source';
import { Calendar, User, ArrowRight, BookOpen } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | Belajar Koding',
  description: 'Kumpulan artikel, catatan teknis, dan refleksi belajar pemrograman dari Belajar Koding.',
};

export default function BlogIndexPage() {
  const pages = blogSource.getPages();

  // Urutkan postingan berdasarkan tanggal terbaru jika tersedia
  const posts = [...pages].sort((a, b) => {
    const dateA = a.data.date ? new Date(a.data.date).getTime() : 0;
    const dateB = b.data.date ? new Date(b.data.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Header Halaman */}
      <header className="mb-10 sm:mb-14 border-b border-fd-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fd-foreground mb-3">
          Blog Belajar Koding
        </h1>
        <p className="text-base sm:text-lg text-fd-muted-foreground leading-relaxed max-w-2xl">
          Catatan teknis, eksplorasi kode, dan refleksi belajar pemrograman yang ditulis secara santai dan praktis.
        </p>
      </header>

      {/* Daftar Tulisan */}
      {posts.length === 0 ? (
        <div className="rounded-2xl border border-fd-border bg-fd-card/50 p-8 sm:p-12 text-center">
          <p className="text-fd-muted-foreground mb-4">
            Belum ada tulisan yang dipublikasikan saat ini.
          </p>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <BookOpen className="size-4" />
            <span>Kunjungi Dokumentasi Belajar</span>
          </Link>
        </div>
      ) : (
        <section aria-label="Daftar artikel blog" className="space-y-6 sm:space-y-8">
          {posts.map((post) => {
            const dateStr = post.data.date
              ? new Intl.DateTimeFormat('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(post.data.date))
              : null;

            return (
              <article
                key={post.url}
                className="group relative rounded-2xl border border-fd-border bg-fd-card/60 hover:bg-fd-card p-6 sm:p-8 transition-colors shadow-2xs hover:border-fd-primary/40 focus-within:ring-2 focus-within:ring-fd-ring"
              >
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-fd-muted-foreground mb-3">
                  {dateStr ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
                      <time dateTime={String(post.data.date)}>{dateStr}</time>
                    </span>
                  ) : null}

                  {post.data.author ? (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
                      <span>{post.data.author}</span>
                    </span>
                  ) : null}
                </div>

                <h2 className="text-xl sm:text-2xl font-semibold text-fd-foreground mb-2.5 group-hover:text-fd-primary transition-colors">
                  <Link
                    href={post.url}
                    className="focus-visible:outline-none after:absolute after:inset-0"
                  >
                    {post.data.title}
                  </Link>
                </h2>

                {post.data.description ? (
                  <p className="text-sm sm:text-base text-fd-muted-foreground leading-relaxed mb-4">
                    {post.data.description}
                  </p>
                ) : null}

                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary group-hover:underline">
                  <span>Baca selengkapnya</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
