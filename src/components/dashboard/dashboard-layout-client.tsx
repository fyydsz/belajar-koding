'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { DocsLayout } from '@/layouts/notebook';
import { baseOptions } from '@/lib/layout.shared';
import { getDashboardTree, type ClassroomCourseItem } from '@/lib/dashboard-tree';
import {
  fetchCurrentUser,
  getAuthToken,
  getCachedUser,
  handleUnauthorizedRedirect,
  type AuthUser,
} from '@/lib/auth';
import {
  DashboardTopProgress,
  preloadDashboardRoute,
  topProgress,
} from '@/lib/dashboard-navigation';

export function DashboardLayoutClient({
  children,
  initialRole,
}: {
  children: React.ReactNode;
  initialRole?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const navIdRef = useRef(0);

  const [user, setUser] = useState<AuthUser | null>(() => {
    if (initialRole) {
      return {
        id: '',
        email: '',
        fullName: '',
        role: initialRole,
        avatarUrl: null,
      };
    }
    return null;
  });
  const [courses, setCourses] = useState<ClassroomCourseItem[]>([]);

  useEffect(() => {
    topProgress.done();
  }, [pathname]);

  const handleLinkClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      let targetUrl: URL;
      try {
        targetUrl = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (targetUrl.origin !== window.location.origin) return;
      if (!targetUrl.pathname.startsWith('/dashboard')) return;

      const currentFull = window.location.pathname + window.location.search;
      const targetFull = targetUrl.pathname + targetUrl.search;

      if (currentFull === targetFull) return;

      // Tahan halaman lama tetap tampil sambil menjalankan Top Progress Bar
      e.preventDefault();
      e.stopPropagation();

      const navId = ++navIdRef.current;
      topProgress.start();
      router.prefetch(targetFull);

      preloadDashboardRoute(targetUrl.pathname, targetUrl.searchParams).finally(() => {
        if (navId === navIdRef.current) {
          router.push(targetFull);
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (navId === navIdRef.current) {
                topProgress.done();
              }
            }, 60);
          });
        }
      });
    },
    [router]
  );

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      if (response.status === 401) {
        const reqUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (
          reqUrl.startsWith(apiUrl) &&
          !reqUrl.includes('/v1/auth/login') &&
          !reqUrl.includes('/v1/auth/register')
        ) {
          handleUnauthorizedRedirect();
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!getAuthToken()) {
      handleUnauthorizedRedirect();
      return;
    }

    const cached = getCachedUser();
    if (cached) {
      setUser(cached);
    }

    const enforceRoleGuard = (role?: string) => {
      if (!role || !pathname) return;
      if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
        router.replace(role === 'mentor' ? '/dashboard/mentor' : '/dashboard/siswa');
      } else if (
        (pathname.startsWith('/dashboard/mentor') || pathname.startsWith('/dashboard/dosen')) &&
        role !== 'mentor' &&
        role !== 'admin'
      ) {
        router.replace('/dashboard/siswa');
      }
    };

    const loadUser = async () => {
      try {
        const current = await fetchCurrentUser();
        if (!mounted) return;
        if (!current) {
          handleUnauthorizedRedirect();
          return;
        }
        setUser(current);
        enforceRoleGuard(current.role);
      } catch {
        // ignore network errors
      }
    };

    const loadClassroomCourses = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          handleUnauthorizedRedirect();
          return;
        }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/v1/classroom/courses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          handleUnauthorizedRedirect();
          return;
        }
        const json = await res.json();
        if (mounted && res.ok && json.success) {
          setCourses(json.data || []);
        }
      } catch {
        // ignore errors
      }
    };

    loadUser();
    loadClassroomCourses();

    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ user: AuthUser | null } | null>;
      if (!customEvent.detail || customEvent.detail.user === null) {
        if (mounted) {
          setUser(null);
        }
        handleUnauthorizedRedirect();
        return;
      }
      if (customEvent.detail?.user !== undefined) {
        setUser(customEvent.detail.user);
        enforceRoleGuard(customEvent.detail.user?.role);
      } else {
        loadUser();
      }
      loadClassroomCourses();
    };

    const handleClassroomUpdated = () => {
      loadClassroomCourses();
    };

    window.addEventListener('auth-changed', handleAuthChange);
    window.addEventListener('classroom-updated', handleClassroomUpdated);

    return () => {
      mounted = false;
      window.removeEventListener('auth-changed', handleAuthChange);
      window.removeEventListener('classroom-updated', handleClassroomUpdated);
    };
  }, [pathname, router]);

  const effectiveRole = user?.role || initialRole;

  const tree = useMemo(() => {
    return getDashboardTree(effectiveRole, courses);
  }, [effectiveRole, courses]);

  return (
    <div onClickCapture={handleLinkClickCapture} className="contents">
      <DashboardTopProgress />
      <DocsLayout
        tree={tree}
        {...baseOptions()}
        containerProps={{
          style: {
            '--fd-toc-width': '0px',
          } as React.CSSProperties,
        }}
      >
        <main
          style={{ gridColumn: 'main-start / toc-end' }}
          className="flex flex-col items-center w-full min-w-0 py-6 md:py-8"
          data-layout-main=""
        >
          <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </DocsLayout>
    </div>
  );
}
