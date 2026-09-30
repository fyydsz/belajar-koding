'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  BookOpenCheck,
  GraduationCap,
  CheckSquare,
  User,
  Code2,
  ChevronRight,
  Sidebar as SidebarIcon,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/auth/user-menu';
import { createClient } from '@/lib/supabase/client';
import { appName } from '@/lib/shared';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavFolder {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { title: string; href: string }[];
}

const academicNavItems: NavItem[] = [
  {
    title: 'Beranda',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Presensi',
    href: '/dashboard/presensi',
    icon: CalendarCheck,
  },
  {
    title: 'KRS',
    href: '/dashboard/krs',
    icon: BookOpenCheck,
  },
  {
    title: 'KHS',
    href: '/dashboard/khs',
    icon: GraduationCap,
  },
  {
    title: 'Tugas & Discord',
    href: '/dashboard/assignments',
    icon: CheckSquare,
  },
  {
    title: 'Profil',
    href: '/dashboard/profil',
    icon: User,
  },
];

const courseFolders: NavFolder[] = [
  {
    title: 'Dasar-Dasar Python',
    icon: Code2,
    items: [
      { title: 'Pengenalan Python', href: '/docs/python' },
      { title: 'Sintaks Dasar', href: '/docs/python/sintaks_dasar' },
      { title: 'Operator Aritmatika', href: '/docs/python/operator_aritmatika' },
      { title: 'Percabangan', href: '/docs/python/percabangan' },
      { title: 'Perulangan', href: '/docs/python/perulangan' },
      { title: 'Struktur Data', href: '/docs/python/struktur_data' },
      { title: 'Fungsi', href: '/docs/python/fungsi' },
    ],
  },
  {
    title: 'Dasar-Dasar JavaScript',
    icon: Code2,
    items: [
      { title: 'Pengenalan JavaScript', href: '/docs/javascript' },
      { title: 'Variabel & Tipe Data', href: '/docs/javascript/variabel_tipe_data' },
      { title: 'Operator', href: '/docs/javascript/operator' },
      { title: 'Percabangan', href: '/docs/javascript/percabangan' },
      { title: 'Perulangan', href: '/docs/javascript/perulangan' },
      { title: 'Fungsi', href: '/docs/javascript/fungsi' },
      { title: 'Array & Objek', href: '/docs/javascript/array_objek' },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'Dasar-Dasar Python': false,
    'Dasar-Dasar JavaScript': false,
  });

  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('student');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Mahasiswa');
        setUserRole(user.user_metadata?.role || 'student');
      }
    });
  }, []);

  // Tutup drawer mobile saat rute berubah
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Tutup drawer mobile dengan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    if (isMobileOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen]);

  const toggleFolder = (title: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push('/');
  };

  const currentPageTitle =
    academicNavItems.find((item) => item.href === pathname)?.title ||
    (pathname === '/dashboard/grades' ? 'Beranda' : 'SIAKAD');

  const renderNavContent = () => (
    <div className="flex flex-col gap-6 px-3 py-4 text-[0.9375rem]">
      {/* 1. Grup Informasi / SIAKAD */}
      <div>
        <p className="px-2 pb-1.5 text-xs font-semibold text-fd-foreground">
          Akademik & SIAKAD
        </p>
        <div className="space-y-0.5">
          {academicNavItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname === '/dashboard/grades'
                : pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[40px] items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring ${
                  isActive
                    ? 'border border-fd-border/60 bg-fd-accent/80 font-medium text-fd-primary shadow-2xs'
                    : 'text-fd-muted-foreground hover:bg-fd-accent/50 hover:text-fd-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`size-4 shrink-0 transition-colors ${
                      isActive ? 'text-fd-primary' : 'text-fd-muted-foreground'
                    }`}
                  />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className="rounded-full bg-fd-primary/15 px-2 py-0.5 text-[10px] font-semibold text-fd-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 2. Grup Materi Kelas (Collapsible seperti contoh Screenshot 2) */}
      <div>
        <p className="px-2 pb-1.5 text-xs font-semibold text-fd-foreground">
          Materi Kelas
        </p>
        <div className="space-y-1">
          {courseFolders.map((folder) => {
            const isOpen = Boolean(openFolders[folder.title]);
            const Icon = folder.icon;
            const hasActiveChild = folder.items.some((sub) => pathname === sub.href);

            return (
              <div key={folder.title} className="space-y-0.5">
                {/* Trigger Folder Collapsible */}
                <button
                  type="button"
                  onClick={() => toggleFolder(folder.title)}
                  aria-expanded={isOpen}
                  className={`flex w-full min-h-[40px] items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring ${
                    hasActiveChild
                      ? 'font-medium text-fd-primary'
                      : 'text-fd-muted-foreground hover:bg-fd-accent/50 hover:text-fd-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-fd-muted-foreground" />
                    <span>{folder.title}</span>
                  </div>
                  <ChevronRight
                    className={`size-3.5 shrink-0 text-fd-muted-foreground transition-transform duration-200 ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {/* Sub Menu / Folder Children */}
                {isOpen && (
                  <div className="ms-3 border-s border-fd-border/70 ps-2.5 py-1 space-y-0.5">
                    {folder.items.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`block min-h-[36px] rounded-md px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring ${
                            isSubActive
                              ? 'bg-fd-accent/80 font-medium text-fd-primary'
                              : 'text-fd-muted-foreground hover:bg-fd-accent/40 hover:text-fd-foreground'
                          }`}
                        >
                          {subItem.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-fd-background text-fd-foreground">
      {/* 1. Sidebar Desktop (Collapsible seperti Screenshot 2) */}
      <aside
        className={`hidden md:flex md:flex-col md:h-screen md:sticky md:top-0 shrink-0 border-e border-fd-border bg-fd-card transition-all duration-300 ease-in-out ${
          isDesktopCollapsed ? 'w-0 overflow-hidden border-none opacity-0' : 'w-[268px] opacity-100'
        }`}
      >
        {/* Header Sidebar: Brand + Tombol Collapse [ | ] persis seperti Screenshot 2 */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-fd-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-medium text-sm">
            <Image
              src="/logo.jpg"
              alt={`Logo ${appName}`}
              width={24}
              height={24}
              className="size-6 rounded-full object-cover border border-fd-border shadow-2xs"
            />
            <span className="font-semibold text-fd-foreground">{appName}</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsDesktopCollapsed(true)}
            title="Ciutkan Sidebar"
            aria-label="Ciutkan Sidebar"
            className="flex size-8 items-center justify-center rounded-lg text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <SidebarIcon className="size-4" />
          </button>
        </div>

        {/* Viewport Konten Sidebar */}
        <div className="flex-1 overflow-y-auto">
          {renderNavContent()}
        </div>

        {/* Footer Sidebar: Profil Mahasiswa & Tombol Keluar */}
        <div className="border-t border-fd-border p-3 shrink-0">
          <div className="flex items-center justify-between rounded-xl border border-fd-border/70 bg-fd-background/50 p-2.5 shadow-2xs">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-fd-foreground">{userName || 'Pengguna'}</p>
              <p className="text-[10px] capitalize text-fd-muted-foreground">
                {userRole === 'mentor' ? 'Pengajar' : userRole === 'admin' ? 'Administrator' : 'Mahasiswa'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Keluar dari akun"
              title="Keluar"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fd-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigasi Menu SIAKAD"
          className="fixed inset-0 z-50 flex md:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Drawer Menu Panel */}
          <div className="relative z-10 flex w-4/5 max-w-[280px] flex-col bg-fd-card shadow-2xl border-e border-fd-border">
            <div className="flex h-14 items-center justify-between border-b border-fd-border px-4 shrink-0">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo.jpg"
                  alt={`Logo ${appName}`}
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-cover border border-fd-border shadow-2xs"
                />
                <span className="font-semibold text-sm">{appName}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Tutup menu"
                className="flex size-8 items-center justify-center rounded-lg text-fd-muted-foreground hover:bg-fd-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <X className="size-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {renderNavContent()}
            </div>

            <div className="border-t border-fd-border p-3 shrink-0">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <LogOut className="size-4" />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Content: Topbar + Page Body */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-fd-border bg-fd-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* Tombol Expand Sidebar Desktop saat di-collapse */}
            {isDesktopCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopCollapsed(false)}
                title="Buka Sidebar"
                aria-label="Buka Sidebar"
                className="hidden md:flex size-8 items-center justify-center rounded-lg text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring -ms-1"
              >
                <SidebarIcon className="size-4" />
              </button>
            )}

            {/* Tombol Menu Mobile Drawer */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Buka menu navigasi"
              className="flex size-8 items-center justify-center rounded-lg text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring md:hidden -ms-1"
            >
              <SidebarIcon className="size-4.5" />
            </button>

            {/* Breadcrumb Info */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
              <Link href="/dashboard" className="transition hover:text-fd-foreground">
                SIAKAD
              </Link>
              <ChevronRight className="size-3.5 shrink-0 text-fd-muted-foreground/60" />
              <span className="font-semibold text-fd-foreground">{currentPageTitle}</span>
            </nav>
          </div>

          {/* Sisi Kanan: Tautan Dokumentasi, Theme Toggle, User Menu */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/docs"
              className="hidden sm:inline-flex min-h-[34px] items-center justify-center rounded-full border border-fd-border bg-fd-card px-3.5 text-xs font-semibold text-fd-foreground shadow-2xs transition hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              Dokumentasi
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
