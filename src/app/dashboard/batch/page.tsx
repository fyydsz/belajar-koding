'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getAuthToken } from '@/lib/auth';
import { useMounted } from '@/lib/use-mounted';
import {
  dashboardCache,
  loadBatchCatalogCache,
  topProgress,
} from '@/lib/dashboard-navigation';
import { FileDropzone } from '@/components/ui/file-dropzone';
import {
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Loader2,
  UploadCloud,
  RefreshCw,
  ExternalLink,
  BookOpen,
  User,
  FileText,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

interface BatchItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  paymentAccountInfo: string | null;
  maxStudents: number;
  studentCount: number;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courses?: Array<{ id: string; title: string; slug: string }>;
  mentorId: string;
  mentorName: string | null;
  mentors?: Array<{ id: string; fullName: string; email: string }>;
  registrationStartDate?: string | null;
  registrationEndDate?: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  createdAt: string;
}

interface MyEnrollmentItem {
  enrollmentId: string;
  batchId: string;
  batchName: string;
  batchDescription: string | null;
  batchPrice: string;
  paymentAccountInfo: string | null;
  batchStatus: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  mentorName: string | null;
  status: 'pending' | 'active' | 'rejected' | 'dropped' | 'graduated';
  paymentProofUrl: string | null;
  notes: string | null;
  rejectedReason: string | null;
  enrolledAt: string;
  verifiedAt: string | null;
}

function formatRupiah(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return 'Gratis';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Jadwal Fleksibel';
  try {
    const s = start
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(
          new Date(start)
        )
      : '';
    const e = end
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(
          new Date(end)
        )
      : 'Selesai';
    return `${s} s/d ${e}`;
  } catch {
    return 'Jadwal Perkuliahan';
  }
}

function getBatchCourses(batch: BatchItem): string[] {
  if (batch.courses && batch.courses.length > 0) {
    return batch.courses.map((c) => c.title);
  }
  if (!batch.courseTitle) return [];
  return batch.courseTitle
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export default function StudentBatchCatalogPage() {
  const mounted = useMounted();
  const cached = dashboardCache.batchCatalog;

  const [batchesList, setBatchesList] = useState<BatchItem[]>(() => cached?.batchesList ?? []);
  const [myEnrollments, setMyEnrollments] = useState<MyEnrollmentItem[]>(
    () => cached?.myEnrollments ?? []
  );
  const [isLoading, setIsLoading] = useState(() => !cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration Modal State
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transferNotes, setTransferNotes] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Re-upload Modal State
  const [reuploadBatch, setReuploadBatch] = useState<MyEnrollmentItem | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadNotes, setReuploadNotes] = useState('');
  const [isReuploading, setIsReuploading] = useState(false);

  // Preview Proof Modal State
  const [previewProofItem, setPreviewProofItem] = useState<MyEnrollmentItem | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const loadData = useCallback(async (isSilent = false) => {
    const token = getAuthToken();
    if (!token) return;

    if (isSilent) {
      setIsRefreshing(true);
    } else if (!dashboardCache.batchCatalog) {
      setIsLoading(true);
    }
    setError(null);
    topProgress.start();

    try {
      const data = await loadBatchCatalogCache();
      setBatchesList(data.batchesList);
      setMyEnrollments(data.myEnrollments);
    } catch {
      setError('Gagal memuat katalog batch pendaftaran.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      topProgress.done();
    }
  }, []);

  useEffect(() => {
    if (mounted && !dashboardCache.batchCatalog) {
      loadData();
    }
  }, [mounted, loadData]);

  // Upload proof to server and return URL
  const uploadProofFile = async (file: File): Promise<string> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${apiUrl}/v1/batches/upload-proof`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success || !json.url) {
      throw new Error(json.message || 'Gagal mengunggah bukti pembayaran.');
    }
    return json.url;
  };

  // Submit Batch Registration
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    const token = getAuthToken();
    if (!token) return;

    const batchPriceNum = parseFloat(selectedBatch.price || '0');
    const isPaidBatch = !isNaN(batchPriceNum) && batchPriceNum > 0;

    try {
      setIsRegistering(true);

      if (isPaidBatch && !selectedFile) {
        toast.error('Harap unggah bukti pembayaran transfer terlebih dahulu.');
        setIsRegistering(false);
        return;
      }

      const proofUrl = isPaidBatch && selectedFile ? await uploadProofFile(selectedFile) : undefined;

      const res = await fetch(`${apiUrl}/v1/batches/${selectedBatch.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentProofUrl: proofUrl,
          notes: transferNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal mendaftar batch.');
      }

      toast.success('Pendaftaran batch berhasil diajukan! Menunggu verifikasi.');
      setSelectedBatch(null);
      setSelectedFile(null);
      setTransferNotes('');
      await loadData(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kendala saat mendaftar.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Submit Re-upload Proof
  const handleSubmitReupload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reuploadBatch || !reuploadFile) {
      toast.error('Harap pilih file bukti transfer yang baru.');
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    try {
      setIsReuploading(true);
      const proofUrl = await uploadProofFile(reuploadFile);

      const res = await fetch(`${apiUrl}/v1/batches/${reuploadBatch.batchId}/re-upload`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentProofUrl: proofUrl,
          notes: reuploadNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memperbarui bukti pembayaran.');
      }

      toast.success('Bukti pembayaran berhasil diajukan ulang untuk verifikasi.');
      setReuploadBatch(null);
      setReuploadFile(null);
      setReuploadNotes('');
      await loadData(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim bukti pembayaran baru.');
    } finally {
      setIsReuploading(false);
    }
  };

  // Find status for a batch
  const getEnrollmentForBatch = (batchId: string) => {
    return myEnrollments.find((e) => e.batchId === batchId);
  };

  if (!mounted || isLoading) {
    return null;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <header className="flex flex-col gap-3 border-b border-fd-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-fd-foreground">
            Pendaftaran Batch
          </h1>
          <p className="text-xs sm:text-sm text-fd-muted-foreground">
            Pilih angkatan kelas yang sedang dibuka untuk mulai mengikuti perkuliahan.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={isLoading || isRefreshing}
          className="h-9 gap-1.5 self-start sm:self-auto shrink-0 text-xs shadow-2xs"
        >
          <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
          <span>Segarkan</span>
        </Button>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center gap-2.5">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Batch Cards Grid */}
      {(() => {
        const visibleBatches = batchesList.filter((b) => b.status !== 'draft');

        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
                Batch yang Dibuka ({visibleBatches.length})
              </span>
            </div>

            {visibleBatches.length === 0 ? (
              <Empty className="py-12 border border-fd-border bg-fd-card rounded-xl">
                <EmptyMedia variant="icon">
                  <BookOpen className="size-5 text-fd-muted-foreground" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-sm font-semibold">Belum Ada Batch yang Dibuka</EmptyTitle>
                  <EmptyDescription className="text-xs max-w-xs mx-auto">
                    Saat ini belum ada batch kelas yang dibuka untuk pendaftaran.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleBatches.map((batch) => {
                  const enrollment = getEnrollmentForBatch(batch.id);
                  const isCompleted = batch.status === 'completed' || batch.status === 'archived';
                  const isFull = batch.studentCount >= batch.maxStudents;
                  const priceNum = parseFloat(batch.price || '0');
                  const coursesList = getBatchCourses(batch);
                  const remainingSeats = Math.max(0, batch.maxStudents - batch.studentCount);

                  return (
                    <Card
                      key={batch.id}
                      className="flex flex-col justify-between border-fd-border bg-fd-card hover:border-fd-primary/30 transition-colors shadow-2xs"
                    >
                      <CardHeader className="space-y-2 p-5 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base font-bold text-fd-foreground">
                            {batch.name}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCompleted && (
                              <Badge
                                variant="outline"
                                className="text-xs font-semibold bg-fd-muted text-fd-muted-foreground border-fd-border"
                              >
                                Selesai
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs font-semibold shrink-0',
                                priceNum === 0
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : 'bg-fd-muted text-fd-foreground border-fd-border'
                              )}
                            >
                              {priceNum === 0 ? 'Gratis' : formatRupiah(batch.price)}
                            </Badge>
                          </div>
                        </div>

                        {batch.description && (
                          <CardDescription className="text-xs text-fd-muted-foreground line-clamp-2 leading-relaxed">
                            {batch.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-3.5 p-5 pt-0 flex-1">
                        {/* Mata Kuliah Chips */}
                        {coursesList.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-medium text-fd-muted-foreground block">
                              Mata Kuliah:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {coursesList.map((course, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-fd-muted text-fd-foreground border border-fd-border/70"
                                >
                                  <BookOpen className="size-3 text-fd-primary shrink-0" />
                                  <span className="truncate max-w-[200px]">{course}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata Rinci */}
                        <div className="space-y-2 pt-3 border-t border-fd-border/60 text-xs text-fd-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="size-3.5 shrink-0 text-fd-muted-foreground" />
                            <span className="truncate">Mentor: {batch.mentorName || 'Mentor Akademik'}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Calendar className="size-3.5 shrink-0 text-fd-muted-foreground" />
                            <span className="truncate">Kelas: {formatDateRange(batch.startDate, batch.endDate)}</span>
                          </div>

                          {(batch.registrationStartDate || batch.registrationEndDate) && (
                            <div className="flex items-center gap-2 text-[11px] text-fd-muted-foreground/90">
                              <Clock className="size-3.5 shrink-0 text-fd-muted-foreground" />
                              <span className="truncate">Pendaftaran: {formatDateRange(batch.registrationStartDate, batch.registrationEndDate)}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Users className="size-3.5 shrink-0 text-fd-muted-foreground" />
                            <span>
                              Kuota: {batch.studentCount} / {batch.maxStudents} Siswa{' '}
                              <span className="text-[11px] opacity-80">
                                ({isFull ? 'Penuh' : `${remainingSeats} sisa`})
                              </span>
                            </span>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="p-5 pt-0 bg-transparent border-t-0">
                        {enrollment?.status === 'active' ? (
                          <Link
                            href={`/dashboard/kelas/${batch.courseSlug}`}
                            className={cn(
                              buttonVariants({ variant: 'outline', size: 'sm' }),
                              'w-full h-9 gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold text-xs'
                            )}
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Buka Kelas</span>
                          </Link>
                        ) : isCompleted ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled
                            size="sm"
                            className="w-full h-9 text-xs font-semibold"
                          >
                            <span>Batch Selesai</span>
                          </Button>
                        ) : enrollment?.status === 'pending' ? (
                          <div className="flex items-center gap-2 w-full">
                            <Button
                              type="button"
                              variant="outline"
                              disabled
                              size="sm"
                              className="flex-1 h-9 gap-1.5 text-xs font-semibold border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            >
                              <Clock className="size-3.5" />
                              <span>Menunggu Verifikasi</span>
                            </Button>
                            {enrollment.paymentProofUrl && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewProofItem(enrollment)}
                                className="h-9 px-2.5 text-xs gap-1 shrink-0 shadow-2xs"
                                title="Lihat Bukti Pembayaran"
                              >
                                <ExternalLink className="size-3" />
                                <span>Lihat Bukti</span>
                              </Button>
                            )}
                          </div>
                        ) : enrollment?.status === 'rejected' ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setReuploadBatch(enrollment);
                              setReuploadFile(null);
                              setReuploadNotes(enrollment.notes || '');
                            }}
                            className="w-full h-9 gap-1.5 bg-red-600 text-white hover:bg-red-700 text-xs font-semibold"
                          >
                            <UploadCloud className="size-3.5" />
                            <span>Unggah Ulang Bukti</span>
                          </Button>
                        ) : isFull ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled
                            size="sm"
                            className="w-full h-9 text-xs font-semibold"
                          >
                            <span>Kuota Penuh</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setSelectedFile(null);
                              setTransferNotes('');
                            }}
                            className="w-full h-9 gap-1.5 text-xs font-semibold shadow-2xs"
                          >
                            <span>Daftar Batch Ini</span>
                            <ArrowRight className="size-3.5" />
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}

      {/* Dialog: Formulir Pendaftaran & Bukti Transfer */}
      <Dialog
        open={Boolean(selectedBatch)}
        onOpenChange={(open) => {
          if (!open && !isRegistering) setSelectedBatch(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogDescription className="text-xs font-medium text-fd-primary">
              {selectedBatch?.courseTitle}
            </DialogDescription>
            <DialogTitle className="text-lg font-bold text-fd-foreground">
              Pendaftaran: {selectedBatch?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedBatch && (() => {
            const selectedPriceNum = parseFloat(selectedBatch.price || '0');
            const isPaidSelectedBatch = !isNaN(selectedPriceNum) && selectedPriceNum > 0;

            return (
              <form onSubmit={handleSubmitRegistration} className="space-y-4">
                {/* Ringkasan Biaya & Petunjuk Rekening Pembayaran */}
                <div className="rounded-xl border border-fd-border bg-fd-muted/40 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-fd-muted-foreground font-medium">Biaya Registrasi</span>
                    <span className="font-bold text-sm text-fd-primary">
                      {formatRupiah(selectedBatch.price)}
                    </span>
                  </div>

                  {isPaidSelectedBatch ? (
                    <div className="pt-2 border-t border-fd-border/60">
                      <p className="font-semibold text-fd-foreground mb-1">Informasi Rekening Tujuan Transfer:</p>
                      <p className="text-fd-muted-foreground whitespace-pre-line text-xs leading-relaxed">
                        {selectedBatch.paymentAccountInfo ||
                          'Bank BCA: 123-456-7890 a.n Belajar Koding Indonesia\nSertakan nama akun Anda pada berita transfer.'}
                      </p>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-fd-border/60 text-fd-muted-foreground leading-relaxed">
                      Batch ini tidak dipungut biaya (Gratis). Anda dapat langsung mengirimkan permohonan pendaftaran tanpa mengunggah bukti transfer.
                    </div>
                  )}
                </div>

                {/* Unggah Bukti Transfer (Hanya untuk Batch Berbayar) */}
                {isPaidSelectedBatch && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-fd-foreground block">
                      Unggah Bukti Transfer (PNG, JPG, atau PDF) <span className="text-destructive">*</span>
                    </label>
                    <FileDropzone
                      selectedFile={selectedFile}
                      onFileSelect={setSelectedFile}
                      disabled={isRegistering}
                    />
                  </div>
                )}

                {/* Catatan Pendaftaran / Transfer */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-fd-foreground block">
                    {isPaidSelectedBatch ? 'Catatan Pengirim (Opsional)' : 'Catatan Pendaftaran (Opsional)'}
                  </label>
                  <Input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder={
                      isPaidSelectedBatch
                        ? 'Contoh: Transfer via BCA Mobile a.n Ahmad Dahlan'
                        : 'Contoh: Siap mengikuti kelas sesuai jadwal'
                    }
                    className="h-10 text-xs"
                  />
                </div>

                <DialogFooter className="pt-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBatch(null)}
                    disabled={isRegistering}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isRegistering}
                  >
                    {isRegistering && <Loader2 className="size-3.5 animate-spin" />}
                    <span>Kirim Pendaftaran</span>
                  </Button>
                </DialogFooter>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog: Unggah Ulang Bukti Pembayaran */}
      <Dialog
        open={Boolean(reuploadBatch)}
        onOpenChange={(open) => {
          if (!open && !isReuploading) setReuploadBatch(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogDescription className="text-xs font-medium text-fd-primary">
              {reuploadBatch?.courseTitle}
            </DialogDescription>
            <DialogTitle className="text-lg font-bold text-fd-foreground">
              Unggah Ulang Bukti: {reuploadBatch?.batchName}
            </DialogTitle>
          </DialogHeader>

          {reuploadBatch && (
            <form onSubmit={handleSubmitReupload} className="space-y-4">
              {reuploadBatch.rejectedReason && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="font-semibold">Alasan Penolakan Sebelumnya:</p>
                  <p className="mt-0.5">{reuploadBatch.rejectedReason}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fd-foreground block">
                  Pilih Bukti Pembayaran Baru
                </label>
                <FileDropzone
                  selectedFile={reuploadFile}
                  onFileSelect={setReuploadFile}
                  disabled={isReuploading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fd-foreground block">
                  Keterangan Tambahan
                </label>
                <Input
                  type="text"
                  value={reuploadNotes}
                  onChange={(e) => setReuploadNotes(e.target.value)}
                  placeholder="Contoh: Bukti slip transfer baru dengan nominal yang sesuai"
                  className="h-10 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReuploadBatch(null)}
                  disabled={isReuploading}
                  className="min-h-[40px] text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  disabled={isReuploading}
                  className="min-h-[40px] text-xs font-semibold gap-1.5"
                >
                  {isReuploading && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Kirim Bukti Baru</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Preview Bukti Pembayaran */}
      <Dialog
        open={Boolean(previewProofItem)}
        onOpenChange={(open) => {
          if (!open) setPreviewProofItem(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">
              Bukti Pembayaran: {previewProofItem?.batchName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Biaya:{' '}
              <span className="font-semibold text-fd-foreground font-mono">
                {previewProofItem ? formatRupiah(previewProofItem.batchPrice) : ''}
              </span>
            </DialogDescription>
          </DialogHeader>

          {previewProofItem && (
            <div className="space-y-3">
              <div className="w-full max-h-[58vh] overflow-auto rounded-xl border border-fd-border bg-fd-background p-3 flex items-center justify-center">
                {previewProofItem.paymentProofUrl?.toLowerCase().includes('.pdf') ? (
                  <div className="text-center p-8 space-y-3">
                    <FileText className="size-14 text-red-500 mx-auto" />
                    <p className="text-xs font-medium text-fd-foreground">Dokumen Bukti Transfer PDF</p>
                    <a
                      href={previewProofItem.paymentProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fd-primary text-fd-primary-foreground text-xs font-semibold hover:bg-fd-primary/90 transition"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Buka / Unduh File PDF di Tab Baru</span>
                    </a>
                  </div>
                ) : previewProofItem.paymentProofUrl ? (
                  <img
                    src={previewProofItem.paymentProofUrl}
                    alt="Bukti Transfer"
                    className="max-h-[52vh] w-auto object-contain rounded-lg"
                  />
                ) : (
                  <p className="text-xs text-fd-muted-foreground">Tidak ada berkas bukti transfer.</p>
                )}
              </div>

              {previewProofItem.notes && (
                <div className="rounded-lg bg-fd-muted/50 p-2.5 text-xs text-fd-muted-foreground border border-fd-border/50">
                  <span className="font-semibold text-fd-foreground">Catatan Anda: </span>
                  {previewProofItem.notes}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewProofItem(null)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
