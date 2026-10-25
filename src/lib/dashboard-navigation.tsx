'use client';

import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { fetchCurrentUser, getAuthToken, type AuthUser } from '@/lib/auth';
import { cn } from '@/lib/cn';

type ProgressListener = (state: { visible: boolean; value: number }) => void;

class TopProgressController {
  private visible = false;
  private value = 0;
  private listeners = new Set<ProgressListener>();
  private trickleTimer: ReturnType<typeof setInterval> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(listener: ProgressListener) {
    this.listeners.add(listener);
    listener({ visible: this.visible, value: this.value });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ visible: this.visible, value: this.value });
    }
  }

  start() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    if (this.trickleTimer) {
      clearInterval(this.trickleTimer);
      this.trickleTimer = null;
    }

    this.visible = true;
    this.value = 18;
    this.notify();

    this.trickleTimer = setInterval(() => {
      if (this.value < 45) {
        this.value += 13;
      } else if (this.value < 70) {
        this.value += 7;
      } else if (this.value < 85) {
        this.value += 3;
      } else if (this.value < 93) {
        this.value += 0.6;
      }
      this.notify();
    }, 110);
  }

  done() {
    if (this.trickleTimer) {
      clearInterval(this.trickleTimer);
      this.trickleTimer = null;
    }

    if (!this.visible && this.value === 0) return;

    this.value = 100;
    this.notify();

    this.hideTimer = setTimeout(() => {
      this.visible = false;
      this.notify();

      this.resetTimer = setTimeout(() => {
        this.value = 0;
        this.notify();
      }, 200);
    }, 220);
  }
}

export const topProgress = new TopProgressController();

export function DashboardTopProgress() {
  const [state, setState] = useState({ visible: false, value: 0 });

  useEffect(() => {
    return topProgress.subscribe(setState);
  }, []);

  if (!state.visible && state.value === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999] pointer-events-none transition-opacity duration-200',
        state.visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <Progress
        value={state.value}
        aria-label="Memuat halaman"
        className="w-full gap-0 [&_[data-slot=progress-track]]:h-[3px] [&_[data-slot=progress-track]]:rounded-none [&_[data-slot=progress-track]]:bg-transparent [&_[data-slot=progress-indicator]]:bg-fd-primary [&_[data-slot=progress-indicator]]:shadow-[0_0_10px_var(--color-fd-primary)] [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-150 [&_[data-slot=progress-indicator]]:ease-out"
      />
    </div>
  );
}

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface SiswaOverviewCache {
  user: AuthUser | null;
  grades: any[];
  studentBatches: any[];
  attendanceSummary: any | null;
  studentAssignments: any[];
}

export interface BatchCatalogCache {
  batchesList: any[];
  myEnrollments: any[];
}

export interface PresensiIndexCache {
  user: AuthUser | null;
  enrollments: any[];
  activeSessionsByBatch: Record<string, any | null>;
}

export interface PresensiDetailCache {
  activeSession: any | null;
  historyList: any[];
}

export interface AssignmentsCache {
  isLinked: boolean;
  discordUsername: string | null;
  pairingCode: string | null;
  assignments: any[];
}

export interface KhsCache {
  grades: any[];
}

export interface KelasListCache {
  courses: any[];
}

export interface KelasDetailCache {
  course: any | null;
  sessions: any[];
  isEnrollmentRequired: boolean;
  error: string | null;
}

export interface KelasSessionCache {
  session: any | null;
  materials: any[];
  assignments: any[];
  notOpenedYet: boolean;
  error: string | null;
}

export interface ProfilCache {
  user: AuthUser | null;
}

export interface AdminOverviewCache {
  courses: any[];
  assignments: any[];
  batches: any[];
  users: any[];
  usersLoaded: boolean;
  pendingVerificationsCount: number | null;
}

export const dashboardCache: {
  siswaOverview: SiswaOverviewCache | null;
  batchCatalog: BatchCatalogCache | null;
  presensiIndex: PresensiIndexCache | null;
  presensiDetail: Record<string, PresensiDetailCache>;
  assignments: AssignmentsCache | null;
  khs: KhsCache | null;
  kelasList: KelasListCache | null;
  kelasDetail: Record<string, KelasDetailCache>;
  kelasSession: Record<string, KelasSessionCache>;
  profil: ProfilCache | null;
  adminOverview: AdminOverviewCache | null;
} = {
  siswaOverview: null,
  batchCatalog: null,
  presensiIndex: null,
  presensiDetail: {},
  assignments: null,
  khs: null,
  kelasList: null,
  kelasDetail: {},
  kelasSession: {},
  profil: null,
  adminOverview: null,
};

export function clearDashboardCache(): void {
  dashboardCache.siswaOverview = null;
  dashboardCache.batchCatalog = null;
  dashboardCache.presensiIndex = null;
  dashboardCache.presensiDetail = {};
  dashboardCache.assignments = null;
  dashboardCache.khs = null;
  dashboardCache.kelasList = null;
  dashboardCache.kelasDetail = {};
  dashboardCache.kelasSession = {};
  dashboardCache.profil = null;
  dashboardCache.adminOverview = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('auth-changed', (e: Event) => {
    const customEvent = e as CustomEvent<{ user: AuthUser | null } | null>;
    if (!customEvent.detail || customEvent.detail.user === null) {
      clearDashboardCache();
    }
  });
}

export async function loadSiswaOverviewCache(): Promise<SiswaOverviewCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [user, gradesRes, batchesRes, attendRes, assignRes] = await Promise.all([
    fetchCurrentUser(),
    fetch(`${apiUrl}/v1/grades/my`, { headers }).then((r) => r.json()),
    fetch(`${apiUrl}/v1/batches/my-batches`, { headers }).then((r) => r.json()),
    fetch(`${apiUrl}/v1/attendance/my-summary`, { headers }).then((r) => r.json()),
    fetch(`${apiUrl}/v1/assignments`, { headers }).then((r) => r.json()),
  ]);

  const data: SiswaOverviewCache = {
    user: user || null,
    grades: gradesRes?.success && Array.isArray(gradesRes.data) ? gradesRes.data : [],
    studentBatches: batchesRes?.success && Array.isArray(batchesRes.data) ? batchesRes.data : [],
    attendanceSummary: attendRes?.success && attendRes.data ? attendRes.data : null,
    studentAssignments: assignRes?.success && Array.isArray(assignRes.data) ? assignRes.data : [],
  };

  dashboardCache.siswaOverview = data;
  return data;
}

export async function loadBatchCatalogCache(): Promise<BatchCatalogCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [batchesRes, myBatchesRes] = await Promise.all([
    fetch(`${apiUrl}/v1/batches`, { headers }).then((r) => r.json()),
    fetch(`${apiUrl}/v1/batches/my-batches`, { headers }).then((r) => r.json()),
  ]);

  const data: BatchCatalogCache = {
    batchesList: batchesRes?.success ? batchesRes.data || [] : [],
    myEnrollments: myBatchesRes?.success ? myBatchesRes.data || [] : [],
  };

  dashboardCache.batchCatalog = data;
  return data;
}

export async function loadPresensiDetailCache(batchId: string): Promise<PresensiDetailCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [resActive, resHistory] = await Promise.all([
    fetch(`${apiUrl}/v1/attendance/active/${batchId}`, { headers }).then((r) => r.json()),
    fetch(`${apiUrl}/v1/attendance/student-history/${batchId}`, { headers }).then((r) => r.json()),
  ]);

  const historyList: any[] = [];
  if (resHistory?.success && Array.isArray(resHistory.data)) {
    const dedupedMap = new Map<number, any>();
    for (const item of resHistory.data) {
      if (!dedupedMap.has(item.sessionNumber)) {
        dedupedMap.set(item.sessionNumber, item);
      }
    }
    historyList.push(
      ...Array.from(dedupedMap.values()).sort((a, b) => a.sessionNumber - b.sessionNumber)
    );
  }

  const detail: PresensiDetailCache = {
    activeSession: resActive?.success && resActive.data ? resActive.data : null,
    historyList,
  };

  dashboardCache.presensiDetail[batchId] = detail;
  return detail;
}

export async function loadPresensiCache(idParam?: string | null): Promise<PresensiIndexCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [user, batchesJson] = await Promise.all([
    fetchCurrentUser(),
    fetch(`${apiUrl}/v1/batches/my-batches`, { headers }).then((r) => r.json()),
  ]);

  const activeList: any[] =
    batchesJson?.success && Array.isArray(batchesJson.data)
      ? batchesJson.data.filter((e: any) => e.status === 'active')
      : [];

  const activeSessionsByBatch: Record<string, any | null> = {};
  await Promise.all(
    activeList.map(async (enr) => {
      try {
        const resActive = await fetch(`${apiUrl}/v1/attendance/active/${enr.batchId}`, { headers });
        const jsonActive = await resActive.json();
        activeSessionsByBatch[enr.batchId] =
          jsonActive?.success && jsonActive.data ? jsonActive.data : null;
      } catch {
        activeSessionsByBatch[enr.batchId] = null;
      }
    })
  );

  const indexData: PresensiIndexCache = {
    user: user || null,
    enrollments: activeList,
    activeSessionsByBatch,
  };

  dashboardCache.presensiIndex = indexData;

  if (idParam) {
    const selected = activeList.find(
      (e) =>
        e.enrollmentId === idParam ||
        e.batchId === idParam ||
        e.courseId === idParam ||
        e.courseSlug === idParam
    );
    if (selected) {
      await loadPresensiDetailCache(selected.batchId);
    }
  }

  return indexData;
}

export async function loadAssignmentsCache(): Promise<AssignmentsCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [resDiscord, resAssign] = await Promise.all([
    fetch(`${apiUrl}/v1/profile/discord/status`, { headers }),
    fetch(`${apiUrl}/v1/assignments`, { headers }),
  ]);

  const [jsonDiscord, jsonAssign] = await Promise.all([resDiscord.json(), resAssign.json()]);

  const data: AssignmentsCache = {
    isLinked: resDiscord.ok && jsonDiscord?.success ? Boolean(jsonDiscord.data.isLinked) : false,
    discordUsername:
      resDiscord.ok && jsonDiscord?.success ? jsonDiscord.data.discordUsername || null : null,
    pairingCode:
      resDiscord.ok && jsonDiscord?.success ? jsonDiscord.data.activeCode || null : null,
    assignments: resAssign.ok && jsonAssign?.success ? jsonAssign.data || [] : [],
  };

  dashboardCache.assignments = data;
  return data;
}

export async function loadKhsCache(): Promise<KhsCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${apiUrl}/v1/grades/my`, { headers });
  const json = await res.json();

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Gagal memuat transkrip nilai.');
  }

  const data: KhsCache = {
    grades: Array.isArray(json.data) ? json.data : [],
  };

  dashboardCache.khs = data;
  return data;
}

export async function loadKelasListCache(): Promise<KelasListCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${apiUrl}/v1/classroom/courses`, { headers });
  const json = await res.json();

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Gagal memuat daftar kelas.');
  }

  const data: KelasListCache = {
    courses: json.data || [],
  };

  dashboardCache.kelasList = data;
  return data;
}

export async function loadKelasSessionCache(
  slug: string,
  sessionNum: number
): Promise<KelasSessionCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${apiUrl}/v1/classroom/courses/${slug}/sessions/${sessionNum}`, {
    headers,
  });
  const json = await res.json();

  let sessionCache: KelasSessionCache;
  if (res.ok && json?.success) {
    sessionCache = {
      session: json.data.session,
      materials: json.data.materials || [],
      assignments: json.data.assignments || [],
      notOpenedYet: false,
      error: null,
    };
  } else {
    sessionCache = {
      session: null,
      materials: [],
      assignments: [],
      notOpenedYet: Boolean(json?.notOpenedYet),
      error: json?.message || 'Pertemuan ini belum dibuka oleh dosen/mentor.',
    };
  }

  dashboardCache.kelasSession[`${slug}:${sessionNum}`] = sessionCache;
  return sessionCache;
}

export async function loadKelasDetailCache(
  slug: string,
  pParam?: string | null
): Promise<KelasDetailCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const sessionNum = pParam ? parseInt(pParam, 10) : null;
  const hasValidSession = Boolean(sessionNum && !isNaN(sessionNum));

  const [resCourse] = await Promise.all([
    fetch(`${apiUrl}/v1/classroom/courses/${slug}`, { headers }),
    hasValidSession && sessionNum ? loadKelasSessionCache(slug, sessionNum) : Promise.resolve(null),
  ]);

  const json = await resCourse.json();
  let detail: KelasDetailCache;

  if (resCourse.ok && json?.success) {
    detail = {
      course: json.data.course,
      sessions: json.data.sessions || [],
      isEnrollmentRequired: false,
      error: null,
    };
  } else {
    detail = {
      course: null,
      sessions: [],
      isEnrollmentRequired: Boolean(resCourse.status === 403 || json?.requiresEnrollment),
      error: json?.message || 'Gagal memuat kurikulum kelas.',
    };
  }

  dashboardCache.kelasDetail[slug] = detail;
  return detail;
}

export async function loadProfilCache(): Promise<ProfilCache> {
  const user = await fetchCurrentUser();
  const data: ProfilCache = { user: user || null };
  dashboardCache.profil = data;
  return data;
}

export async function loadAdminOverviewCache(): Promise<AdminOverviewCache> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [coursesRes, assignRes, batchesRes, usersRes, enrollmentsRes] = await Promise.all([
    fetch(`${apiUrl}/v1/classroom/courses`, { headers }),
    fetch(`${apiUrl}/v1/assignments`, { headers }),
    fetch(`${apiUrl}/v1/batches`, { headers }),
    fetch(`${apiUrl}/v1/profile/users`, { headers }).catch(() => null),
    fetch(`${apiUrl}/v1/batches/pending-enrollments?status=pending`, { headers }).catch(() => null),
  ]);

  const coursesJson = await coursesRes.json();
  const assignJson = await assignRes.json();
  const batchesJson = await batchesRes.json();

  let nextUsers: any[] = [];
  let nextUsersLoaded = false;
  if (usersRes && usersRes.ok) {
    const usersJson = await usersRes.json();
    if (usersJson?.success && Array.isArray(usersJson.data)) {
      nextUsers = usersJson.data;
      nextUsersLoaded = true;
    }
  }

  let nextPending: number | null = null;
  if (enrollmentsRes && enrollmentsRes.ok) {
    const enrollJson = await enrollmentsRes.json();
    if (enrollJson?.success && Array.isArray(enrollJson.data)) {
      nextPending = enrollJson.data.length;
    }
  }

  const data: AdminOverviewCache = {
    courses: coursesJson?.success && Array.isArray(coursesJson.data) ? coursesJson.data : [],
    assignments: assignJson?.success && Array.isArray(assignJson.data) ? assignJson.data : [],
    batches: batchesJson?.success && Array.isArray(batchesJson.data) ? batchesJson.data : [],
    users: nextUsers,
    usersLoaded: nextUsersLoaded,
    pendingVerificationsCount: nextPending,
  };

  dashboardCache.adminOverview = data;
  return data;
}

export async function preloadDashboardRoute(
  pathname: string,
  searchParams?: URLSearchParams
): Promise<void> {
  try {
    if (pathname === '/dashboard/admin') {
      await loadAdminOverviewCache();
    } else if (pathname === '/dashboard/siswa') {
      await loadSiswaOverviewCache();
    } else if (pathname === '/dashboard/batch') {
      await loadBatchCatalogCache();
    } else if (pathname === '/dashboard/siswa/presensi') {
      await loadPresensiCache(searchParams?.get('id'));
    } else if (pathname === '/dashboard/assignments') {
      await loadAssignmentsCache();
    } else if (pathname === '/dashboard/khs') {
      await loadKhsCache();
    } else if (pathname === '/dashboard/kelas') {
      await loadKelasListCache();
    } else if (pathname.startsWith('/dashboard/kelas/')) {
      const slug = pathname.replace('/dashboard/kelas/', '').split('/')[0];
      if (slug) {
        await loadKelasDetailCache(slug, searchParams?.get('p'));
      }
    } else if (pathname === '/dashboard/profil') {
      await loadProfilCache();
    }
  } catch {
    // Biarkan komponen halaman menampilkan pesan error jika gagal
  }
}
