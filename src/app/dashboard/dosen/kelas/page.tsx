'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import {
  BookOpen,
  ChevronRight,
  Layers,
  GraduationCap,
  PlusCircle,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface CourseItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  totalSessions: number;
}

export default function DosenClassroomListPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Buat Kelas State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [totalSessions, setTotalSessions] = useState<number>(16);
  const [isSubmitting, startCreateTransition] = useTransition();

  // Dialog Hapus Kelas State
  const [courseToDelete, setCourseToDelete] = useState<CourseItem | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Load Courses
  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    topProgress.start();
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/classroom/courses`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setCourses(json.data || []);
      } else {
        throw new Error(json.message || 'Gagal memuat daftar kelas.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memuat kelas.';
      setError(msg);
    } finally {
      setIsLoading(false);
      topProgress.done();
    }
  }, [apiUrl]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const user = await fetchCurrentUser();
        if (mounted) setCurrentUser(user);
      } finally {
        if (mounted) loadCourses();
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [loadCourses]);

  // Handle Title Change & Auto Slug
  const handleTitleChange = (val: string) => {
    setTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  };

  // Submit Buat Kelas
  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      toast.error('Judul dan slug kelas wajib diisi.');
      return;
    }

    startCreateTransition(async () => {
      const token = getAuthToken();
      if (!token) {
        toast.error('Sesi login telah berakhir.');
        return;
      }

      try {
        const res = await fetch(`${apiUrl}/v1/classroom/courses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim(),
            description: description.trim() || undefined,
            total_sessions: Number(totalSessions) || 16,
          }),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          toast.success(json.message || 'Kelas baru berhasil dibuat.');
          setIsCreateOpen(false);
          setTitle('');
          setSlug('');
          setDescription('');
          setTotalSessions(16);
          loadCourses();
          window.dispatchEvent(new Event('classroom-updated'));
        } else {
          toast.error(json.message || 'Gagal membuat kelas.');
        }
      } catch {
        toast.error('Terjadi kesalahan jaringan.');
      }
    });
  };

  // Submit Hapus Kelas
  const handleDeleteCourse = () => {
    if (!courseToDelete) return;

    startDeleteTransition(async () => {
      const token = getAuthToken();
      if (!token) {
        toast.error('Sesi login telah berakhir.');
        return;
      }

      try {
        const res = await fetch(`${apiUrl}/v1/classroom/courses/${courseToDelete.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();
        if (res.ok && json.success) {
          toast.success(json.message || 'Kelas berhasil dihapus.');
          setCourseToDelete(null);
          loadCourses();
          window.dispatchEvent(new Event('classroom-updated'));
        } else {
          toast.error(json.message || 'Gagal menghapus kelas.');
        }
      } catch {
        toast.error('Terjadi kesalahan jaringan.');
      }
    });
  };

  const isAuthorized =
    currentUser && (currentUser.role === 'mentor' || currentUser.role === 'admin');
  const isAdmin = currentUser && currentUser.role === 'admin';

  if (isLoading) {
    return null;
  }

  if (!isAuthorized) {
    return (
      <Alert variant="destructive" className="p-6">
        <AlertCircle className="size-5" />
        <AlertTitle className="text-base font-bold">Akses Terbatas</AlertTitle>
        <AlertDescription className="text-xs">
          Halaman ini khusus untuk Pengajar, Mentor, atau Administrator sistem.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Actions */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
            Kelola Kelas & Materi
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Buat kelas kurikulum mandiri, atur sesi pertemuan, dan kelola modul pembelajaran MDX.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadCourses}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusCircle className="size-3.5" />
            <span>Buat Kelas Baru</span>
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-sm font-bold">Gagal Memuat Kelas</AlertTitle>
          <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {!error && courses.length === 0 && (
        <div className="rounded-xl border border-dashed border-fd-border p-12 text-center bg-fd-card shadow-2xs">
          <GraduationCap className="size-12 mx-auto text-fd-muted-foreground/40 mb-3" />
          <h3 className="text-base font-semibold text-fd-foreground">Belum Ada Kelas yang Dibuat</h3>
          <p className="text-xs text-fd-muted-foreground max-w-md mx-auto mt-1 mb-5 leading-relaxed">
            Belum ada kurikulum kelas yang terdaftar. Klik tombol di bawah untuk membuat kelas baru beserta sesi pertemuannya.
          </p>
          <Button type="button" onClick={() => setIsCreateOpen(true)} size="sm">
            <PlusCircle className="size-3.5" />
            <span>Buat Kelas Pertama</span>
          </Button>
        </div>
      )}

      {!isLoading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="group relative flex flex-col justify-between p-5 rounded-xl border border-fd-border bg-fd-card hover:border-fd-primary/40 transition-colors shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="size-10 rounded-xl bg-fd-primary/10 text-fd-primary flex items-center justify-center border border-fd-primary/20">
                    <GraduationCap className="size-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fd-muted text-fd-foreground font-medium text-xs border border-fd-border">
                      <Layers className="size-3 text-fd-primary" />
                      <span>{course.totalSessions} Pertemuan</span>
                    </span>
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          setCourseToDelete(course);
                        }}
                        title="Hapus Kelas"
                        aria-label="Hapus Kelas"
                        className="text-fd-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <Link
                  href={`/dashboard/dosen/kelas/${course.slug}`}
                  className="font-semibold text-base text-fd-foreground group-hover:text-fd-primary transition-colors block"
                >
                  {course.title}
                </Link>
                <p className="text-fd-muted-foreground text-xs leading-relaxed mt-1.5 line-clamp-3">
                  {course.description || 'Kelola pertemuan dan materi pembelajaran kelas ini.'}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-fd-border/60 flex items-center justify-between text-xs font-semibold text-fd-primary">
                <Link
                  href={`/dashboard/dosen/kelas/${course.slug}`}
                  className="flex items-center justify-between w-full"
                >
                  <span>Kelola Pertemuan & Materi</span>
                  <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog: Buat Kelas Baru */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreateCourse}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <PlusCircle className="size-5 text-primary" />
                Buat Kelas / Kurikulum Baru
              </DialogTitle>
              <DialogDescription className="text-xs">
                Mata kuliah yang dibuat akan langsung memiliki struktur sesi pertemuan (P1 s/d P16) yang siap diisi materi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="courseTitle" className="text-xs font-semibold">
                  Judul Kelas / Mata Kuliah *
                </label>
                <Input
                  id="courseTitle"
                  type="text"
                  placeholder="Contoh: Flutter Mobile App Development"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  required
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="courseSlug" className="text-xs font-semibold flex justify-between">
                  <span>URL Slug *</span>
                  <span className="text-muted-foreground font-mono text-[11px]">Hanya huruf, angka, strip</span>
                </label>
                <Input
                  id="courseSlug"
                  type="text"
                  placeholder="flutter-mobile-app"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  className="h-10 text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="courseDesc" className="text-xs font-semibold">
                  Deskripsi Singkat Silabus
                </label>
                <Textarea
                  id="courseDesc"
                  placeholder="Tuliskan capaian belajar atau ringkasan kurikulum kelas ini..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="courseSessions" className="text-xs font-semibold flex justify-between">
                  <span>Jumlah Sesi Pertemuan</span>
                  <span className="text-muted-foreground font-mono text-[11px]">1 - 32 Sesi</span>
                </label>
                <Input
                  id="courseSessions"
                  type="number"
                  min={1}
                  max={32}
                  value={totalSessions}
                  onChange={(e) => setTotalSessions(Number(e.target.value) || 16)}
                  className="h-10 text-sm font-mono"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                <span>Simpan & Buat Kelas</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog: Konfirmasi Hapus Kelas */}
      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Hapus Kelas Ini?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Kelas <strong>&quot;{courseToDelete?.title}&quot;</strong> beserta seluruh sesi materi dan modul pertemuannya akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting} className="m-0">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              disabled={isDeleting}
              className={buttonVariants({ variant: 'destructive', size: 'sm' })}
            >
              {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
              <span>Ya, Hapus Kelas</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
