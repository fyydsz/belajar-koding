'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { appName } from '@/lib/shared';

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/docs';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMessage('Semua kolom formulir wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Kata sandi harus terdiri dari minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok dengan kata sandi.');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          router.refresh();
          router.push(redirectTarget);
          return;
        }

        setSuccessMessage(
          'Pendaftaran berhasil! Akun Anda telah dibuat. Silakan periksa inbox email Anda untuk verifikasi atau langsung coba masuk.'
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Terjadi kendala saat proses pendaftaran akun.';
        setErrorMessage(message);
      }
    });
  };

  const isPasswordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-fd-border/90 bg-fd-card/90 p-5 sm:p-6 shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/50 backdrop-blur-xl transition-all',
        className
      )}
      {...props}
    >
      {/* Brand Header */}
      <div className="text-center mb-3.5">
        <Link
          href="/"
          className="inline-flex flex-col items-center gap-1 group transition"
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
        <h1 className="mt-1.5 text-xl font-bold tracking-tight text-fd-foreground">
          Daftar Akun Siswa
        </h1>
        <p className="mt-0.5 text-xs text-fd-muted-foreground leading-relaxed">
          Buat akun untuk mengakses materi, latihan tugas, dan kartu nilai.
        </p>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="size-7 mx-auto mb-1.5 text-emerald-500" />
          <h2 className="font-semibold text-xs mb-1">Pendaftaran Berhasil!</h2>
          <p className="text-[11px] leading-relaxed opacity-90">{successMessage}</p>
          <div className="mt-3">
            <Link
              href={`/login${
                redirectTarget !== '/docs'
                  ? `?redirect=${encodeURIComponent(redirectTarget)}`
                  : ''
              }`}
              className="inline-flex items-center justify-center h-8.5 px-4 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition shadow-xs"
            >
              Lanjut ke Halaman Masuk
            </Link>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs font-medium text-red-600 dark:text-red-400"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {!successMessage && (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1">
            <label
              htmlFor="fullName"
              className="block text-[11px] font-semibold text-fd-foreground"
            >
              Nama Lengkap
            </label>
            <input
              id="fullName"
              type="text"
              placeholder="Contoh: Muhammad Fikri"
              autoComplete="name"
              required
              disabled={isPending}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-fd-border bg-fd-background/70 text-xs sm:text-sm text-fd-foreground placeholder:text-fd-muted-foreground/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:border-transparent disabled:opacity-50"
            />
          </div>

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
              className="w-full h-9 px-3 rounded-lg border border-fd-border bg-fd-background/70 text-xs sm:text-sm text-fd-foreground placeholder:text-fd-muted-foreground/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:border-transparent disabled:opacity-50"
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
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
                required
                disabled={isPending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-9 pl-3 pr-9 rounded-lg border border-fd-border bg-fd-background/70 text-xs sm:text-sm text-fd-foreground placeholder:text-fd-muted-foreground/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:border-transparent disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? 'Sembunyikan kata sandi'
                    : 'Tampilkan kata sandi'
                }
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

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="confirmPassword"
                className="block text-[11px] font-semibold text-fd-foreground"
              >
                Ulangi Kata Sandi
              </label>
              {isPasswordMismatch && (
                <span className="text-[10px] text-red-500 font-medium">
                  Kata sandi tidak cocok
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ulangi kata sandi Anda"
                required
                disabled={isPending}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(
                  'w-full h-9 pl-3 pr-9 rounded-lg border bg-fd-background/70 text-xs sm:text-sm text-fd-foreground placeholder:text-fd-muted-foreground/50 transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
                  isPasswordMismatch
                    ? 'border-red-500/60 focus-visible:ring-red-500'
                    : 'border-fd-border focus-visible:ring-fd-ring focus-visible:border-transparent'
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword
                    ? 'Sembunyikan konfirmasi kata sandi'
                    : 'Tampilkan konfirmasi kata sandi'
                }
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6.5 inline-flex items-center justify-center rounded-md text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent/60 transition cursor-pointer"
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || isPasswordMismatch}
            className="w-full h-9.5 rounded-lg bg-fd-primary text-fd-primary-foreground font-semibold hover:bg-fd-primary/90 active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring mt-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Sedang membuat akun...</span>
              </>
            ) : (
              <span>Daftar Sekarang</span>
            )}
          </button>
        </form>
      )}

      {/* Switch to Login */}
      <div className="mt-3.5 pt-3 border-t border-fd-border/70 text-center">
        <p className="text-xs text-fd-muted-foreground">
          Sudah memiliki akun?{' '}
          <Link
            href={`/login${
              redirectTarget !== '/docs'
                ? `?redirect=${encodeURIComponent(redirectTarget)}`
                : ''
            }`}
            className="font-semibold text-fd-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fd-ring rounded"
          >
            Masuk ke akun
          </Link>
        </p>
      </div>
    </div>
  );
}
