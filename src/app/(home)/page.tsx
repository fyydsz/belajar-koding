import Link from 'next/link';
import { BookOpen, GitPullRequest } from 'lucide-react';
import { HeroDocsPreview } from '@/components/home/hero-docs-preview';
import { TrackCards } from '@/components/home/track-cards';
import { gitConfig } from '@/lib/shared';

export default function HomePage() {
  const githubRepoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Hero Framed Section */}
      <section className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-6 sm:pb-8">
        <div className="relative rounded-3xl border border-fd-border bg-gradient-to-b from-fd-card/90 via-fd-card/40 to-transparent pt-10 sm:pt-16 px-6 sm:px-12 overflow-hidden shadow-xs">
          {/* Halftone Dot pattern halus di sudut kanan atas */}
          <div
            className="absolute top-0 right-0 w-[380px] h-[380px] sm:w-[500px] sm:h-[500px] opacity-25 dark:opacity-20 pointer-events-none -z-10 translate-x-12 -translate-y-12"
            aria-hidden="true"
          >
            <svg viewBox="0 0 400 400" className="size-full fill-fd-primary">
              <defs>
                <pattern id="dot-pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" />
                </pattern>
                <radialGradient id="fade-mask" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fff" />
                  <stop offset="100%" stopColor="#000" />
                </radialGradient>
                <mask id="radial-fade">
                  <rect width="400" height="400" fill="url(#fade-mask)" />
                </mask>
              </defs>
              <rect width="400" height="400" fill="url(#dot-pattern)" mask="url(#radial-fade)" />
            </svg>
          </div>

          {/* Hero Header Content dengan copywriting manusiawi & lugas */}
          <div className="max-w-3xl text-left">
            <h1 className="text-4xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-fd-foreground mb-6 leading-[1.14]">
              Bangun logika coding,
              <br />
              pelajari konsepnya <span className="text-fd-primary">secara runtut</span>.
            </h1>

            <p className="text-base sm:text-lg text-fd-muted-foreground max-w-2xl mb-8 sm:mb-10 leading-relaxed">
              Panduan belajar pemrograman yang menitikberatkan pemahaman alur berpikir logis dan pemecahan masalah,
              bukan sekadar menghafal sintaksis kode.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 mb-12 sm:mb-16">
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <BookOpen className="size-4" />
                <span>Baca Dokumentasi</span>
              </Link>

              <a
                href={githubRepoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium border border-fd-border bg-fd-secondary/70 hover:bg-fd-accent text-fd-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <svg role="img" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                <span>Repositori GitHub</span>
              </a>
            </div>
          </div>

          {/* Pratinjau Pembaca Dokumentasi */}
          <div className="w-full flex justify-center -mb-2">
            <HeroDocsPreview />
          </div>
        </div>
      </section>

      {/* Curriculum Tracks Section */}
      <section className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-fd-foreground mb-3">
            Materi Pembelajaran
          </h2>
          <p className="text-sm sm:text-base text-fd-muted-foreground leading-relaxed">
            Pelajari konsep fundamental dan sintaks praktis melalui modul pembelajaran terstruktur.
          </p>
        </div>

        <TrackCards />
      </section>

      {/* Open Source & Contribution Banner */}
      <section className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 pt-6 pb-14 sm:pt-8 sm:pb-20">
        <div className="rounded-3xl border border-fd-border bg-fd-card/80 p-8 sm:p-12 lg:p-16 flex flex-col md:flex-row items-center justify-between gap-8 sm:gap-10 shadow-xs">
          <div className="max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-fd-border bg-fd-secondary mb-4 text-fd-muted-foreground">
              <GitPullRequest className="size-3.5 text-fd-primary" />
              <span>Proyek Terbuka di GitHub</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-fd-foreground mb-3">
              Ada materi yang keliru atau butuh diperjelas?
            </h3>
            <p className="text-sm text-fd-muted-foreground leading-relaxed">
              Repositori ini dikelola secara terbuka. Jika kamu menemukan penjelasan yang kurang tepat, kode yang perlu diperbaiki,
              atau ingin menyumbang materi baru, silakan ajukan kontribusi melalui pull request.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3.5 shrink-0">
            <Link
              href="/docs/kontribusi"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 transition-colors shadow-xs"
            >
              <GitPullRequest className="size-4" />
              <span>Panduan Kontribusi</span>
            </Link>
            <Link
              href="/docs/tentang"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-fd-border bg-fd-secondary hover:bg-fd-accent text-fd-foreground transition-colors"
            >
              <span>Tentang Penulis</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
