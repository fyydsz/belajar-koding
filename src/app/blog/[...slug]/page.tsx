import { blogSource } from '@/lib/source';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import Link from 'next/link';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { BlogTOCProvider, BlogDesktopTOC, BlogMobileTOC } from '@/components/blog/blog-toc';
import { BlogPagination } from '@/components/blog/blog-pagination';

interface BlogPostProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  return blogSource.generateParams();
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const resolvedParams = await params;
  const page = blogSource.getPage(resolvedParams.slug);
  if (!page) notFound();

  return {
    title: `${page.data.title} | Blog Belajar Koding`,
    description: page.data.description,
  };
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const resolvedParams = await params;
  const page = blogSource.getPage(resolvedParams.slug);
  if (!page) notFound();

  const allPages = blogSource.getPages();
  // Urutkan postingan secara kronologis (dari tanggal terlama ke terbaru)
  const sortedPosts = [...allPages].sort((a, b) => {
    const dateA = a.data.date ? new Date(a.data.date).getTime() : 0;
    const dateB = b.data.date ? new Date(b.data.date).getTime() : 0;
    return dateA - dateB;
  });

  const currentIndex = sortedPosts.findIndex((p) => p.url === page.url);
  const previousPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : null;
  const nextPost =
    currentIndex >= 0 && currentIndex < sortedPosts.length - 1
      ? sortedPosts[currentIndex + 1]
      : null;

  const MDX = page.data.body;
  const dateStr = page.data.date
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(page.data.date))
    : null;

  return (
    <BlogTOCProvider toc={page.data.toc}>
      {/* Mobile Sticky TOC Popover sama persis seperti di docs */}
      <BlogMobileTOC />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="flex items-start gap-10 xl:gap-14 justify-center">
          {/* Kolom Artikel Utama */}
          <article className="w-full max-w-3xl min-w-0 flex-1 pt-8 sm:pt-12">
            {/* Tombol Navigasi Kembali */}
            <div className="mb-8">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring rounded-md py-1.5 px-2 -ml-2 min-h-[44px]"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span>Kembali ke semua blog</span>
              </Link>
            </div>

            {/* Header Artikel */}
            <header className="mb-8 border-b border-fd-border pb-8">
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-fd-muted-foreground mb-4">
                {dateStr ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-4 text-fd-muted-foreground" aria-hidden="true" />
                    <time dateTime={String(page.data.date)}>{dateStr}</time>
                  </span>
                ) : null}

                {page.data.author ? (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-4 text-fd-muted-foreground" aria-hidden="true" />
                    <span>{page.data.author}</span>
                  </span>
                ) : null}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-fd-foreground mb-4 leading-tight">
                {page.data.title}
              </h1>

              {page.data.description ? (
                <p className="text-lg sm:text-xl text-fd-muted-foreground leading-relaxed">
                  {page.data.description}
                </p>
              ) : null}
            </header>

            {/* Konten Artikel MDX */}
            <div className="prose max-w-none text-fd-foreground">
              <MDX
                components={getMDXComponents({
                  a: createRelativeLink(blogSource, page),
                })}
              />
            </div>

            {/* Navigasi Next & Previous */}
            <BlogPagination
              previous={
                previousPost
                  ? {
                      title: previousPost.data.title,
                      url: previousPost.url,
                    }
                  : null
              }
              next={
                nextPost
                  ? {
                      title: nextPost.data.title,
                      url: nextPost.url,
                    }
                  : null
              }
            />

            {/* Footer Tambahan */}
            <div className="mt-8 pt-6 border-t border-fd-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-medium text-fd-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring rounded-md py-2 px-3 min-h-[44px]"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span>Kembali ke daftar tulisan</span>
              </Link>

              <Link
                href="/docs"
                className="inline-flex items-center gap-2 text-sm font-medium text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring rounded-md py-2 px-3 min-h-[44px]"
              >
                <span>Jelajahi Dokumentasi Kelas</span>
              </Link>
            </div>
          </article>

          {/* Desktop TOC (sticky di sisi kanan dengan style docs) */}
          <BlogDesktopTOC />
        </div>
      </div>
    </BlogTOCProvider>
  );
}
