'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-8 rounded-full border border-fd-border bg-fd-secondary/40" />;
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Ganti tema tampilan"
      className="inline-flex size-8 items-center justify-center rounded-full border border-fd-border bg-fd-secondary/40 text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
    >
      {resolvedTheme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
