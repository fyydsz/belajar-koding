'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuthToken, fetchCurrentUser, handleUnauthorizedRedirect, type AuthUser } from '@/lib/auth';
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  Layers,
  Users,
  GraduationCap,
  ClipboardList,
  Calendar,
  CheckCircle2,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { dashboardCache, topProgress } from '@/lib/dashboard-navigation';

interface AssignmentItem {
  id: string;
  courseId: string;
  courseTitle: string | null;
  batchId?: string | null;
  type?: 'tugas' | 'quiz' | 'uts' | 'uas';
  title: string;
  description: string | null;
  createdAt: string;
  expiredAt: string;
  isExpired: boolean;
}

interface CourseSession {
  id: string;
  sessionNumber: number;
  title: string;
}

interface CourseItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  totalSessions: number;
  sessions?: CourseSession[];
}

interface BatchSummaryItem {
  id: string;
  name: string;
  status: string;
  maxStudents?: number;
  studentCount?: number;
  startDate?: string | null;
  endDate?: string | null;
  price?: string | number;
  courses?: Array<{ id: string; title: string; slug: string }>;
  mentors?: Array<{ id: string; fullName: string; email: string }>;
}

interface UserSummaryItem {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'mentor' | 'admin';
  avatarUrl?: string | null;
  createdAt?: string;
}

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return 'Tidak ditentukan';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);

  const cached = dashboardCache.adminOverview;

  const [courses, setCourses] = useState<CourseItem[]>(() => cached?.courses || []);
  const [assignments, setAssignments] = useState<AssignmentItem[]>(() => cached?.assignments || []);
  const [batches, setBatches] = useState<BatchSummaryItem[]>(() => cached?.batches || []);
  const [users, setUsers] = useState<UserSummaryItem[]>(() => cached?.users || []);
  const [usersLoaded, setUsersLoaded] = useState(() => Boolean(cached?.usersLoaded));
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState<number | null>(
    () => (cached ? cached.pendingVerificationsCount : null)
  );
  const [isLoading, setIsLoading] = useState(() => !cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((user) => {
        if (!mounted) return;
        if (!user) {
          router.replace('/login');
          return;
        }
        if (user.role !== 'admin') {
          if (user.role === 'mentor') {
            router.replace('/dashboard/mentor');
          } else {
            router.replace('/dashboard/siswa');
          }
          return;
        }
        setCurrentUser(user);
      })
      .finally(() => {
        if (mounted) setIsAuthResolved(true);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const loadAdminOverview = useCallback(async (manual = false) => {
    if (manual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    topProgress.start();
    setErrorMessage(null);

    try {
      const token = getAuthToken();
      if (!token) {
        handleUnauthorizedRedirect();
        return;
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
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

      if (!coursesRes.ok || !coursesJson.success) {
        throw new Error(coursesJson.message || 'Gagal memuat kurikulum kelas.');
      }
      if (!assignRes.ok || !assignJson.success) {
        throw new Error(assignJson.message || 'Gagal memuat data penugasan.');
      }

      const nextCourses = coursesJson.data || [];
      const nextAssignments = assignJson.data || [];
      const nextBatches = batchesRes.ok && batchesJson.success && Array.isArray(batchesJson.data) ? batchesJson.data : [];

      setCourses(nextCourses);
      setAssignments(nextAssignments);
      setBatches(nextBatches);

      let nextUsers: UserSummaryItem[] = [];
      let nextUsersLoaded = false;
      if (usersRes && usersRes.ok) {
        const usersJson = await usersRes.json();
        if (usersJson?.success && Array.isArray(usersJson.data)) {
          nextUsers = usersJson.data;
          nextUsersLoaded = true;
        }
      }
      setUsers(nextUsers);
      setUsersLoaded(nextUsersLoaded);

      let nextPending: number | null = null;
      if (enrollmentsRes && enrollmentsRes.ok) {
        const enrollJson = await enrollmentsRes.json();
        if (enrollJson?.success && Array.isArray(enrollJson.data)) {
          nextPending = enrollJson.data.length;
        }
      }
      setPendingVerificationsCount(nextPending);

      dashboardCache.adminOverview = {
        courses: nextCourses,
        assignments: nextAssignments,
        batches: nextBatches,
        users: nextUsers,
        usersLoaded: nextUsersLoaded,
        pendingVerificationsCount: nextPending,
      };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Terjadi kendala saat menghubungi server data akademik.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      topProgress.done();
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!isAuthResolved || currentUser?.role !== 'admin') return;
    if (!dashboardCache.adminOverview) {
      loadAdminOverview();
    }
  }, [isAuthResolved, currentUser, loadAdminOverview]);

  const activeBatches = batches.filter((b) => b.status === 'active');
  const primaryBatch = activeBatches[0] || batches[0] || null;
  const primaryCourse =
    courses.find(
      (c) => primaryBatch?.courses && primaryBatch.courses.some((bc) => bc.id === c.id)
    ) || courses[0] || null;

  const totalStudents = users.filter((u) => u.role === 'student').length;
  const totalMentors = users.filter((u) => u.role === 'mentor').length;
  const activeAssignments = assignments.filter((item) => !item.isExpired);

  const studentOccupancy = primaryBatch?.studentCount || 0;
  const maxCapacity = primaryBatch?.maxStudents || 20;
  const remainingSeats = Math.max(0, maxCapacity - studentOccupancy);
  const occupancyPercentage = Math.min(100, Math.round((studentOccupancy / maxCapacity) * 100));

  const upcomingAssignments = [...activeAssignments]
    .sort((a, b) => new Date(a.expiredAt).getTime() - new Date(b.expiredAt).getTime())
    .slice(0, 5);

  const recentUsers = [...users]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 5);

  const roleLabel: Record<UserSummaryItem['role'], string> = {
    student: 'Siswa',
    mentor: 'Mentor',
    admin: 'Admin',
  };

  const adminName = currentUser?.fullName || 'Administrator';

  if (!isAuthResolved || isLoading) {
    return null;
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fd-foreground">Gagal Menampilkan Data</h2>
        <p className="mt-1.5 max-w-md text-xs text-fd-muted-foreground">{errorMessage}</p>
        <Button
          onClick={() => loadAdminOverview(true)}
          variant="outline"
          size="sm"
          className="mt-6 gap-2"
        >
          <RefreshCw className="size-3.5" />
          <span>Muat Ulang Data</span>
        </Button>
      </div>
    );
  }

  const metrics: Array<{ label: string; value: number | null; href: string }> = [
    { label: 'Siswa', value: usersLoaded ? totalStudents : null, href: '/dashboard/admin/pengguna' },
    { label: 'Mentor', value: usersLoaded ? totalMentors : null, href: '/dashboard/admin/pengguna' },
    { label: 'Kelas', value: courses.length, href: '/dashboard/dosen/kelas' },
    { label: 'Tugas aktif', value: activeAssignments.length, href: '/dashboard/dosen/tugas' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Ringkasan Sistem
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Halo, {adminName}. Ini kondisi batch, pendaftaran, dan penugasan saat ini.
          </p>
        </div>
        <ButtonGroup className="self-start sm:self-auto shrink-0">
          <Button
            id="admin-refresh"
            type="button"
            onClick={() => loadAdminOverview(true)}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            <span>{isRefreshing ? 'Memuat...' : 'Segarkan'}</span>
          </Button>
          <Button
            id="admin-manage-batches"
            type="button"
            variant="default"
            size="sm"
            onClick={() => router.push('/dashboard/admin/batches')}
          >
            <Layers className="size-3.5" />
            <span>Kelola Batch</span>
          </Button>
        </ButtonGroup>
      </header>

      {/* Baris fokus: antrean tindakan + batch berjalan */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Perlu tindakan">
        {(() => {
          const hasPending = pendingVerificationsCount !== null && pendingVerificationsCount > 0;
          return (
            <div
              className={cn(
                'flex flex-col justify-between rounded-xl border p-5 shadow-2xs',
                hasPending
                  ? 'border-amber-500/30 bg-amber-500/[0.06]'
                  : 'border-fd-border bg-fd-card'
              )}
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-fd-muted-foreground">
                  <UserCheck className="size-4" />
                  <span>Verifikasi pendaftaran</span>
                </div>
                {pendingVerificationsCount === null ? (
                  <>
                    <p className="mt-3 text-sm font-medium text-fd-muted-foreground">
                      Data antrean tidak tersedia
                    </p>
                    <p className="mt-1 text-xs text-fd-muted-foreground">
                      Gagal menghubungi server verifikasi pendaftaran.
                    </p>
                  </>
                ) : pendingVerificationsCount > 0 ? (
                  <>
                    <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-fd-foreground">
                      {pendingVerificationsCount}
                    </p>
                    <p className="mt-1 text-sm text-fd-foreground">
                      bukti pembayaran menunggu diperiksa
                    </p>
                    <p className="mt-1 text-xs text-fd-muted-foreground">
                      Siswa belum bisa mengakses kelas sebelum pendaftarannya disetujui.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 flex items-center gap-2 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-5" />
                      <span>Antrean kosong</span>
                    </p>
                    <p className="mt-1 text-xs text-fd-muted-foreground">
                      Semua pendaftaran batch sudah diproses.
                    </p>
                  </>
                )}
              </div>
              <Link
                id="admin-open-verification"
                href="/dashboard/dosen/verifikasi-batch"
                data-slot="button"
                className={cn(
                  buttonVariants({
                    variant: hasPending ? 'default' : 'outline',
                    size: 'sm',
                  }),
                  'mt-5 w-full justify-between'
                )}
              >
                <span>{hasPending ? 'Periksa Antrean' : 'Buka Riwayat Verifikasi'}</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          );
        })()}

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-fd-border p-5 pb-4">
            <div className="min-w-0 space-y-0.5">
              <CardDescription className="text-xs font-medium">Batch berjalan</CardDescription>
              <CardTitle className="truncate text-base font-semibold">
                {primaryBatch ? primaryBatch.name : 'Belum ada batch'}
              </CardTitle>
            </div>
            {primaryBatch && (
              <Badge
                variant="outline"
                className={cn('shrink-0 text-[11px]', batchStatusClass(primaryBatch.status))}
              >
                {batchStatusLabel(primaryBatch.status)}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-5">
            {primaryBatch ? (
              <div className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-fd-foreground">
                      <span className="text-2xl font-bold tabular-nums">{studentOccupancy}</span>
                      <span className="text-fd-muted-foreground"> / {maxCapacity} kursi terisi</span>
                    </p>
                    <span className="text-xs font-medium text-fd-muted-foreground tabular-nums">
                      {remainingSeats > 0 ? `Sisa ${remainingSeats} kursi` : 'Penuh'}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-fd-muted"
                    role="progressbar"
                    aria-label="Keterisian batch"
                    aria-valuenow={occupancyPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-500',
                        occupancyPercentage >= 90 ? 'bg-amber-500' : 'bg-fd-primary'
                      )}
                      style={{ width: `${occupancyPercentage}%` }}
                    />
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground">
                      <Calendar className="size-3.5" />
                      Periode
                    </dt>
                    <dd className="text-fd-foreground">
                      {formatDate(primaryBatch.startDate)} - {formatDate(primaryBatch.endDate)}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground">
                      <GraduationCap className="size-3.5" />
                      Mentor
                    </dt>
                    <dd className="text-fd-foreground">
                      {primaryBatch.mentors && primaryBatch.mentors.length > 0
                        ? primaryBatch.mentors.map((m) => m.fullName).join(', ')
                        : 'Belum ditugaskan'}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground">
                      <BookOpen className="size-3.5" />
                      Kelas
                    </dt>
                    <dd className="text-fd-foreground">
                      {primaryBatch.courses && primaryBatch.courses.length > 0
                        ? primaryBatch.courses.map((c) => c.title).join(', ')
                        : primaryCourse?.title || 'Belum ada kelas'}
                    </dd>
                  </div>
                </dl>

                {batches.length > 1 && (
                  <p className="border-t border-fd-border/60 pt-4 text-xs text-fd-muted-foreground">
                    {activeBatches.length} batch aktif dari {batches.length} batch terdaftar.{' '}
                    <Link
                      href="/dashboard/admin/batches"
                      className="font-medium text-fd-foreground underline-offset-4 hover:text-fd-primary hover:underline"
                    >
                      Lihat semua batch
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-fd-foreground">Belum ada batch yang dibuat.</p>
                <p className="mt-1 text-xs text-fd-muted-foreground">
                  Buat batch pertama agar siswa bisa mendaftar dan mentor bisa ditugaskan.
                </p>
                <Link
                  href="/dashboard/admin/batches"
                  data-slot="button"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}
                >
                  Buat Batch
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Strip angka ringkas */}
      <section aria-label="Total data">
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-2xs sm:grid-cols-4">
          {metrics.map((metric, index) => (
            <Link
              key={metric.label}
              href={metric.href}
              className={cn(
                'group flex flex-col gap-1 p-4 transition-colors hover:bg-fd-accent/30 focus-visible:bg-fd-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring',
                index % 2 === 1 && 'border-l border-fd-border',
                index >= 2 && 'border-t border-fd-border sm:border-t-0',
                index === 2 && 'sm:border-l'
              )}
            >
              <dt className="text-xs font-medium text-fd-muted-foreground group-hover:text-fd-foreground">
                {metric.label}
              </dt>
              <dd className="text-xl font-semibold tabular-nums text-fd-foreground">
                {metric.value ?? <span className="text-sm font-normal text-fd-muted-foreground">Tidak tersedia</span>}
              </dd>
            </Link>
          ))}
        </dl>
      </section>

      {/* Tenggat + pengguna baru */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-fd-border p-5 pb-4">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ClipboardList className="size-4 text-fd-primary" />
                <span>Tenggat Terdekat</span>
              </CardTitle>
              <CardDescription>Tugas dan ujian yang masih terbuka, diurutkan dari tenggat paling dekat.</CardDescription>
            </div>
            <Link
              href="/dashboard/dosen/tugas"
              data-slot="button"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
            >
              Semua Tugas
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingAssignments.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-fd-foreground">Tidak ada tugas yang sedang terbuka.</p>
                <p className="mt-1 text-xs text-fd-muted-foreground">
                  Tugas baru dibuat lewat menu Kelola Tugas &amp; Proyek.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-fd-border">
                {upcomingAssignments.map((task) => {
                  const daysLeft = getDaysLeft(task.expiredAt);
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-4 p-4 sm:px-5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-fd-foreground">
                            {task.title}
                          </span>
                          {task.type && (
                            <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                              {task.type}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-fd-muted-foreground">
                          {task.courseTitle || 'Kelas tidak diketahui'} · {formatDate(task.expiredAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-xs font-medium tabular-nums',
                          daysLeft <= 1
                            ? 'text-destructive'
                            : daysLeft <= 3
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-fd-muted-foreground'
                        )}
                      >
                        {daysLeft <= 0 ? 'Hari ini' : `${daysLeft} hari lagi`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-fd-border p-5 pb-4">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="size-4 text-fd-primary" />
                <span>Pengguna Terbaru</span>
              </CardTitle>
              <CardDescription>Akun yang terakhir terdaftar.</CardDescription>
            </div>
            <Link
              href="/dashboard/admin/pengguna"
              data-slot="button"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
            >
              Kelola
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {!usersLoaded ? (
              <div className="p-8 text-center text-xs text-fd-muted-foreground">
                Data pengguna tidak dapat dimuat. Coba muat ulang halaman.
              </div>
            ) : recentUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-fd-muted-foreground">
                Belum ada pengguna terdaftar.
              </div>
            ) : (
              <ul className="divide-y divide-fd-border">
                {recentUsers.map((user) => (
                  <li key={user.id} className="flex items-center gap-3 p-4 sm:px-5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fd-muted text-xs font-semibold text-fd-foreground"
                      aria-hidden="true"
                    >
                      {getInitials(user.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fd-foreground">{user.fullName}</p>
                      <p className="truncate text-xs text-fd-muted-foreground">{user.email}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 text-[10px]',
                        user.role === 'admin' && 'border-fd-primary/30 text-fd-primary',
                        user.role === 'mentor' && 'border-amber-500/20 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {roleLabel[user.role]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kurikulum */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-fd-border p-5 pb-4">
          <div className="space-y-0.5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="size-4 text-fd-primary" />
              <span>Kurikulum Kelas</span>
            </CardTitle>
            <CardDescription>Kelas yang tersedia beserta jumlah pertemuannya.</CardDescription>
          </div>
          <Link
            href="/dashboard/dosen/kelas"
            data-slot="button"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
          >
            Kelola Kelas
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {courses.length === 0 ? (
            <div className="p-8 text-center text-xs text-fd-muted-foreground">
              Belum ada kelas. Tambahkan kelas di menu Kelola Kelas &amp; Materi.
            </div>
          ) : (
            <ul className="divide-y divide-fd-border">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/dashboard/dosen/kelas/${course.slug}`}
                    className="group flex items-center justify-between gap-4 p-4 transition-colors hover:bg-fd-accent/30 focus-visible:bg-fd-accent/30 focus-visible:outline-none sm:px-5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium text-fd-foreground group-hover:text-fd-primary">
                        {course.title}
                      </p>
                      {course.description && (
                        <p className="line-clamp-1 text-xs text-fd-muted-foreground">{course.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-fd-muted-foreground">
                      <span className="tabular-nums">{course.totalSessions} pertemuan</span>
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getDaysLeft(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function batchStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Berjalan',
    open: 'Pendaftaran Dibuka',
    upcoming: 'Akan Datang',
    completed: 'Selesai',
    closed: 'Ditutup',
  };
  return labels[status] || status;
}

function batchStatusClass(status: string): string {
  if (status === 'active' || status === 'open') {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  }
  if (status === 'upcoming') {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  }
  return 'text-fd-muted-foreground';
}


