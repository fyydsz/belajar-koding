import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PaginationItem {
  title: string;
  url: string;
}

interface BlogPaginationProps {
  previous?: PaginationItem | null;
  next?: PaginationItem | null;
}

export function BlogPagination({ previous, next }: BlogPaginationProps) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Navigasi antar artikel blog"
      className="mt-12 pt-8 border-t border-fd-border grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      {previous ? (
        <Link
          href={previous.url}
          className="group flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-fd-border bg-fd-card/60 hover:bg-fd-card hover:border-fd-primary/40 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring text-left min-h-[80px]"
        >
          <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground mb-2">
            <ChevronLeft
              className="size-4 transition-transform group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            <span>Artikel Sebelumnya</span>
          </div>
          <span className="font-medium text-sm sm:text-base text-fd-foreground group-hover:text-fd-primary transition-colors line-clamp-2">
            {previous.title}
          </span>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}

      {next ? (
        <Link
          href={next.url}
          className={cn(
            'group flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-fd-border bg-fd-card/60 hover:bg-fd-card hover:border-fd-primary/40 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring text-right min-h-[80px]',
            !previous && 'sm:col-start-2'
          )}
        >
          <div className="flex items-center justify-end gap-1.5 text-xs text-fd-muted-foreground mb-2">
            <span>Artikel Berikutnya</span>
            <ChevronRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <span className="font-medium text-sm sm:text-base text-fd-foreground group-hover:text-fd-primary transition-colors line-clamp-2">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
