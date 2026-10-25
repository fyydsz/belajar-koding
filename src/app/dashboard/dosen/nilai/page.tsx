'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import {
  GraduationCap,
  Download,
  Printer,
  SlidersHorizontal,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Users,
  Award,
  ChevronRight,
  Loader2,
  Check,
  X,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface BatchItem {
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  mentorId: string | null;
  mentorName: string | null;
  studentCount?: number;
}

interface StudentGradeItem {
  number: number;
  studentId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  discordUsername: string | null;
  tugas: number;
  quiz: number;
  uts: number;
  uas: number;
  finalScore: number;
  gradeLetter: string;
  gradePoint: number;
  predicate: string;
  isPassing: boolean;
  isOverride: boolean;
  updatedAt: string | null;
}

interface BatchStats {
  totalStudents: number;
  classAverage: number;
  passCount: number;
  passRate: number;
  overrideCount: number;
}

interface BatchGradebookData {
  batch: {
    id: string;
    name: string;
    courseId: string;
    courseTitle: string;
    courseSlug: string;
    mentorId: string | null;
    mentorName: string | null;
  };
  stats: BatchStats;
  students: StudentGradeItem[];
}

export default function DosenNilaiPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);

  const [gradebook, setGradebook] = useState<BatchGradebookData | null>(null);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passing' | 'failing' | 'overridden'>('all');

  // Override Modal Dialog State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentGradeItem | null>(null);
  const [modalTugas, setModalTugas] = useState<number>(0);
  const [modalQuiz, setModalQuiz] = useState<number>(0);
  const [modalUts, setModalUts] = useState<number>(0);
  const [modalUas, setModalUas] = useState<number>(0);
  const [modalIsOverride, setModalIsOverride] = useState<boolean>(false);
  const [modalCustomFinal, setModalCustomFinal] = useState<number>(0);
  const [isSavingOverride, startSaveOverrideTransition] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Auth check
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const user = await fetchCurrentUser();
        if (mounted) setCurrentUser(user);
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const isAuthorized =
    currentUser && (currentUser.role === 'mentor' || currentUser.role === 'admin');

  // 2. Fetch Batches
  const loadBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    const token = getAuthToken();
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${apiUrl}/v1/batches`, { headers });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setBatches(json.data);
        if (json.data.length > 0 && !selectedBatchId) {
          setSelectedBatchId(json.data[0].id);
        }
      }
    } catch {
      toast.error('Gagal menghubungkan ke server untuk memuat daftar batch.');
    } finally {
      setIsLoadingBatches(false);
    }
  }, [apiUrl, selectedBatchId]);

  useEffect(() => {
    if (isAuthorized) {
      loadBatches();
    }
  }, [isAuthorized, loadBatches]);

  // 3. Fetch Gradebook for Selected Batch
  const loadGradebook = useCallback(
    async (batchId: string) => {
      if (!batchId) return;
      setIsLoadingGrades(true);
      const token = getAuthToken();
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${apiUrl}/v1/grades/batch/${batchId}`, { headers });
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setGradebook(json.data);
        } else {
          toast.error(json.message || 'Gagal memuat rekap nilai batch.');
          setGradebook(null);
        }
      } catch {
        toast.error('Gagal mengambil data lembar nilai.');
        setGradebook(null);
      } finally {
        setIsLoadingGrades(false);
      }
    },
    [apiUrl]
  );

  useEffect(() => {
    if (selectedBatchId && isAuthorized) {
      loadGradebook(selectedBatchId);
    }
  }, [selectedBatchId, isAuthorized, loadGradebook]);

  // 4. Open Override Modal
  const handleOpenOverrideModal = (student: StudentGradeItem) => {
    setSelectedStudent(student);
    setModalTugas(student.tugas);
    setModalQuiz(student.quiz);
    setModalUts(student.uts);
    setModalUas(student.uas);
    setModalIsOverride(student.isOverride);
    setModalCustomFinal(student.finalScore);
    setIsOverrideModalOpen(true);
  };

  // Preview final score calculation in modal
  const computedFormulaFinal = Math.round(
    (modalTugas * 0.2 + modalQuiz * 0.2 + modalUts * 0.3 + modalUas * 0.3) * 100
  ) / 100;

  const currentPreviewFinal = modalIsOverride ? modalCustomFinal : computedFormulaFinal;

  const getLetterPreview = (score: number) => {
    if (score >= 85) return { letter: 'A', pass: true };
    if (score >= 75) return { letter: 'B', pass: true };
    if (score >= 65) return { letter: 'C', pass: true };
    if (score >= 50) return { letter: 'D', pass: false };
    return { letter: 'E', pass: false };
  };

  // 5. Submit Override / Save
  const handleSaveOverride = (overrideMode: boolean) => {
    if (!selectedStudent || !selectedBatchId) return;

    startSaveOverrideTransition(async () => {
      const token = getAuthToken();
      if (!token) {
        toast.error('Sesi login telah kedaluwarsa.');
        return;
      }

      try {
        const payload = {
          student_id: selectedStudent.studentId,
          batch_id: selectedBatchId,
          tugas_score: Number(modalTugas),
          quiz_score: Number(modalQuiz),
          uts_score: Number(modalUts),
          uas_score: Number(modalUas),
          final_score: overrideMode ? Number(modalCustomFinal) : undefined,
          is_override: overrideMode,
        };

        const res = await fetch(`${apiUrl}/v1/grades/override`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          toast.success(
            overrideMode
              ? `Nilai override untuk ${selectedStudent.fullName} berhasil disimpan.`
              : `Nilai ${selectedStudent.fullName} berhasil dikembalikan ke kalkulasi otomatis.`
          );
          setIsOverrideModalOpen(false);
          // Refresh gradebook
          loadGradebook(selectedBatchId);
        } else {
          toast.error(json.message || 'Gagal menyimpan nilai.');
        }
      } catch {
        toast.error('Terjadi kesalahan jaringan.');
      }
    });
  };

  // 6. Export to CSV
  const handleExportCSV = () => {
    if (!gradebook || gradebook.students.length === 0) {
      toast.error('Tidak ada data nilai untuk diekspor.');
      return;
    }

    const headers = [
      'No',
      'Nama Lengkap',
      'Email',
      'Discord',
      'Batch Kelas',
      'Mata Kuliah',
      'Tugas (20%)',
      'Quiz (20%)',
      'UTS (30%)',
      'UAS (30%)',
      'Nilai Akhir',
      'Huruf Mutu',
      'Bobot Nilai',
      'Predikat',
      'Status Kelulusan',
      'Manual Override',
    ];

    const rows = gradebook.students.map((s, idx) => [
      idx + 1,
      `"${s.fullName.replace(/"/g, '""')}"`,
      `"${s.email}"`,
      `"${s.discordUsername || '-'}"`,
      `"${gradebook.batch.name.replace(/"/g, '""')}"`,
      `"${gradebook.batch.courseTitle.replace(/"/g, '""')}"`,
      s.tugas,
      s.quiz,
      s.uts,
      s.uas,
      s.finalScore,
      s.gradeLetter,
      s.gradePoint,
      `"${s.predicate}"`,
      s.isPassing ? 'LULUS' : 'TIDAK LULUS',
      s.isOverride ? 'YA' : 'TIDAK',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeName = gradebook.batch.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `rekap_nilai_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('File CSV berhasil diunduh.');
  };

  // 7. Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Filter students
  const filteredStudents = (gradebook?.students || []).filter((student) => {
    const matchQuery =
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.discordUsername &&
        student.discordUsername.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchQuery) return false;

    if (filterStatus === 'passing') return student.isPassing;
    if (filterStatus === 'failing') return !student.isPassing;
    if (filterStatus === 'overridden') return student.isOverride;
    return true;
  });

  // Guard: Unauthorized
  if (!isAuthLoading && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold tracking-tight mb-2">Akses Dibatasi</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Halaman Lembar Rekap Nilai SIAKAD hanya dapat diakses oleh Mentor Pengampu atau Administrator.
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: 'default' }))}>
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const selectedBatchInfo = batches.find((b) => b.id === selectedBatchId);

  return (
    <div className="space-y-6 pb-16">
      {/* Print-Only Header: Standar Dokumen Akademik SIAKAD */}
      <div className="hidden print:block mb-8 border-b-2 border-black pb-4 text-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider">
              BELAJAR KODING ACADEMY & SIAKAD
            </h1>
            <p className="text-xs font-serif text-gray-700">
              Sistem Informasi Akademik & Rekapitulasi Hasil Evaluasi Kompetensi Siswa
            </p>
          </div>
          <div className="text-right text-xs">
            <p>Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
            <p className="font-semibold">Dokumen Resmi SIAKAD</p>
          </div>
        </div>

        {gradebook && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t pt-2 border-gray-400">
            <div>
              <span className="font-bold">Batch Kelas:</span> {gradebook.batch.name}
            </div>
            <div>
              <span className="font-bold">Mata Kuliah:</span> {gradebook.batch.courseTitle}
            </div>
            <div>
              <span className="font-bold">Mentor Pengampu:</span>{' '}
              {gradebook.batch.mentorName || 'Belum Ditetapkan'}
            </div>
            <div>
              <span className="font-bold">Formula Evaluasi:</span> Tugas (20%) + Quiz (20%) + UTS (30%) + UAS (30%)
            </div>
          </div>
        )}
      </div>

      {/* Screen Header */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
              Lembar Rekap Nilai Akademik
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              Tugas 20% &middot; Quiz 20% &middot; UTS 30% &middot; UAS 30%
            </Badge>
          </div>
          <p className="text-sm text-fd-muted-foreground">
            Pantau performa akademik siswa, sesuaikan nilai akhir secara manual, dan ekspor transkrip resmi per batch.
          </p>
        </div>

        {/* Action Buttons: Refresh, Export CSV & Print */}
        <ButtonGroup className="self-start sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => selectedBatchId ? loadGradebook(selectedBatchId) : loadBatches()}
            disabled={isLoadingBatches || isLoadingGrades}
          >
            <RefreshCw className={`size-3.5 ${(isLoadingBatches || isLoadingGrades) ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!gradebook || gradebook.students.length === 0}
          >
            <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Unduh CSV (Excel)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={!gradebook || gradebook.students.length === 0}
          >
            <Printer className="size-3.5 text-fd-primary" />
            <span>Cetak Transkrip</span>
          </Button>
        </ButtonGroup>
      </header>

      {/* Batch Selector Bar */}
      <Card className="print:hidden border-fd-border bg-fd-card shadow-2xs">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label htmlFor="batchSelect" className="text-xs font-semibold text-fd-foreground whitespace-nowrap flex items-center gap-2">
              <Layers className="size-4 text-fd-muted-foreground" />
              Pilih Batch Kelas:
            </label>
            <div className="relative min-w-[280px]">
              {isLoadingBatches ? (
                <div className="flex items-center gap-2 text-sm text-fd-muted-foreground px-3 py-2 border border-fd-border rounded-lg">
                  <Loader2 className="size-4 animate-spin" /> Memuat daftar batch...
                </div>
              ) : batches.length === 0 ? (
                <div className="text-sm text-fd-muted-foreground px-3 py-2 border border-fd-border rounded-lg">
                  Belum ada batch tersedia.
                </div>
              ) : (
                <select
                  id="batchSelect"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-fd-border bg-fd-background px-3 text-sm font-medium text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} &middot; {b.courseTitle} ({b.studentCount || 0} Siswa)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {selectedBatchInfo && (
            <div className="flex items-center gap-3 text-xs text-fd-muted-foreground border-t border-fd-border md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4">
              <div>
                <span className="font-semibold text-fd-foreground">Mentor:</span>{' '}
                {selectedBatchInfo.mentorName || 'Belum Diatur'}
              </div>
              <span>&middot;</span>
              <div>
                <span className="font-semibold text-fd-foreground">Mata Kuliah:</span>{' '}
                {selectedBatchInfo.courseTitle}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stat Cards */}
      {gradebook && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <div className="rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fd-muted-foreground">Total Siswa Terdaftar</span>
              <div className="size-8 rounded-lg border border-fd-border bg-fd-muted/40 text-fd-muted-foreground flex items-center justify-center">
                <Users className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground">
              {gradebook.stats.totalStudents}
            </p>
            <p className="text-xs text-fd-muted-foreground">Terploting dalam batch ini</p>
          </div>

          <div className="rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fd-muted-foreground">Rata-rata Nilai Kelas</span>
              <div className="size-8 rounded-lg border border-fd-primary/20 bg-fd-primary/10 text-fd-primary flex items-center justify-center">
                <Award className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground">
              {gradebook.stats.classAverage}
            </p>
            <p className="text-xs text-fd-muted-foreground">Kalkulasi berbobot 0 - 100</p>
          </div>

          <div className="rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fd-muted-foreground">Tingkat Kelulusan</span>
              <div className="size-8 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <p className={`text-2xl font-bold font-mono tabular-nums ${gradebook.stats.passRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
              {gradebook.stats.passRate}%
            </p>
            <p className="text-xs text-fd-muted-foreground">
              {gradebook.stats.passCount} dari {gradebook.stats.totalStudents} siswa lulus (Nilai &ge; 65)
            </p>
          </div>

          <div className="rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fd-muted-foreground">Nilai Ter-override</span>
              <div className="size-8 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <SlidersHorizontal className="size-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-fd-foreground">
              {gradebook.stats.overrideCount}
            </p>
            <p className="text-xs text-fd-muted-foreground">
              {gradebook.stats.overrideCount > 0
                ? 'Siswa dengan nilai manual khusus'
                : 'Semua nilai mengikuti kalkulasi murni'}
            </p>
          </div>
        </div>
      )}

      {/* Gradebook Table Card */}
      <Card className="border-fd-border bg-fd-card shadow-2xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-fd-border print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-fd-foreground">
                <FileSpreadsheet className="size-4 text-fd-primary" />
                Daftar Rekapitulasi Nilai Siswa
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Nilai akhir dihitung: (Tugas &times; 20%) + (Quiz &times; 20%) + (UTS &times; 30%) + (UAS &times; 30%).
              </CardDescription>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="size-4 text-fd-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 w-full sm:w-[220px] text-xs"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="h-10 rounded-lg border border-fd-border bg-fd-background px-3 text-xs font-medium text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                <option value="all">Semua Status</option>
                <option value="passing">Hanya Lulus (A/B/C)</option>
                <option value="failing">Belum Lulus (D/E)</option>
                <option value="overridden">Hanya Nilai Override</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingGrades ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Memuat lembar rekap nilai...</p>
            </div>
          ) : !gradebook || gradebook.students.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-base mb-1">Belum Ada Siswa di Batch Ini</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Batch ini belum memiliki siswa yang terdaftar atau di-ploting melalui menu Kelola Batch.
              </p>
              <Link
                href="/dashboard/admin/batches"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Buka Kelola Batch & Siswa
              </Link>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">Tidak ada data siswa yang cocok dengan filter pencarian.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className="mt-2 text-xs"
              >
                Reset Pencarian
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground print:bg-gray-100 print:text-black">
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-3 text-center">Tugas (20%)</th>
                    <th className="py-3 px-3 text-center">Quiz (20%)</th>
                    <th className="py-3 px-3 text-center">UTS (30%)</th>
                    <th className="py-3 px-3 text-center">UAS (30%)</th>
                    <th className="py-3 px-3 text-center font-bold text-foreground print:text-black">Nilai Akhir</th>
                    <th className="py-3 px-3 text-center">Huruf</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center print:hidden">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStudents.map((student, idx) => (
                    <tr
                      key={student.studentId}
                      className="hover:bg-muted/30 transition-colors group print:border-b print:border-gray-300"
                    >
                      <td className="py-3.5 px-3 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            {student.fullName}
                            {student.isOverride && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-semibold px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 print:border print:text-black"
                              >
                                Override
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">{student.email}</span>
                          {student.discordUsername && (
                            <span className="text-[11px] text-muted-foreground/80 font-mono">
                              Discord: @{student.discordUsername}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono">{student.tugas}</td>
                      <td className="py-3.5 px-3 text-center font-mono">{student.quiz}</td>
                      <td className="py-3.5 px-3 text-center font-mono">{student.uts}</td>
                      <td className="py-3.5 px-3 text-center font-mono">{student.uas}</td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-base text-foreground print:text-black">
                        {student.finalScore}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'font-bold text-xs px-2 py-0.5 font-mono',
                            student.gradeLetter === 'A' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                            student.gradeLetter === 'B' && 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
                            student.gradeLetter === 'C' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
                            (student.gradeLetter === 'D' || student.gradeLetter === 'E') &&
                              'bg-destructive/15 text-destructive border-destructive/20'
                          )}
                        >
                          {student.gradeLetter}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <Badge
                          variant={student.isPassing ? 'default' : 'destructive'}
                          className={cn(
                            'text-[11px] font-medium px-2 py-0.5',
                            student.isPassing
                              ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/15'
                              : 'bg-red-600/10 text-red-700 dark:text-red-400 border border-red-600/20'
                          )}
                        >
                          {student.isPassing ? 'Lulus' : 'Belum Lulus'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center print:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenOverrideModal(student)}
                        >
                          <SlidersHorizontal className="size-3.5" />
                          <span>Sesuaikan</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print-Only Signature & Academic Verification Footer */}
      <div className="hidden print:block mt-12 pt-6 border-t border-gray-400 text-black text-xs">
        <div className="grid grid-cols-2 gap-8 text-center">
          <div>
            <p className="mb-16">Mengetahui,<br />Koordinator Akademik & Kurikulum</p>
            <p className="font-bold underline">( ...................................................... )</p>
            <p className="text-[10px] text-gray-600">NIP / NIDN Akademik</p>
          </div>
          <div>
            <p className="mb-16">
              Diverifikasi oleh,<br />
              Dosen / Mentor Pengampu Batch
            </p>
            <p className="font-bold underline">
              ( {gradebook?.batch.mentorName || '......................................................'} )
            </p>
            <p className="text-[10px] text-gray-600">Mentor Belajar Koding</p>
          </div>
        </div>
      </div>

      {/* Modal Dialog: Manual Override Nilai Siswa */}
      <Dialog open={isOverrideModalOpen} onOpenChange={setIsOverrideModalOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              Penyesuaian Nilai Siswa (Override)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ubah angka nilai per komponen atau tetapkan Nilai Akhir manual khusus untuk siswa ini.
            </DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-4 py-2">
              {/* Student Info Box */}
              <div className="p-3 bg-muted/40 rounded-lg border border-border/70 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm text-foreground">{selectedStudent.fullName}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudent.email}</p>
                </div>
                {selectedStudent.isOverride && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px]">
                    Sedang Ter-override
                  </Badge>
                )}
              </div>

              {/* Component Scores Input Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="modalTugas" className="text-xs font-semibold flex justify-between">
                    <span>Tugas (20%)</span>
                    <span className="text-muted-foreground font-mono">0 - 100</span>
                  </label>
                  <Input
                    id="modalTugas"
                    type="number"
                    min={0}
                    max={100}
                    value={modalTugas}
                    onChange={(e) => setModalTugas(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="font-mono text-center h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="modalQuiz" className="text-xs font-semibold flex justify-between">
                    <span>Quiz (20%)</span>
                    <span className="text-muted-foreground font-mono">0 - 100</span>
                  </label>
                  <Input
                    id="modalQuiz"
                    type="number"
                    min={0}
                    max={100}
                    value={modalQuiz}
                    onChange={(e) => setModalQuiz(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="font-mono text-center h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="modalUts" className="text-xs font-semibold flex justify-between">
                    <span>UTS Proyek (30%)</span>
                    <span className="text-muted-foreground font-mono">0 - 100</span>
                  </label>
                  <Input
                    id="modalUts"
                    type="number"
                    min={0}
                    max={100}
                    value={modalUts}
                    onChange={(e) => setModalUts(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="font-mono text-center h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="modalUas" className="text-xs font-semibold flex justify-between">
                    <span>UAS Capstone (30%)</span>
                    <span className="text-muted-foreground font-mono">0 - 100</span>
                  </label>
                  <Input
                    id="modalUas"
                    type="number"
                    min={0}
                    max={100}
                    value={modalUas}
                    onChange={(e) => setModalUas(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="font-mono text-center h-10"
                  />
                </div>
              </div>

              {/* Calculated Formula Preview */}
              <div className="p-3 bg-muted/20 border rounded-md flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Hasil Kalkulasi Formula Komponen:</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {computedFormulaFinal}
                </span>
              </div>

              {/* Override Toggle Checkbox */}
              <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="enableOverride"
                    checked={modalIsOverride}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setModalIsOverride(checked);
                      if (checked && modalCustomFinal === 0) {
                        setModalCustomFinal(computedFormulaFinal);
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <label htmlFor="enableOverride" className="text-xs font-bold text-foreground cursor-pointer">
                      Tetapkan Nilai Akhir Manual Khusus (Override Resmi)
                    </label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Centang jika Anda ingin menetapkan nilai akhir yang kebal terhadap perubahan kalkulasi komponen otomatis.
                    </p>
                  </div>
                </div>

                {modalIsOverride && (
                  <div className="pt-2 border-t border-amber-500/20 flex items-center gap-3">
                    <label htmlFor="customFinal" className="text-xs font-semibold text-foreground whitespace-nowrap">
                      Nilai Akhir Tetap:
                    </label>
                    <Input
                      id="customFinal"
                      type="number"
                      min={0}
                      max={100}
                      value={modalCustomFinal}
                      onChange={(e) =>
                        setModalCustomFinal(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                      }
                      className="font-mono font-bold text-base h-10 text-center w-28 bg-background"
                    />
                  </div>
                )}
              </div>

              {/* Live Status Preview */}
              <div className="p-3 bg-card border rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">Pratinjau Hasil Akhir:</span>
                  <p className="font-bold text-base font-mono mt-0.5">
                    {currentPreviewFinal} / 100
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-bold text-xs font-mono px-2.5 py-0.5',
                      getLetterPreview(currentPreviewFinal).pass
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        : 'bg-destructive/10 text-destructive border-destructive/30'
                    )}
                  >
                    Mutu: {getLetterPreview(currentPreviewFinal).letter} ({getLetterPreview(currentPreviewFinal).pass ? 'Lulus' : 'Belum Lulus'})
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            {selectedStudent?.isOverride && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSaveOverride(false)}
                disabled={isSavingOverride}
                className="text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="size-3.5" />
                <span>Kembalikan ke Kalkulasi Otomatis</span>
              </Button>
            )}

            <ButtonGroup className="ml-auto w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOverrideModalOpen(false)}
                disabled={isSavingOverride}
                className="flex-1 sm:flex-initial"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveOverride(modalIsOverride)}
                disabled={isSavingOverride}
                className="flex-1 sm:flex-initial"
              >
                {isSavingOverride && <Loader2 className="size-3.5 animate-spin" />}
                <span>Simpan Nilai</span>
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
