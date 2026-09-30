'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { appName } from '@/lib/shared';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/docs';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Silakan isi alamat email dan kata sandi Anda.');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMessage('Email atau kata sandi yang Anda masukkan salah.');
          } else {
            setErrorMessage(error.message);
          }
          return;
        }

        router.refresh();
        router.push(redirectTarget);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Terjadi kendala saat menghubungi server.';
        setErrorMessage(message);
      }
    });
  };

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-fd-border/90 bg-fd-card/90 p-5 sm:p-6 shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/50 backdrop-blur-xl transition-all',
        className
      )}
      {...props}
    >
      {/* Brand Header */}
      <div className="text-center mb-4">
        <Link
          href="/"
          className="inline-flex flex-col items-center gap-1.5 group transition"
        >
          <Image
            src="/logo.jpg"
            alt={`Logo ${appName}`}
            width={36}
            height={36}
            className="size-9 rounded-xl border border-fd-border object-cover shadow-xs transition group-hover:scale-105"
            priority
          />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-fd-muted-foreground group-hover:text-fd-foreground transition">
            {appName}
          </span>
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-fd-foreground">
          Masuk ke Akun
        </h1>
        <p className="mt-0.5 text-xs text-fd-muted-foreground leading-relaxed">
          Masukkan email dan kata sandi untuk mengakses materi kelas.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-3.5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs font-medium text-red-600 dark:text-red-400"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-[11px] font-semibold text-fd-foreground"
          >
            Alamat Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="nama@domain.com"
            autoComplete="email"
            required
            disabled={isPending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-9.5 px-3 rounded-lg border border-fd-border bg-fd-background/70 text-xs sm:text-sm text-fd-foreground placeholder:text-fd-muted-foreground/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:border-transparent disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-[11px] font-semibold text-fd-foreground"
          >
            Kata Sandi
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Masukkan kata sandi"
              required
              disabled={isPending}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9.5 pl-3 pr-9 rounded-lg border border-fd-border bg-fd-background/70 text-xs sm:text-sm text-fd-foreground placeholder:text-fd-muted-foreground/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:border-transparent disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6.5 inline-flex items-center justify-center rounded-md text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent/60 transition cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-9.5 rounded-lg bg-fd-primary text-fd-primary-foreground font-semibold hover:bg-fd-primary/90 active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring mt-1"
        >
          {isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Sedang memproses masuk...</span>
            </>
          ) : (
            <span>Masuk Sekarang</span>
          )}
        </button>
      </form>

      {/* Switch Auth */}
      <div className="mt-4 pt-3 border-t border-fd-border/70 text-center">
        <p className="text-xs text-fd-muted-foreground">
          Belum memiliki akun?{' '}
          <Link
            href={`/register${
              redirectTarget !== '/docs'
                ? `?redirect=${encodeURIComponent(redirectTarget)}`
                : ''
            }`}
            className="font-semibold text-fd-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring rounded"
          >
            Daftar akun siswa
          </Link>
        </p>
      </div>
    </div>
  );
}
