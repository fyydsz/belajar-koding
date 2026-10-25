'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useMounted } from '@/lib/use-mounted';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div
        className={`size-9 rounded-xl border border-fd-border/60 bg-fd-card/50 ${className ?? ''}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`inline-flex size-9 items-center justify-center rounded-xl border border-fd-border/80 bg-fd-card/70 text-fd-foreground/80 hover:text-fd-foreground hover:bg-fd-accent transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring cursor-pointer ${className ?? ''}`}
      aria-label="Alihkan mode tema gelap/terang"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
