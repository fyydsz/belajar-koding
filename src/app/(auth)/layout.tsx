import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/auth/theme-toggle';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-fd-background text-fd-foreground">
      {/* Background Halftone Dot Pattern khas Belajar Koding */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] opacity-20 sm:opacity-25 dark:opacity-15 -z-10"
        aria-hidden="true"
      >
        <svg viewBox="0 0 400 400" className="size-full fill-fd-primary">
          <defs>
            <pattern id="auth-dot-pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" />
            </pattern>
            <radialGradient id="auth-fade-mask" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
            <mask id="auth-radial-fade">
              <rect width="400" height="400" fill="url(#auth-fade-mask)" />
            </mask>
          </defs>
          <rect width="400" height="400" fill="url(#auth-dot-pattern)" mask="url(#auth-radial-fade)" />
        </svg>
      </div>

      <div
        className="pointer-events-none absolute -bottom-28 -left-28 h-[400px] w-[400px] opacity-15 sm:opacity-20 dark:opacity-10 -z-10"
        aria-hidden="true"
      >
        <svg viewBox="0 0 400 400" className="size-full fill-fd-primary">
          <rect width="400" height="400" fill="url(#auth-dot-pattern)" mask="url(#auth-radial-fade)" />
        </svg>
      </div>

      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 z-10 shrink-0">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 rounded-lg border border-fd-border/80 bg-fd-card/70 px-3 py-1.5 text-xs font-medium text-fd-muted-foreground transition hover:border-fd-border hover:bg-fd-accent hover:text-fd-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Kembali ke Beranda</span>
        </Link>

        <ThemeToggle />
      </header>

      {/* Auth Content Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-2 sm:py-3 z-10 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Footer */}
      <footer className="w-full py-2 px-4 text-center text-[11px] text-fd-muted-foreground/75 z-10 shrink-0">
        Belajar Koding &bull; Platform belajar logika dan konsep pemrograman
      </footer>
    </div>
  );
}
