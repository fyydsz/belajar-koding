'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import {
  ClipboardList,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  ChevronRight,
  BookOpen,
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  X,
  Layers,
  FolderGit2,
  Globe,
  FileArchive,
  RefreshCw,
  Send,
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

interface BatchItem {
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
}

interface AssignmentItem {
  id: string;
  courseId: string;
  batchId?: string | null;
  batchName?: string | null;
  type: 'tugas' | 'quiz' | 'uts' | 'uas';
  courseTitle: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  expiredAt: string;
  isExpired: boolean;
}

interface SubmissionItem {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  avatarUrl: string | null;
  discordUsername: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  fileUrl: string | null;
  notes: string | null;
  submittedVia: string | null;
  grade: string | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
}

export default function DosenTugasPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<AssignmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Buat Tugas State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [assignmentType, setAssignmentType] = useState<'tugas' | 'quiz' | 'uts' | 'uas'>('tugas');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiredAt, setExpiredAt] = useState('');
  const [isSubmitting, startTransition] = useTransition();

  // Submission Inspection Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<AssignmentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({});
  const [gradingFeedbacks, setGradingFeedbacks] = useState<Record<string, string>>({});
  const [isGrading, setIsGrading] = useState<Record<string, boolean>>({});

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Load User & Role
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

  // Load Courses, Batches, & Assignments
  const loadData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      topProgress.start();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const [coursesRes, batchesRes, assignRes] = await Promise.all([
        fetch(`${apiUrl}/v1/assignments/courses`, { headers }),
        fetch(`${apiUrl}/v1/batches`, { headers }),
        fetch(`${apiUrl}/v1/assignments`, { headers }),
      ]);

      const [coursesJson, batchesJson, assignJson] = await Promise.all([
        coursesRes.json(),
        batchesRes.json(),
        assignRes.json(),
      ]);

      if (coursesJson.success && coursesJson.data) {
        setCourses(coursesJson.data);
        if (coursesJson.data.length > 0 && !selectedCourseId) {
          setSelectedCourseId(coursesJson.data[0].id);
        }
      }

      if (batchesJson.success && batchesJson.data) {
        setBatches(batchesJson.data);
        if (batchesJson.data.length > 0 && !selectedBatchId) {
          setSelectedBatchId(batchesJson.data[0].id);
        }
      }

      if (assignJson.success && assignJson.data) {
        setAssignmentsList(assignJson.data);
      }
    } catch {
      toast.error('Gagal memuat data penugasan.');
    } finally {
      setIsLoading(false);
      topProgress.done();
    }
  }, [apiUrl, selectedCourseId, selectedBatchId]);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized, loadData]);

  // Handle Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;

    if (!selectedCourseId || !title.trim() || !expiredAt) {
      toast.error('Lengkapi mata kuliah, judul tugas, dan batas waktu pengumpulan.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${apiUrl}/v1/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            course_id: selectedCourseId,
            batch_id: selectedBatchId || undefined,
            type: assignmentType,
            title: title.trim(),
            description: description.trim() || undefined,
            expired_at: new Date(expiredAt).toISOString(),
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Gagal membuat tugas.');
        }

        toast.success(json.message || 'Penugasan proyek berhasil dibuat!');
        setTitle('');
        setDescription('');
        setExpiredAt('');
        loadData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Terjadi kendala sistem.';
        toast.error(msg);
      }
    });
  };

  // Buka Modal Detail Submission
  const openSubmissionsModal = async (assignment: AssignmentItem) => {
    setSelectedAssignment(assignment);
    setIsLoadingSubmissions(true);
    setSubmissions([]);

    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiUrl}/v1/assignments/submissions/${assignment.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSubmissions(json.data || []);
        // Inisialisasi nilai form
        const scores: Record<string, number> = {};
        const feedbacks: Record<string, string> = {};
        (json.data || []).forEach((sub: SubmissionItem) => {
          if (sub.grade) scores[sub.id] = parseFloat(sub.grade);
          if (sub.feedback) feedbacks[sub.id] = sub.feedback;
        });
        setGradingScores(scores);
        setGradingFeedbacks(feedbacks);
      }
    } catch {
      toast.error('Gagal mengambil daftar pengumpulan siswa.');
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Submit Nilai Mentor & Auto-Sync SIAKAD
  const handleGradeSubmission = async (submissionId: string) => {
    const grade = gradingScores[submissionId];
    if (grade === undefined || isNaN(grade) || grade < 0 || grade > 100) {
      toast.error('Masukkan nilai valid antara 0 sampai 100.');
      return;
    }

    const feedback = gradingFeedbacks[submissionId] || '';
    setIsGrading((prev) => ({ ...prev, [submissionId]: true }));

    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiUrl}/v1/assignments/submissions/${submissionId}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ grade, feedback }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyimpan nilai.');
      }

      toast.success('Nilai berhasil disimpan & disinkronkan ke SIAKAD!');
      if (selectedAssignment) {
        openSubmissionsModal(selectedAssignment);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan nilai.';
      toast.error(msg);
    } finally {
      setIsGrading((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  // Hapus Assignment
  const handleConfirmDeleteAssignment = async () => {
    if (!deletingAssignment) return;

    const token = getAuthToken();
    if (!token) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/v1/assignments/${deletingAssignment.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menghapus tugas.');
      }
      toast.success('Tugas berhasil dihapus.');
      setDeletingAssignment(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return null;
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <AlertCircle className="size-12 mx-auto text-amber-500" />
        <h2 className="text-lg font-bold text-fd-foreground">Akses Khusus Mentor / Pengajar</h2>
        <p className="text-xs text-fd-muted-foreground">
          Halaman ini hanya dapat diakses oleh akun dengan peran Mentor atau Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Halaman */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Kelola Tugas &amp; Proyek Evaluasi
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Buat penugasan proyek per batch kelas, periksa kode siswa, dan sinkronkan penilaian ke buku nilai.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Kolom Kiri: Form Buat Penugasan Baru */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-fd-border bg-fd-card shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Buat Penugasan Baru</CardTitle>
              <CardDescription className="text-xs">
                Penugasan terikat spesifik ke batch kelas dan akan masuk ke bobot nilai akademik siswa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAssignment} className="space-y-4">
                {/* Pilihan Mata Kuliah */}
                <div className="space-y-1.5">
                  <label htmlFor="courseSelect" className="text-xs font-semibold text-fd-foreground">
                    Mata Kuliah Master
                  </label>
                  <select
                    id="courseSelect"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-fd-border bg-fd-background px-3 text-sm text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                    required
                  >
                    <option value="">Pilih Mata Kuliah</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilihan Batch Kelas */}
                <div className="space-y-1.5">
                  <label htmlFor="batchSelect" className="text-xs font-semibold text-fd-foreground">
                    Sasaran Batch Kelas
                  </label>
                  <select
                    id="batchSelect"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-fd-border bg-fd-background px-3 text-sm text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                  >
                    <option value="">Semua Batch / Global Silabus</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.courseTitle})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilihan Kategori Evaluasi */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-fd-foreground">
                    Kategori &amp; Bobot Penilaian
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'tugas', label: 'Tugas (20%)' },
                        { id: 'quiz', label: 'Quiz (20%)' },
                        { id: 'uts', label: 'UTS Proyek (30%)' },
                        { id: 'uas', label: 'UAS Capstone (30%)' },
                      ] as const
                    ).map((cat) => (
                      <Button
                        key={cat.id}
                        type="button"
                        size="sm"
                        variant={assignmentType === cat.id ? 'default' : 'outline'}
                        onClick={() => setAssignmentType(cat.id)}
                        className="w-full"
                      >
                        {cat.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Judul Tugas */}
                <div className="space-y-1.5">
                  <label htmlFor="titleInput" className="text-xs font-semibold text-fd-foreground">
                    Judul Penugasan
                  </label>
                  <Input
                    id="titleInput"
                    placeholder="Contoh: Proyek UTS: Slicing UI E-Commerce"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-sm"
                    required
                  />
                </div>

                {/* Batas Waktu */}
                <div className="space-y-1.5">
                  <label htmlFor="expiredAtInput" className="text-xs font-semibold text-fd-foreground">
                    Tenggat Waktu Pengumpulan (Deadline)
                  </label>
                  <Input
                    id="expiredAtInput"
                    type="datetime-local"
                    value={expiredAt}
                    onChange={(e) => setExpiredAt(e.target.value)}
                    className="text-sm"
                    required
                  />
                </div>

                {/* Deskripsi */}
                <div className="space-y-1.5">
                  <label htmlFor="descInput" className="text-xs font-semibold text-fd-foreground">
                    Panduan &amp; Instruksi Pengerjaan (Opsional)
                  </label>
                  <Textarea
                    id="descInput"
                    placeholder="Tuliskan spesifikasi teknis, rubrik penilaian, atau ketentuan pengumpulan..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="text-xs leading-relaxed"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="w-full font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Menerbitkan Tugas...
                    </>
                  ) : (
                    'Terbitkan Penugasan'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Daftar Penugasan & Aksi Periksa */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-fd-border bg-fd-card shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Daftar Penugasan Aktif</CardTitle>
              <CardDescription className="text-xs">
                Klik tombol &quot;Periksa Jawaban&quot; untuk meninjau kode siswa dan memberikan skor nilai.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignmentsList.length === 0 ? (
                <div className="text-center py-12 text-fd-muted-foreground space-y-2">
                  <ClipboardList className="size-8 mx-auto text-fd-muted-foreground/60" />
                  <p className="text-xs font-semibold text-fd-foreground">Belum ada tugas dibuat</p>
                  <p className="text-[11px]">Gunakan formulir di samping untuk menerbitkan tugas pertama Anda.</p>
                </div>
              ) : (
                <div className="divide-y divide-fd-border rounded-lg border border-fd-border text-xs">
                  {assignmentsList.map((item) => {
                    const expiredDate = new Date(item.expiredAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div key={item.id} className="p-4 space-y-3 hover:bg-fd-muted/10 transition">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold uppercase border-fd-border bg-fd-muted/40 text-fd-foreground"
                              >
                                {item.type}
                              </Badge>
                              {item.batchName && (
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Layers className="size-3" />
                                  <span>{item.batchName}</span>
                                </Badge>
                              )}
                              <span className="text-[11px] text-fd-muted-foreground">
                                &middot; {item.courseTitle}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-fd-foreground">{item.title}</h3>
                          </div>

                          <ButtonGroup className="self-end sm:self-auto shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSubmissionsModal(item)}
                            >
                              <Users className="size-3.5 text-fd-primary" />
                              <span>Periksa Jawaban</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => setDeletingAssignment(item)}
                              aria-label="Hapus Tugas"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </ButtonGroup>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-fd-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            <span>Deadline: {expiredDate}</span>
                          </span>
                          {item.isExpired && (
                            <span className="text-red-600 font-semibold">Telah Berakhir</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI HAPUS TUGAS                                   */}
      {/* ============================================================== */}
      <Dialog
        open={!!deletingAssignment}
        onOpenChange={(open) => {
          if (!open) setDeletingAssignment(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Hapus Penugasan</DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin menghapus tugas <strong>{deletingAssignment?.title}</strong> beserta seluruh pengumpulan siswa di dalamnya? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingAssignment(null)}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDeleteAssignment}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
              <span>Hapus Permanen</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL PERIKSA SUBMISSION & NILAI SISWA                         */}
      {/* ============================================================== */}
      <Dialog
        open={!!selectedAssignment}
        onOpenChange={(open) => {
          if (!open) setSelectedAssignment(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-fd-border">
            <DialogTitle className="text-base font-bold">
              Pengumpulan Siswa: {selectedAssignment?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mata Kuliah: {selectedAssignment?.courseTitle} &middot; Kategori:{' '}
              <span className="uppercase font-semibold text-fd-foreground">
                {selectedAssignment?.type}
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* List Submissions */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {isLoadingSubmissions ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-fd-muted-foreground">
                <Loader2 className="size-5 animate-spin text-fd-primary" />
                <p className="text-xs">Memuat berkas pengumpulan siswa...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-12 text-center text-fd-muted-foreground space-y-2">
                <Users className="size-8 mx-auto text-fd-muted-foreground/60" />
                <p className="text-xs font-semibold text-fd-foreground">Belum ada siswa yang mengumpulkan tugas ini</p>
                <p className="text-[11px]">Siswa dapat mengumpulkan melalui web dashboard atau bot Discord.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub) => {
                  return (
                    <Card key={sub.id} className="border-fd-border bg-fd-card">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-fd-border pb-2.5">
                          <div>
                            <p className="font-bold text-sm text-fd-foreground">{sub.studentName}</p>
                            <p className="text-[11px] text-fd-muted-foreground">{sub.studentEmail}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                              via {sub.submittedVia || 'web'}
                            </Badge>
                            <span className="text-[11px] text-fd-muted-foreground">
                              {new Date(sub.submittedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>

                        {/* Lampiran Kode Sumber & Demo */}
                        <ButtonGroup className="flex-wrap">
                          {sub.repoUrl && (
                            <a
                              href={sub.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-slot="button"
                              className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                              <FolderGit2 className="size-3.5 text-fd-primary" />
                              <span>Buka Repositori GitHub</span>
                              <ExternalLink className="size-3 text-fd-muted-foreground" />
                            </a>
                          )}
                          {sub.demoUrl && (
                            <a
                              href={sub.demoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-slot="button"
                              className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                              <Globe className="size-3.5 text-blue-500" />
                              <span>Kunjungi Live Demo</span>
                              <ExternalLink className="size-3 text-fd-muted-foreground" />
                            </a>
                          )}
                          {sub.fileUrl && (
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-slot="button"
                              className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                              <FileArchive className="size-3.5 text-amber-500" />
                              <span>Unduh Berkas Proyek</span>
                              <ExternalLink className="size-3 text-fd-muted-foreground" />
                            </a>
                          )}
                        </ButtonGroup>

                        {/* Catatan Siswa */}
                        {sub.notes && (
                          <div className="rounded-lg bg-fd-muted/30 p-2.5 text-xs">
                            <p className="text-[11px] font-semibold text-fd-muted-foreground">Catatan Siswa:</p>
                            <p className="text-fd-foreground mt-0.5">{sub.notes}</p>
                          </div>
                        )}

                        {/* Form Penilaian Mentor */}
                        <div className="pt-2 rounded-lg bg-fd-muted/20 p-3 border border-fd-border/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-fd-foreground">
                              Penilaian & Feedback Mentor
                            </label>
                            {sub.grade && (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                Sudah Dinilai: {sub.grade} / 100
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-3 space-y-1">
                              <span className="text-[11px] text-fd-muted-foreground font-semibold">Skor (0-100)</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="0-100"
                                value={gradingScores[sub.id] ?? ''}
                                onChange={(e) =>
                                  setGradingScores((prev) => ({
                                    ...prev,
                                    [sub.id]: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="font-mono text-sm h-9"
                              />
                            </div>

                            <div className="sm:col-span-7 space-y-1">
                              <span className="text-[11px] text-fd-muted-foreground font-semibold">Masukan Evaluasi</span>
                              <Input
                                placeholder="Masukan review kode, arsitektur, atau rubrik..."
                                value={gradingFeedbacks[sub.id] || ''}
                                onChange={(e) =>
                                  setGradingFeedbacks((prev) => ({
                                    ...prev,
                                    [sub.id]: e.target.value,
                                  }))
                                }
                                className="text-xs h-9"
                              />
                            </div>

                            <div className="sm:col-span-2 flex items-end">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isGrading[sub.id]}
                                onClick={() => handleGradeSubmission(sub.id)}
                                className="w-full text-xs h-9 font-semibold"
                              >
                                {isGrading[sub.id] ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  'Simpan Nilai'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-fd-border flex justify-between">
            <p className="text-[11px] text-fd-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-600" />
              <span>Nilai otomatis disinkronkan ke rekap SIAKAD siswa secara realtime.</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedAssignment(null)}
              className="text-xs"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
