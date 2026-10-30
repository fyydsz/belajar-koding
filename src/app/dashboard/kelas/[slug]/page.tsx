'use client';

import React, { useEffect, useState, useCallback, use, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import {
  dashboardCache,
  loadKelasDetailCache,
  loadKelasSessionCache,
  topProgress,
} from '@/lib/dashboard-navigation';
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  AlertCircle,
  ExternalLink,
  Download,
  Send,
  Loader2,
  ArrowLeft,
  Pencil,
  Layers,
} from 'lucide-react';
import { DynamicMDXRenderer } from '@/components/mdx/dynamic-mdx-renderer';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { DashboardBreadcrumb } from '@/components/dashboard/dashboard-breadcrumb';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

function formatSubmissionDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

interface SessionSummary {
  id: string;
  courseId: string;
  sessionNumber: number;
  title: string;
  description: string | null;
  materialsCount: number;
  assignmentsCount: number;
}

interface MaterialItem {
  id: string;
  sessionId: string;
  mentorId: string;
  mentorName: string | null;
  title: string;
  contentMdx: string;
  fileUrl: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface AssignmentItem {
  id: string;
  courseId: string;
  sessionId: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  expiredAt: string;
  isExpired: boolean;
  isSubmitted: boolean;
  submission: {
    id: string;
    fileUrl: string;
    submittedAt: string;
    grade: string | null;
    feedback: string | null;
  } | null;
}

function StudentModularClassroomContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const pFromUrl = searchParams.get('p');
  const urlSessionNumber = pFromUrl ? parseInt(pFromUrl, 10) : null;
  const isViewingSpecificSession = Boolean(urlSessionNumber && !isNaN(urlSessionNumber));

  const cachedCourse = dashboardCache.kelasDetail[slug];

  const cachedSession =
    urlSessionNumber && !isNaN(urlSessionNumber)
      ? dashboardCache.kelasSession[`${slug}:${urlSessionNumber}`]
      : undefined;

  const [course, setCourse] = useState<CourseDetail | null>(
    (cachedCourse?.course as CourseDetail) || null,
  );
  const [sessions, setSessions] = useState<SessionSummary[]>(
    (cachedCourse?.sessions as SessionSummary[]) || [],
  );

  // Active Session Detail (Mode 2)
  const [activeMaterials, setActiveMaterials] = useState<MaterialItem[]>(
    (cachedSession?.materials as MaterialItem[]) || [],
  );
  const [activeAssignments, setActiveAssignments] = useState<AssignmentItem[]>(
    (cachedSession?.assignments as AssignmentItem[]) || [],
  );
  const [activeSessionInfo, setActiveSessionInfo] = useState<SessionSummary | null>(
    (cachedSession?.session as SessionSummary) || null,
  );

  const [isLoadingCourse, setIsLoadingCourse] = useState(!cachedCourse);
  const [isLoadingSession, setIsLoadingSession] = useState(
    Boolean(isViewingSpecificSession && !cachedSession),
  );
  const [error, setError] = useState<string | null>(cachedCourse?.error || null);
  const [sessionError, setSessionError] = useState<string | null>(
    cachedSession?.error || null,
  );
  const [isSessionNotOpenedYet, setIsSessionNotOpenedYet] = useState(
    Boolean(cachedSession?.notOpenedYet),
  );
  const [isEnrollmentRequired, setIsEnrollmentRequired] = useState(
    Boolean(cachedCourse?.isEnrollmentRequired),
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((u) => {
      if (mounted) setCurrentUser(u);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Modal Submission Dialog State
  const [activeTaskForModal, setActiveTaskForModal] = useState<AssignmentItem | null>(null);
  const [modalFileUrl, setModalFileUrl] = useState('');
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Fetch Course Info and All Session Summaries
  const loadCourseData = useCallback(async () => {
    topProgress.start();
    try {
      const data = await loadKelasDetailCache(slug, null);
      if (data.isEnrollmentRequired) {
        setIsEnrollmentRequired(true);
        setError(data.error || 'Gagal memuat kurikulum kelas.');
      } else if (data.error) {
        setError(data.error);
      } else {
        setCourse((data.course as CourseDetail) || null);
        setSessions((data.sessions as SessionSummary[]) || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memuat kelas.';
      setError(msg);
    } finally {
      setIsLoadingCourse(false);
      topProgress.done();
    }
  }, [slug]);

  // 2. Fetch Selected Session Detail (Materials & Assignments)
  const loadSessionData = useCallback(
    async (sessionNum: number) => {
      topProgress.start();
      setIsSessionNotOpenedYet(false);
      setSessionError(null);
      try {
        const data = await loadKelasSessionCache(slug, sessionNum);
        if (data.session) {
          setActiveSessionInfo(data.session as SessionSummary);
          setActiveMaterials((data.materials as MaterialItem[]) || []);
          setActiveAssignments((data.assignments as AssignmentItem[]) || []);
        } else {
          setActiveSessionInfo(null);
          setActiveMaterials([]);
          setActiveAssignments([]);
          if (data.notOpenedYet) {
            setIsSessionNotOpenedYet(true);
          }
          setSessionError(data.error || 'Pertemuan ini belum dibuka oleh dosen/mentor.');
        }
      } catch (err: unknown) {
        console.error('Gagal memuat sesi:', err);
        setSessionError('Gagal memuat data pertemuan.');
      } finally {
        setIsLoadingSession(false);
        topProgress.done();
      }
    },
    [slug]
  );

  useEffect(() => {
    const cached = dashboardCache.kelasDetail[slug];
    if (cached) {
      setCourse((cached.course as CourseDetail) || null);
      setSessions((cached.sessions as SessionSummary[]) || []);
      setIsEnrollmentRequired(Boolean(cached.isEnrollmentRequired));
      setError(cached.error || null);
      setIsLoadingCourse(false);
      return;
    }
    loadCourseData();
  }, [slug, loadCourseData]);

  useEffect(() => {
    if (isViewingSpecificSession && urlSessionNumber) {
      const cached = dashboardCache.kelasSession[`${slug}:${urlSessionNumber}`] as {
        session?: SessionSummary | null;
        materials?: MaterialItem[];
        assignments?: AssignmentItem[];
        notOpenedYet?: boolean;
        error?: string | null;
      } | undefined;
      if (cached) {
        setActiveSessionInfo(cached.session || null);
        setActiveMaterials(cached.materials || []);
        setActiveAssignments(cached.assignments || []);
        setIsSessionNotOpenedYet(Boolean(cached.notOpenedYet));
        setSessionError(cached.error || null);
        setIsLoadingSession(false);
        return;
      }
      loadSessionData(urlSessionNumber);
    } else {
      setActiveSessionInfo(null);
      setActiveMaterials([]);
      setActiveAssignments([]);
    }
  }, [slug, isViewingSpecificSession, urlSessionNumber, loadSessionData]);

  // Buka Dialog Pengumpulan / Edit Tugas
  const handleOpenSubmitModal = (task: AssignmentItem) => {
    setActiveTaskForModal(task);
    setModalFileUrl(task.submission?.fileUrl || '');
    setModalError(null);
  };

  // Kirim / Perbarui Tugas via Dialog
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskForModal) return;

    const fileUrl = modalFileUrl.trim();
    if (!fileUrl) {
      setModalError('Harap cantumkan URL hasil pengerjaan tugas.');
      return;
    }

    setIsSubmittingModal(true);
    setModalError(null);

    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/assignments/${activeTaskForModal.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fileUrl }),
      });

      let json: { success?: boolean; message?: string } | null = null;
      try {
        json = await res.json();
      } catch {
        // Respon bukan format JSON valid
      }

      if (res.ok && json?.success) {
        toast.success(
          activeTaskForModal.isSubmitted
            ? 'Tautan tugas berhasil diperbarui!'
            : 'Tugas berhasil dikumpulkan!'
        );
        setActiveTaskForModal(null);
        setModalFileUrl('');
        // Reload data sesi
        if (urlSessionNumber) {
          loadSessionData(urlSessionNumber);
        }
        loadCourseData();
      } else {
        throw new Error(json?.message || `Gagal mengirim tugas (Status: ${res.status}).`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim tugas.';
      setModalError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const currentIndex = sessions.findIndex((s) => s.sessionNumber === urlSessionNumber);
  const prevSession = currentIndex > 0 ? sessions[currentIndex - 1] : null;
  const nextSession =
    currentIndex >= 0 && currentIndex < sessions.length - 1
      ? sessions[currentIndex + 1]
      : null;

  if (isEnrollmentRequired) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
          <Layers className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-fd-foreground">
            Akses Kelas Terkunci
          </h1>
          <p className="text-xs sm:text-sm text-fd-muted-foreground leading-relaxed max-w-md mx-auto">
            Anda belum terdaftar dalam batch aktif untuk kelas ini, atau pendaftaran Anda sedang dalam proses verifikasi pembayaran oleh dosen.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard/batch"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-fd-primary px-5 py-2.5 text-xs font-bold text-fd-primary-foreground hover:bg-fd-primary/90 transition shadow-sm"
          >
            <Layers className="size-4" />
            <span>Katalog & Pendaftaran Batch</span>
          </Link>
          <Link
            href="/dashboard/kelas"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-fd-border bg-fd-card px-5 py-2.5 text-xs font-semibold text-fd-foreground hover:bg-fd-muted transition"
          >
            <ArrowLeft className="size-4" />
            <span>Kembali ke Beranda Kelas</span>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoadingCourse || (isViewingSpecificSession && isLoadingSession)) {
    return null;
  }

  return (
    <div className="space-y-8 pb-16">
      {!isViewingSpecificSession ? (
        /* ================= MODE 1: RINGKASAN KELAS & DAFTAR PERTEMUAN (OVERVIEW) ================= */
        <>
          {/* Top Breadcrumb */}
          <DashboardBreadcrumb
            items={[
              { label: 'Semua Kelas', href: '/dashboard/kelas' },
              { label: course?.title || 'Detail Kelas' },
            ]}
          />

          {/* Course Overview Header */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-fd-border">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
                <span className="font-medium text-fd-primary">
                  Kurikulum Kelas
                </span>
                <span className="text-fd-border">&middot;</span>
                <span className="font-medium text-fd-foreground/90">
                  {sessions.length} Sesi Pertemuan Tersedia
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
                {course?.title || 'Detail Kelas'}
              </h1>

              <p className="text-sm text-fd-muted-foreground leading-relaxed max-w-3xl">
                {course?.description ||
                  'Pelajari kurikulum pembelajaran, modul materi berbasis MDX, dan kumpulkan tugas praktikum untuk kelas ini.'}
              </p>
            </div>

            {currentUser?.role === 'admin' && (
              <Link
                href={`/dashboard/dosen/kelas/${course?.slug || slug}`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'gap-1.5 shrink-0 text-xs shadow-2xs self-start sm:self-auto font-medium'
                )}
                title="Kelola & Edit Materi Kelas (Admin)"
              >
                <Pencil className="size-3.5" />
                <span>Edit Materi (Admin)</span>
              </Link>
            )}
          </header>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle className="text-sm font-bold">Terjadi Kesalahan</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          ) : sessions.length === 0 ? (
            <div className="p-10 rounded-xl border border-dashed border-fd-border bg-fd-card/50 text-center space-y-4">
              <div className="size-12 rounded-xl bg-fd-primary/10 text-fd-primary flex items-center justify-center mx-auto border border-fd-primary/20">
                <BookOpen className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-fd-foreground">
                  Belum Ada Sesi Pertemuan yang Dibuka
                </h3>
                <p className="text-xs sm:text-sm text-fd-muted-foreground max-w-md mx-auto leading-relaxed">
                  Dosen atau mentor belum membuka sesi kelas / presensi untuk kelas ini. Sesi pertemuan akan otomatis muncul di sini setelah dibuka oleh mentor.
                </p>
              </div>
            </div>
          ) : (
            <main className="space-y-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-fd-foreground">
                  Daftar Sesi Pertemuan
                </h2>
                <p className="text-xs text-fd-muted-foreground mt-0.5">
                  Pilih sesi pertemuan untuk mempelajari modul materi MDX dan tugas praktikum.
                </p>
              </div>

              {/* Grid Card Pertemuan (Single-Layer Card) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:border-fd-primary/40 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md border border-fd-border bg-fd-muted/50 font-mono text-xs font-semibold text-fd-foreground">
                          Pertemuan {sess.sessionNumber.toString().padStart(2, '0')}
                        </span>
                      </div>

                      <h3 className="font-semibold text-base text-fd-foreground group-hover:text-fd-primary transition-colors line-clamp-2 leading-snug">
                        <Link
                          href={`/dashboard/kelas/${slug}?p=${sess.sessionNumber}`}
                          className="focus-visible:outline-none focus-visible:underline before:absolute before:inset-0 before:z-10"
                        >
                          {sess.title}
                        </Link>
                      </h3>

                      <p className="text-fd-muted-foreground text-xs leading-relaxed mt-2 line-clamp-2">
                        {sess.description || 'Belum ada ringkasan materi untuk sesi pertemuan ini.'}
                      </p>
                    </div>

                    <div className="pt-4 mt-5 border-t border-fd-border/60 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-fd-muted-foreground font-medium">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="size-3.5 text-fd-primary shrink-0" />
                          <span>{sess.materialsCount || 0} Materi</span>
                        </span>
                        <span className="text-fd-border">&middot;</span>
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="size-3.5 text-fd-primary shrink-0" />
                          <span>{sess.assignmentsCount || 0} Tugas</span>
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1 text-xs font-semibold text-fd-primary group-hover:translate-x-0.5 transition-transform">
                        <span>Buka</span>
                        <ChevronRight className="size-3.5 shrink-0" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          )}
        </>
      ) : (
        /* ================= MODE 2: DETAIL SESI PERTEMUAN TERTENTU (?p=...) ================= */
        <>
          {!activeSessionInfo ? (
            <div className="p-8 rounded-2xl border border-fd-border bg-fd-card text-center space-y-4 max-w-lg mx-auto my-8">
              <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <AlertCircle className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-fd-foreground">
                  {isSessionNotOpenedYet
                    ? `Pertemuan P${urlSessionNumber} Belum Dibuka`
                    : `Pertemuan P${urlSessionNumber} Tidak Ditemukan`}
                </h3>
                <p className="text-xs sm:text-sm text-fd-muted-foreground max-w-md mx-auto leading-relaxed">
                  {isSessionNotOpenedYet
                    ? 'Pertemuan ini belum dibuka oleh dosen/mentor. Pertemuan dan modul materi akan aktif setelah dosen membuka sesi presensi kelas.'
                    : sessionError || 'Sesi pertemuan yang Anda cari tidak tersedia atau mungkin belum diterbitkan.'}
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href={`/dashboard/kelas/${slug}`}
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-fd-primary text-fd-primary-foreground text-xs sm:text-sm font-semibold hover:bg-fd-primary/90 transition-colors shadow-2xs"
                >
                  <ArrowLeft className="size-4" />
                  <span>Kembali ke Ringkasan Kelas</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Top Breadcrumb & Header */}
              <div className="space-y-4">
                <DashboardBreadcrumb
                  items={[
                    { label: 'Semua Kelas', href: '/dashboard/kelas' },
                    { label: course?.title || 'Kelas', href: `/dashboard/kelas/${slug}` },
                    { label: activeSessionInfo?.title || `Pertemuan ${urlSessionNumber}` },
                  ]}
                />

                <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-fd-border/50">
                  <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-fd-foreground leading-tight">
                      {activeSessionInfo?.title || `Pertemuan ${urlSessionNumber}`}
                    </h1>
                    {activeSessionInfo?.description && (
                      <p className="text-sm sm:text-base text-fd-muted-foreground leading-relaxed max-w-3xl">
                        {activeSessionInfo.description}
                      </p>
                    )}
                  </div>

                  {currentUser?.role === 'admin' && (
                    <Link
                      href={`/dashboard/dosen/kelas/${slug}?p=${urlSessionNumber}`}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'gap-1.5 shrink-0 text-xs shadow-2xs self-start sm:self-auto font-medium'
                      )}
                      title="Edit Sesi & Materi di Studio Dosen"
                    >
                      <Pencil className="size-3.5" />
                      <span>Edit di Studio Dosen</span>
                    </Link>
                  )}
                </header>
              </div>

              <main className="space-y-10">
              {/* 1. SEKSI MATERI PERTEMUAN (MDX) */}
              <section className="space-y-8">
                {activeMaterials.length === 0 ? (
                  <p className="py-8 text-sm text-fd-muted-foreground italic">
                    Belum ada materi pembelajaran yang diunggah untuk pertemuan ini.
                  </p>
                ) : (
                  activeMaterials.map((mat) => (
                    <article key={mat.id} className="space-y-4">
                      {activeMaterials.length > 1 && (
                        <h2 className="text-xl font-bold tracking-tight text-fd-foreground pt-4 border-b border-fd-border/30 pb-2">
                          {mat.title}
                        </h2>
                      )}
                      {mat.fileUrl && (
                        <div>
                          <a
                            href={mat.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-fd-primary hover:underline underline-offset-4"
                          >
                            <Download className="size-3.5" />
                            <span>Unduh lampiran berkas ({mat.title})</span>
                          </a>
                        </div>
                      )}

                      {/* RENDER KONTEN MDX DINAMIS */}
                      <DynamicMDXRenderer content={mat.contentMdx} />
                    </article>
                  ))
                )}
              </section>

              {/* 2. SEKSI TUGAS PERTEMUAN (MDX) */}
              {activeAssignments.length > 0 && (
                <section className="space-y-8 pt-10 border-t border-fd-border/60">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-fd-foreground">
                      Tugas & Praktikum
                    </h2>
                    <p className="text-sm text-fd-muted-foreground mt-1">
                      Instruksi dan batas waktu pengumpulan tugas untuk pertemuan ini.
                    </p>
                  </div>

                  <div className="space-y-8">
                    {activeAssignments.map((task) => {
                      const isGraded =
                        task.submission?.grade !== null && task.submission?.grade !== undefined;
                      return (
                        <div
                          key={task.id}
                          className="space-y-4 border-l-2 border-fd-border pl-5 py-1"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="text-lg font-bold text-fd-foreground">
                                {task.title}
                              </h3>
                              {task.isSubmitted ? (
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  &bull; Sudah dikumpulkan
                                </span>
                              ) : task.isExpired ? (
                                <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                  &bull; Batas waktu terlewati
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-fd-muted-foreground">
                                  &bull; Belum dikumpulkan
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-fd-muted-foreground">
                              Tenggat:{' '}
                              {new Date(task.expiredAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>

                          {isGraded && (
                            <div className="text-sm font-medium text-fd-foreground">
                              Nilai:{' '}
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {task.submission?.grade}
                              </span>
                              {task.submission?.feedback && (
                                <p className="text-xs text-fd-muted-foreground mt-0.5">
                                  Catatan pengajar: {task.submission.feedback}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Instruksi Tugas (Format MDX) */}
                          {task.description && (
                            <DynamicMDXRenderer content={task.description} />
                          )}

                          {/* Bagian Pengumpulan Jawaban */}
                          <div className="pt-2">
                            {task.isExpired ? (
                              task.isSubmitted ? (
                                <div className="rounded-xl border border-fd-border/70 bg-fd-card/40 p-4 text-xs space-y-2 max-w-lg">
                                  <p className="font-semibold text-fd-foreground">
                                    Tautan Tugas yang Dikumpulkan:
                                  </p>
                                  <div>
                                    <a
                                      href={task.submission?.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-xs text-fd-primary hover:underline inline-flex items-center gap-1 break-all"
                                    >
                                      <span>{task.submission?.fileUrl}</span>
                                      <ExternalLink className="size-3 shrink-0" />
                                    </a>
                                  </div>
                                  <p className="text-[11px] text-fd-muted-foreground pt-1.5 border-t border-fd-border/40">
                                    Tenggat waktu pengumpulan telah berakhir. Pengumpulan dikunci.
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-rose-600 dark:text-rose-400">
                                  Batas waktu pengumpulan tugas ini telah berakhir.
                                </p>
                              )
                            ) : task.isSubmitted ? (
                              <div className="rounded-xl border border-fd-border/70 bg-fd-card/40 p-4 text-xs space-y-3 max-w-lg">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-[11px] text-fd-muted-foreground">
                                      Tautan pengerjaan:
                                    </span>
                                    <a
                                      href={task.submission?.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-xs text-fd-primary hover:underline inline-flex items-center gap-1 break-all mt-0.5"
                                    >
                                      <span className="truncate">{task.submission?.fileUrl}</span>
                                      <ExternalLink className="size-3 shrink-0" />
                                    </a>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenSubmitModal(task)}
                                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-fd-border bg-fd-background px-3.5 py-1.5 text-xs font-semibold text-fd-foreground transition-colors hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring cursor-pointer shrink-0"
                                  >
                                    <Pencil className="size-3 text-fd-muted-foreground" />
                                    <span>Edit Jawaban</span>
                                  </button>
                                </div>

                                {task.submission?.submittedAt && (
                                  <p className="text-[11px] text-fd-muted-foreground border-t border-fd-border/40 pt-2">
                                    Terakhir dikirim:{' '}
                                    {formatSubmissionDate(task.submission.submittedAt)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSubmitModal(task)}
                                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-fd-primary px-4 py-2 text-xs font-semibold text-fd-primary-foreground hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring cursor-pointer"
                                >
                                  <Send className="size-3.5" />
                                  <span>Kumpulkan Tugas</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* BOTTOM PAGINATION: Pindah Sesi dengan Mudah */}
              <nav
                aria-label="Navigasi Pertemuan"
                className="flex items-center justify-between pt-10 border-t border-fd-border/50"
              >
                {prevSession ? (
                  <Link
                    href={`/dashboard/kelas/${slug}?p=${prevSession.sessionNumber}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground hover:text-fd-foreground transition-colors"
                  >
                    <ChevronLeft className="size-4" />
                    <span>
                      P{prevSession.sessionNumber}: {prevSession.title}
                    </span>
                  </Link>
                ) : (
                  <div />
                )}

                {nextSession && (
                  <Link
                    href={`/dashboard/kelas/${slug}?p=${nextSession.sessionNumber}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground hover:text-fd-foreground transition-colors ml-auto"
                  >
                    <span>
                      P{nextSession.sessionNumber}: {nextSession.title}
                    </span>
                    <ChevronRight className="size-4" />
                  </Link>
                )}
              </nav>

              {/* Dialog Modal Pengumpulan / Edit Tugas */}
              <Dialog
                open={activeTaskForModal !== null}
                onOpenChange={(open) => {
                  if (!open && !isSubmittingModal) {
                    setActiveTaskForModal(null);
                    setModalFileUrl('');
                    setModalError(null);
                  }
                }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {activeTaskForModal?.isSubmitted ? 'Edit Tautan Tugas' : 'Kumpulkan Tugas'}
                    </DialogTitle>
                    <DialogDescription>
                      {activeTaskForModal?.title || 'Pengumpulan tugas praktikum'}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleModalSubmit} className="space-y-4 pt-2">
                    {modalError && (
                      <div className="rounded-lg bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400 border border-red-500/20">
                        {modalError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="modal-assignment-url">
                        Tautan Hasil Pengerjaan (GitHub repo atau Google Drive)
                      </Label>
                      <Input
                        id="modal-assignment-url"
                        type="url"
                        placeholder="https://github.com/username/repo"
                        value={modalFileUrl}
                        onChange={(e) => {
                          setModalFileUrl(e.target.value);
                          if (modalError) setModalError(null);
                        }}
                        required
                        autoFocus
                        className="text-xs"
                      />
                      <p className="text-[11px] text-fd-muted-foreground">
                        Pastikan izin berkas dapat diakses publik atau izin repositori/drive sudah dibuka untuk pengajar.
                      </p>
                    </div>

                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTaskForModal(null)}
                        disabled={isSubmittingModal}
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmittingModal || !modalFileUrl.trim()}
                      >
                        {isSubmittingModal && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                        <span>
                          {activeTaskForModal?.isSubmitted ? 'Simpan Perubahan' : 'Kirim Tugas'}
                        </span>
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </main>
          </>
        )}
      </>
    )}
  </div>
  );
}

export default function StudentModularClassroomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <Suspense fallback={null}>
      <StudentModularClassroomContent slug={slug} />
    </Suspense>
  );
}
