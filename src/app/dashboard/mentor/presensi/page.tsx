'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarCheck,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Users,
  MessageSquare,
  RefreshCw,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Layers,
  GraduationCap,
  ExternalLink,
  Edit,
  UserCheck,
  UserX,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { fetchCurrentUser, getAuthToken, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface CourseOption {
  id: string;
  slug: string;
  title: string;
  totalSessions?: number;
}

interface BatchItem {
  id: string;
  name: string;
  status: string;
  studentCount?: number;
  courses?: Array<{ id: string; title: string; slug: string }>;
  courseId?: string;
  courseTitle?: string;
  courseSlug?: string;
}

interface ActiveSessionData {
  id: string;
  batchId: string;
  sessionNumber: number;
  tokenCode: string;
  expiresAt: string;
  attendeesCount?: number;
  attendees?: AttendeeItem[];
}

interface AttendeeItem {
  id: string;
  studentId: string;
  studentName: string;
  email: string;
  avatarUrl: string | null;
  discordUsername: string | null;
  checkedInAt: string;
  channel: 'web' | 'discord';
}

interface BatchHistorySession {
  id: string;
  sessionNumber: number;
  tokenCode: string;
  createdAt: string;
  expiresAt: string;
  attendeesCount: number;
  attendees: AttendeeItem[];
}

interface RosterStudentItem {
  studentId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  discordUsername: string | null;
  attended: boolean;
  checkedInAt: string | null;
  channel: string | null;
  logId: string | null;
}

export default function MentorPresensiPage() {
  const searchParams = useSearchParams();
  const initialCourseSlug = searchParams.get('course');
  const initialBatchId = searchParams.get('batch');
  const initialSessionNum = searchParams.get('p');

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Data master
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [allCourses, setAllCourses] = useState<CourseOption[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Selection state
  const [selectedCourseSlug, setSelectedCourseSlug] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedSessionNumber, setSelectedSessionNumber] = useState<number>(1);
  const [durationMinutes, setDurationMinutes] = useState<string>('30');

  // Active session & attendees
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isSubmittingOpen, setIsSubmittingOpen] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

  // History recap
  const [batchHistory, setBatchHistory] = useState<BatchHistorySession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState<BatchHistorySession | null>(null);

  // Edit Presensi & Roster State
  const [editingSession, setEditingSession] = useState<BatchHistorySession | ActiveSessionData | null>(null);
  const [rosterList, setRosterList] = useState<RosterStudentItem[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [togglingStudentId, setTogglingStudentId] = useState<string | null>(null);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);

  // Countdown
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDiscord, setCopiedDiscord] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Auth check
  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((u) => {
      if (mounted) {
        setCurrentUser(u);
        setIsLoadingUser(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Load batches and courses
  const loadMasterData = useCallback(async () => {
    setIsLoadingData(true);
    topProgress.start();
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [resBatches, resCourses] = await Promise.all([
        fetch(`${apiUrl}/v1/batches/my-batches`, { headers }),
        fetch(`${apiUrl}/v1/classroom/courses`, { headers }),
      ]);

      const [jsonBatches, jsonCourses] = await Promise.all([
        resBatches.json(),
        resCourses.json(),
      ]);

      if (jsonBatches.success) setBatches(jsonBatches.data || []);
      if (jsonCourses.success) setAllCourses(jsonCourses.data || []);
    } catch {
      toast.error('Gagal memuat data kelas dari server.');
    } finally {
      setIsLoadingData(false);
      topProgress.done();
    }
  }, [apiUrl]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // 3. Filter daftar mata pelajaran yang aktif diampu mentor
  const mentorCourses = useMemo(() => {
    if (!batches || batches.length === 0) {
      // Fallback: Jika admin atau belum ada batch, pakai allCourses
      return allCourses;
    }

    const courseMap = new Map<string, CourseOption>();
    for (const b of batches) {
      if (b.courses && b.courses.length > 0) {
        for (const c of b.courses) {
          if (!courseMap.has(c.slug)) {
            const full = allCourses.find((ac) => ac.slug === c.slug);
            courseMap.set(c.slug, full || { id: c.id, slug: c.slug, title: c.title });
          }
        }
      } else if (b.courseSlug && b.courseTitle) {
        if (!courseMap.has(b.courseSlug)) {
          const full = allCourses.find((ac) => ac.slug === b.courseSlug);
          courseMap.set(b.courseSlug, full || { id: b.courseId || '', slug: b.courseSlug, title: b.courseTitle });
        }
      }
    }

    return courseMap.size > 0 ? Array.from(courseMap.values()) : allCourses;
  }, [batches, allCourses]);

  // Set initial course selection
  useEffect(() => {
    if (mentorCourses.length > 0 && !selectedCourseSlug) {
      if (initialCourseSlug && mentorCourses.some((c) => c.slug === initialCourseSlug)) {
        setSelectedCourseSlug(initialCourseSlug);
      } else {
        setSelectedCourseSlug(mentorCourses[0].slug);
      }
    }
  }, [mentorCourses, selectedCourseSlug, initialCourseSlug]);

  // 4. Filter batch yang terikat dengan mata pelajaran yang dipilih
  const availableBatchesForCourse = useMemo(() => {
    if (!selectedCourseSlug) return [];
    return batches.filter((b) => {
      if (b.courses && b.courses.length > 0) {
        return b.courses.some((c) => c.slug === selectedCourseSlug);
      }
      return b.courseSlug === selectedCourseSlug;
    });
  }, [batches, selectedCourseSlug]);

  // Set initial batch selection
  useEffect(() => {
    if (availableBatchesForCourse.length > 0) {
      if (initialBatchId && availableBatchesForCourse.some((b) => b.id === initialBatchId)) {
        setSelectedBatchId(initialBatchId);
      } else if (!availableBatchesForCourse.some((b) => b.id === selectedBatchId)) {
        setSelectedBatchId(availableBatchesForCourse[0].id);
      }
    } else {
      setSelectedBatchId('');
    }
  }, [availableBatchesForCourse, selectedBatchId, initialBatchId]);

  // Set initial session number
  useEffect(() => {
    if (initialSessionNum) {
      const parsed = parseInt(initialSessionNum, 10);
      if (!Number.isNaN(parsed) && parsed >= 1) {
        setSelectedSessionNumber(parsed);
      }
    }
  }, [initialSessionNum]);

  // Selected course object
  const currentCourse = useMemo(() => {
    return mentorCourses.find((c) => c.slug === selectedCourseSlug) || null;
  }, [mentorCourses, selectedCourseSlug]);

  // Selected batch object
  const currentBatch = useMemo(() => {
    return availableBatchesForCourse.find((b) => b.id === selectedBatchId) || null;
  }, [availableBatchesForCourse, selectedBatchId]);

  // Total sessions for dropdown
  const totalSessions = currentCourse?.totalSessions || 16;
  const sessionOptions = useMemo(() => {
    return Array.from({ length: Math.max(totalSessions, 8) }, (_, i) => i + 1);
  }, [totalSessions]);

  // 5. Cek sesi aktif & riwayat ketika batch berganti
  const checkActiveSessionAndHistory = useCallback(async () => {
    if (!selectedBatchId) {
      setActiveSession(null);
      setBatchHistory([]);
      return;
    }

    setIsLoadingSession(true);
    setIsLoadingHistory(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [resActive, resHistory] = await Promise.all([
        fetch(`${apiUrl}/v1/attendance/active/${selectedBatchId}`, { headers }),
        fetch(`${apiUrl}/v1/attendance/batch/${selectedBatchId}`, { headers }),
      ]);

      const [jsonActive, jsonHistory] = await Promise.all([
        resActive.json(),
        resHistory.json(),
      ]);

      if (jsonActive.success && jsonActive.data) {
        setActiveSession(jsonActive.data);
        setSelectedSessionNumber(jsonActive.data.sessionNumber);
      } else {
        setActiveSession(null);
      }

      if (jsonHistory.success && Array.isArray(jsonHistory.data)) {
        const dedupedMap = new Map<number, BatchHistorySession>();
        for (const item of jsonHistory.data) {
          if (!dedupedMap.has(item.sessionNumber)) {
            dedupedMap.set(item.sessionNumber, item);
          } else {
            const existing = dedupedMap.get(item.sessionNumber)!;
            const itemTime = new Date(item.expiresAt).getTime();
            const existingTime = new Date(existing.expiresAt).getTime();
            if (itemTime > existingTime) {
              dedupedMap.set(item.sessionNumber, item);
            }
          }
        }
        setBatchHistory(Array.from(dedupedMap.values()).sort((a, b) => b.sessionNumber - a.sessionNumber));
      } else {
        setBatchHistory([]);
      }
    } catch {
      console.error('Gagal mengambil status presensi batch.');
    } finally {
      setIsLoadingSession(false);
      setIsLoadingHistory(false);
    }
  }, [apiUrl, selectedBatchId]);

  // Filter roster by search query
  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return rosterList;
    const q = rosterSearch.toLowerCase();
    return rosterList.filter(
      (s) => s.fullName?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
  }, [rosterList, rosterSearch]);

  // Handler: Buka modal edit presensi & muat daftar siswa
  const handleOpenEditPresensi = async (session: BatchHistorySession | ActiveSessionData) => {
    setEditingSession(session);
    setRosterSearch('');
    setIsLoadingRoster(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/session/${session.id}/roster`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setRosterList(json.data.roster || []);
      } else {
        toast.error(json.message || 'Gagal memuat daftar siswa.');
        setRosterList([]);
      }
    } catch {
      toast.error('Gagal menghubungi server.');
      setRosterList([]);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  // Handler: Toggle kehadiran siswa secara manual
  const handleToggleAttendance = async (studentId: string, currentAttended: boolean) => {
    if (!editingSession) return;
    setTogglingStudentId(studentId);

    // Optimistic update
    setRosterList((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? {
              ...s,
              attended: !currentAttended,
              checkedInAt: !currentAttended ? new Date().toISOString() : null,
              channel: !currentAttended ? 'manual' : null,
            }
          : s
      )
    );

    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/session/${editingSession.id}/manual-toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          studentId,
          attended: !currentAttended,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message);
        checkActiveSessionAndHistory();
      } else {
        // Revert on failure
        setRosterList((prev) =>
          prev.map((s) => (s.studentId === studentId ? { ...s, attended: currentAttended } : s))
        );
        toast.error(json.message || 'Gagal mengubah status kehadiran.');
      }
    } catch {
      // Revert on failure
      setRosterList((prev) =>
        prev.map((s) => (s.studentId === studentId ? { ...s, attended: currentAttended } : s))
      );
      toast.error('Gagal menghubungi server.');
    } finally {
      setTogglingStudentId(null);
    }
  };

  // Handler: Aksi kontrol sesi (perpanjang waktu, tutup, buka ulang)
  const handleSessionAction = async (action: 'extend' | 'reopen' | 'close') => {
    if (!editingSession) return;
    setIsUpdatingSession(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/session/${editingSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action,
          extendMinutes: 15,
          durationMinutes: 30,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message);
        if (json.data) {
          setEditingSession((prev) => (prev ? { ...prev, ...json.data } : null));
        }
        checkActiveSessionAndHistory();
      } else {
        toast.error(json.message || 'Gagal memperbarui status sesi.');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setIsUpdatingSession(false);
    }
  };

  useEffect(() => {
    checkActiveSessionAndHistory();
  }, [checkActiveSessionAndHistory]);

  // 6. Live countdown timer untuk sesi aktif
  useEffect(() => {
    if (!activeSession) {
      setTimeRemaining('');
      return;
    }

    function updateTimer() {
      if (!activeSession) return;
      const now = new Date().getTime();
      const expiry = new Date(activeSession.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining('Waktu Habis');
        setActiveSession(null);
        checkActiveSessionAndHistory();
        return;
      }

      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} tersisa`
      );
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession, checkActiveSessionAndHistory]);

  // 7. Buka Sesi Presensi Baru
  async function handleOpenSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBatchId) {
      toast.error('Pilih batch kelas terlebih dahulu.');
      return;
    }

    setIsSubmittingOpen(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          batchId: selectedBatchId,
          sessionNumber: selectedSessionNumber,
          durationMinutes: parseInt(durationMinutes, 10) || 30,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal membuka sesi presensi.');
      }

      toast.success(json.message || 'Sesi presensi berhasil dibuka.');
      await checkActiveSessionAndHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      toast.error(msg);
    } finally {
      setIsSubmittingOpen(false);
    }
  }

  // 8. Tutup Sesi Presensi Lebih Awal
  async function handleCloseSession() {
    if (!activeSession) return;
    setIsClosingSession(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/close/${activeSession.id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menutup sesi presensi.');
      }

      toast.success('Sesi presensi telah ditutup.');
      setIsConfirmCloseOpen(false);
      await checkActiveSessionAndHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menutup sesi.';
      toast.error(msg);
    } finally {
      setIsClosingSession(false);
    }
  }

  // Copy helper
  const handleCopyCode = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.tokenCode);
    setCopiedCode(true);
    toast.success('Kode token berhasil disalin ke clipboard.');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyDiscordCmd = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(`/presensi kode:${activeSession.tokenCode}`);
    setCopiedDiscord(true);
    toast.success('Perintah Discord berhasil disalin.');
    setTimeout(() => setCopiedDiscord(false), 2000);
  };

  if (isLoadingUser || isLoadingData) {
    return null;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER SECTION */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
              Presensi Sesi Pembelajaran
            </h1>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              {currentUser?.role === 'admin' ? 'Admin' : 'Mentor'}
            </Badge>
          </div>
          <p className="text-sm text-fd-muted-foreground">
            Generate kode kehadiran pertemuan kelas dan pantau siswa yang hadir secara langsung.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={checkActiveSessionAndHistory}
            disabled={isLoadingSession}
          >
            <RefreshCw className={`size-3.5 ${isLoadingSession ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </Button>

          {currentCourse && (
            <Link
              href={`/dashboard/dosen/kelas/${currentCourse.slug}?p=${selectedSessionNumber}`}
              data-slot="button"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
            >
              <BookOpen className="size-3.5" />
              <span>Buka Materi Sesi</span>
            </Link>
          )}
        </div>
      </header>

      {/* FILTER & SELECTOR BAR */}
      <div className="p-4 rounded-xl border border-fd-border bg-fd-card/60 backdrop-blur-xs space-y-3">
        <div className="text-xs font-semibold text-fd-foreground flex items-center gap-1.5">
          <Layers className="size-4 text-fd-primary" />
          <span>Pilih Kelas & Kurikulum Pembelajaran</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Mata Pelajaran / Kurikulum */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-fd-muted-foreground">
              Mata Pelajaran (Kurikulum)
            </label>
            <Select
              value={selectedCourseSlug}
              onValueChange={(val) => {
                if (val) setSelectedCourseSlug(val);
              }}
            >
              <SelectTrigger className="text-xs h-9 bg-fd-background w-full">
                <SelectValue placeholder="Pilih mata pelajaran...">
                  {currentCourse ? currentCourse.title : 'Pilih mata pelajaran...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="z-[80]">
                {mentorCourses.map((c) => (
                  <SelectItem key={c.slug} value={c.slug} className="text-xs">
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Batch Kelas Aktif */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-fd-muted-foreground">
              Batch Kelas Pelaksanaan
            </label>
            <Select
              value={selectedBatchId}
              onValueChange={(val) => {
                if (val) setSelectedBatchId(val);
              }}
              disabled={availableBatchesForCourse.length === 0}
            >
              <SelectTrigger className="text-xs h-9 bg-fd-background w-full">
                <SelectValue
                  placeholder={
                    availableBatchesForCourse.length === 0
                      ? 'Belum ada batch aktif'
                      : 'Pilih batch...'
                  }
                >
                  {currentBatch
                    ? `${currentBatch.name} (${currentBatch.studentCount || 0} siswa)`
                    : availableBatchesForCourse.length === 0
                    ? 'Belum ada batch aktif'
                    : 'Pilih batch...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="z-[80]">
                {availableBatchesForCourse.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name} ({b.studentCount || 0} siswa)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Pertemuan Ke- */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-fd-muted-foreground">
              Target Pertemuan
            </label>
            <Select
              value={String(selectedSessionNumber)}
              onValueChange={(val) => setSelectedSessionNumber(Number(val))}
            >
              <SelectTrigger className="text-xs h-9 bg-fd-background font-mono w-full">
                <SelectValue placeholder="Pertemuan">
                  Pertemuan {selectedSessionNumber}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="z-[80]">
                {sessionOptions.map((num) => (
                  <SelectItem key={num} value={String(num)} className="text-xs font-mono">
                    Pertemuan {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI: KONTROL PRESENSI AKTIF / BUKA SESI (7 COLUMNS) */}
        <div className="lg:col-span-7 space-y-6">
          {activeSession ? (
            /* ================= SESI PRESENSI AKTIF ================= */
            <Card className="border-emerald-500/30 bg-emerald-950/10 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

              <CardHeader className="pb-3 border-b border-emerald-500/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                    </span>
                    <CardTitle className="text-base font-bold text-emerald-400">
                      Sesi Pertemuan {activeSession.sessionNumber} Sedang Aktif
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono text-emerald-400 border-emerald-500/40 tabular-nums">
                    <Clock className="size-3 mr-1" />
                    {timeRemaining || 'Aktif'}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-fd-muted-foreground">
                  Bagikan kode token berikut kepada siswa di ruang kelas atau melalui Discord.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-5">
                {/* BIG TOKEN CODE BOX */}
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-fd-card/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <span className="text-[11px] font-semibold text-fd-muted-foreground uppercase tracking-wider">
                      Kode Token Presensi
                    </span>
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-widest font-mono text-emerald-400 select-all">
                      {activeSession.tokenCode}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ButtonGroup>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyCode}
                      >
                        {copiedCode ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        <span>{copiedCode ? 'Tersalin' : 'Salin Kode'}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditPresensi(activeSession)}
                      >
                        <Edit className="size-3.5 text-fd-primary" />
                        <span>Edit Presensi</span>
                      </Button>
                    </ButtonGroup>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setIsConfirmCloseOpen(true)}
                    >
                      Tutup Sesi
                    </Button>
                  </div>
                </div>

                {/* DISCORD OMNICHANNEL COMMAND */}
                <div className="p-3 rounded-lg border border-fd-border/70 bg-fd-muted/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-fd-foreground">
                      <MessageSquare className="size-3.5 text-[#5865F2]" />
                      <span>Perintah Presensi Bot Discord</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={handleCopyDiscordCmd}
                    >
                      {copiedDiscord ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      <span>{copiedDiscord ? 'Tersalin' : 'Salin'}</span>
                    </Button>
                  </div>
                  <div className="p-2 rounded bg-fd-background/80 border border-fd-border/50 font-mono text-xs text-fd-foreground select-all">
                    /presensi kode:{activeSession.tokenCode}
                  </div>
                </div>

                {/* LIVE ATTENDEES IN CURRENT SESSION */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-fd-foreground">
                      Siswa Hadir ({activeSession.attendeesCount || 0} / {currentBatch?.studentCount || 0})
                    </span>
                    <span className="text-[11px] text-fd-muted-foreground">
                      {currentBatch?.studentCount
                        ? `${Math.round(((activeSession.attendeesCount || 0) / currentBatch.studentCount) * 100)}% kehadiran`
                        : ''}
                    </span>
                  </div>

                  {activeSession.attendees && activeSession.attendees.length > 0 ? (
                    <ScrollArea className="h-48 rounded-lg border border-fd-border bg-fd-card">
                      <div className="divide-y divide-fd-border text-xs">
                        {activeSession.attendees.map((att) => (
                          <div key={att.id} className="flex items-center justify-between p-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-7 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                {att.studentName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-fd-foreground truncate">{att.studentName}</p>
                                <p className="text-[10px] text-fd-muted-foreground truncate">{att.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                                {att.channel}
                              </Badge>
                              <span className="text-[10px] text-fd-muted-foreground font-mono tabular-nums">
                                {new Date(att.checkedInAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="p-6 rounded-lg border border-dashed border-fd-border text-center text-xs text-fd-muted-foreground">
                      Belum ada siswa yang melakukan presensi pada sesi aktif ini.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* ================= FORM BUKA SESI BARU ================= */
            <Card className="border-fd-border shadow-xs">
              <CardHeader className="pb-3 border-b border-fd-border/70">
                <CardTitle className="text-base font-semibold text-fd-foreground flex items-center gap-2">
                  <CalendarCheck className="size-4 text-fd-primary" />
                  <span>Buka Sesi Kehadiran Pertemuan {selectedSessionNumber}</span>
                </CardTitle>
                <CardDescription className="text-xs text-fd-muted-foreground">
                  Buat kode token OTP berbatas waktu untuk dibagikan ke siswa saat sesi kelas berlangsung.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4">
                <form onSubmit={handleOpenSession} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Durasi */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-fd-foreground">
                        Durasi Token Berakhir
                      </label>
                      <Select
                        value={durationMinutes}
                        onValueChange={(val) => {
                          if (val) setDurationMinutes(val);
                        }}
                      >
                        <SelectTrigger className="text-xs h-9 w-full">
                          <SelectValue placeholder="Pilih durasi...">
                            {durationMinutes === '15'
                              ? '15 Menit (Cepat)'
                              : durationMinutes === '30'
                              ? '30 Menit (Standar Sesi)'
                              : durationMinutes === '45'
                              ? '45 Menit'
                              : durationMinutes === '60'
                              ? '60 Menit (1 Jam Penuh)'
                              : durationMinutes === '120'
                              ? '120 Menit (2 Jam Praktikum)'
                              : `${durationMinutes} Menit`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="z-[80]">
                          <SelectItem value="15" className="text-xs">15 Menit (Cepat)</SelectItem>
                          <SelectItem value="30" className="text-xs">30 Menit (Standar Sesi)</SelectItem>
                          <SelectItem value="45" className="text-xs">45 Menit</SelectItem>
                          <SelectItem value="60" className="text-xs">60 Menit (1 Jam Penuh)</SelectItem>
                          <SelectItem value="120" className="text-xs">120 Menit (2 Jam Praktikum)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Info Kelas Target */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-fd-foreground">
                        Target Kelas & Siswa
                      </label>
                      <div className="p-2 rounded-lg border border-fd-border/70 bg-fd-muted/20 text-xs">
                        <p className="font-semibold text-fd-foreground truncate">
                          {currentCourse?.title || 'Pilih Mata Pelajaran'}
                        </p>
                        <p className="text-[11px] text-fd-muted-foreground">
                          {currentBatch ? `${currentBatch.name} (${currentBatch.studentCount || 0} Siswa)` : 'Belum memilih batch'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-fd-border/60 bg-fd-muted/10 p-3 text-xs text-fd-muted-foreground space-y-1">
                    <p className="font-semibold text-fd-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-fd-primary" />
                      Otomasi Token
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Sistem akan membuat token unik acak (contoh: <code>KDG-882X</code>). Siswa yang terdaftar di batch ini dapat langsung menginputnya lewat portal web siswa atau perintah bot Discord.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingOpen || !selectedBatchId}
                    className="w-full font-semibold"
                  >
                    {isSubmittingOpen ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        <span>Membuka Sesi...</span>
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="size-4" />
                        <span>Buka Sesi Presensi Pertemuan {selectedSessionNumber}</span>
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* KOLOM KANAN: REKAP & RIWAYAT PERTEMUAN BATCH (5 COLUMNS) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-fd-border shadow-xs">
            <CardHeader className="pb-3 border-b border-fd-border/70">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-fd-foreground flex items-center gap-1.5">
                  <Users className="size-4 text-fd-muted-foreground" />
                  <span>Riwayat Kehadiran Batch</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {batchHistory.length} Sesi Terbuka
                </Badge>
              </div>
              <CardDescription className="text-xs text-fd-muted-foreground">
                Rekap sesi presensi yang telah dilaksanakan untuk batch ini.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-3">
              {isLoadingHistory ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-fd-muted-foreground">
                  <RefreshCw className="size-4 animate-spin text-fd-primary" />
                  <p className="text-xs">Memuat riwayat sesi...</p>
                </div>
              ) : batchHistory.length === 0 ? (
                <div className="py-10 text-center text-xs text-fd-muted-foreground space-y-2">
                  <CalendarCheck className="size-8 mx-auto text-fd-muted-foreground/40" />
                  <p className="font-semibold text-fd-foreground">Belum ada sesi presensi</p>
                  <p className="text-[11px] max-w-xs mx-auto">
                    Gunakan form di samping untuk membuka sesi presensi pertemuan pertama batch ini.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[380px] rounded-lg border border-fd-border">
                  <div className="divide-y divide-fd-border text-xs">
                    {batchHistory.map((sess) => {
                      const isExpired = new Date(sess.expiresAt) <= new Date();
                      return (
                        <div
                          key={sess.id}
                          className="p-3 hover:bg-fd-muted/20 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-fd-foreground font-mono">
                                Pertemuan {sess.sessionNumber}
                              </span>
                              <Badge
                                variant={isExpired ? 'secondary' : 'outline'}
                                className={`text-[9px] uppercase font-mono ${
                                  !isExpired ? 'text-emerald-500 border-emerald-500/40' : ''
                                }`}
                              >
                                {isExpired ? 'Selesai' : 'Aktif'}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-fd-muted-foreground">
                              {new Date(sess.createdAt).toLocaleDateString('id-ID', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="font-bold text-fd-foreground font-mono">
                                {sess.attendeesCount}
                              </span>
                              <span className="text-[10px] text-fd-muted-foreground ml-1">
                                hadir
                              </span>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditPresensi(sess)}
                              title="Kelola & edit status kehadiran pertemuan ini"
                            >
                              <Edit className="size-3.5 text-fd-primary" />
                              <span>Edit Presensi</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL KONFIRMASI TUTUP SESI */}
      <Dialog open={isConfirmCloseOpen} onOpenChange={setIsConfirmCloseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertCircle className="size-5" />
              <span>Tutup Sesi Presensi Lebih Awal?</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              Jika ditutup sekarang, siswa tidak akan dapat lagi menggunakan kode token{' '}
              <strong className="text-fd-foreground font-mono">{activeSession?.tokenCode}</strong> untuk mencatat kehadiran pertemuan ini.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmCloseOpen(false)}
              disabled={isClosingSession}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleCloseSession}
              disabled={isClosingSession}
            >
              {isClosingSession ? 'Menutup...' : 'Tutup Sesi Sekarang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL EDIT PRESENSI (ROSTER & MANUAL OVERRIDE) ================= */}
      <Dialog
        open={!!editingSession}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSession(null);
            setRosterList([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-3 border-b border-fd-border bg-fd-card/50">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-fd-foreground flex items-center gap-2">
                    <Edit className="size-4 text-fd-primary" />
                    <span>Edit Presensi: Pertemuan {editingSession?.sessionNumber}</span>
                  </h2>
                  {editingSession && (
                    <Badge
                      variant={new Date(editingSession.expiresAt) > new Date() ? 'outline' : 'secondary'}
                      className={`text-[10px] font-mono uppercase ${
                        new Date(editingSession.expiresAt) > new Date()
                          ? 'border-emerald-500/40 text-emerald-500'
                          : ''
                      }`}
                    >
                      {new Date(editingSession.expiresAt) > new Date() ? 'Sesi Aktif' : 'Sesi Selesai'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-fd-muted-foreground">
                  {currentCourse?.title} • {currentBatch?.name}
                </p>
              </div>

              {/* Token Info */}
              {editingSession && (
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-mono text-fd-muted-foreground block">
                    Token Presensi
                  </span>
                  <span className="font-mono font-bold text-base tracking-widest text-fd-foreground">
                    {editingSession.tokenCode}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Session Controls */}
            {editingSession && (
              <div className="mt-3 pt-3 border-t border-fd-border/50 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-fd-muted-foreground">
                  {new Date(editingSession.expiresAt) > new Date() ? (
                    <span className="text-emerald-500 font-medium">
                      Batas waktu: {new Date(editingSession.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <span>Sesi ini telah kedaluwarsa / ditutup.</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {new Date(editingSession.expiresAt) > new Date() ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUpdatingSession}
                        onClick={() => handleSessionAction('extend')}
                      >
                        <Clock className="size-3.5" />
                        <span>+15 Menit</span>
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isUpdatingSession}
                        onClick={() => handleSessionAction('close')}
                      >
                        Tutup Sesi
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUpdatingSession}
                      onClick={() => handleSessionAction('reopen')}
                    >
                      <RefreshCw className="size-3.5" />
                      <span>Buka Kembali (+30 Mnt)</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search & Summary Bar */}
          <div className="px-5 py-3 border-b border-fd-border/60 bg-fd-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-fd-muted-foreground" />
              <Input
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Cari nama atau email siswa..."
                className="pl-8 text-xs h-8 bg-fd-background"
              />
            </div>
            <div className="text-xs font-medium text-fd-foreground shrink-0 flex items-center gap-2">
              <span className="text-fd-muted-foreground">Kehadiran:</span>
              <span className="font-bold text-emerald-600 font-mono">
                {rosterList.filter((s) => s.attended).length}
              </span>
              <span className="text-fd-muted-foreground font-mono">/</span>
              <span className="font-mono text-fd-foreground">{rosterList.length} Siswa</span>
              <Badge variant="outline" className="text-[10px] font-mono ml-1">
                {rosterList.length > 0
                  ? `${Math.round((rosterList.filter((s) => s.attended).length / rosterList.length) * 100)}%`
                  : '0%'}
              </Badge>
            </div>
          </div>

          {/* Student Roster List */}
          <ScrollArea className="flex-1 overflow-y-auto max-h-[380px] p-5">
            {isLoadingRoster ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-fd-muted-foreground">
                <RefreshCw className="size-5 animate-spin text-fd-primary" />
                <p className="text-xs">Memuat daftar siswa kelas...</p>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="py-12 text-center text-xs text-fd-muted-foreground space-y-1">
                <Users className="size-8 mx-auto text-fd-muted-foreground/40" />
                <p className="font-medium text-fd-foreground">Tidak ada siswa ditemukan</p>
                <p className="text-[11px]">
                  {rosterSearch ? 'Coba ubah kata kunci pencarian Anda.' : 'Belum ada siswa terdaftar di batch ini.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-fd-border/60 rounded-xl border border-fd-border bg-fd-card">
                {filteredRoster.map((student) => (
                  <div
                    key={student.studentId}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-fd-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'size-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border',
                          student.attended
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            : 'bg-fd-muted text-fd-muted-foreground border-fd-border'
                        )}
                      >
                        {student.fullName?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-xs text-fd-foreground truncate">
                            {student.fullName}
                          </p>
                          {student.attended ? (
                            <Badge className="text-[9px] h-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                              Hadir
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] h-4 text-fd-muted-foreground font-medium">
                              Tidak Hadir
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-fd-muted-foreground">
                          <span className="truncate">{student.email}</span>
                          {student.attended && student.checkedInAt && (
                            <>
                              <span>•</span>
                              <span className="tabular-nums font-mono">
                                {new Date(student.checkedInAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {student.channel && (
                                <span className="capitalize font-mono">
                                  ({student.channel === 'manual' ? 'Manual oleh Mentor' : student.channel})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {student.attended ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={togglingStudentId === student.studentId}
                          onClick={() => handleToggleAttendance(student.studentId, true)}
                          title="Ubah status siswa menjadi tidak hadir"
                        >
                          {togglingStudentId === student.studentId ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <UserX className="size-3.5" />
                          )}
                          <span>Batal Hadir</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={togglingStudentId === student.studentId}
                          onClick={() => handleToggleAttendance(student.studentId, false)}
                          title="Tandai siswa ini hadir secara manual"
                        >
                          {togglingStudentId === student.studentId ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="size-3.5" />
                          )}
                          <span>Tandai Hadir</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 px-5 border-t border-fd-border/60 bg-fd-card/50 flex items-center justify-between">
            <span className="text-[11px] text-fd-muted-foreground">
              Perubahan status kehadiran siswa langsung tersimpan secara otomatis.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingSession(null);
                setRosterList([]);
              }}
              className="text-xs"
            >
              Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
