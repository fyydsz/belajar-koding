'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarCheck,
  Clock,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Search,
  FileText,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { fetchCurrentUser, getAuthToken, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DashboardBreadcrumb } from '@/components/dashboard/dashboard-breadcrumb';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface CourseSessionNode {
  id: string;
  sessionNumber: number;
  title: string;
  description?: string | null;
}

interface CourseOption {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  totalSessions?: number;
  sessions?: CourseSessionNode[];
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
  isExpired?: boolean;
  attendeesCount?: number;
}

interface BatchHistorySession {
  id: string;
  sessionNumber: number;
  tokenCode: string;
  createdAt: string;
  expiresAt: string;
  attendeesCount: number;
}

interface RosterStudentItem {
  studentId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  discordUsername: string | null;
  attended: boolean;
  status: 'present' | 'permission' | 'sick' | 'absent' | string | null;
  note: string | null;
  attachmentUrl: string | null;
  checkedInAt: string | null;
  channel: string | null;
  logId: string | null;
}

export default function MentorPresensiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query parameters from URL
  const queryCourse = searchParams.get('course');
  const queryBatch = searchParams.get('batch');
  const querySession = searchParams.get('p');

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Master data
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [allCourses, setAllCourses] = useState<CourseOption[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // View state tracking
  const [batchHistory, setBatchHistory] = useState<BatchHistorySession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Active session and roster in session view
  const [sessionData, setSessionData] = useState<ActiveSessionData | null>(null);
  const [rosterList, setRosterList] = useState<RosterStudentItem[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<string>('30');
  const [isSubmittingOpen, setIsSubmittingOpen] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const [isReopeningSession, setIsReopeningSession] = useState(false);
  const [togglingStudentId, setTogglingStudentId] = useState<string | null>(null);

  // Modal review keterangan izin/sakit
  const [reviewStudent, setReviewStudent] = useState<RosterStudentItem | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Countdown & clipboard
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

  // Helper: Dapatkan batch yang terikat dengan sebuah mata kuliah
  const getBatchesForCourse = useCallback(
    (courseSlug: string): BatchItem[] => {
      return batches.filter((b) => {
        if (b.courses && b.courses.length > 0) {
          return b.courses.some((c) => c.slug === courseSlug);
        }
        return b.courseSlug === courseSlug;
      });
    },
    [batches]
  );

  // Helper: Deteksi batch otomatis untuk mata kuliah (prioritaskan active/ongoing)
  const detectBatchForCourse = useCallback(
    (courseSlug: string): BatchItem | null => {
      const courseBatches = getBatchesForCourse(courseSlug);
      if (courseBatches.length === 0) return null;
      const activeBatch = courseBatches.find(
        (b) => b.status === 'active' || b.status === 'ongoing'
      );
      return activeBatch || courseBatches[0];
    },
    [getBatchesForCourse]
  );

  // Current course resolved from query
  const currentCourse = useMemo(() => {
    if (!queryCourse) return null;
    return allCourses.find((c) => c.slug === queryCourse) || null;
  }, [allCourses, queryCourse]);

  // Available batches for current selected course
  const availableBatches = useMemo(() => {
    if (!currentCourse) return [];
    return getBatchesForCourse(currentCourse.slug);
  }, [currentCourse, getBatchesForCourse]);

  // Resolved current batch
  const currentBatch = useMemo(() => {
    if (!currentCourse) return null;
    if (queryBatch) {
      const match = batches.find((b) => b.id === queryBatch);
      if (match) return match;
    }
    return detectBatchForCourse(currentCourse.slug);
  }, [currentCourse, queryBatch, batches, detectBatchForCourse]);

  // Total sessions for current course
  const totalSessions = currentCourse?.totalSessions || 16;
  const sessionNumber = querySession ? parseInt(querySession, 10) : null;

  // View state determination
  const currentView: 'courses' | 'sessions' | 'attendance' = useMemo(() => {
    if (querySession && currentCourse && currentBatch) {
      return 'attendance';
    }
    if (queryCourse && currentBatch) {
      return 'sessions';
    }
    return 'courses';
  }, [querySession, queryCourse, currentBatch]);

  // Fetch batch attendance history (for Step 2: Session Cards)
  const loadBatchHistory = useCallback(async () => {
    if (!currentBatch) {
      setBatchHistory([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/batch/${currentBatch.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBatchHistory(json.data);
      } else {
        setBatchHistory([]);
      }
    } catch {
      setBatchHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiUrl, currentBatch]);

  useEffect(() => {
    if (currentView === 'sessions' && currentBatch) {
      loadBatchHistory();
    }
  }, [currentView, currentBatch, loadBatchHistory]);

  // Fetch active session and student roster (for Step 3: Attendance view)
  const loadSessionRoster = useCallback(async () => {
    if (!currentBatch || !sessionNumber) return;

    setIsLoadingRoster(true);
    topProgress.start();
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(
        `${apiUrl}/v1/attendance/batch/${currentBatch.id}/session/${sessionNumber}/roster`,
        { headers }
      );
      const json = await res.json();

      if (json.success && json.data) {
        setSessionData(json.data.session || null);
        setRosterList(json.data.roster || []);
      } else {
        setSessionData(null);
        setRosterList([]);
      }
    } catch {
      toast.error('Gagal memuat data presensi pertemuan.');
      setSessionData(null);
      setRosterList([]);
    } finally {
      setIsLoadingRoster(false);
      topProgress.done();
    }
  }, [apiUrl, currentBatch, sessionNumber]);

  useEffect(() => {
    if (currentView === 'attendance' && currentBatch && sessionNumber) {
      loadSessionRoster();
    }
  }, [currentView, currentBatch, sessionNumber, loadSessionRoster]);

  // Live countdown timer for active session
  useEffect(() => {
    if (!sessionData || sessionData.isExpired) {
      setTimeRemaining('');
      return;
    }

    function updateTimer() {
      if (!sessionData) return;
      const now = Date.now();
      const expiry = new Date(sessionData.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining('Waktu Habis');
        setSessionData((prev) => (prev ? { ...prev, isExpired: true } : null));
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
  }, [sessionData]);

  // Handler: Buka Sesi Presensi Baru
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch || !sessionNumber) return;

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
          batchId: currentBatch.id,
          sessionNumber,
          durationMinutes: parseInt(durationMinutes, 10) || 30,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal membuka sesi presensi.');
      }

      toast.success(json.message || 'Sesi presensi berhasil dibuka.');
      await loadSessionRoster();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      toast.error(msg);
    } finally {
      setIsSubmittingOpen(false);
    }
  };

  // Handler: Tutup Sesi Presensi Lebih Awal
  const handleCloseSession = async () => {
    if (!sessionData) return;
    setIsClosingSession(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/session/${sessionData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'close' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menutup sesi presensi.');
      }

      toast.success('Sesi presensi telah ditutup.');
      setIsConfirmCloseOpen(false);
      await loadSessionRoster();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menutup sesi.';
      toast.error(msg);
    } finally {
      setIsClosingSession(false);
    }
  };

  // Handler: Buka Ulang Sesi Presensi (Reopen)
  const handleReopenSession = async () => {
    if (!sessionData && !currentBatch) return;
    setIsReopeningSession(true);
    try {
      const token = getAuthToken();
      if (sessionData) {
        const res = await fetch(`${apiUrl}/v1/attendance/session/${sessionData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: 'reopen',
            durationMinutes: parseInt(durationMinutes, 10) || 30,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Gagal membuka ulang sesi presensi.');
        }
      } else {
        const res = await fetch(`${apiUrl}/v1/attendance/open`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            batchId: currentBatch!.id,
            sessionNumber,
            durationMinutes: parseInt(durationMinutes, 10) || 30,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Gagal membuka sesi presensi.');
        }
      }

      toast.success('Sesi presensi berhasil dibuka kembali.');
      await loadSessionRoster();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      toast.error(msg);
    } finally {
      setIsReopeningSession(false);
    }
  };

  // Helper untuk menentukan status tampilan siswa
  const isSessionExpired = Boolean(
    sessionData && (sessionData.isExpired || new Date(sessionData.expiresAt) <= new Date())
  );

  const getStudentDisplayStatus = useCallback(
    (student: RosterStudentItem): 'present' | 'permission' | 'sick' | 'absent' | null => {
      if (student.status) {
        if (student.status === 'present') return 'present';
        if (student.status === 'permission' || student.status === 'excused') return 'permission';
        if (student.status === 'sick') return 'sick';
        if (student.status === 'absent') return 'absent';
      }

      if (student.attended) {
        return 'present';
      }

      // Rule: Siswa yang tidak absen sama sekali selama waktu yang ditentukan -> A (Alpa)
      if (isSessionExpired) {
        return 'absent';
      }

      // Rule: Siswa yang belum absen selama sesi aktif/belum dibuka -> kosongin tombol radionya
      return null;
    },
    [isSessionExpired]
  );

  // Handler: Update status presensi siswa secara manual (klik radio button H / I / S / A)
  const handleUpdateStudentStatus = async (
    studentId: string,
    targetStatus: 'present' | 'permission' | 'sick' | 'absent' | 'none'
  ) => {
    if (!currentBatch || !sessionNumber) return;

    setTogglingStudentId(studentId);
    const previousRoster = [...rosterList];

    // Optimistic update
    setRosterList((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        return {
          ...s,
          status: targetStatus === 'none' ? null : targetStatus,
          attended: targetStatus === 'present',
          checkedInAt: targetStatus !== 'none' ? new Date().toISOString() : null,
          channel: targetStatus !== 'none' ? 'manual' : null,
        };
      })
    );

    try {
      const token = getAuthToken();
      const res = await fetch(
        `${apiUrl}/v1/attendance/batch/${currentBatch.id}/session/${sessionNumber}/manual-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            studentId,
            status: targetStatus,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRosterList(previousRoster);
        toast.error(json.message || 'Gagal memperbarui status presensi.');
      } else {
        const labelMap: Record<string, string> = {
          present: 'Hadir',
          permission: 'Izin',
          sick: 'Sakit',
          absent: 'Alpa',
          none: 'Dikosongkan',
        };
        toast.success(`Status ${labelMap[targetStatus] || targetStatus} berhasil disimpan.`);
      }
    } catch {
      setRosterList(previousRoster);
      toast.error('Gagal menghubungi server.');
    } finally {
      setTogglingStudentId(null);
    }
  };

  // Handler: Review Keterangan Siswa (Setujui Izin / Sakit / Tolak)
  const handleApproveKeterangan = async (
    approvedStatus: 'permission' | 'sick' | 'present' | 'absent'
  ) => {
    if (!reviewStudent || !currentBatch || !sessionNumber) return;
    setIsSubmittingApproval(true);

    try {
      await handleUpdateStudentStatus(reviewStudent.studentId, approvedStatus);
      toast.success(
        `Pengajuan ${approvedStatus === 'sick' ? 'Sakit' : approvedStatus === 'permission' ? 'Izin' : approvedStatus} telah disetujui.`
      );
      setReviewStudent(null);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Copy helper
  const handleCopyCode = () => {
    if (!sessionData) return;
    navigator.clipboard.writeText(sessionData.tokenCode);
    setCopiedCode(true);
    toast.success('Kode token berhasil disalin ke clipboard.');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyDiscordCmd = () => {
    if (!sessionData) return;
    navigator.clipboard.writeText(`/presensi kode:${sessionData.tokenCode}`);
    setCopiedDiscord(true);
    toast.success('Perintah Discord berhasil disalin.');
    setTimeout(() => setCopiedDiscord(false), 2000);
  };

  // Filter roster by search input
  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return rosterList;
    const q = rosterSearch.toLowerCase();
    return rosterList.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.discordUsername?.toLowerCase().includes(q)
    );
  }, [rosterList, rosterSearch]);

  // Statistics counters
  const stats = useMemo(() => {
    let presentCount = 0;
    let permissionCount = 0;
    let sickCount = 0;
    let absentCount = 0;
    let unrecordedCount = 0;

    for (const student of rosterList) {
      const st = getStudentDisplayStatus(student);
      if (st === 'present') presentCount++;
      else if (st === 'permission') permissionCount++;
      else if (st === 'sick') sickCount++;
      else if (st === 'absent') absentCount++;
      else unrecordedCount++;
    }

    return {
      total: rosterList.length,
      present: presentCount,
      permission: permissionCount,
      sick: sickCount,
      absent: absentCount,
      unrecorded: unrecordedCount,
    };
  }, [rosterList, getStudentDisplayStatus]);

  if (isLoadingUser || isLoadingData) {
    return null;
  }

  // =========================================================================
  // VIEW 1: MATA KULIAH (Root Presensi)
  // =========================================================================
  if (currentView === 'courses') {
    return (
      <div className="space-y-6 pb-12">
        <header className="flex flex-col gap-3 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
                Presensi & Rekap Kehadiran
              </h1>
              <Badge variant="outline" className="text-xs font-mono uppercase">
                {currentUser?.role === 'admin' ? 'Admin' : 'Mentor'}
              </Badge>
            </div>
            <p className="text-sm text-fd-muted-foreground">
              Pilih mata kuliah untuk mengelola kehadiran siswa per pertemuan kelas.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadMasterData}
            disabled={isLoadingData}
          >
            <RefreshCw className={`size-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </Button>
        </header>

        {allCourses.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-fd-border rounded-xl space-y-3">
            <GraduationCap className="size-10 mx-auto text-fd-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-fd-foreground">Belum Ada Mata Kuliah</h3>
              <p className="text-sm text-fd-muted-foreground max-w-md mx-auto">
                Belum ada kurikulum atau mata kuliah yang tersedia untuk diampu.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {allCourses.map((course) => {
              const detected = detectBatchForCourse(course.slug);
              const courseBatches = getBatchesForCourse(course.slug);

              return (
                <Card
                  key={course.id}
                  className="group flex flex-col justify-between border-fd-border hover:border-fd-primary/50 transition-all duration-200 hover:shadow-xs cursor-pointer"
                  onClick={() => {
                    if (detected) {
                      router.push(
                        `/dashboard/mentor/presensi?batch=${detected.id}&course=${course.slug}`
                      );
                    } else {
                      toast.error('Belum ada batch yang terdaftar untuk mata kuliah ini.');
                    }
                  }}
                >
                  <CardHeader className="space-y-2.5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="size-9 rounded-lg bg-fd-primary/10 text-fd-primary flex items-center justify-center shrink-0 group-hover:bg-fd-primary group-hover:text-fd-primary-foreground transition-colors">
                        <CalendarCheck className="size-4.5" />
                      </div>

                      {detected ? (
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium"
                        >
                          {detected.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] text-fd-muted-foreground">
                          Belum Ada Batch
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <CardTitle className="text-base group-hover:text-fd-primary transition-colors">
                        {course.title}
                      </CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {course.description || 'Kelola presensi dan absensi siswa untuk mata kuliah ini.'}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between text-xs py-2 px-3 rounded-md bg-fd-muted/40 border border-fd-border/50">
                      <span className="text-fd-muted-foreground">
                        {course.totalSessions || 16} Pertemuan
                      </span>
                      <span className="font-semibold text-fd-foreground">
                        {detected?.studentCount || 0} Siswa Terdaftar
                      </span>
                    </div>

                    {courseBatches.length > 1 && (
                      <p className="text-[11px] text-fd-muted-foreground">
                        Tersedia {courseBatches.length} batch pilihan.
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs font-medium text-fd-primary group-hover:translate-x-0.5 transition-transform pt-1">
                      <span>Buka Presensi Pertemuan</span>
                      <ArrowRight className="size-3.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: DAFTAR PERTEMUAN (Structured Clean List, Not Cluttered Grid)
  // =========================================================================
  if (currentView === 'sessions' && currentCourse && currentBatch) {
    const sessionCards = Array.from({ length: totalSessions }, (_, i) => i + 1);

    return (
      <div className="space-y-6 pb-12">
        {/* Navigation Breadcrumb */}
        <DashboardBreadcrumb
          items={[
            { label: 'Presensi', href: '/dashboard/mentor/presensi' },
            { label: currentCourse.title },
          ]}
        />

        {/* Top Header Bar */}
        <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
                {currentCourse.title}
              </h1>
              <Badge variant="outline" className="text-xs font-semibold">
                {currentBatch.name}
              </Badge>
            </div>
            <p className="text-sm text-fd-muted-foreground">
              Daftar sesi pertemuan kelas untuk mengelola presensi siswa.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
            {availableBatches.length > 1 && (
              <Select
                value={currentBatch.id}
                onValueChange={(val) => {
                  if (val) router.push(`/dashboard/mentor/presensi?batch=${val}&course=${currentCourse.slug}`);
                }}
              >
                <SelectTrigger className="text-xs h-9 bg-fd-background min-w-[160px]">
                  <SelectValue placeholder="Ganti Batch">
                    {currentBatch.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {availableBatches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name} ({b.studentCount || 0} siswa)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadBatchHistory}
              disabled={isLoadingHistory}
            >
              <RefreshCw className={`size-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </Button>
          </div>
        </header>

        {/* Structured List View */}
        <div className="rounded-xl border border-fd-border bg-fd-card divide-y divide-fd-border overflow-hidden shadow-xs">
          {sessionCards.map((sessNum) => {
            const courseSession = currentCourse.sessions?.find(
              (s) => s.sessionNumber === sessNum
            );
            const historyItem = batchHistory.find((h) => h.sessionNumber === sessNum);
            const now = Date.now();
            const isActive =
              historyItem && new Date(historyItem.expiresAt).getTime() > now;
            const isCompleted =
              historyItem && new Date(historyItem.expiresAt).getTime() <= now;

            return (
              <div
                key={sessNum}
                onClick={() => {
                  router.push(
                    `/dashboard/mentor/presensi?batch=${currentBatch.id}&course=${currentCourse.slug}&p=${sessNum}`
                  );
                }}
                className="flex items-center justify-between p-3.5 sm:px-5 hover:bg-fd-muted/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                  <span
                    className={cn(
                      'size-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 transition-colors',
                      isActive
                        ? 'bg-fd-foreground text-fd-background'
                        : 'bg-fd-muted text-fd-foreground group-hover:bg-fd-foreground group-hover:text-fd-background'
                    )}
                  >
                    P{sessNum}
                  </span>

                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-fd-foreground group-hover:text-fd-primary transition-colors truncate block">
                      {courseSession?.title
                        ? courseSession.title.replace(/^Pertemuan\s*\d+\s*[-:]*\s*/i, '')
                        : `Pertemuan ${sessNum}`}
                    </span>
                    <span className="text-xs text-fd-muted-foreground truncate block">
                      {courseSession?.description || `Sesi pembelajaran pertemuan ke-${sessNum}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isActive ? (
                    <Badge variant="default" className="text-[11px] font-semibold flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-fd-primary-foreground animate-pulse" />
                      Sedang Aktif
                    </Badge>
                  ) : isCompleted ? (
                    <Badge variant="outline" className="text-[11px] text-fd-muted-foreground">
                      Selesai ({historyItem.attendeesCount || 0} Hadir)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] text-fd-muted-foreground border-dashed">
                      Belum Dibuka
                    </Badge>
                  )}

                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-fd-muted-foreground group-hover:text-fd-foreground group-hover:translate-x-0.5 transition-transform">
                    <span>Kelola</span>
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: SESSION ATTENDANCE & ROSTER (Deep Query: course, batch, and p)
  // =========================================================================
  const isSessionActive = Boolean(
    sessionData && !sessionData.isExpired && new Date(sessionData.expiresAt).getTime() > Date.now()
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Navigation Breadcrumb */}
      <DashboardBreadcrumb
        items={[
          { label: 'Presensi', href: '/dashboard/mentor/presensi' },
          {
            label: currentCourse?.title || 'Mata Kuliah',
            href: `/dashboard/mentor/presensi?batch=${currentBatch?.id}&course=${currentCourse?.slug}`,
          },
          { label: `Pertemuan ${sessionNumber}` },
        ]}
      />

      {/* HEADER & QUICK SWITCHER */}
      <header className="space-y-3 border-b border-fd-border pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
                Presensi Pertemuan {sessionNumber}
              </h1>
              <Badge variant="outline" className="text-xs font-semibold">
                {currentBatch?.name}
              </Badge>
              {isSessionActive && (
                <Badge variant="default" className="text-xs font-medium">
                  Live
                </Badge>
              )}
            </div>
            <p className="text-xs text-fd-muted-foreground">
              Mata Kuliah: <strong className="text-fd-foreground">{currentCourse?.title}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {currentCourse && sessionNumber && (
              <Link
                href={`/dashboard/dosen/kelas/${currentCourse.slug}?p=${sessionNumber}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground hover:text-fd-foreground transition-colors mr-2"
              >
                <BookOpen className="size-3.5" />
                <span>Buka Materi Sesi</span>
              </Link>
            )}

            {/* Quick Pertemuan Selector */}
            <Select
              value={String(sessionNumber)}
              onValueChange={(val) => {
                if (val) {
                  router.push(
                    `/dashboard/mentor/presensi?batch=${currentBatch?.id}&course=${currentCourse?.slug}&p=${val}`
                  );
                }
              }}
            >
              <SelectTrigger className="text-xs h-9 bg-fd-background min-w-[130px] font-mono">
                <SelectValue placeholder="Pilih Pertemuan">
                  Pertemuan {sessionNumber}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="z-[80]">
                {Array.from({ length: totalSessions }, (_, i) => i + 1).map((num) => (
                  <SelectItem key={num} value={String(num)} className="text-xs font-mono">
                    Pertemuan {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadSessionRoster}
              disabled={isLoadingRoster}
            >
              <RefreshCw className={`size-3.5 ${isLoadingRoster ? 'animate-spin' : ''}`} />
              <span className="sr-only sm:not-sr-only">Segarkan</span>
            </Button>
          </div>
        </div>
      </header>

      {/* SESSION STATUS / CONTROL BANNER */}
      {isSessionActive && sessionData ? (
        /* Sesi Sedang Aktif */
        <Card className="border-fd-border bg-fd-card shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-lg bg-fd-primary/10 flex items-center justify-center shrink-0 border border-fd-primary/20 text-fd-primary mt-0.5">
                <CalendarCheck className="size-5" />
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className="text-xs font-semibold flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-fd-primary-foreground animate-pulse" />
                    Sesi Sedang Aktif
                  </Badge>
                  <span className="text-xs font-mono font-medium text-fd-muted-foreground">
                    {timeRemaining}
                  </span>
                </div>

                <p className="text-xs text-fd-muted-foreground max-w-xl">
                  Bagikan kode token kepada siswa untuk input presensi melalui web atau bot Discord.
                </p>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <div className="font-mono text-lg font-bold tracking-widest text-fd-foreground bg-fd-muted border border-fd-border px-2.5 py-0.5 rounded-md">
                    {sessionData.tokenCode}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="h-7 text-xs gap-1"
                  >
                    {copiedCode ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedCode ? 'Disalin' : 'Salin'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyDiscordCmd}
                    className="h-7 text-xs gap-1"
                  >
                    {copiedDiscord ? <Check className="size-3 text-emerald-500" /> : <Share2 className="size-3" />}
                    <span>Format Discord</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto shrink-0 pt-2 md:pt-0">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsConfirmCloseOpen(true)}
                className="text-xs h-9 px-3"
              >
                Tutup Presensi
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isSessionExpired && sessionData ? (
        /* Sesi Sudah Selesai / Expired */
        <Card className="border-fd-border bg-fd-card shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-lg bg-fd-muted flex items-center justify-center shrink-0 border border-fd-border text-fd-muted-foreground mt-0.5">
                <Clock className="size-5" />
              </div>

              <div className="space-y-1.5 min-w-0">
                <p className="text-xs text-fd-muted-foreground max-w-xl">
                  Batas waktu presensi telah berakhir. Anda dapat membuka ulang sesi atau mengubah kehadiran siswa di daftar bawah.
                </p>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-xs text-fd-muted-foreground font-medium">Token:</span>
                  <code className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-fd-muted border border-fd-border text-fd-foreground">
                    {sessionData.tokenCode}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyCode}
                    className="h-6 px-2 text-xs text-fd-muted-foreground hover:text-fd-foreground gap-1"
                  >
                    {copiedCode ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedCode ? 'Disalin' : 'Salin'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyDiscordCmd}
                    className="h-6 px-2 text-xs text-fd-muted-foreground hover:text-fd-foreground gap-1"
                  >
                    {copiedDiscord ? <Check className="size-3 text-emerald-500" /> : <Share2 className="size-3" />}
                    <span>Format Discord</span>
                  </Button>
                  <Badge className="text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                    Sesi Berakhir
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto shrink-0 pt-2 md:pt-0">
              <Select
                value={durationMinutes}
                onValueChange={(val) => {
                  if (val) setDurationMinutes(val);
                }}
              >
                <SelectTrigger className="text-xs h-9 min-w-[125px] bg-fd-background">
                  <SelectValue>{durationMinutes} Menit</SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  <SelectItem value="15" className="text-xs">15 Menit</SelectItem>
                  <SelectItem value="30" className="text-xs">30 Menit</SelectItem>
                  <SelectItem value="45" className="text-xs">45 Menit</SelectItem>
                  <SelectItem value="60" className="text-xs">60 Menit</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                onClick={handleReopenSession}
                disabled={isReopeningSession}
                className="text-xs h-9 gap-1.5"
              >
                <RefreshCw className={cn('size-3.5', isReopeningSession && 'animate-spin')} />
                <span>Buka Ulang Sesi</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Sesi Belum Pernah Dibuka */
        <Card className="border-fd-border bg-fd-card shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-lg bg-fd-muted flex items-center justify-center shrink-0 border border-fd-border text-fd-muted-foreground mt-0.5">
                <CalendarCheck className="size-5" />
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs font-medium border-dashed">
                    Belum Dibuka
                  </Badge>
                  <h3 className="text-sm font-semibold text-fd-foreground">
                    Presensi Pertemuan {sessionNumber} Belum Aktif
                  </h3>
                </div>
                <p className="text-xs text-fd-muted-foreground max-w-xl">
                  Buka sesi kehadiran untuk membagikan kode token baru kepada siswa.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleOpenSession}
              className="flex items-center gap-2 self-start md:self-auto shrink-0 pt-2 md:pt-0"
            >
              <Select
                value={durationMinutes}
                onValueChange={(val) => {
                  if (val) setDurationMinutes(val);
                }}
              >
                <SelectTrigger className="text-xs h-9 min-w-[125px] bg-fd-background">
                  <SelectValue>{durationMinutes} Menit</SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  <SelectItem value="15" className="text-xs">15 Menit</SelectItem>
                  <SelectItem value="30" className="text-xs">30 Menit</SelectItem>
                  <SelectItem value="45" className="text-xs">45 Menit</SelectItem>
                  <SelectItem value="60" className="text-xs">60 Menit</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingOpen}
                className="text-xs h-9 gap-1.5"
              >
                <CalendarCheck className="size-3.5" />
                <span>Buka Sesi Presensi</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ROSTER TABLE SECTION */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-1.5">
            <div>
              <h2 className="text-base font-semibold text-fd-foreground">
                Daftar Siswa & Presensi
              </h2>
              <p className="text-xs text-fd-muted-foreground">
                Pilih radio button untuk menetapkan kehadiran siswa.
              </p>
            </div>

            {/* REKAP PRESENSI LANGSUNG DI BAWAH DAFTAR SISWA & PRESENSI */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-fd-muted-foreground text-xs font-medium">
                Total: <strong className="text-fd-foreground">{stats.total} Siswa</strong>
              </span>
              <span className="text-fd-muted-foreground/60">•</span>
              <Badge variant="secondary" className="text-xs font-medium">
                Hadir: {stats.present}
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium">
                Izin: {stats.permission}
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium">
                Sakit: {stats.sick}
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium">
                Alpa: {stats.absent}
              </Badge>
              {stats.unrecorded > 0 && (
                <Badge variant="outline" className="text-xs font-medium border-dashed text-fd-muted-foreground">
                  Belum Absen: {stats.unrecorded}
                </Badge>
              )}
            </div>
          </div>

          <div className="relative w-full sm:w-64 self-start sm:self-end">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-fd-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari siswa..."
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              className="text-xs h-8 pl-8 bg-fd-background"
            />
          </div>
        </div>

        <div className="rounded-xl border border-fd-border bg-fd-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-fd-muted/40 hover:bg-fd-muted/40 border-b border-fd-border">
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Nama Siswa</TableHead>
                <TableHead className="text-xs text-right pr-6">Status Presensi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoster.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-xs text-fd-muted-foreground">
                    {rosterList.length === 0
                      ? 'Belum ada siswa yang terdaftar di batch ini.'
                      : 'Tidak ada siswa yang cocok dengan pencarian.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoster.map((student, idx) => {
                  const displayStatus = getStudentDisplayStatus(student);
                  const isPending = togglingStudentId === student.studentId;
                  const hasExplanation =
                    student.status === 'permission' ||
                    student.status === 'sick' ||
                    Boolean(student.note) ||
                    Boolean(student.attachmentUrl);

                  return (
                    <TableRow key={student.studentId} className="hover:bg-fd-muted/20">
                      {/* 1. Index */}
                      <TableCell className="text-center font-mono text-xs text-fd-muted-foreground w-12 py-3.5">
                        {idx + 1}
                      </TableCell>

                      {/* 2. Nama Siswa (Tanpa Email) */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-fd-primary/10 text-fd-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-fd-border">
                            {student.avatarUrl ? (
                              <img
                                src={student.avatarUrl}
                                alt={student.fullName}
                                className="size-full object-cover"
                              />
                            ) : (
                              student.fullName.charAt(0).toUpperCase()
                            )}
                          </div>

                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-xs text-fd-foreground truncate">
                              {student.fullName}
                            </span>
                            {student.discordUsername && (
                              <span className="font-mono text-[10px] text-fd-muted-foreground bg-fd-muted px-1.5 py-0.5 rounded shrink-0">
                                @{student.discordUsername}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* 3. Status Presensi di Pojok Kanan (dengan tombol Lihat Pengajuan di sebelah kirinya) */}
                      <TableCell className="text-right pr-6 py-3.5">
                        <div className="inline-flex items-center justify-end gap-3.5">
                          {/* Sebelah kiri nya status presensi: Tombol lihat pengajuan izin/sakit jika ada pengajuan */}
                          {hasExplanation && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setReviewStudent(student)}
                              className="h-7 text-xs gap-1.5"
                            >
                              <FileText className="size-3" />
                              <span>Lihat Pengajuan Izin / Sakit</span>
                            </Button>
                          )}

                          {/* Radio Group titik dari @/components/ui/radio-group.tsx */}
                          <RadioGroup
                            value={displayStatus || ''}
                            onValueChange={(val) => {
                              if (val) {
                                handleUpdateStudentStatus(
                                  student.studentId,
                                  val as 'present' | 'permission' | 'sick' | 'absent'
                                );
                              }
                            }}
                            className="flex items-center gap-4 w-auto"
                          >
                            {/* Radio H (Hadir) */}
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-fd-foreground select-none">
                              <RadioGroupItem value="present" disabled={isPending} />
                              <span>H</span>
                            </label>

                            {/* Radio I (Izin) */}
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-fd-foreground select-none">
                              <RadioGroupItem value="permission" disabled={isPending} />
                              <span>I</span>
                            </label>

                            {/* Radio S (Sakit) */}
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-fd-foreground select-none">
                              <RadioGroupItem value="sick" disabled={isPending} />
                              <span>S</span>
                            </label>

                            {/* Radio A (Alpa) */}
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-fd-foreground select-none">
                              <RadioGroupItem value="absent" disabled={isPending} />
                              <span>A</span>
                            </label>
                          </RadioGroup>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* DIALOG: REVIEW KETERANGAN IZIN / SAKIT */}
      <Dialog open={Boolean(reviewStudent)} onOpenChange={(open) => !open && setReviewStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="size-4 text-fd-primary" />
              <span>Pengajuan Izin / Sakit</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tinjau keterangan dan bukti surat izin/sakit dari siswa.
            </DialogDescription>
          </DialogHeader>

          {reviewStudent && (
            <div className="space-y-4 pt-2">
              {/* Profil Siswa */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-fd-muted/40 border border-fd-border">
                <div className="size-10 rounded-full bg-fd-primary/10 text-fd-primary font-bold flex items-center justify-center text-sm overflow-hidden shrink-0">
                  {reviewStudent.avatarUrl ? (
                    <img
                      src={reviewStudent.avatarUrl}
                      alt={reviewStudent.fullName}
                      className="size-full object-cover"
                    />
                  ) : (
                    reviewStudent.fullName.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-fd-foreground">
                    {reviewStudent.fullName}
                  </h4>
                  {reviewStudent.discordUsername && (
                    <p className="text-xs text-fd-muted-foreground font-mono">
                      @{reviewStudent.discordUsername}
                    </p>
                  )}
                </div>
              </div>

              {/* Status Pengajuan */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-fd-muted-foreground">
                  Jenis Pengajuan
                </span>
                <div>
                  <Badge variant="secondary" className="text-xs">
                    {reviewStudent.status === 'sick'
                      ? 'Sakit'
                      : reviewStudent.status === 'permission'
                      ? 'Izin'
                      : reviewStudent.status || 'Keterangan Tambahan'}
                  </Badge>
                </div>
              </div>

              {/* Catatan Tertulis */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-fd-muted-foreground">
                  Catatan Siswa
                </span>
                <div className="p-3 rounded-lg border border-fd-border bg-fd-background text-xs text-fd-foreground whitespace-pre-wrap min-h-[60px]">
                  {reviewStudent.note || (
                    <span className="text-fd-muted-foreground italic">
                      Tidak ada catatan tertulis dari siswa.
                    </span>
                  )}
                </div>
              </div>

              {/* Bukti Lampiran */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-fd-muted-foreground">
                  Bukti Surat / Lampiran
                </span>
                {reviewStudent.attachmentUrl ? (
                  <div className="rounded-lg border border-fd-border overflow-hidden bg-fd-muted/20 p-2 space-y-2">
                    {reviewStudent.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ? (
                      <div className="relative max-h-48 overflow-hidden rounded border border-fd-border bg-black/5">
                        <img
                          src={reviewStudent.attachmentUrl}
                          alt="Bukti Lampiran"
                          className="w-full h-auto object-contain max-h-48"
                        />
                      </div>
                    ) : null}
                    <div className="flex justify-end">
                      <a
                        href={reviewStudent.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'sm' }),
                          'text-xs h-7 gap-1'
                        )}
                      >
                        <ExternalLink className="size-3" />
                        <span>Buka Lampiran Dokumen</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-fd-muted-foreground italic">
                    Tidak melampirkan berkas bukti.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-fd-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmittingApproval}
              onClick={() => handleApproveKeterangan('absent')}
              className="text-xs"
            >
              Tolak (Jadikan Alpa)
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmittingApproval}
                onClick={() => handleApproveKeterangan('present')}
                className="text-xs"
              >
                Hadirkan
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isSubmittingApproval}
                onClick={() =>
                  handleApproveKeterangan(
                    reviewStudent?.status === 'sick' ? 'sick' : 'permission'
                  )
                }
                className="text-xs"
              >
                {reviewStudent?.status === 'sick' ? 'Setujui Sakit' : 'Setujui Izin'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM CLOSE DIALOG */}
      <Dialog open={isConfirmCloseOpen} onOpenChange={setIsConfirmCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertCircle className="size-5" />
              <span>Tutup Sesi Presensi Sekarang?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Siswa yang belum menginput kode kehadiran hingga sesi ditutup akan otomatis tercatat sebagai Alpa (A). Anda tetap dapat mengubah status kehadiran secara manual sewaktu-waktu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmCloseOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isClosingSession}
              onClick={handleCloseSession}
            >
              {isClosingSession ? 'Menutup...' : 'Ya, Tutup Presensi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
