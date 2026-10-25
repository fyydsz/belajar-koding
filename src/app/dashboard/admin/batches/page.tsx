'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Layers,
  Plus,
  Users,
  Search,
  Calendar,
  Check,
  Trash2,
  RefreshCw,
  UserCheck,
  AlertCircle,
  GraduationCap,
  Pencil,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { toast } from 'sonner';

interface BatchItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  paymentAccountInfo: string | null;
  maxStudents: number;
  courseId: string;
  courseIds?: string[];
  courses?: Array<{ id: string; title: string; slug: string }>;
  courseTitle: string;
  courseSlug: string;
  mentorId: string;
  mentorIds?: string[];
  mentors?: Array<{ id: string; fullName: string; email: string }>;
  mentorName: string;
  startDate: string | null;
  endDate: string | null;
  status: 'draft' | 'active' | 'completed';
  studentCount: number;
  createdAt: string;
}

interface CourseOption {
  id: string;
  title: string;
  slug: string;
}

interface MentorOption {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface StudentPoolItem {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  discordUsername: string | null;
}

interface EnrolledStudentItem {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  discordUsername: string | null;
  status: string;
  enrolledAt: string;
}

function toDateInputValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toggleArrayItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
}

function CourseMultiCombobox({
  courses,
  selectedIds,
  onChange,
  placeholder = 'Pilih mata kuliah...',
}: {
  courses: CourseOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const anchor = useComboboxAnchor();

  const courseItems = useMemo(
    () =>
      ComboboxPrimitive.createItems(courses, {
        getValue: (c) => c.id,
        getLabel: (c) => c.title,
      }),
    [courses]
  );

  return (
    <Combobox
      items={courseItems}
      multiple
      value={selectedIds}
      onValueChange={(val) => onChange(val as string[])}
    >
      <ComboboxValue>
        {(values: string[]) => (
          <ComboboxChips
            ref={anchor}
            className="min-h-9 border-fd-border/70 bg-fd-muted/20 text-xs px-2 py-1 gap-1.5 focus-within:ring-1 focus-within:border-fd-foreground/40 rounded-lg cursor-text"
          >
            {values.map((id) => {
              const c = courses.find((item) => item.id === id);
              return (
                <ComboboxChip
                  key={id}
                  className="bg-fd-accent text-fd-foreground text-[11px] h-6 px-2 rounded-md font-medium"
                >
                  <span className="truncate max-w-[180px]">{c ? c.title : id}</span>
                </ComboboxChip>
              );
            })}
            <ComboboxChipsInput
              placeholder={values.length === 0 ? (courses.length === 0 ? 'Belum ada mata kuliah' : placeholder) : ''}
              className="text-xs min-w-24 placeholder:text-fd-muted-foreground placeholder:text-[11px]"
            />
          </ComboboxChips>
        )}
      </ComboboxValue>

      <ComboboxContent anchor={anchor} className="z-[70] max-h-56 border-fd-border/70 bg-fd-popover p-1 shadow-lg">
        <ComboboxEmpty className="py-3 text-center text-[11px] text-fd-muted-foreground">
          Mata kuliah tidak ditemukan
        </ComboboxEmpty>
        <ComboboxList className="max-h-52">
          {(course: CourseOption) => (
            <ComboboxItem
              key={course.id}
              value={course.id}
              className="text-xs px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-fd-muted/50 data-[highlighted]:bg-fd-accent/40 flex items-center justify-between"
            >
              <span className="text-[11px] font-medium text-fd-foreground truncate">{course.title}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function MentorMultiCombobox({
  mentors,
  selectedIds,
  onChange,
  placeholder = 'Pilih mentor...',
}: {
  mentors: MentorOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const anchor = useComboboxAnchor();

  const mentorItems = useMemo(
    () =>
      ComboboxPrimitive.createItems(mentors, {
        getValue: (m) => m.id,
        getLabel: (m) => `${m.fullName} ${m.email}`,
      }),
    [mentors]
  );

  return (
    <Combobox
      items={mentorItems}
      multiple
      value={selectedIds}
      onValueChange={(val) => onChange(val as string[])}
    >
      <ComboboxValue>
        {(values: string[]) => (
          <ComboboxChips
            ref={anchor}
            className="min-h-9 border-fd-border/70 bg-fd-muted/20 text-xs px-2 py-1 gap-1.5 focus-within:ring-1 focus-within:border-fd-foreground/40 rounded-lg cursor-text"
          >
            {values.map((id) => {
              const m = mentors.find((item) => item.id === id);
              return (
                <ComboboxChip
                  key={id}
                  className="bg-fd-accent text-fd-foreground text-[11px] h-6 px-2 rounded-md font-medium"
                >
                  <span className="truncate max-w-[150px]">{m ? m.fullName : id}</span>
                </ComboboxChip>
              );
            })}
            <ComboboxChipsInput
              placeholder={values.length === 0 ? (mentors.length === 0 ? 'Belum ada mentor' : placeholder) : ''}
              className="text-xs min-w-24 placeholder:text-fd-muted-foreground placeholder:text-[11px]"
            />
          </ComboboxChips>
        )}
      </ComboboxValue>

      <ComboboxContent anchor={anchor} className="z-[70] max-h-56 border-fd-border/70 bg-fd-popover p-1 shadow-lg">
        <ComboboxEmpty className="py-3 text-center text-[11px] text-fd-muted-foreground">
          Mentor tidak ditemukan
        </ComboboxEmpty>
        <ComboboxList className="max-h-52">
          {(mentor: MentorOption) => (
            <ComboboxItem
              key={mentor.id}
              value={mentor.id}
              className="text-xs px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-fd-muted/50 data-[highlighted]:bg-fd-accent/40 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-fd-foreground truncate">{mentor.fullName}</p>
                <p className="text-[10px] text-fd-muted-foreground font-mono truncate">{mentor.email}</p>
              </div>
              <span className="text-[9px] text-fd-muted-foreground font-mono uppercase shrink-0">
                {mentor.role === 'admin' ? 'Admin' : 'Mentor'}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Modal Buat Batch (Multi-Select Course & Mentor)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchCourseIds, setNewBatchCourseIds] = useState<string[]>([]);
  const [newBatchMentorIds, setNewBatchMentorIds] = useState<string[]>([]);
  const [newBatchMaxStudents, setNewBatchMaxStudents] = useState('30');
  const [newBatchPrice, setNewBatchPrice] = useState('0');
  const [newBatchPaymentInfo, setNewBatchPaymentInfo] = useState('');
  const [newBatchDescription, setNewBatchDescription] = useState('');
  const [newBatchStartDate, setNewBatchStartDate] = useState('');
  const [newBatchEndDate, setNewBatchEndDate] = useState('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // State Modal Edit Batch (Multi-Select Course & Mentor)
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [editBatchName, setEditBatchName] = useState('');
  const [editBatchCourseIds, setEditBatchCourseIds] = useState<string[]>([]);
  const [editBatchMentorIds, setEditBatchMentorIds] = useState<string[]>([]);
  const [editBatchStatus, setEditBatchStatus] = useState<'draft' | 'active' | 'completed'>('active');
  const [editBatchMaxStudents, setEditBatchMaxStudents] = useState('30');
  const [editBatchPrice, setEditBatchPrice] = useState('0');
  const [editBatchPaymentInfo, setEditBatchPaymentInfo] = useState('');
  const [editBatchDescription, setEditBatchDescription] = useState('');
  const [editBatchStartDate, setEditBatchStartDate] = useState('');
  const [editBatchEndDate, setEditBatchEndDate] = useState('');
  const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);

  // State Modal Hapus Batch
  const [deletingBatch, setDeletingBatch] = useState<BatchItem | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // State Modal Plotting Siswa
  const [activePlottingBatch, setActivePlottingBatch] = useState<BatchItem | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudentItem[]>([]);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [studentsPool, setStudentsPool] = useState<StudentPoolItem[]>([]);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isEnrollingStudents, setIsEnrollingStudents] = useState(false);
  const [activeTab, setActiveTab] = useState<'enrolled' | 'enroll-new'>('enrolled');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Load data batch, master kursus, dan daftar mentor
  const loadData = useCallback(async () => {
    setIsLoading(true);
    topProgress.start();
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [resBatches, resCourses, resMentors] = await Promise.all([
        fetch(`${apiUrl}/v1/batches`, { headers }),
        fetch(`${apiUrl}/v1/classroom/courses`, { headers }),
        fetch(`${apiUrl}/v1/batches/mentors-pool`, { headers }),
      ]);

      const [jsonBatches, jsonCourses, jsonMentors] = await Promise.all([
        resBatches.json(),
        resCourses.json(),
        resMentors.json(),
      ]);

      if (jsonBatches.success) setBatches(jsonBatches.data || []);
      if (jsonCourses.success) setCourses(jsonCourses.data || []);
      if (jsonMentors.success) setMentors(jsonMentors.data || []);
    } catch {
      toast.error('Gagal mengambil data dari server.');
    } finally {
      setIsLoading(false);
      topProgress.done();
    }
  }, [apiUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Buat Batch Baru
  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBatchName.trim() || newBatchCourseIds.length === 0) {
      toast.error('Nama batch dan minimal satu mata kuliah wajib dipilih.');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newBatchName.trim(),
          courseIds: newBatchCourseIds,
          courseId: newBatchCourseIds[0],
          mentorIds: newBatchMentorIds.length > 0 ? newBatchMentorIds : undefined,
          mentorId: newBatchMentorIds[0] || undefined,
          maxStudents: Number(newBatchMaxStudents) || 30,
          price: Number(newBatchPrice) || 0,
          paymentAccountInfo: newBatchPaymentInfo.trim() || undefined,
          description: newBatchDescription.trim() || undefined,
          startDate: newBatchStartDate || undefined,
          endDate: newBatchEndDate || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal membuat batch.');
      }

      toast.success('Batch kelas berhasil dibuat!');
      setIsCreateModalOpen(false);
      setNewBatchName('');
      setNewBatchCourseIds([]);
      setNewBatchMentorIds([]);
      setNewBatchMaxStudents('30');
      setNewBatchPrice('0');
      setNewBatchPaymentInfo('');
      setNewBatchDescription('');
      setNewBatchStartDate('');
      setNewBatchEndDate('');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      toast.error(msg);
    } finally {
      setIsSubmittingBatch(false);
    }
  }

  // 2b. Buka Modal Edit Batch
  function openEditModal(batch: BatchItem) {
    setEditingBatch(batch);
    setEditBatchName(batch.name);
    setEditBatchCourseIds(
      batch.courseIds && batch.courseIds.length > 0
        ? batch.courseIds
        : batch.courseId
        ? [batch.courseId]
        : []
    );
    setEditBatchMentorIds(
      batch.mentorIds && batch.mentorIds.length > 0
        ? batch.mentorIds
        : batch.mentorId
        ? [batch.mentorId]
        : []
    );
    setEditBatchStatus(batch.status || 'active');
    setEditBatchMaxStudents(String(batch.maxStudents || 30));
    setEditBatchPrice(String(parseFloat(String(batch.price || '0'))));
    setEditBatchPaymentInfo(batch.paymentAccountInfo || '');
    setEditBatchDescription(batch.description || '');
    setEditBatchStartDate(toDateInputValue(batch.startDate));
    setEditBatchEndDate(toDateInputValue(batch.endDate));
  }

  // 2c. Simpan Perubahan Batch (PUT)
  async function handleUpdateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBatch) return;

    if (!editBatchName.trim() || editBatchCourseIds.length === 0) {
      toast.error('Nama batch dan minimal satu mata kuliah wajib dipilih.');
      return;
    }

    setIsUpdatingBatch(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/batches/${editingBatch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editBatchName.trim(),
          courseIds: editBatchCourseIds,
          courseId: editBatchCourseIds[0],
          mentorIds: editBatchMentorIds,
          mentorId: editBatchMentorIds[0] || undefined,
          status: editBatchStatus,
          maxStudents: Number(editBatchMaxStudents) || 30,
          price: Number(editBatchPrice) || 0,
          paymentAccountInfo: editBatchPaymentInfo.trim(),
          description: editBatchDescription.trim(),
          startDate: editBatchStartDate || null,
          endDate: editBatchEndDate || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memperbarui batch.');
      }

      toast.success(json.message || 'Data batch berhasil diperbarui.');
      setEditingBatch(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui data batch.';
      toast.error(msg);
    } finally {
      setIsUpdatingBatch(false);
    }
  }

  // 2d. Hapus Batch Kelas (DELETE)
  async function handleConfirmDeleteBatch() {
    if (!deletingBatch) return;

    setIsDeletingBatch(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/batches/${deletingBatch.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menghapus batch.');
      }

      toast.success(json.message || 'Batch berhasil dihapus.');
      setDeletingBatch(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus batch.';
      toast.error(msg);
    } finally {
      setIsDeletingBatch(false);
    }
  }

  // 3. Buka Modal Plotting Siswa
  const openPlottingModal = useCallback(async (batch: BatchItem) => {
    setActivePlottingBatch(batch);
    setActiveTab('enrolled');
    setSelectedStudentIds([]);
    setSearchStudentQuery('');
    setIsLoadingEnrolled(true);
    setIsLoadingPool(true);

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [resDetail, resPool] = await Promise.all([
        fetch(`${apiUrl}/v1/batches/${batch.id}`, { headers }),
        fetch(`${apiUrl}/v1/batches/students-pool`, { headers }),
      ]);

      const [jsonDetail, jsonPool] = await Promise.all([
        resDetail.json(),
        resPool.json(),
      ]);

      if (jsonDetail.success && jsonDetail.data) {
        setEnrolledStudents(jsonDetail.data.students || []);
      }
      if (jsonPool.success && jsonPool.data) {
        setStudentsPool(jsonPool.data);
      }
    } catch {
      toast.error('Gagal mengambil daftar siswa.');
    } finally {
      setIsLoadingEnrolled(false);
      setIsLoadingPool(false);
    }
  }, [apiUrl]);

  // 4. Daftarkan Siswa Terpilih ke Batch
  async function handleEnrollSelectedStudents() {
    if (!activePlottingBatch || selectedStudentIds.length === 0) return;

    setIsEnrollingStudents(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/batches/${activePlottingBatch.id}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal mendaftarkan siswa.');
      }

      toast.success(`${selectedStudentIds.length} siswa berhasil didaftarkan!`);
      setSelectedStudentIds([]);
      openPlottingModal(activePlottingBatch);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendaftarkan siswa.';
      toast.error(msg);
    } finally {
      setIsEnrollingStudents(false);
    }
  }

  // 5. Keluarkan Siswa dari Batch
  async function handleUnenrollStudent(studentId: string, studentName: string) {
    if (!activePlottingBatch) return;

    try {
      const token = getAuthToken();
      const res = await fetch(
        `${apiUrl}/v1/batches/${activePlottingBatch.id}/enroll/${studentId}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal mengeluarkan siswa.');
      }

      toast.success(`${studentName} dikeluarkan dari batch.`);
      openPlottingModal(activePlottingBatch);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses pengeluaran siswa.';
      toast.error(msg);
    }
  }

  // Set ID siswa yang sudah terdaftar untuk disable checkbox
  const enrolledStudentIdSet = useMemo(() => {
    return new Set(enrolledStudents.map((s) => s.studentId));
  }, [enrolledStudents]);


  // Filter kolam siswa berdasarkan search query
  const filteredStudentsPool = useMemo(() => {
    if (!searchStudentQuery.trim()) return studentsPool;
    const q = searchStudentQuery.toLowerCase();
    return studentsPool.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.discordUsername && s.discordUsername.toLowerCase().includes(q))
    );
  }, [studentsPool, searchStudentQuery]);

  // Toggle checklist siswa
  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  // Toggle pilih semua siswa yang belum terdaftar
  function handleToggleSelectAll() {
    const available = filteredStudentsPool.filter((s) => !enrolledStudentIdSet.has(s.id));
    if (selectedStudentIds.length === available.length && available.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(available.map((s) => s.id));
    }
  }

  // Statistik Ringkas
  const totalStudentsEnrolled = batches.reduce((sum, b) => sum + (b.studentCount || 0), 0);
  const activeBatchesCount = batches.filter((b) => b.status === 'active').length;

  if (isLoading && batches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Halaman */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Manajemen Batch Kelas &amp; Plotting Siswa
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Buka angkatan kelas baru, pilih paket mata kuliah dan tim mentor pengampu, serta distribusikan siswa ke dalam kelompok belajar.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="self-start sm:self-auto shrink-0"
        >
          <Plus className="size-4" />
          <span>Buka Batch Baru</span>
        </Button>
      </header>

      {/* Kartu Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-fd-border bg-fd-card p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-fd-muted-foreground">Total Batch</p>
            <p className="text-2xl font-bold font-mono tracking-tight text-fd-foreground tabular-nums">
              {batches.length}
            </p>
          </div>
          <div className="size-9 rounded-lg border border-fd-border bg-fd-muted/30 text-fd-muted-foreground flex items-center justify-center">
            <Layers className="size-4" />
          </div>
        </div>

        <div className="rounded-xl border border-fd-border bg-fd-card p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-fd-muted-foreground">Batch Aktif</p>
            <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {activeBatchesCount}
            </p>
          </div>
          <div className="size-9 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Check className="size-4" />
          </div>
        </div>

        <div className="rounded-xl border border-fd-border bg-fd-card p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-fd-muted-foreground">Siswa Terplotting</p>
            <p className="text-2xl font-bold font-mono tracking-tight text-fd-foreground tabular-nums">
              {totalStudentsEnrolled}
            </p>
          </div>
          <div className="size-9 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="size-4" />
          </div>
        </div>
      </div>

      {/* Daftar Tabel Batch */}
      <div className="rounded-xl border border-fd-border bg-fd-card shadow-none overflow-hidden">
        {/* Section Header */}
        <div className="p-5 border-b border-fd-border/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight text-fd-foreground">
                Daftar Batch Kelas
              </h2>
              <span className="font-mono text-[11px] text-fd-muted-foreground bg-fd-muted/50 px-2 py-0.5 rounded border border-fd-border/50">
                {batches.length} Batch
              </span>
            </div>
            <p className="text-xs text-fd-muted-foreground/90">
              Kelola angkatan aktif, kurikulum terikat, mentor, serta kuota plotting siswa.
            </p>
          </div>
        </div>

        {/* Section Content */}
        {batches.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-4">
            <div className="size-10 rounded-lg border border-fd-border bg-fd-muted/30 text-fd-foreground flex items-center justify-center mx-auto">
              <Layers className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-fd-foreground">Belum Ada Batch Kelas</h3>
              <p className="text-xs text-fd-muted-foreground max-w-sm mx-auto leading-relaxed">
                Mata kuliah saat ini belum dikelompokkan ke dalam angkatan belajar aktif.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="size-3.5" />
              <span>Buka Batch Perdana</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-fd-border/70 border-collapse">
              <thead className="bg-fd-muted/20 text-fd-muted-foreground text-[11px] font-medium tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-medium">Batch &amp; Kurikulum</th>
                  <th className="px-5 py-3 font-medium">Mentor</th>
                  <th className="px-5 py-3 font-medium">Periode</th>
                  <th className="px-5 py-3 font-medium text-center">Plotting Kuota</th>
                  <th className="px-5 py-3 font-medium text-center">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fd-border/60 text-fd-foreground">
                {batches.map((b) => {
                  const batchCoursesList =
                    b.courses && b.courses.length > 0
                      ? b.courses
                      : b.courseTitle
                      ? [{ id: b.courseId, title: b.courseTitle, slug: b.courseSlug }]
                      : [];

                  const batchMentorsList =
                    b.mentors && b.mentors.length > 0
                      ? b.mentors
                      : b.mentorName
                      ? [{ id: b.mentorId, fullName: b.mentorName, email: '' }]
                      : [];

                  const courseNames = batchCoursesList.map((c) => c.title).join(', ');

                  return (
                    <tr key={b.id} className="hover:bg-fd-muted/20 transition-colors">
                      {/* Kolom 1: Batch & Kurikulum */}
                      <td className="px-5 py-3.5 align-middle">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-[13px] text-fd-foreground">
                            {b.name}
                          </p>
                          <p className="text-[11px] text-fd-muted-foreground leading-normal" title={courseNames}>
                            {courseNames || 'Belum ada mata kuliah'}
                          </p>
                        </div>
                      </td>

                      {/* Kolom 2: Mentor */}
                      <td className="px-5 py-3.5 align-middle">
                        {batchMentorsList.length === 0 ? (
                          <span className="text-[11px] text-fd-muted-foreground/70">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {batchMentorsList.map((m) => (
                              <p key={m.id} className="text-xs text-fd-foreground/90 font-medium truncate max-w-[160px]">
                                {m.fullName}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Kolom 3: Periode */}
                      <td className="px-5 py-3.5 align-middle">
                        {b.startDate ? (
                          <span className="font-mono text-[11px] text-fd-muted-foreground whitespace-nowrap">
                            {new Date(b.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            {b.endDate && ` – ${new Date(b.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          </span>
                        ) : (
                          <span className="text-[11px] text-fd-muted-foreground/70 font-mono">—</span>
                        )}
                      </td>

                      {/* Kolom 4: Plotting Kuota */}
                      <td className="px-5 py-3.5 align-middle text-center">
                        <span className="font-mono text-xs text-fd-foreground font-semibold tabular-nums">
                          {b.studentCount}{' '}
                          <span className="text-fd-muted-foreground font-normal text-[11px]">
                            / {b.maxStudents || 30}
                          </span>
                        </span>
                      </td>

                      {/* Kolom 5: Status */}
                      <td className="px-5 py-3.5 align-middle text-center">
                        {b.status === 'active' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Aktif
                          </span>
                        ) : b.status === 'completed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-fd-muted text-fd-muted-foreground border border-fd-border/60">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Kolom 6: Aksi */}
                      <td className="px-5 py-3.5 align-middle text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPlottingModal(b)}
                            className="h-7 px-2.5 text-[11px] font-medium rounded-md border-fd-border shadow-none hover:bg-fd-accent/40"
                          >
                            <UserCheck className="size-3.5 text-fd-primary mr-1" />
                            <span>Plot Siswa</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded-md text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted"
                                  title="Aksi Lainnya"
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={() => openEditModal(b)}
                                className="cursor-pointer text-xs"
                              >
                                <Pencil className="size-3.5 mr-1.5 text-fd-muted-foreground" />
                                <span>Edit Batch</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeletingBatch(b)}
                                className="cursor-pointer text-xs"
                              >
                                <Trash2 className="size-3.5 mr-1.5" />
                                <span>Hapus Batch</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL BUAT BATCH BARU (MINIMALIST UI - ZERO SCROLL)            */}
      {/* ============================================================== */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-2xl p-6 rounded-xl border border-fd-border bg-fd-card">
          <DialogHeader className="pb-3 border-b border-fd-border/70 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight text-fd-foreground">
              Buka Batch Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-fd-muted-foreground">
              Tetapkan kurikulum terikat, pengampu, kuota, serta jadwal pelaksanaan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBatch} className="py-2 space-y-4">
            {/* Nama Batch */}
            <div className="space-y-1.5">
              <label htmlFor="batchNameInput" className="text-xs font-medium text-fd-foreground">
                Nama Batch / Angkatan
              </label>
              <Input
                id="batchNameInput"
                placeholder="Contoh: Batch 1 - 2026 Ganjil"
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                className="text-xs h-9 bg-fd-muted/20 border-fd-border/70 focus-visible:ring-1"
                required
              />
            </div>

            {/* 2 Kolom Sejajar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* KOLOM KIRI: KURIKULUM & MENTOR */}
              <div className="space-y-4">
                {/* Kurikulum */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-fd-foreground">
                      Kurikulum ({newBatchCourseIds.length} dipilih)
                    </span>
                    {courses.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewBatchCourseIds(
                            newBatchCourseIds.length === courses.length
                              ? []
                              : courses.map((c) => c.id)
                          )
                        }
                        className="text-[11px] text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
                      >
                        {newBatchCourseIds.length === courses.length ? 'Reset' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>
                  <CourseMultiCombobox
                    courses={courses}
                    selectedIds={newBatchCourseIds}
                    onChange={setNewBatchCourseIds}
                  />
                </div>

                {/* Tim Mentor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-fd-foreground">
                      Mentor ({newBatchMentorIds.length} dipilih)
                    </span>
                    {mentors.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewBatchMentorIds(
                            newBatchMentorIds.length === mentors.length
                              ? []
                              : mentors.map((m) => m.id)
                          )
                        }
                        className="text-[11px] text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
                      >
                        {newBatchMentorIds.length === mentors.length ? 'Reset' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>
                  <MentorMultiCombobox
                    mentors={mentors}
                    selectedIds={newBatchMentorIds}
                    onChange={setNewBatchMentorIds}
                  />
                </div>
              </div>

              {/* KOLOM KANAN: PARAMETER OPERASIONAL */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="batchMaxStudents" className="text-xs font-medium text-fd-foreground">
                      Kuota Siswa
                    </label>
                    <Input
                      id="batchMaxStudents"
                      type="number"
                      min={1}
                      max={500}
                      value={newBatchMaxStudents}
                      onChange={(e) => setNewBatchMaxStudents(e.target.value)}
                      className="text-xs h-8 font-mono bg-fd-muted/20 border-fd-border/70"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="batchPrice" className="text-xs font-medium text-fd-foreground">
                      Biaya (Rp)
                    </label>
                    <Input
                      id="batchPrice"
                      type="number"
                      min={0}
                      step="1000"
                      placeholder="0 (Gratis)"
                      value={newBatchPrice}
                      onChange={(e) => setNewBatchPrice(e.target.value)}
                      className="text-xs h-8 font-mono bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                </div>

                {Number(newBatchPrice) > 0 && (
                  <div className="space-y-1">
                    <label htmlFor="batchPaymentInfo" className="text-xs font-medium text-fd-foreground">
                      Rekening Pembayaran
                    </label>
                    <Input
                      id="batchPaymentInfo"
                      placeholder="BCA 1234567890 a/n Belajar Koding"
                      value={newBatchPaymentInfo}
                      onChange={(e) => setNewBatchPaymentInfo(e.target.value)}
                      className="text-xs h-8 bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="batchStartDate" className="text-xs font-medium text-fd-foreground">
                      Tanggal Mulai
                    </label>
                    <Input
                      id="batchStartDate"
                      type="date"
                      value={newBatchStartDate}
                      onChange={(e) => setNewBatchStartDate(e.target.value)}
                      className="text-xs h-8 bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="batchEndDate" className="text-xs font-medium text-fd-foreground">
                      Tanggal Selesai
                    </label>
                    <Input
                      id="batchEndDate"
                      type="date"
                      value={newBatchEndDate}
                      onChange={(e) => setNewBatchEndDate(e.target.value)}
                      className="text-xs h-8 bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="batchDescription" className="text-xs font-medium text-fd-foreground">
                    Catatan / Deskripsi
                  </label>
                  <Textarea
                    id="batchDescription"
                    placeholder="Informasi jadwal atau catatan pelaksanaan..."
                    value={newBatchDescription}
                    onChange={(e) => setNewBatchDescription(e.target.value)}
                    rows={2}
                    className="text-xs bg-fd-muted/20 border-fd-border/70 resize-none"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-fd-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8 px-3 text-xs rounded-md shadow-none"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingBatch || newBatchCourseIds.length === 0}
                className="h-8 px-3.5 text-xs rounded-md shadow-none bg-fd-foreground text-fd-background hover:bg-fd-foreground/90 font-medium"
              >
                {isSubmittingBatch ? (
                  <>
                    <RefreshCw className="size-3 animate-spin mr-1.5" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Batch Kelas'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL EDIT BATCH KELAS (MINIMALIST UI - ZERO SCROLL)          */}
      {/* ============================================================== */}
      <Dialog
        open={!!editingBatch}
        onOpenChange={(open) => {
          if (!open) setEditingBatch(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl p-6 rounded-xl border border-fd-border bg-fd-card">
          <DialogHeader className="pb-3 border-b border-fd-border/70 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight text-fd-foreground">
              Edit Batch Kelas
            </DialogTitle>
            <DialogDescription className="text-xs text-fd-muted-foreground">
              Perbarui kurikulum terikat, pengampu, kuota, serta status pendaftaran.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateBatch} className="py-2 space-y-4">
            {/* Nama Batch */}
            <div className="space-y-1.5">
              <label htmlFor="editBatchNameInput" className="text-xs font-medium text-fd-foreground">
                Nama Batch / Angkatan
              </label>
              <Input
                id="editBatchNameInput"
                placeholder="Contoh: Batch 1 - 2026 Ganjil"
                value={editBatchName}
                onChange={(e) => setEditBatchName(e.target.value)}
                className="text-xs h-9 bg-fd-muted/20 border-fd-border/70 focus-visible:ring-1"
                required
              />
            </div>

            {/* 2 Kolom Sejajar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* KOLOM KIRI: KURIKULUM & MENTOR */}
              <div className="space-y-4">
                {/* Kurikulum */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-fd-foreground">
                      Kurikulum ({editBatchCourseIds.length} dipilih)
                    </span>
                    {courses.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditBatchCourseIds(
                            editBatchCourseIds.length === courses.length
                              ? []
                              : courses.map((c) => c.id)
                          )
                        }
                        className="text-[11px] text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
                      >
                        {editBatchCourseIds.length === courses.length ? 'Reset' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>
                  <CourseMultiCombobox
                    courses={courses}
                    selectedIds={editBatchCourseIds}
                    onChange={setEditBatchCourseIds}
                  />
                </div>

                {/* Tim Mentor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-fd-foreground">
                      Mentor ({editBatchMentorIds.length} dipilih)
                    </span>
                    {mentors.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditBatchMentorIds(
                            editBatchMentorIds.length === mentors.length
                              ? []
                              : mentors.map((m) => m.id)
                          )
                        }
                        className="text-[11px] text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
                      >
                        {editBatchMentorIds.length === mentors.length ? 'Reset' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>
                  <MentorMultiCombobox
                    mentors={mentors}
                    selectedIds={editBatchMentorIds}
                    onChange={setEditBatchMentorIds}
                  />
                </div>
              </div>

              {/* KOLOM KANAN: PARAMETER OPERASIONAL */}
              <div className="space-y-3.5">
                {/* Status Segmented Control */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-fd-foreground">
                    Status Pendaftaran
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg border border-fd-border/70 bg-fd-muted/20">
                    {(
                      [
                        { id: 'active', label: 'Aktif' },
                        { id: 'draft', label: 'Draft' },
                        { id: 'completed', label: 'Selesai' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setEditBatchStatus(st.id)}
                        className={`h-7 px-2 rounded text-[11px] font-medium transition-colors ${
                          editBatchStatus === st.id
                            ? 'bg-fd-background text-fd-foreground shadow-2xs font-semibold'
                            : 'text-fd-muted-foreground hover:text-fd-foreground'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="editBatchMaxStudents" className="text-xs font-medium text-fd-foreground">
                      Kuota Siswa
                    </label>
                    <Input
                      id="editBatchMaxStudents"
                      type="number"
                      min={1}
                      max={500}
                      value={editBatchMaxStudents}
                      onChange={(e) => setEditBatchMaxStudents(e.target.value)}
                      className="text-xs h-8 font-mono bg-fd-muted/20 border-fd-border/70"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="editBatchPrice" className="text-xs font-medium text-fd-foreground">
                      Biaya (Rp)
                    </label>
                    <Input
                      id="editBatchPrice"
                      type="number"
                      min={0}
                      step="1000"
                      placeholder="0 (Gratis)"
                      value={editBatchPrice}
                      onChange={(e) => setEditBatchPrice(e.target.value)}
                      className="text-xs h-8 font-mono bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                </div>

                {Number(editBatchPrice) > 0 && (
                  <div className="space-y-1">
                    <label htmlFor="editBatchPaymentInfo" className="text-xs font-medium text-fd-foreground">
                      Rekening Pembayaran
                    </label>
                    <Input
                      id="editBatchPaymentInfo"
                      placeholder="BCA 1234567890 a/n Belajar Koding"
                      value={editBatchPaymentInfo}
                      onChange={(e) => setEditBatchPaymentInfo(e.target.value)}
                      className="text-xs h-8 bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="editBatchStartDate" className="text-xs font-medium text-fd-foreground">
                      Tanggal Mulai
                    </label>
                    <Input
                      id="editBatchStartDate"
                      type="date"
                      value={editBatchStartDate}
                      onChange={(e) => setEditBatchStartDate(e.target.value)}
                      className="text-xs h-8 bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="editBatchEndDate" className="text-xs font-medium text-fd-foreground">
                      Tanggal Selesai
                    </label>
                    <Input
                      id="editBatchEndDate"
                      type="date"
                      value={editBatchEndDate}
                      onChange={(e) => setEditBatchEndDate(e.target.value)}
                      className="text-xs h-8 bg-fd-muted/20 border-fd-border/70"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="editBatchDescription" className="text-xs font-medium text-fd-foreground">
                    Catatan / Deskripsi
                  </label>
                  <Textarea
                    id="editBatchDescription"
                    placeholder="Informasi jadwal atau catatan pelaksanaan..."
                    value={editBatchDescription}
                    onChange={(e) => setEditBatchDescription(e.target.value)}
                    rows={2}
                    className="text-xs bg-fd-muted/20 border-fd-border/70 resize-none"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-fd-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingBatch(null)}
                disabled={isUpdatingBatch}
                className="h-8 px-3 text-xs rounded-md shadow-none"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isUpdatingBatch || editBatchCourseIds.length === 0}
                className="h-8 px-3.5 text-xs rounded-md shadow-none bg-fd-foreground text-fd-background hover:bg-fd-foreground/90 font-medium"
              >
                {isUpdatingBatch ? (
                  <>
                    <RefreshCw className="size-3 animate-spin mr-1.5" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI HAPUS BATCH KELAS                             */}
      {/* ============================================================== */}
      <Dialog
        open={!!deletingBatch}
        onOpenChange={(open) => {
          if (!open) setDeletingBatch(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-fd-foreground">
              <AlertCircle className="size-5 text-destructive shrink-0" />
              <span>Hapus Batch Kelas</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              Apakah Anda yakin ingin menghapus batch{' '}
              <strong className="text-fd-foreground">{deletingBatch?.name}</strong> pada kurikulum{' '}
              <strong className="text-fd-foreground">{deletingBatch?.courseTitle}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3.5 text-xs text-destructive space-y-1.5">
            <p className="font-semibold">Dampak Penghapusan Permanen:</p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
              <li>
                Data pendaftaran siswa di batch ini ({deletingBatch?.studentCount || 0} siswa terdaftar) akan ikut terhapus.
              </li>
              <li>
                Riwayat sesi presensi dan penugasan yang terikat spesifik pada batch ini tidak dapat dipulihkan.
              </li>
            </ul>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingBatch(null)}
              disabled={isDeletingBatch}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDeleteBatch}
              disabled={isDeletingBatch}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingBatch ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Hapus Batch Permanen</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL PLOTTING SISWA (MULTI-SELECT CHECKLIST)                  */}
      {/* ============================================================== */}
      <Dialog
        open={!!activePlottingBatch}
        onOpenChange={(open) => {
          if (!open) setActivePlottingBatch(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-6 rounded-xl">
          <DialogHeader className="pb-3 border-b border-fd-border space-y-2">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                Plotting Siswa: {activePlottingBatch?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-fd-muted-foreground mt-0.5">
                Mata Kuliah: <span className="font-semibold text-fd-foreground">{activePlottingBatch?.courseTitle}</span>
              </DialogDescription>
            </div>

            {/* Navigasi Tab Segmented Pill */}
            <div className="flex p-1 rounded-xl bg-fd-muted/40 border border-fd-border/50 gap-1 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('enrolled')}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'enrolled'
                    ? 'bg-fd-card text-fd-foreground shadow-xs border border-fd-border/40'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
              >
                Siswa Terdaftar ({enrolledStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('enroll-new')}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'enroll-new'
                    ? 'bg-fd-card text-fd-foreground shadow-xs border border-fd-border/40'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
              >
                + Daftarkan Siswa Baru
              </button>
            </div>
          </DialogHeader>

          {/* Isi Konten Tab */}
          <div className="flex-1 overflow-y-auto py-3">
            {activeTab === 'enrolled' ? (
              /* TAB 1: DAFTAR SISWA YANG SUDAH TERGABUNG */
              <div>
                {isLoadingEnrolled ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-fd-muted-foreground">
                    <RefreshCw className="size-5 animate-spin text-fd-primary" />
                    <p className="text-xs">Memuat daftar siswa...</p>
                  </div>
                ) : enrolledStudents.length === 0 ? (
                  <div className="py-10 text-center text-fd-muted-foreground space-y-2">
                    <Users className="size-8 mx-auto text-fd-muted-foreground/60" />
                    <p className="text-xs font-semibold text-fd-foreground">Belum ada siswa di batch ini</p>
                    <p className="text-[11px]">
                      Pindah ke tab &quot;+ Daftarkan Siswa Baru&quot; untuk memilih siswa.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[360px] rounded-lg border border-fd-border">
                    <div className="divide-y divide-fd-border text-xs">
                      {enrolledStudents.map((s) => (
                        <div key={s.enrollmentId} className="flex items-center justify-between p-3">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-fd-foreground">{s.fullName}</p>
                            <p className="text-[11px] text-fd-muted-foreground">{s.email}</p>
                            {s.discordUsername && (
                              <span className="text-[10px] text-[#5865F2] font-mono">
                                Discord: @{s.discordUsername}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnenrollStudent(s.studentId, s.fullName)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-500/10 h-8 px-2.5 text-xs gap-1"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Keluarkan</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              /* TAB 2: MULTI-SELECT CHECKLIST SISWA BARU */
              <div className="space-y-3">
                {/* Search Bar & Counter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-fd-muted-foreground" />
                    <Input
                      placeholder="Cari nama atau email siswa..."
                      value={searchStudentQuery}
                      onChange={(e) => setSearchStudentQuery(e.target.value)}
                      className="pl-8 text-xs h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleSelectAll}
                    className="text-xs h-9"
                  >
                    Pilih Semua
                  </Button>
                </div>

                {/* List Siswa dengan Checkbox */}
                {isLoadingPool ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-fd-muted-foreground">
                    <RefreshCw className="size-5 animate-spin text-fd-primary" />
                    <p className="text-xs">Memuat kolam siswa...</p>
                  </div>
                ) : filteredStudentsPool.length === 0 ? (
                  <div className="py-8 text-center text-xs text-fd-muted-foreground">
                    Tidak ditemukan siswa yang cocok dengan pencarian.
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] rounded-lg border border-fd-border">
                    <div className="divide-y divide-fd-border text-xs">
                      {filteredStudentsPool.map((student) => {
                        const isAlreadyEnrolled = enrolledStudentIdSet.has(student.id);
                        const isSelected = selectedStudentIds.includes(student.id);

                        return (
                          <div
                            key={student.id}
                            onClick={() => {
                              if (!isAlreadyEnrolled) toggleStudentSelection(student.id);
                            }}
                            className={`flex items-center justify-between p-3 transition ${
                              isAlreadyEnrolled
                                ? 'bg-fd-muted/30 opacity-60 cursor-not-allowed'
                                : 'cursor-pointer hover:bg-fd-muted/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected || isAlreadyEnrolled}
                                disabled={isAlreadyEnrolled}
                                onClick={(e) => e.stopPropagation()}
                                onCheckedChange={() => {
                                  if (!isAlreadyEnrolled) toggleStudentSelection(student.id);
                                }}
                              />
                              <div>
                                <p className="font-semibold text-fd-foreground">{student.fullName}</p>
                                <p className="text-[11px] text-fd-muted-foreground">{student.email}</p>
                              </div>
                            </div>
                            <div>
                              {isAlreadyEnrolled ? (
                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                                  Sudah Terdaftar
                                </Badge>
                              ) : isSelected ? (
                                <Badge className="text-[10px] bg-fd-primary">Terpilih</Badge>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-fd-border flex items-center justify-between sm:justify-between">
            <span className="text-xs text-fd-muted-foreground">
              {activeTab === 'enroll-new' && (
                <span>
                  <strong className="text-fd-foreground font-mono">{selectedStudentIds.length}</strong> siswa dipilih
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActivePlottingBatch(null)}
                className="text-xs"
              >
                Tutup
              </Button>
              {activeTab === 'enroll-new' && (
                <Button
                  type="button"
                  size="sm"
                  disabled={isEnrollingStudents || selectedStudentIds.length === 0}
                  onClick={handleEnrollSelectedStudents}
                  className="text-xs font-semibold gap-1.5"
                >
                  {isEnrollingStudents ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      Mendaftarkan...
                    </>
                  ) : (
                    <>
                      <UserCheck className="size-3.5" />
                      <span>Daftarkan Siswa Terpilih</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
