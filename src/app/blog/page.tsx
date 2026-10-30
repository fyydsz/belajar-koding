import Link from 'next/link';
import { blogSource } from '@/lib/source';
import { Calendar, User, BookOpen } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | Belajar Koding',
  description: 'Kumpulan artikel analisis usability dan catatan teknis pemrograman.',
};

function getReadTime(slug: string): string {
  if (slug.includes('usability') || slug.includes('spotify')) {
    return '8';
  }
  if (slug.includes('xampp') || slug.includes('mysql')) {
    return '4';
  }
  return '2';
}

export default function BlogIndexPage() {
  const pages = blogSource.getPages();

  const posts = [...pages].sort((a, b) => {
    const dateA = a.data.date ? new Date(a.data.date).getTime() : 0;
    const dateB = b.data.date ? new Date(b.data.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Header Halaman */}
      <header className="mb-10 sm:mb-12 border-b border-fd-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fd-foreground mb-3">
          Blog Belajar Koding
        </h1>
        <p className="text-base text-fd-muted-foreground leading-relaxed max-w-2xl">
          Catatan teknis, analisis antarmuka, dan eksplorasi kode pemrograman.
        </p>
      </header>

      {/* Bagian Blog Terbaru */}
      <section aria-label="Blog Terbaru">
        <h2 className="text-lg font-semibold text-fd-foreground mb-6">
          Blog Terbaru
        </h2>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-fd-border bg-fd-card/50 p-8 sm:p-12 text-center">
            <p className="text-fd-muted-foreground mb-4">
              Belum ada tulisan yang dipublikasikan saat ini.
            </p>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 transition shadow-2xs"
            >
              <BookOpen className="size-4" />
              <span>Kunjungi Dokumentasi Belajar</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => {
              const formattedDate = post.data.date
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(post.data.date))
                : null;

              const readTime = getReadTime(post.slugs.join('/'));

              return (
                <article
                  key={post.url}
                  className="group relative rounded-2xl border border-fd-border bg-fd-card p-6 sm:p-7 transition-all duration-200 hover:border-fd-primary/50 hover:bg-fd-accent/20 shadow-2xs hover:shadow-xs focus-within:ring-2 focus-within:ring-fd-ring"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-fd-muted-foreground mb-3">
                    {formattedDate && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
                        <time dateTime={String(post.data.date)}>{formattedDate}</time>
                      </span>
                    )}
                    <span>&bull;</span>
                    <span>{readTime} min read</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-semibold text-fd-foreground mb-2.5 group-hover:text-fd-primary transition-colors leading-snug">
                    <Link
                      href={post.url}
                      className="focus-visible:outline-none after:absolute after:inset-0"
                    >
                      {post.data.title}
                    </Link>
                  </h3>

                  {post.data.description && (
                    <p className="text-sm sm:text-base text-fd-muted-foreground leading-relaxed mb-4">
                      {post.data.description}
                    </p>
                  )}

                  {post.data.author && (
                    <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-fd-muted-foreground">
                      <User className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
                      <span>{post.data.author}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
