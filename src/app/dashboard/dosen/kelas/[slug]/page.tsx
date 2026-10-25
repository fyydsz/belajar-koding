'use client';

import React, { useEffect, useState, useCallback, use, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import {
  BookOpen,
  PlusCircle,
  FileText,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Edit,
  Trash2,
  Clock,
  ExternalLink,
  Download,
  Loader2,
  ArrowLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Layers,
  CalendarCheck,
  Copy,
  Check,
  Users,
} from 'lucide-react';
import { MDXEditor } from '@/components/dashboard/classroom/mdx-editor';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

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
}

interface BatchOption {
  id: string;
  name: string;
  status: string;
}

interface AttendanceActiveData {
  id: string;
  batchId: string;
  sessionNumber: number;
  tokenCode: string;
  expiresAt: string;
  attendees?: Array<{
    id: string;
    studentName: string;
    avatarUrl: string | null;
    checkedInAt: string;
    channel: 'web' | 'discord';
  }>;
}

function DosenClassroomDetailContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pFromUrl = searchParams.get('p');
  const urlSessionNumber = pFromUrl ? parseInt(pFromUrl, 10) : null;
  const isViewingSpecificSession = Boolean(urlSessionNumber && !isNaN(urlSessionNumber));

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  // Active Session Data (Only loaded when viewing a specific session)
  const [activeSessionInfo, setActiveSessionInfo] = useState<SessionSummary | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<AssignmentItem[]>([]);

  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionDesc, setNewSessionDesc] = useState('');

  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialContentMdx, setMaterialContentMdx] = useState('');
  const [materialFileUrl, setMaterialFileUrl] = useState('');

  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentExpiredAt, setAssignmentExpiredAt] = useState('');
  const [assignmentDescMdx, setAssignmentDescMdx] = useState('');

  // Delete Session Modal State
  const [isDeleteSessionModalOpen, setIsDeleteSessionModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionSummary | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Edit Session Modal State
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<SessionSummary | null>(null);
  const [editSessionTitle, setEditSessionTitle] = useState('');
  const [editSessionDesc, setEditSessionDesc] = useState('');
  const [isSavingSession, setIsSavingSession] = useState(false);

  // Attendance State
  const [courseBatches, setCourseBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [activeAttendance, setActiveAttendance] = useState<AttendanceActiveData | null>(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceDuration, setAttendanceDuration] = useState<number>(30);
  const [isOpeningAttendance, setIsOpeningAttendance] = useState(false);
  const [isClosingAttendance, setIsClosingAttendance] = useState(false);
  const [hasCopiedToken, setHasCopiedToken] = useState(false);
  const [remainingTimeText, setRemainingTimeText] = useState<string>('');

  const [isSubmitting, startTransition] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Keyboard shortcut: Escape to close any open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDeleteSessionModalOpen(false);
        setSessionToDelete(null);
        setIsEditSessionModalOpen(false);
        setSessionToEdit(null);
        setIsNewSessionModalOpen(false);
        setIsMaterialModalOpen(false);
        setIsAssignmentModalOpen(false);
        setEditingAssignmentId(null);
        setIsAttendanceModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Initial Load & Auth
  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((u) => {
      if (mounted) setCurrentUser(u);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch Selected Session Detail
  const loadSessionData = useCallback(
    async (sessionNum: number) => {
      setIsLoadingSession(true);
      topProgress.start();
      try {
        const token = getAuthToken();
        const res = await fetch(
          `${apiUrl}/v1/classroom/courses/${slug}/sessions/${sessionNum}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const json = await res.json();

        if (res.ok && json.success) {
          setActiveSessionInfo(json.data.session);
          setMaterials(json.data.materials || []);
          setAssignmentsList(json.data.assignments || []);
        } else {
          setActiveSessionInfo(null);
          setMaterials([]);
          setAssignmentsList([]);
        }
      } catch (err: unknown) {
        console.error('Gagal memuat sesi:', err);
      } finally {
        setIsLoadingSession(false);
        topProgress.done();
      }
    },
    [apiUrl, slug]
  );

  // Attendance helpers & polling
  const loadCourseBatches = useCallback(
    async (courseId?: string) => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${apiUrl}/v1/batches/my-batches`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) {
          const matched = json.data.filter((b: any) => {
            if (b.courseSlug === slug || (courseId && b.courseId === courseId)) return true;
            if (Array.isArray(b.courses)) {
              return b.courses.some((c: any) => c.slug === slug || (courseId && c.courseId === courseId));
            }
            return false;
          });
          const listToUse = matched.length > 0 ? matched : json.data;
          const mapped: BatchOption[] = listToUse.map((b: any) => ({
            id: b.id || b.batchId,
            name: b.name || b.batchName || 'Batch',
            status: b.status || b.batchStatus || 'active',
          }));
          setCourseBatches(mapped);
          if (mapped.length > 0) {
            setSelectedBatchId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0].id));
          }
        }
      } catch (err) {
        console.error('Gagal memuat batch kelas:', err);
      }
    },
    [apiUrl, slug]
  );

  // 3. Fetch Course and Sessions
  const loadCourseData = useCallback(async () => {
    setIsLoadingCourse(true);
    topProgress.start();
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/classroom/courses/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setCourse(json.data.course);
        loadCourseBatches(json.data.course?.id);
        const sessList: SessionSummary[] = json.data.sessions || [];
        setSessions(sessList);

        if (isViewingSpecificSession && urlSessionNumber) {
          const found = sessList.find((s) => s.sessionNumber === urlSessionNumber);
          if (found) {
            setActiveSessionInfo(found);
            await loadSessionData(urlSessionNumber);
          } else {
            setActiveSessionInfo(null);
            setMaterials([]);
            setAssignmentsList([]);
          }
        } else {
          setActiveSessionInfo(null);
          setMaterials([]);
          setAssignmentsList([]);
        }
      } else {
        throw new Error(json.message || 'Gagal memuat detail kelas.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memuat kelas.';
      setError(msg);
    } finally {
      setIsLoadingCourse(false);
      topProgress.done();
    }
  }, [apiUrl, slug, isViewingSpecificSession, urlSessionNumber, loadSessionData, loadCourseBatches]);

  const checkActiveAttendance = useCallback(
    async (batchId: string, sessNum: number) => {
      if (!batchId || !sessNum) return;
      try {
        const token = getAuthToken();
        const res = await fetch(`${apiUrl}/v1/attendance/active/${batchId}?sessionNumber=${sessNum}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setActiveAttendance(json.data);
        } else {
          setActiveAttendance(null);
        }
      } catch (err) {
        console.error('Gagal cek presensi aktif:', err);
      }
    },
    [apiUrl]
  );

  useEffect(() => {
    if (selectedBatchId && urlSessionNumber) {
      checkActiveAttendance(selectedBatchId, urlSessionNumber);
    }
  }, [selectedBatchId, urlSessionNumber, checkActiveAttendance]);

  useEffect(() => {
    if (!isAttendanceModalOpen || !selectedBatchId || !urlSessionNumber || !activeAttendance) return;
    const interval = setInterval(() => {
      checkActiveAttendance(selectedBatchId, urlSessionNumber);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAttendanceModalOpen, selectedBatchId, urlSessionNumber, activeAttendance, checkActiveAttendance]);

  useEffect(() => {
    if (!activeAttendance?.expiresAt) {
      setRemainingTimeText('');
      return;
    }
    const updateCountdown = () => {
      const diffMs = new Date(activeAttendance.expiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setRemainingTimeText('Selesai');
        return;
      }
      const totalSec = Math.floor(diffMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setRemainingTimeText(`${m}m ${s < 10 ? '0' : ''}${s}d`);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeAttendance?.expiresAt]);

  const handleOpenAttendance = async () => {
    if (!selectedBatchId || !urlSessionNumber) {
      toast.error('Pilih batch terlebih dahulu.');
      return;
    }
    setIsOpeningAttendance(true);
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
          sessionNumber: urlSessionNumber,
          durationMinutes: attendanceDuration,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Sesi presensi berhasil dibuka!');
        checkActiveAttendance(selectedBatchId, urlSessionNumber);
      } else {
        toast.error(json.message || 'Gagal membuka sesi presensi.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kendala sistem.');
    } finally {
      setIsOpeningAttendance(false);
    }
  };

  const handleCloseAttendance = async () => {
    if (!activeAttendance) return;
    setIsClosingAttendance(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/attendance/close/${activeAttendance.id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Sesi presensi ditutup.');
        setActiveAttendance(null);
      } else {
        toast.error(json.message || 'Gagal menutup presensi.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kendala sistem.');
    } finally {
      setIsClosingAttendance(false);
    }
  };

  const handleCopyAttendanceToken = (code: string) => {
    navigator.clipboard.writeText(code);
    setHasCopiedToken(true);
    toast.success('Kode presensi disalin ke clipboard!');
    setTimeout(() => setHasCopiedToken(false), 2000);
  };

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      await loadCourseData();
    };
    run();
    return () => {
      ignore = true;
    };
  }, [loadCourseData]);

  useEffect(() => {
    if (isViewingSpecificSession && urlSessionNumber) {
      loadSessionData(urlSessionNumber);
    }
  }, [isViewingSpecificSession, urlSessionNumber, loadSessionData]);

  const notifySidebarUpdate = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('classroom-updated'));
    }
  };

  const handleSelectSession = (num: number) => {
    router.push(`/dashboard/dosen/kelas/${slug}?p=${num}`);
  };

  // Handler: Buat Sesi Baru
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;

    startTransition(async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${apiUrl}/v1/classroom/courses/${slug}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: newSessionTitle.trim(),
            description: newSessionDesc.trim() || undefined,
          }),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          setIsNewSessionModalOpen(false);
          setNewSessionTitle('');
          setNewSessionDesc('');
          toast.success(json.message || 'Sesi pertemuan berhasil dibuat.');
          await loadCourseData();
          notifySidebarUpdate();
          if (json.data?.sessionNumber) {
            router.push(`/dashboard/dosen/kelas/${slug}?p=${json.data.sessionNumber}`);
          }
        } else {
          toast.error(json.message || 'Gagal membuat pertemuan baru.');
        }
      } catch {
        toast.error('Terjadi kesalahan koneksi.');
      }
    });
  };

  // Handler: Hapus Sesi Pertemuan (Aktif atau dari Card Overview)
  const handleDeleteSession = async () => {
    const targetSession = sessionToDelete || activeSessionInfo;
    if (!targetSession) return;

    setIsDeletingSession(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/classroom/sessions/${targetSession.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setIsDeleteSessionModalOpen(false);
        const deletedNumber = targetSession.sessionNumber;
        setSessionToDelete(null);
        toast.success(json.message || `Pertemuan P${deletedNumber} berhasil dihapus.`);
        notifySidebarUpdate();

        await loadCourseData();

        // Jika sedang membuka sesi yang baru saja dihapus, kembali ke daftar pertemuan kelas
        if (isViewingSpecificSession && urlSessionNumber === deletedNumber) {
          router.push(`/dashboard/dosen/kelas/${slug}`);
        }
      } else {
        toast.error(json.message || 'Gagal menghapus pertemuan.');
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi saat menghapus pertemuan.');
    } finally {
      setIsDeletingSession(false);
    }
  };

  // Handler: Buka Modal Ubah Sesi Pertemuan
  const handleOpenEditSession = (sess: SessionSummary) => {
    setSessionToEdit(sess);
    setEditSessionTitle(sess.title);
    setEditSessionDesc(sess.description || '');
    setIsEditSessionModalOpen(true);
  };

  // Handler: Simpan Perubahan Sesi Pertemuan (PUT)
  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToEdit || !editSessionTitle.trim()) return;

    setIsSavingSession(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/classroom/sessions/${sessionToEdit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editSessionTitle.trim(),
          description: editSessionDesc.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Sesi pertemuan berhasil diperbarui.');
        setIsEditSessionModalOpen(false);

        // Update local activeSessionInfo if currently viewing this session
        if (activeSessionInfo && activeSessionInfo.id === sessionToEdit.id) {
          setActiveSessionInfo({
            ...activeSessionInfo,
            title: editSessionTitle.trim(),
            description: editSessionDesc.trim() || null,
          });
        }

        // Update sessions list in state
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionToEdit.id
              ? { ...s, title: editSessionTitle.trim(), description: editSessionDesc.trim() || null }
              : s
          )
        );

        notifySidebarUpdate();
      } else {
        toast.error(json.message || 'Gagal memperbarui sesi pertemuan.');
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi saat memperbarui pertemuan.');
    } finally {
      setIsSavingSession(false);
    }
  };

  // Handler: Buka Modal Tambah Materi Baru
  const handleOpenAddMaterial = () => {
    setEditingMaterialId(null);
    setMaterialTitle('');
    setMaterialContentMdx('');
    setMaterialFileUrl('');
    setIsMaterialModalOpen(true);
  };

  // Handler: Buka Modal Edit Materi
  const handleOpenEditMaterial = (mat: MaterialItem) => {
    setEditingMaterialId(mat.id);
    setMaterialTitle(mat.title);
    setMaterialContentMdx(mat.contentMdx);
    setMaterialFileUrl(mat.fileUrl || '');
    setIsMaterialModalOpen(true);
  };

  // Handler: Simpan Materi (POST / PUT)
  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTitle.trim() || !materialContentMdx.trim() || !activeSessionInfo) return;

    startTransition(async () => {
      try {
        const token = getAuthToken();
        const endpoint = editingMaterialId
          ? `${apiUrl}/v1/classroom/materials/${editingMaterialId}`
          : `${apiUrl}/v1/classroom/sessions/${activeSessionInfo.id}/materials`;

        const method = editingMaterialId ? 'PUT' : 'POST';

        const res = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: materialTitle.trim(),
            content_mdx: materialContentMdx.trim(),
            file_url: materialFileUrl.trim() || undefined,
          }),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          setIsMaterialModalOpen(false);
          toast.success(
            editingMaterialId ? 'Materi berhasil diperbarui!' : 'Materi berhasil diunggah ke Supabase!'
          );
          if (urlSessionNumber) {
            loadSessionData(urlSessionNumber);
          }
          loadCourseData();
          notifySidebarUpdate();
        } else {
          toast.error(json.message || 'Gagal menyimpan materi.');
        }
      } catch {
        toast.error('Terjadi kesalahan koneksi saat menyimpan materi.');
      }
    });
  };

  // Handler: Hapus Materi
  const handleDeleteMaterial = async (materialId: string) => {
    if (!window.confirm('Yakin ingin menghapus materi ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }

    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/classroom/materials/${materialId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (res.ok && json.success) {
        toast.success('Materi berhasil dihapus.');
        if (urlSessionNumber) {
          loadSessionData(urlSessionNumber);
        }
        loadCourseData();
        notifySidebarUpdate();
      } else {
        toast.error(json.message || 'Gagal menghapus materi.');
      }
    } catch {
      toast.error('Terjadi kesalahan saat menghapus materi.');
    }
  };

  // Handler: Buka Modal Tambah Tugas Baru
  const handleOpenAddAssignment = () => {
    setEditingAssignmentId(null);
    setAssignmentTitle('');
    setAssignmentExpiredAt('');
    setAssignmentDescMdx('');
    setIsAssignmentModalOpen(true);
  };

  // Handler: Buka Modal Edit Tugas
  const handleOpenEditAssignment = (task: AssignmentItem) => {
    setEditingAssignmentId(task.id);
    setAssignmentTitle(task.title);
    if (task.expiredAt) {
      const d = new Date(task.expiredAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setAssignmentExpiredAt(formatted);
    } else {
      setAssignmentExpiredAt('');
    }
    setAssignmentDescMdx(task.description || '');
    setIsAssignmentModalOpen(true);
  };

  // Handler: Simpan Tugas (POST Baru atau PUT Edit)
  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim() || !assignmentExpiredAt || !course || !activeSessionInfo) return;

    startTransition(async () => {
      try {
        const token = getAuthToken();
        const endpoint = editingAssignmentId
          ? `${apiUrl}/v1/assignments/${editingAssignmentId}`
          : `${apiUrl}/v1/assignments`;

        const method = editingAssignmentId ? 'PUT' : 'POST';

        const bodyPayload = editingAssignmentId
          ? {
              title: assignmentTitle.trim(),
              description: assignmentDescMdx.trim() || undefined,
              expired_at: new Date(assignmentExpiredAt).toISOString(),
            }
          : {
              course_id: course.id,
              session_id: activeSessionInfo.id,
              title: assignmentTitle.trim(),
              description: assignmentDescMdx.trim() || undefined,
              expired_at: new Date(assignmentExpiredAt).toISOString(),
            };

        const res = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(bodyPayload),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          setIsAssignmentModalOpen(false);
          setAssignmentTitle('');
          setAssignmentExpiredAt('');
          setAssignmentDescMdx('');
          setEditingAssignmentId(null);
          toast.success(
            editingAssignmentId
              ? 'Tugas berhasil diperbarui!'
              : 'Tugas baru berhasil dibuat untuk pertemuan ini!'
          );
          if (urlSessionNumber) {
            loadSessionData(urlSessionNumber);
          }
          loadCourseData();
          notifySidebarUpdate();
        } else {
          toast.error(json.message || 'Gagal menyimpan tugas.');
        }
      } catch {
        toast.error('Terjadi kesalahan koneksi saat menyimpan tugas.');
      }
    });
  };

  // Handler: Hapus Tugas
  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Yakin ingin menghapus tugas ini? Semua data pengumpulan mahasiswa yang terhubung juga akan dihapus.')) {
      return;
    }

    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (res.ok && json.success) {
        toast.success(json.message || 'Tugas berhasil dihapus.');
        if (urlSessionNumber) {
          loadSessionData(urlSessionNumber);
        }
        loadCourseData();
        notifySidebarUpdate();
      } else {
        toast.error(json.message || 'Gagal menghapus tugas.');
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi saat menghapus tugas.');
    }
  };

  if (isLoadingCourse || (isViewingSpecificSession && isLoadingSession)) {
    return null;
  }

  return (
    <div className="space-y-8 pb-16">
      {!isViewingSpecificSession ? (
        /* ================= MODE 1: RINGKASAN KELAS & DAFTAR PERTEMUAN (OVERVIEW) ================= */
        <>
          {/* Top Navigation Bar / Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-fd-muted-foreground">
              <Link
                href="/dashboard/dosen/kelas"
                className="hover:text-fd-foreground transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:underline"
              >
                <ArrowLeft className="size-3.5 shrink-0" />
                <span>Kelola Kelas</span>
              </Link>
              <span className="text-fd-border">/</span>
              <span className="text-fd-foreground font-medium truncate max-w-[200px] sm:max-w-xs">
                {course?.title || 'Detail Kelas'}
              </span>
            </nav>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsNewSessionModalOpen(true)}
              className="self-start sm:self-auto shrink-0"
            >
              <PlusCircle className="size-3.5 shrink-0" />
              <span>Tambah Sesi Baru</span>
            </Button>
          </div>

          {/* Course Overview Header */}
          <header className="space-y-2 pb-5 border-b border-fd-border">
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
                  'Kelola kurikulum, sesi pertemuan, materi pembelajaran MDX, dan tugas siswa untuk kelas ini.'}
              </p>
            </div>
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
                  Belum Ada Sesi Pertemuan
                </h3>
                <p className="text-xs sm:text-sm text-fd-muted-foreground max-w-md mx-auto">
                  Kelas ini belum memiliki sesi pertemuan. Buat pertemuan baru untuk mulai mengunggah materi ajar dan tugas praktikum.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsNewSessionModalOpen(true)}
              >
                <PlusCircle className="size-3.5" />
                <span>Buat Pertemuan Pertama</span>
              </Button>
            </div>
          ) : (
            <main className="space-y-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-fd-foreground">
                  Daftar Sesi Pertemuan
                </h2>
                <p className="text-xs text-fd-muted-foreground mt-0.5">
                  Pilih sesi pertemuan untuk mengelola modul materi MDX dan penugasan siswa.
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
                      {/* Top row: session indicator & quick actions */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md border border-fd-border bg-fd-muted/50 font-mono text-xs font-semibold text-fd-foreground">
                          Pertemuan {sess.sessionNumber.toString().padStart(2, '0')}
                        </span>

                        <ButtonGroup className="relative z-20">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenEditSession(sess);
                            }}
                            title={`Ubah Nama & Info Pertemuan ${sess.sessionNumber}`}
                            aria-label={`Ubah Nama & Info Pertemuan ${sess.sessionNumber}`}
                          >
                            <Edit className="size-3.5 shrink-0" />
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSessionToDelete(sess);
                              setIsDeleteSessionModalOpen(true);
                            }}
                            title={`Hapus Pertemuan P${sess.sessionNumber}`}
                            aria-label={`Hapus Pertemuan P${sess.sessionNumber}`}
                          >
                            <Trash2 className="size-3.5 shrink-0" />
                          </Button>
                        </ButtonGroup>
                      </div>

                      {/* Session Title (Whole-card clickable link) */}
                      <h3 className="font-semibold text-base text-fd-foreground group-hover:text-fd-primary transition-colors line-clamp-2 leading-snug">
                        <Link
                          href={`/dashboard/dosen/kelas/${slug}?p=${sess.sessionNumber}`}
                          className="focus-visible:outline-none focus-visible:underline before:absolute before:inset-0 before:z-10"
                        >
                          {sess.title}
                        </Link>
                      </h3>

                      {/* Session Description */}
                      <p className="text-fd-muted-foreground text-xs leading-relaxed mt-2 line-clamp-2">
                        {sess.description || 'Belum ada ringkasan materi untuk sesi pertemuan ini.'}
                      </p>
                    </div>

                    {/* Card Footer: Counts & Action */}
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
                        <span>Kelola</span>
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
        /* ================= MODE 2: DETAIL SESI PERTEMUAN SPESIFIK (?p=...) ================= */
        <>
          {/* Top Breadcrumb & Clean Navigation */}
          <div className="pt-1">
            <Link
              href={`/dashboard/dosen/kelas/${slug}`}
              className="inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors group"
            >
              <ArrowLeft className="size-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span>Semua Pertemuan</span>
              <span className="text-fd-border mx-1">/</span>
              <span className="text-fd-foreground font-medium truncate max-w-[200px] sm:max-w-md">
                {course?.title || 'Kelas'}
              </span>
            </Link>
          </div>

          {/* Session Header & Content */}
          {!activeSessionInfo ? (
            <div className="p-8 rounded-2xl border border-fd-border bg-fd-card text-center space-y-4">
              <AlertCircle className="size-10 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-fd-foreground">
                  Pertemuan P{urlSessionNumber} Tidak Ditemukan
                </h3>
                <p className="text-xs sm:text-sm text-fd-muted-foreground max-w-md mx-auto">
                  Sesi pertemuan yang Anda cari tidak tersedia atau mungkin telah dihapus.
                </p>
              </div>
              <Link
                href={`/dashboard/dosen/kelas/${slug}`}
                data-slot="button"
                className={buttonVariants({ variant: 'default', size: 'sm' })}
              >
                <ArrowLeft className="size-3.5" />
                <span>Kembali ke Daftar Pertemuan</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Session Header */}
              <header className="space-y-4 pb-6 border-b border-fd-border/50">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-fd-foreground leading-tight">
                      {activeSessionInfo.title || `Pertemuan ${urlSessionNumber}`}
                    </h1>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleOpenEditSession(activeSessionInfo)}
                      title="Ubah judul & deskripsi sesi pertemuan"
                      aria-label="Ubah judul & deskripsi sesi pertemuan"
                      className="shrink-0"
                    >
                      <Edit className="size-3.5 shrink-0" />
                    </Button>
                  </div>

                  {activeSessionInfo.description ? (
                    <p className="text-sm sm:text-base text-fd-muted-foreground leading-relaxed max-w-3xl">
                      {activeSessionInfo.description}
                    </p>
                  ) : null}
                </div>

                {/* Balanced Action Toolbar */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-fd-border/40">
                  <ButtonGroup className="flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleOpenAddMaterial}
                    >
                      <PlusCircle className="size-3.5 shrink-0" />
                      <span>Tambah Materi</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenAddAssignment}
                    >
                      <ClipboardList className="size-3.5 shrink-0 text-fd-muted-foreground" />
                      <span>Tambah Tugas</span>
                    </Button>

                    {activeAttendance ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAttendanceModalOpen(true)}
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                        title="Lihat kode dan status presensi aktif"
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span>Presensi: <span className="font-mono font-bold tracking-wider">{activeAttendance.tokenCode}</span></span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAttendanceModalOpen(true)}
                        title="Buka sesi presensi untuk pertemuan ini"
                      >
                        <CalendarCheck className="size-3.5 shrink-0 text-fd-primary" />
                        <span>Buka Presensi</span>
                      </Button>
                    )}
                  </ButtonGroup>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSessionToDelete(activeSessionInfo);
                      setIsDeleteSessionModalOpen(true);
                    }}
                    title={`Hapus Pertemuan P${urlSessionNumber}`}
                    className="self-start sm:self-auto"
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                    <span>Hapus Pertemuan</span>
                  </Button>
                </div>
              </header>

              <main className="space-y-12">
              {/* 1. KONTEN MATERI (MDX) DI SESI INI */}
              <section className="space-y-8">
                {materials.length === 0 ? (
                  <div className="py-8 text-sm text-fd-muted-foreground space-y-2 border-y border-dashed border-fd-border/50">
                    <p>Belum ada materi perkuliahan untuk pertemuan ini.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenAddMaterial}
                    >
                      <PlusCircle className="size-3.5 text-fd-primary" />
                      <span>Tulis materi baru sekarang (MDX)</span>
                    </Button>
                  </div>
                ) : (
                  materials.map((mat) => (
                    <article key={mat.id} className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fd-border/30 pb-2">
                        <div>
                          <h2 className="text-xl font-bold tracking-tight text-fd-foreground">
                            {mat.title}
                          </h2>
                          <p className="text-xs text-fd-muted-foreground mt-0.5">
                            Oleh: {mat.mentorName || 'Pengajar'} &bull; Diperbarui:{' '}
                            {new Date(mat.updatedAt).toLocaleDateString('id-ID')}
                          </p>
                        </div>

                        <ButtonGroup>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditMaterial(mat)}
                          >
                            <Edit className="size-3.5" />
                            <span>Edit MDX</span>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteMaterial(mat.id)}
                            title="Hapus Materi"
                            aria-label="Hapus Materi"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </ButtonGroup>
                      </div>

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
                      <div className="pt-1">
                        <DynamicMDXRenderer content={mat.contentMdx} />
                      </div>
                    </article>
                  ))
                )}
              </section>

              {/* 2. DAFTAR TUGAS DI SESI INI */}
              {assignmentsList.length > 0 && (
                <section className="space-y-6 pt-10 border-t border-fd-border/60">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-fd-foreground">
                      Tugas & Praktikum
                    </h2>
                    <p className="text-sm text-fd-muted-foreground mt-1">
                      Tugas yang ditautkan ke pertemuan ini.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {assignmentsList.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-2xl border border-fd-border bg-fd-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs hover:border-fd-primary/30 transition-all"
                      >
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Tugas Praktikum
                            </span>
                            <span className="text-[11px] text-fd-muted-foreground flex items-center gap-1">
                              <Clock className="size-3 text-fd-muted-foreground" />
                              <span>
                                Deadline:{' '}
                                {new Date(task.expiredAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-fd-foreground">
                            {task.title}
                          </h3>

                          {task.description && (
                            <p className="text-xs text-fd-muted-foreground line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        <ButtonGroup className="shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditAssignment(task)}
                            title="Edit Tugas"
                          >
                            <Edit className="size-3.5" />
                            <span>Edit Tugas</span>
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteAssignment(task.id)}
                            title="Hapus Tugas"
                            aria-label="Hapus Tugas"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>

                          <Link
                            href="/dashboard/dosen/tugas"
                            data-slot="button"
                            className={buttonVariants({ variant: 'default', size: 'sm' })}
                          >
                            <span>Koreksi & Nilai</span>
                            <ChevronRight className="size-3.5" />
                          </Link>
                        </ButtonGroup>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* BOTTOM PAGINATION: Pindah Sesi dengan Mudah */}
              <nav
                aria-label="Navigasi Pertemuan"
                className="flex items-center justify-between pt-10 border-t border-fd-border/50"
              >
                {sessions.findIndex((s) => s.sessionNumber === urlSessionNumber) > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const idx = sessions.findIndex((s) => s.sessionNumber === urlSessionNumber);
                      handleSelectSession(sessions[idx - 1].sessionNumber);
                    }}
                  >
                    <ChevronLeft className="size-3.5" />
                    <span className="truncate max-w-[200px] sm:max-w-xs">
                      P{sessions[sessions.findIndex((s) => s.sessionNumber === urlSessionNumber) - 1].sessionNumber}:{' '}
                      {sessions[sessions.findIndex((s) => s.sessionNumber === urlSessionNumber) - 1].title}
                    </span>
                  </Button>
                ) : (
                  <div />
                )}

                {sessions.findIndex((s) => s.sessionNumber === urlSessionNumber) < sessions.length - 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const idx = sessions.findIndex((s) => s.sessionNumber === urlSessionNumber);
                      handleSelectSession(sessions[idx + 1].sessionNumber);
                    }}
                    className="ml-auto"
                  >
                    <span className="truncate max-w-[200px] sm:max-w-xs">
                      P{sessions[sessions.findIndex((s) => s.sessionNumber === urlSessionNumber) + 1].sessionNumber}:{' '}
                      {sessions[sessions.findIndex((s) => s.sessionNumber === urlSessionNumber) + 1].title}
                    </span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                ) : null}
              </nav>
            </main>
          </>
        )}
      </>
    )}

      {/* ================= MODAL: BUAT PERTEMUAN BARU ================= */}
      <Dialog open={isNewSessionModalOpen} onOpenChange={setIsNewSessionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Sesi Pertemuan Baru</DialogTitle>
            <DialogDescription>
              Buat sesi pertemuan baru untuk silabus mata kuliah ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSession} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-session-title">Judul Pertemuan</Label>
              <Input
                id="new-session-title"
                type="text"
                required
                placeholder="Contoh: Pertemuan 4 - Manipulasi DOM & Event"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-session-desc">Deskripsi / Sasaran Pembelajaran (Opsional)</Label>
              <Textarea
                id="new-session-desc"
                rows={3}
                placeholder="Ringkasan topik yang akan dipelajari mahasiswa..."
                value={newSessionDesc}
                onChange={(e) => setNewSessionDesc(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !newSessionTitle.trim()}
                >
                  {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Simpan Pertemuan</span>
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: EDIT SESI PERTEMUAN ================= */}
      <Dialog open={isEditSessionModalOpen} onOpenChange={setIsEditSessionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Edit className="size-4 text-fd-primary" />
              <span>Edit Sesi Pertemuan {sessionToEdit?.sessionNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-fd-muted-foreground">
              Ubah judul materi pertemuan dan deskripsi sasaran pembelajaran silabus kelas ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateSession} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-session-title" className="text-xs font-semibold">
                Judul Pertemuan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-session-title"
                type="text"
                required
                placeholder="Contoh: Pertemuan 1 - Pengenalan Dasar & Sintaks Python"
                value={editSessionTitle}
                onChange={(e) => setEditSessionTitle(e.target.value)}
                autoFocus
                className="h-10 text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-session-desc" className="text-xs font-semibold">
                Deskripsi / Sasaran Pembelajaran (Opsional)
              </Label>
              <Textarea
                id="edit-session-desc"
                rows={3}
                placeholder="Ringkasan topik atau capaian belajar mahasiswa..."
                value={editSessionDesc}
                onChange={(e) => setEditSessionDesc(e.target.value)}
                className="text-sm rounded-xl resize-none"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-fd-border/40">
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditSessionModalOpen(false)}
                  disabled={isSavingSession}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingSession || !editSessionTitle.trim()}
                >
                  {isSavingSession ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    'Simpan Perubahan'
                  )}
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: EDITOR MATERI MDX ================= */}
      <Dialog open={isMaterialModalOpen} onOpenChange={setIsMaterialModalOpen}>
        <DialogContent className="w-[96vw] max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingMaterialId ? 'Edit Materi MDX' : 'Tulis Materi Baru (MDX Web Editor)'}
            </DialogTitle>
            <DialogDescription>
              Konten akan dikonversi ke format MDX dan disimpan di Supabase untuk Pertemuan P
              {urlSessionNumber || activeSessionInfo?.sessionNumber}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMaterial} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="material-title">Judul Materi</Label>
                <Input
                  id="material-title"
                  type="text"
                  required
                  placeholder="Contoh: Fundamental Variabel & Operator"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="material-file-url">Tautan File Lampiran (Opsional)</Label>
                <Input
                  id="material-file-url"
                  type="url"
                  placeholder="https://drive.google.com/... atau slide presentasi"
                  value={materialFileUrl}
                  onChange={(e) => setMaterialFileUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* THE WEB MDX EDITOR WITH LIVE PREVIEW */}
            <div className="space-y-1.5">
              <Label>Isi Materi (Dukungan Format MDX / Markdown)</Label>
              <MDXEditor
                value={materialContentMdx}
                onChange={setMaterialContentMdx}
                minHeight="420px"
                placeholder="Gunakan heading (#), list (-), block code (```), rumus ($..$), atau callout (> [!NOTE]) untuk memformat materi..."
              />
            </div>

            <DialogFooter className="pt-2">
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMaterialModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !materialTitle.trim() || !materialContentMdx.trim()}
                >
                  {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Simpan & Publikasikan ke Supabase</span>
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: TAMBAH / EDIT TUGAS PERTEMUAN ================= */}
      <Dialog
        open={isAssignmentModalOpen}
        onOpenChange={(open) => {
          setIsAssignmentModalOpen(open);
          if (!open) setEditingAssignmentId(null);
        }}
      >
        <DialogContent className="w-[96vw] max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingAssignmentId
                ? 'Edit Tugas Praktikum'
                : `Publikasikan Tugas untuk Pertemuan P${urlSessionNumber || activeSessionInfo?.sessionNumber}`}
            </DialogTitle>
            <DialogDescription>
              {editingAssignmentId
                ? 'Perbarui judul, batas waktu pengumpulan, atau format instruksi MDX tugas ini.'
                : 'Tugas ini akan terikat pada sesi pertemuan ini dan muncul di dashboard tugas mahasiswa.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAssignment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="assignment-title">Judul Tugas</Label>
                <Input
                  id="assignment-title"
                  type="text"
                  required
                  placeholder="Contoh: Tugas Praktikum 03: Manipulasi Array"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignment-deadline">Batas Waktu Pengumpulan (Deadline)</Label>
                <Input
                  id="assignment-deadline"
                  type="datetime-local"
                  required
                  value={assignmentExpiredAt}
                  onChange={(e) => setAssignmentExpiredAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Instruksi & Soal Tugas (Format MDX)</Label>
              <MDXEditor
                value={assignmentDescMdx}
                onChange={setAssignmentDescMdx}
                minHeight="420px"
                placeholder="Jelaskan instruksi pengerjaan, format repositori GitHub, kriteria penilaian..."
              />
            </div>

            <DialogFooter className="pt-2">
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAssignmentModalOpen(false);
                    setEditingAssignmentId(null);
                  }}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !assignmentTitle.trim() || !assignmentExpiredAt}
                >
                  {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{editingAssignmentId ? 'Perbarui Tugas' : 'Publikasikan Tugas'}</span>
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: KONFIRMASI HAPUS PERTEMUAN ================= */}
      <AlertDialog
        open={Boolean(isDeleteSessionModalOpen && (sessionToDelete || activeSessionInfo))}
        onOpenChange={(open) => {
          if (!open && !isDeletingSession) {
            setIsDeleteSessionModalOpen(false);
            setSessionToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0 border border-destructive/20">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1 text-left">
                <AlertDialogTitle>
                  Hapus Pertemuan P{(sessionToDelete || activeSessionInfo)?.sessionNumber}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Pertemuan <span className="font-semibold text-foreground">&ldquo;{(sessionToDelete || activeSessionInfo)?.title}&rdquo;</span> beserta semua materi perkuliahan di dalamnya akan dihapus.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <Alert variant="destructive" className="bg-destructive/5 my-2">
            <AlertCircle className="size-4" />
            <AlertTitle className="text-xs font-bold">Peringatan Tindakan Permanen</AlertTitle>
            <AlertDescription className="text-[11px] leading-relaxed">
              Tindakan ini tidak dapat dibatalkan. Tugas praktikum yang sudah dibuat akan tetap tersimpan namun status pertemuannya dilepaskan.
            </AlertDescription>
          </Alert>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeletingSession}
              onClick={() => {
                setIsDeleteSessionModalOpen(false);
                setSessionToDelete(null);
              }}
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingSession}
              onClick={handleDeleteSession}
            >
              {isDeletingSession && <Loader2 className="size-4 animate-spin mr-1.5" />}
              <span>{isDeletingSession ? 'Menghapus...' : 'Ya, Hapus Pertemuan'}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================= MODAL: PRESENSI PERTEMUAN ================= */}
      <Dialog open={isAttendanceModalOpen} onOpenChange={setIsAttendanceModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-fd-primary/10 text-fd-primary flex items-center justify-center shrink-0 border border-fd-primary/20">
                <CalendarCheck className="size-5" />
              </div>
              <div className="space-y-0.5 text-left">
                <DialogTitle>
                  Presensi Pertemuan P{urlSessionNumber}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {course?.title || 'Kelas'} {activeSessionInfo?.title ? `• ${activeSessionInfo.title}` : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {activeAttendance ? (
            <div className="space-y-5 py-2">
              {/* Active Token Card */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    Sesi Presensi Aktif
                  </span>
                  <span className="font-mono text-fd-muted-foreground font-medium tabular-nums">
                    Sisa Waktu: {remainingTimeText || 'Menghitung...'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 p-3 bg-fd-background rounded-lg border border-fd-border/70">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-fd-muted-foreground">
                      Kode Token Presensi
                    </p>
                    <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-widest text-fd-foreground">
                      {activeAttendance.tokenCode}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyAttendanceToken(activeAttendance.tokenCode)}
                    className="gap-1.5 shrink-0"
                  >
                    {hasCopiedToken ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" />
                        <span>Disalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-fd-muted-foreground leading-relaxed">
                  Bagikan token kepada siswa. Siswa dapat memasukkan kode di web presensi atau Discord:{' '}
                  <code className="px-1.5 py-0.5 bg-fd-muted rounded text-[11px] font-mono text-fd-foreground font-semibold">
                    /presensi kode:{activeAttendance.tokenCode}
                  </code>
                </p>
              </div>

              {/* Attendee List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-fd-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-fd-muted-foreground" />
                    Siswa Hadir ({activeAttendance.attendees?.length || 0})
                  </span>
                  <Link
                    href={`/dashboard/mentor/presensi?batchId=${activeAttendance.batchId}`}
                    className="text-fd-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    Halaman Presensi Lengkap <ExternalLink className="size-3" />
                  </Link>
                </div>

                {activeAttendance.attendees && activeAttendance.attendees.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-fd-border divide-y divide-fd-border/50">
                    {activeAttendance.attendees.map((a) => (
                      <div key={a.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-fd-accent/30">
                        <div className="flex items-center gap-2 truncate">
                          <div className="size-6 rounded-full bg-fd-primary/10 text-fd-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {a.studentName?.charAt(0).toUpperCase() || 'S'}
                          </div>
                          <span className="font-medium text-fd-foreground truncate">{a.studentName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-fd-muted-foreground tabular-nums">
                            {new Date(a.checkedInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize',
                              a.channel === 'discord'
                                ? 'bg-[#5865F2]/10 text-[#5865F2]'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            )}
                          >
                            {a.channel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-fd-muted-foreground rounded-lg border border-dashed border-fd-border">
                    Belum ada siswa yang melakukan check-in pada sesi ini.
                  </div>
                )}
              </div>

              {/* Dialog Footer */}
              <div className="pt-2 flex items-center justify-end border-t border-fd-border/40">
                <ButtonGroup>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleCloseAttendance}
                    disabled={isClosingAttendance}
                  >
                    {isClosingAttendance && <Loader2 className="size-3.5 animate-spin" />}
                    <span>Tutup Sesi Sekarang</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAttendanceModalOpen(false)}
                  >
                    Tutup Jendela
                  </Button>
                </ButtonGroup>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Batch Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="batchSelect" className="text-xs font-semibold">
                  Pilih Batch Aktif
                </Label>
                {courseBatches.length > 1 ? (
                  <select
                    id="batchSelect"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-fd-border bg-fd-background text-fd-foreground text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                  >
                    {courseBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-lg border border-fd-border bg-fd-muted/30 text-xs font-medium text-fd-foreground">
                    {courseBatches[0]?.name || 'Batch Utama'}
                  </div>
                )}
              </div>

              {/* Session Number Info */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Pertemuan Perkuliahan</Label>
                <div className="p-2.5 rounded-lg border border-fd-border bg-fd-muted/30 text-xs font-medium text-fd-foreground">
                  Pertemuan {urlSessionNumber} {activeSessionInfo?.title ? `- ${activeSessionInfo.title}` : ''}
                </div>
              </div>

              {/* Duration Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Durasi Presensi Dibuka</Label>
                <ButtonGroup className="w-full">
                  {[15, 30, 60, 120].map((mins) => (
                    <Button
                      key={mins}
                      type="button"
                      size="sm"
                      variant={attendanceDuration === mins ? 'default' : 'outline'}
                      onClick={() => setAttendanceDuration(mins)}
                      className="flex-1"
                    >
                      {mins} Menit
                    </Button>
                  ))}
                </ButtonGroup>
              </div>

              <div className="p-3 rounded-lg bg-fd-muted/40 border border-fd-border/70 text-xs text-fd-muted-foreground space-y-1">
                <p className="font-medium text-fd-foreground">Informasi Presensi</p>
                <p className="text-[11px] leading-relaxed">
                  Setelah dibuka, sistem akan menghasilkan kode acak 8 karakter unik untuk pertemuan ini. Siswa dapat mengisi kode presensi via web siswa atau Discord.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <ButtonGroup>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAttendanceModalOpen(false)}
                    disabled={isOpeningAttendance}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenAttendance}
                    disabled={isOpeningAttendance || !selectedBatchId}
                  >
                    {isOpeningAttendance && <Loader2 className="size-3.5 animate-spin" />}
                    <span>Buka Kelas & Generate Kode</span>
                  </Button>
                </ButtonGroup>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DosenClassroomDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <Suspense fallback={null}>
      <DosenClassroomDetailContent slug={slug} />
    </Suspense>
  );
}
