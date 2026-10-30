'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Layers,
  GraduationCap,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  FileText,
  Paperclip,
  HeartPulse,
} from 'lucide-react';
import { fetchCurrentUser, getAuthToken, type AuthUser } from '@/lib/auth';
import { useMounted } from '@/lib/use-mounted';
import {
  dashboardCache,
  loadPresensiCache,
  loadPresensiDetailCache,
  topProgress,
} from '@/lib/dashboard-navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { DashboardBreadcrumb } from '@/components/dashboard/dashboard-breadcrumb';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

interface StudentEnrollmentItem {
  enrollmentId: string;
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  mentorName: string | null;
  status: string;
}

interface ActiveSessionData {
  id: string;
  batchId: string;
  sessionNumber: number;
  tokenCode: string;
  expiresAt: string;
}

interface StudentSessionHistory {
  sessionId: string;
  sessionNumber: number;
  attended: boolean;
  status: string | null; // 'present' | 'permission' | 'sick' | 'absent'
  note: string | null;
  attachmentUrl: string | null;
  checkedInAt: string | null;
  channel: string | null;
  isExpired: boolean;
  isActive: boolean;
  createdAt: string;
}

function formatDateIndo(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatShortTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function SiswaPresensiContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const mounted = useMounted();
  const cachedIndex = dashboardCache.presensiIndex;

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => cachedIndex?.user ?? null);
  const [isLoadingUser, setIsLoadingUser] = useState(() => !cachedIndex);

  // Daftar kelas / enrollment siswa
  const [enrollments, setEnrollments] = useState<StudentEnrollmentItem[]>(
    () => cachedIndex?.enrollments ?? []
  );
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(() => !cachedIndex);
  const [isRefreshingEnrollments, setIsRefreshingEnrollments] = useState(false);

  // Pemetaan sesi aktif per batchId
  const [activeSessionsByBatch, setActiveSessionsByBatch] = useState<
    Record<string, ActiveSessionData | null>
  >(() => cachedIndex?.activeSessionsByBatch ?? {});

  // Selected enrollment
  const selectedEnrollment = useMemo(() => {
    if (!idParam) return null;
    return (
      enrollments.find(
        (e) =>
          e.enrollmentId === idParam ||
          e.batchId === idParam ||
          e.courseId === idParam ||
          e.courseSlug === idParam
      ) || null
    );
  }, [enrollments, idParam]);

  const cachedDetail = selectedEnrollment
    ? dashboardCache.presensiDetail[selectedEnrollment.batchId]
    : null;

  // Sesi aktif & riwayat
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(
    () => cachedDetail?.activeSession ?? null
  );
  const [isLoadingActiveSession, setIsLoadingActiveSession] = useState(false);
  const [historyList, setHistoryList] = useState<StudentSessionHistory[]>(
    () => cachedDetail?.historyList ?? []
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Modal 1: Presensi Hadir
  const [isOpenAttendDialog, setIsOpenAttendDialog] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isSubmittingToken, setIsSubmittingToken] = useState(false);

  // Modal 2: Izin / Sakit
  const [isOpenPermitDialog, setIsOpenPermitDialog] = useState(false);
  const [permitType, setPermitType] = useState<'permission' | 'sick'>('permission');
  const [permitReason, setPermitReason] = useState('');
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [isSubmittingPermit, setIsSubmittingPermit] = useState(false);

  const [copiedDiscord, setCopiedDiscord] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1 & 2. Load daftar kelas + user
  const loadStudentEnrollments = useCallback(
    async (isSilent = false) => {
      if (isSilent) {
        setIsRefreshingEnrollments(true);
      } else if (!dashboardCache.presensiIndex) {
        setIsLoadingEnrollments(true);
        setIsLoadingUser(true);
      }
      topProgress.start();
      try {
        const data = await loadPresensiCache(idParam);
        setCurrentUser(data.user);
        setEnrollments(data.enrollments);
        setActiveSessionsByBatch(data.activeSessionsByBatch);
      } catch {
        toast.error('Gagal mengambil daftar kelas.');
      } finally {
        setIsLoadingUser(false);
        setIsLoadingEnrollments(false);
        setIsRefreshingEnrollments(false);
        topProgress.done();
      }
    },
    [idParam]
  );

  useEffect(() => {
    if (mounted && !dashboardCache.presensiIndex) {
      loadStudentEnrollments();
    }
  }, [mounted, loadStudentEnrollments]);

  // 3. Load active session & history
  const loadClassAttendanceData = useCallback(
    async (isSilent = false) => {
      if (!selectedEnrollment) {
        setActiveSession(null);
        setHistoryList([]);
        return;
      }

      const existingDetail = dashboardCache.presensiDetail[selectedEnrollment.batchId];
      if (!isSilent && existingDetail) {
        setActiveSession(existingDetail.activeSession);
        setHistoryList(existingDetail.historyList);
        return;
      }

      if (!existingDetail) {
        setIsLoadingActiveSession(true);
      }
      topProgress.start();
      try {
        const detail = await loadPresensiDetailCache(selectedEnrollment.batchId);
        setActiveSession(detail.activeSession);
        setHistoryList(detail.historyList);
      } catch {
        console.error('Gagal memuat status presensi.');
      } finally {
        setIsLoadingActiveSession(false);
        setIsLoadingHistory(false);
        topProgress.done();
      }
    },
    [selectedEnrollment]
  );

  useEffect(() => {
    if (selectedEnrollment) {
      loadClassAttendanceData();
    }
  }, [selectedEnrollment, loadClassAttendanceData]);

  // 4. Submit Token Presensi
  async function handleSubmitAttendance(e: React.FormEvent) {
    e.preventDefault();
    const cleanToken = tokenInput.trim().toUpperCase();
    if (!cleanToken) {
      toast.error('Masukkan kode token presensi.');
      return;
    }

    setIsSubmittingToken(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: cleanToken }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal mencatat presensi.');
      }

      toast.success(json.message || 'Presensi berhasil dicatat.');
      setTokenInput('');
      setIsOpenAttendDialog(false);
      await loadClassAttendanceData(true);
      await loadStudentEnrollments(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat mengirim presensi.';
      toast.error(msg);
    } finally {
      setIsSubmittingToken(false);
    }
  }

  // 5. Submit Izin / Sakit
  async function handleSubmitPermit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEnrollment || !activeSession) return;

    if (!permitReason.trim()) {
      toast.error('Harap sertakan alasan izin atau sakit.');
      return;
    }

    setIsSubmittingPermit(true);
    try {
      const token = getAuthToken();
      let attachmentUrl: string | null = null;

      if (permitFile) {
        const formData = new FormData();
        formData.append('file', permitFile);

        const uploadRes = await fetch(`${apiUrl}/v1/attendance/upload-proof`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok || !uploadJson.success) {
          throw new Error(uploadJson.message || 'Gagal mengunggah surat keterangan.');
        }

        attachmentUrl = uploadJson.data.url;
      }

      const permitRes = await fetch(`${apiUrl}/v1/attendance/permit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          batchId: selectedEnrollment.batchId,
          sessionNumber: activeSession.sessionNumber,
          status: permitType,
          note: permitReason.trim(),
          attachmentUrl,
        }),
      });

      const permitJson = await permitRes.json();
      if (!permitRes.ok || !permitJson.success) {
        throw new Error(permitJson.message || 'Gagal mengirim permohonan izin.');
      }

      const label = permitType === 'sick' ? 'Sakit' : 'Izin';
      toast.success(`Keterangan ${label} berhasil dikirim.`);
      setIsOpenPermitDialog(false);
      setPermitReason('');
      setPermitFile(null);
      await loadClassAttendanceData(true);
      await loadStudentEnrollments(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengajukan izin.';
      toast.error(msg);
    } finally {
      setIsSubmittingPermit(false);
    }
  }

  const handleCopyDiscord = () => {
    navigator.clipboard.writeText('/presensi kode:KDG-XXXX');
    setCopiedDiscord(true);
    toast.success('Format perintah disalin.');
    setTimeout(() => setCopiedDiscord(false), 2000);
  };

  // Metrik kehadiran
  const attendanceRate = useMemo(() => {
    if (historyList.length === 0) return 100;
    const attendedCount = historyList.filter(
      (h) => h.status === 'present' || h.attended
    ).length;
    return Math.round((attendedCount / historyList.length) * 100);
  }, [historyList]);

  // Cek catatan presensi sesi aktif
  const currentSessionRecord = useMemo(() => {
    if (!activeSession) return null;
    return historyList.find((h) => h.sessionNumber === activeSession.sessionNumber) || null;
  }, [activeSession, historyList]);

  const hasSubmittedAttendance = useMemo(() => {
    if (!currentSessionRecord) return false;
    return Boolean(
      currentSessionRecord.attended ||
        currentSessionRecord.status === 'present' ||
        currentSessionRecord.status === 'permission' ||
        currentSessionRecord.status === 'sick'
    );
  }, [currentSessionRecord]);

  if (!mounted || isLoadingUser || isLoadingEnrollments) {
    return null;
  }

  // Empty state jika siswa belum terdaftar kelas
  if (enrollments.length === 0) {
    return (
      <div className="space-y-8 pb-16">
        <header className="space-y-1.5 pb-5 border-b border-fd-border/50">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
            Presensi Sesi
          </h1>
          <p className="text-xs sm:text-sm text-fd-muted-foreground">
            Konfirmasi kehadiran pertemuan kelas bootcamp Anda.
          </p>
        </header>

        <Empty className="py-12 border border-fd-border bg-fd-card shadow-2xs">
          <EmptyMedia variant="icon">
            <Layers className="size-4 text-fd-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-semibold">Belum Terdaftar di Kelas Aktif</EmptyTitle>
            <EmptyDescription className="text-xs">
              Anda belum memiliki batch kelas yang aktif atau pendaftaran Anda masih dalam tahap verifikasi.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/dashboard/batch"
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              <Layers className="size-3.5" />
              <span>Lihat Batch Pendaftaran</span>
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  /* =========================================================================================
     VIEW 2: DETAIL SESI BELAJAR (?id=...) — EDITORIAL / WORKSPACE MINIMALIST LAYOUT
     ========================================================================================= */
  if (selectedEnrollment) {
    const sessionNum = activeSession
      ? activeSession.sessionNumber
      : historyList.length > 0
      ? historyList[historyList.length - 1].sessionNumber
      : 1;

    return (
      <div className="space-y-8 pb-16 max-w-5xl">
        {/* Standard Breadcrumb */}
        <DashboardBreadcrumb
          items={[
            { label: 'Semua Kelas', href: '/dashboard/siswa/presensi' },
            { label: selectedEnrollment.courseTitle },
          ]}
        />

        {/* Minimalist Editorial Header */}
        <header className="space-y-3 pb-6 border-b border-fd-border/50">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fd-foreground">
                  Pertemuan {sessionNum}
                </h1>
                {activeSession && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs gap-1.5 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Sesi Berlangsung</span>
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-fd-muted-foreground">
                {selectedEnrollment.courseTitle} &middot; {selectedEnrollment.batchName} &middot; Mentor: {selectedEnrollment.mentorName || 'Tim Mentor'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadClassAttendanceData(true)}
              disabled={isLoadingActiveSession}
              className="text-xs h-8 gap-1.5 shadow-none self-start sm:self-auto border-fd-border/70"
            >
              <RefreshCw className={`size-3 ${isLoadingActiveSession ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </Button>
          </div>
        </header>

        {/* BENTO CARDS: METADATA & STATUS SESI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Status Kehadiran Sesi Ini */}
          <div className="p-5 rounded-xl border border-fd-border/70 bg-fd-card space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-fd-muted-foreground block">
                Status Presensi Sesi Ini
              </span>
              <div className="pt-1">
                {currentSessionRecord?.status === 'present' || currentSessionRecord?.attended ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                    <CheckCircle2 className="size-3.5" />
                    <span>Hadir</span>
                  </div>
                ) : currentSessionRecord?.status === 'permission' ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
                    <FileText className="size-3.5" />
                    <span>Izin Berhalangan</span>
                  </div>
                ) : currentSessionRecord?.status === 'sick' ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold">
                    <HeartPulse className="size-3.5" />
                    <span>Sakit</span>
                  </div>
                ) : activeSession ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
                    <Clock className="size-3.5" />
                    <span>Belum Konfirmasi</span>
                  </div>
                ) : (
                  <div className="text-xs text-fd-muted-foreground">
                    Belum ada sesi aktif
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-fd-muted-foreground font-mono pt-2 border-t border-fd-border/40">
              {currentSessionRecord?.checkedInAt
                ? `Tercatat: ${formatShortTime(currentSessionRecord.checkedInAt)} WIB`
                : activeSession
                ? `Batas: ${formatShortTime(activeSession.expiresAt)} WIB`
                : '-'}
            </div>
          </div>

          {/* Card 2: Jadwal & Format Belajar */}
          <div className="p-5 rounded-xl border border-fd-border/70 bg-fd-card space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-fd-muted-foreground block">
                Jadwal &amp; Metode
              </span>
              <p className="text-xs font-medium text-fd-foreground pt-1">
                {formatDateIndo(new Date().toISOString())}
              </p>
            </div>
            <div className="text-[11px] text-fd-muted-foreground pt-2 border-t border-fd-border/40 flex items-center justify-between">
              <span>Format</span>
              <span className="font-medium text-fd-foreground">Live Daring &amp; Discord</span>
            </div>
          </div>

          {/* Card 3: Rekapitulasi Kehadiran */}
          <div className="p-5 rounded-xl border border-fd-border/70 bg-fd-card space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-fd-muted-foreground block">
                Tingkat Kehadiran Kelas
              </span>
              <p className="text-2xl font-bold font-mono tracking-tight text-fd-foreground pt-0.5">
                {attendanceRate}%
              </p>
            </div>
            <div className="text-[11px] text-fd-muted-foreground pt-2 border-t border-fd-border/40 flex items-center justify-between">
              <span>Total Sesi Terselenggara</span>
              <span className="font-mono text-fd-foreground font-medium">{historyList.length} Sesi</span>
            </div>
          </div>
        </div>

        {/* ACTION ROW: TOMBOL PRESENSI & IZIN (HANYA MUNCUL DI SINI JIKA BELUM PRESENSI) */}
        {activeSession && !hasSubmittedAttendance && (
          <div className="p-5 rounded-xl border border-fd-border bg-fd-card/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-fd-foreground">
                Presensi Sesi Pertemuan {activeSession.sessionNumber}
              </h2>
              <p className="text-xs text-fd-muted-foreground">
                Mentor sedang membuka presensi. Konfirmasi kehadiran Anda sebelum {formatShortTime(activeSession.expiresAt)} WIB.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                type="button"
                variant="default"
                onClick={() => setIsOpenAttendDialog(true)}
                className="h-9 px-4 text-xs font-medium gap-1.5"
              >
                <CalendarCheck className="size-3.5" />
                <span>Presensi Sekarang</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpenPermitDialog(true)}
                className="h-9 px-3.5 text-xs font-medium border-fd-border/80 hover:bg-fd-muted transition gap-1.5"
              >
                <FileText className="size-3.5 text-fd-muted-foreground" />
                <span>Izin / Sakit</span>
              </Button>
            </div>
          </div>
        )}

        {/* CATATAN / FEEDBACK JIKA SUDAH PRESENSI */}
        {hasSubmittedAttendance && (
          <div className="p-4 rounded-xl border border-fd-border/60 bg-fd-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-fd-foreground">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>
                Presensi Anda untuk sesi ini telah tercatat (
                {currentSessionRecord?.status === 'sick'
                  ? 'Sakit'
                  : currentSessionRecord?.status === 'permission'
                  ? 'Izin'
                  : 'Hadir'}
                ).
              </span>
              {currentSessionRecord?.attachmentUrl && (
                <a
                  href={currentSessionRecord.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fd-primary hover:underline ml-1 inline-flex items-center gap-1 font-medium"
                >
                  <Paperclip className="size-3" />
                  <span>Surat Lampiran</span>
                </a>
              )}
            </div>

            {activeSession && (
              <button
                type="button"
                onClick={() => setIsOpenPermitDialog(true)}
                className="text-[11px] text-fd-muted-foreground hover:text-fd-foreground underline cursor-pointer self-start sm:self-auto"
              >
                Ubah Keterangan Izin/Sakit
              </button>
            )}
          </div>
        )}

        {/* TABEL RIWAYAT PERTEMUAN KELAS (DOCUMENT TABLE) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-fd-foreground">
              Riwayat Pertemuan Sesi
            </h2>
            <Link
              href={`/dashboard/kelas/${selectedEnrollment.courseSlug}`}
              className="text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors inline-flex items-center gap-1"
            >
              <span>Materi & Tugas Kelas</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>

          {historyList.length === 0 ? (
            <Empty className="py-8 border border-dashed border-fd-border bg-fd-card/30">
              <EmptyMedia variant="icon">
                <CalendarCheck className="size-4 text-fd-muted-foreground" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-sm font-semibold">Belum Ada Sesi Presensi</EmptyTitle>
                <EmptyDescription className="text-xs">
                  Sesi presensi akan muncul otomatis setelah mentor membuka pertemuan pertama kelas Anda.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-xl border border-fd-border/70 overflow-hidden bg-fd-card shadow-2xs">
              <Table className="text-xs">
                <TableHeader className="bg-fd-muted/30">
                  <TableRow className="border-b border-fd-border/60">
                    <TableHead className="w-16">Sesi</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyList.map((hist) => (
                    <TableRow key={hist.sessionId} className="hover:bg-fd-muted/10 transition-colors">
                      <TableCell className="font-semibold text-fd-foreground font-mono">
                        P{hist.sessionNumber}
                      </TableCell>
                      <TableCell className="text-fd-muted-foreground">
                        {new Date(hist.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-fd-muted-foreground font-mono">
                        {hist.checkedInAt ? formatShortTime(hist.checkedInAt) : '-'}
                      </TableCell>
                      <TableCell className="text-fd-muted-foreground max-w-xs truncate">
                        {hist.note ? (
                          <span className="italic">{hist.note}</span>
                        ) : (
                          <span className="text-fd-muted-foreground/40">-</span>
                        )}
                        {hist.attachmentUrl && (
                          <a
                            href={hist.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-fd-primary hover:underline font-medium inline-flex items-center gap-0.5"
                          >
                            <Paperclip className="size-3" />
                            <span>Surat</span>
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {hist.status === 'present' || hist.attended ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            Hadir
                          </Badge>
                        ) : hist.status === 'permission' ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                            Izin
                          </Badge>
                        ) : hist.status === 'sick' ? (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                            Sakit
                          </Badge>
                        ) : hist.isActive ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            Sesi Aktif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-fd-muted-foreground border-fd-border">
                            Tidak Hadir
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* DIALOG 1: KONFIRMASI KEHADIRAN (TOKEN) */}
        <Dialog open={isOpenAttendDialog} onOpenChange={setIsOpenAttendDialog}>
          <DialogContent className="sm:max-w-sm rounded-xl">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-bold text-fd-foreground">
                Presensi Kehadiran
              </DialogTitle>
              <DialogDescription className="text-xs text-fd-muted-foreground">
                Masukkan kode token presensi pertemuan {activeSession?.sessionNumber} dari mentor.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitAttendance} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Input
                  id="tokenInputModal"
                  placeholder="KODE TOKEN"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  className="font-mono tracking-widest text-center text-base h-11 bg-fd-muted/20 border-fd-border focus-visible:ring-1 focus-visible:ring-fd-foreground font-semibold uppercase"
                  maxLength={12}
                  required
                  autoFocus
                />
                <p className="text-[10px] text-fd-muted-foreground text-center">
                  Tidak membedakan huruf besar atau kecil.
                </p>
              </div>

              {/* Bot discord helper */}
              <div className="p-2.5 rounded-lg border border-fd-border/60 bg-fd-muted/20 flex items-center justify-between text-xs">
                <span className="text-[11px] text-fd-muted-foreground">Perintah bot Discord:</span>
                <button
                  type="button"
                  onClick={handleCopyDiscord}
                  className="text-[11px] font-mono text-fd-primary hover:underline cursor-pointer"
                >
                  {copiedDiscord ? 'Tersalin' : '/presensi kode:XXXX'}
                </button>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpenAttendDialog(false)}
                  disabled={isSubmittingToken}
                  className="text-xs h-8"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingToken || tokenInput.trim().length < 3}
                  className="text-xs h-8 font-medium bg-fd-foreground text-fd-background hover:opacity-90"
                >
                  {isSubmittingToken ? 'Memverifikasi...' : 'Kirim Presensi'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOG 2: PENGAJUAN IZIN / SAKIT (DRAG & DROP) */}
        <Dialog open={isOpenPermitDialog} onOpenChange={setIsOpenPermitDialog}>
          <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-bold text-fd-foreground">
                Pengajuan Izin / Sakit
              </DialogTitle>
              <DialogDescription className="text-xs text-fd-muted-foreground">
                Berhalangan mengikuti Sesi Pertemuan {activeSession?.sessionNumber}? Isi keterangan di bawah ini.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitPermit} className="space-y-3.5 pt-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-fd-muted-foreground">
                  Jenis Halangan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPermitType('permission')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition cursor-pointer text-center ${
                      permitType === 'permission'
                        ? 'border-fd-foreground bg-fd-foreground text-fd-background'
                        : 'border-fd-border bg-fd-card text-fd-muted-foreground hover:text-fd-foreground'
                    }`}
                  >
                    Izin
                  </button>

                  <button
                    type="button"
                    onClick={() => setPermitType('sick')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition cursor-pointer text-center ${
                      permitType === 'sick'
                        ? 'border-fd-foreground bg-fd-foreground text-fd-background'
                        : 'border-fd-border bg-fd-card text-fd-muted-foreground hover:text-fd-foreground'
                    }`}
                  >
                    Sakit
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="permitReasonInput" className="text-[11px] font-medium text-fd-muted-foreground">
                  Keterangan / Alasan
                </label>
                <Textarea
                  id="permitReasonInput"
                  placeholder="Tuliskan alasan singkat..."
                  value={permitReason}
                  onChange={(e) => setPermitReason(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-fd-muted-foreground">
                  Lampiran Surat Dokter / Bukti (Opsional)
                </label>
                <FileDropzone
                  onFileSelect={setPermitFile}
                  selectedFile={permitFile}
                  onClear={() => setPermitFile(null)}
                  disabled={isSubmittingPermit}
                  helperText="Format: PNG, JPG, PDF (Maks. 5MB)"
                />
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpenPermitDialog(false)}
                  disabled={isSubmittingPermit}
                  className="text-xs h-8"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingPermit || !permitReason.trim()}
                  className="text-xs h-8 font-medium bg-fd-foreground text-fd-background hover:opacity-90"
                >
                  {isSubmittingPermit ? 'Mengirim...' : 'Kirim Keterangan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* =========================================================================================
     VIEW 1: DAFTAR KELAS BOOTCAMP (INDEX) — CLEAN BENTO GRID
     ========================================================================================= */
  return (
    <div className="space-y-8 pb-16 max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4 pb-5 border-b border-fd-border/50">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
            Presensi Sesi
          </h1>
          <p className="text-xs sm:text-sm text-fd-muted-foreground">
            Pilih kelas untuk memeriksa jadwal sesi dan mengonfirmasi kehadiran.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadStudentEnrollments(true)}
          disabled={isLoadingEnrollments || isRefreshingEnrollments}
          className="text-xs h-8 gap-1.5 shadow-none self-start sm:self-auto border-fd-border/70"
        >
          <RefreshCw className={cn('size-3', isRefreshingEnrollments && 'animate-spin')} />
          <span>Periksa Sesi Baru</span>
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {enrollments.map((enr) => {
          const hasActiveSession = Boolean(activeSessionsByBatch[enr.batchId]);
          const activeSessionInfo = activeSessionsByBatch[enr.batchId];

          return (
            <Link
              key={enr.enrollmentId}
              href={`/dashboard/siswa/presensi?id=${enr.enrollmentId}`}
              className="group flex flex-col justify-between rounded-xl border border-fd-border/70 bg-fd-card p-5 transition-all hover:border-fd-foreground/40"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-fd-muted-foreground uppercase tracking-wide">
                    {enr.batchName}
                  </span>

                  {hasActiveSession ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1.5 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                      <span>Sesi P{activeSessionInfo?.sessionNumber} Dibuka</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-fd-muted-foreground border-fd-border font-normal">
                      Tidak ada sesi aktif
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-base text-fd-foreground group-hover:text-fd-primary transition-colors line-clamp-2">
                    {enr.courseTitle}
                  </h3>
                  <p className="text-xs text-fd-muted-foreground mt-1">
                    Mentor: {enr.mentorName || 'Tim Mentor'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-fd-border/40 flex items-center justify-between text-xs text-fd-muted-foreground">
                <span className="text-[11px]">Buka presensi sesi</span>
                <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function SiswaPresensiPage() {
  return (
    <Suspense fallback={null}>
      <SiswaPresensiContent />
    </Suspense>
  );
}
