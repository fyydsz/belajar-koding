'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { User as UserIcon, LogOut, BookOpen, CheckSquare } from 'lucide-react';
import { fetchCurrentUser, logoutUser, type AuthUser } from '@/lib/auth';

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    if (!isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setOpenUpward(rect.bottom > window.innerHeight * 0.5);
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const currentUser = await fetchCurrentUser();
        if (mounted) {
          setUser(currentUser);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadUser();

    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ user: AuthUser | null }>;
      if (customEvent.detail?.user !== undefined) {
        setUser(customEvent.detail.user);
      } else {
        loadUser();
      }
    };

    window.addEventListener('auth-changed', handleAuthChange);
    return () => {
      mounted = false;
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, []);

  // Menutup menu dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    await logoutUser();
    setUser(null);
    setIsOpen(false);
    router.refresh();
    router.push('/');
  };

  if (isLoading) {
    return <div className="h-8 w-16 animate-pulse rounded-full bg-fd-muted shrink-0" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-8 items-center justify-center rounded-full bg-fd-primary px-3.5 text-xs font-semibold text-fd-primary-foreground shadow-2xs transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring shrink-0"
      >
        Masuk
      </Link>
    );
  }

  const fullName = user.fullName || user.email?.split('@')[0] || 'Siswa';
  const role = user.role || 'student';
  const avatarUrl = user.avatarUrl || null;

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Tombol Link Dashboard (Warna Primary) - Disembunyikan saat sedang berada di /dashboard */}
      {!isDashboard && (
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center justify-center rounded-full bg-fd-primary px-3.5 text-xs font-semibold text-fd-primary-foreground shadow-2xs transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring shrink-0"
        >
          Dashboard
        </Link>
      )}

      {/* Profil Akun: Hanya Ikon Avatar Bundar */}
      <div className="relative inline-block text-left shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={toggleMenu}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={`Menu akun untuk ${fullName}`}
          title={fullName}
          className="flex size-8 items-center justify-center rounded-full border border-fd-border bg-fd-secondary/60 text-xs font-semibold text-fd-foreground shadow-2xs transition hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring overflow-hidden shrink-0"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={fullName}
              className="size-full object-cover rounded-full"
            />
          ) : (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fd-muted text-[10px] font-bold text-fd-foreground">
              {initials ? initials : <UserIcon className="size-3 text-fd-foreground" />}
            </span>
          )}
        </button>

        {/* Dropdown Menu (informasi nama, role, KHS, tugas, dan logout) */}
        {isOpen && (
          <div
            className={`absolute right-0 z-50 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-fd-border bg-fd-card p-1.5 shadow-lg focus:outline-none ${
              openUpward ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'
            }`}
          >
            {/* Header Info Akun */}
            <div className="flex items-center gap-2.5 border-b border-fd-border px-3 py-2.5">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="size-8 rounded-full object-cover border border-fd-border shrink-0"
                />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fd-muted text-xs font-bold text-fd-foreground">
                  {initials || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-fd-foreground truncate">{fullName}</p>
                <p className="text-[11px] text-fd-muted-foreground truncate">{user.email}</p>
                <span className="mt-0.5 inline-block rounded bg-fd-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-fd-muted-foreground">
                  {role === 'mentor' ? 'Pengajar' : role === 'admin' ? 'Administrator' : 'Siswa'}
                </span>
              </div>
            </div>

            {/* Navigasi SIAKAD */}
            <div className="py-1">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex w-full min-h-[36px] items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-fd-foreground transition hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <BookOpen className="size-3.5 text-fd-muted-foreground shrink-0" />
                <span>Beranda SIAKAD</span>
              </Link>
              <Link
                href="/dashboard/profil"
                onClick={() => setIsOpen(false)}
                className="flex w-full min-h-[36px] items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-fd-foreground transition hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <UserIcon className="size-3.5 text-fd-muted-foreground shrink-0" />
                <span>Profil Mahasiswa</span>
              </Link>
              <Link
                href="/dashboard/assignments"
                onClick={() => setIsOpen(false)}
                className="flex w-full min-h-[36px] items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-fd-foreground transition hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <CheckSquare className="size-3.5 text-fd-muted-foreground shrink-0" />
                <span>Daftar Tugas & Discord</span>
              </Link>
            </div>

            {/* Tombol Keluar */}
            <div className="border-t border-fd-border pt-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full min-h-[36px] items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <LogOut className="size-3.5 shrink-0" />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
