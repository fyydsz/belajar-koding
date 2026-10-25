'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Users,
  Search,
  Filter,
  Eye,
  Loader2,
  FileText,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, buttonVariants } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface PendingEnrollmentItem {
  id: string;
  batchId: string;
  batchName: string;
  batchPrice: string;
  paymentAccountInfo: string | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatarUrl: string | null;
  studentDiscord: string | null;
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

function formatDate(isoStr: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
}

export default function DosenBatchVerificationPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [enrollments, setEnrollments] = useState<PendingEnrollmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Preview Modal State
  const [previewItem, setPreviewItem] = useState<PendingEnrollmentItem | null>(null);

  // Reject Modal State
  const [rejectingItem, setRejectingItem] = useState<PendingEnrollmentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingAction, startTransition] = useTransition();

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

  // Load enrollments by active tab
  const loadEnrollments = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setIsLoading(true);
      topProgress.start();
      const res = await fetch(`${apiUrl}/v1/batches/pending-enrollments?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setEnrollments(json.data || []);
      } else {
        toast.error(json.message || 'Gagal memuat data pendaftaran.');
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi saat memuat pendaftaran.');
    } finally {
      setIsLoading(false);
      topProgress.done();
    }
  }, [apiUrl, activeTab]);

  useEffect(() => {
    if (isAuthorized) {
      loadEnrollments();
    }
  }, [isAuthorized, loadEnrollments]);

  // Handle Approve
  const handleApprove = async (enrollmentId: string) => {
    const token = getAuthToken();
    if (!token) return;

    startTransition(async () => {
      try {
        const res = await fetch(`${apiUrl}/v1/batches/enrollments/${enrollmentId}/approve`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (res.ok && json.success) {
          toast.success('Pendaftaran siswa berhasil disetujui! Akses kelas aktif.');
          if (previewItem?.id === enrollmentId) {
            setPreviewItem(null);
          }
          await loadEnrollments();
        } else {
          toast.error(json.message || 'Gagal menyetujui pendaftaran.');
        }
      } catch {
        toast.error('Terjadi kesalahan saat menyetujui pendaftaran.');
      }
    });
  };

  // Handle Reject
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    const token = getAuthToken();
    if (!token) return;

    if (!rejectReason.trim()) {
      toast.error('Harap isi alasan penolakan pembayaran.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${apiUrl}/v1/batches/enrollments/${rejectingItem.id}/reject`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: rejectReason.trim() }),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          toast.success('Pendaftaran telah ditolak.');
          setRejectingItem(null);
          setRejectReason('');
          if (previewItem?.id === rejectingItem.id) {
            setPreviewItem(null);
          }
          await loadEnrollments();
        } else {
          toast.error(json.message || 'Gagal menolak pendaftaran.');
        }
      } catch {
        toast.error('Terjadi kesalahan saat memproses penolakan.');
      }
    });
  };

  // Filtered by search
  const filteredEnrollments = enrollments.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.studentName.toLowerCase().includes(q) ||
      item.studentEmail.toLowerCase().includes(q) ||
      item.batchName.toLowerCase().includes(q) ||
      item.courseTitle.toLowerCase().includes(q)
    );
  });

  if (isAuthLoading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-fd-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="size-10 text-red-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-fd-foreground">Akses Terbatas</h1>
        <p className="text-sm text-fd-muted-foreground mt-1 mb-5">
          Halaman verifikasi pendaftaran batch khusus diperuntukkan bagi Mentor dan Administrator.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2 text-xs font-semibold text-fd-primary-foreground transition hover:opacity-90"
        >
          <ArrowLeft className="size-4" />
          <span>Kembali ke Beranda</span>
        </Link>
      </div>
    );
  }

  if (isLoading && enrollments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Verifikasi Pendaftaran Batch
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Tinjau bukti pembayaran transfer siswa dan aktifkan akses kelas belajar.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadEnrollments}
          disabled={isLoading}
          className="self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          <span>Segarkan</span>
        </Button>
      </header>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <ButtonGroup className="self-start">
          {(
            [
              { id: 'pending', label: 'Menunggu Persetujuan' },
              { id: 'active', label: 'Disetujui' },
              { id: 'rejected', label: 'Ditolak' },
              { id: 'all', label: 'Semua' },
            ] as const
          ).map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={activeTab === tab.id ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </ButtonGroup>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-fd-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari siswa, batch, atau kelas..."
            className="pl-9 h-10 text-xs"
          />
        </div>
      </div>

      {/* Table / Cards List */}
      {filteredEnrollments.length === 0 ? (
        <div className="rounded-xl border border-fd-border bg-fd-card p-12 text-center text-xs text-fd-muted-foreground space-y-2 shadow-2xs">
          <ClipboardCheck className="size-8 text-fd-muted-foreground mx-auto opacity-40" />
          <p className="font-semibold text-sm text-fd-foreground">
            Tidak Ada Pendaftaran Siswa pada Kategori Ini
          </p>
          <p>Semua pendaftaran telah diproses atau belum ada siswa yang mendaftar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEnrollments.map((item) => {
            const isPdf = item.paymentProofUrl?.toLowerCase().includes('.pdf');

            return (
              <div
                key={item.id}
                className="rounded-xl border border-fd-border bg-fd-card p-4 sm:p-5 shadow-2xs hover:border-fd-primary/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Student & Batch Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-fd-primary bg-fd-primary/10 px-2.5 py-0.5 rounded-md">
                      {item.courseTitle}
                    </span>
                    <span className="text-[11px] font-bold text-fd-foreground">
                      Batch: {item.batchName}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono tabular-nums">
                      {formatRupiah(item.batchPrice)}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        item.status === 'active' && 'bg-emerald-500/10 text-emerald-600',
                        item.status === 'pending' && 'bg-amber-500/10 text-amber-600',
                        item.status === 'rejected' && 'bg-red-500/10 text-red-600'
                      )}
                    >
                      {item.status === 'active' && 'Disetujui'}
                      {item.status === 'pending' && 'Menunggu Verifikasi'}
                      {item.status === 'rejected' && 'Ditolak'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-fd-muted overflow-hidden flex items-center justify-center shrink-0 border border-fd-border">
                      {item.studentAvatarUrl ? (
                        <img
                          src={item.studentAvatarUrl}
                          alt={item.studentName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="size-4 text-fd-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-fd-foreground">{item.studentName}</h3>
                      <p className="text-[11px] text-fd-muted-foreground">
                        {item.studentEmail} &middot; Mendaftar pada: {formatDate(item.enrolledAt)}
                      </p>
                    </div>
                  </div>

                  {item.notes && (
                    <div className="text-xs text-fd-muted-foreground bg-fd-muted/30 px-3 py-1.5 rounded-lg inline-block border border-fd-border/40">
                      <span className="font-semibold text-fd-foreground">Catatan Siswa:</span>{' '}
                      {item.notes}
                    </div>
                  )}

                  {item.status === 'rejected' && item.rejectedReason && (
                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 px-3 py-1.5 rounded-lg border border-red-500/20">
                      <span className="font-semibold">Alasan Penolakan:</span> {item.rejectedReason}
                    </div>
                  )}
                </div>

                {/* Right: Proof Preview & Actions */}
                <div className="shrink-0 flex items-center flex-wrap gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-fd-border/50">
                  {!item.paymentProofUrl && (
                    <span className="text-[11px] text-fd-muted-foreground px-2 py-1 italic">
                      Tanpa bukti berkas
                    </span>
                  )}

                  <ButtonGroup>
                    {item.paymentProofUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewItem(item)}
                      >
                        {isPdf ? (
                          <FileText className="size-3.5 text-red-500" />
                        ) : (
                          <Eye className="size-3.5 text-fd-primary" />
                        )}
                        <span>Lihat Bukti</span>
                      </Button>
                    )}

                    {item.status === 'pending' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSubmittingAction}
                          onClick={() => handleApprove(item.id)}
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Setujui</span>
                        </Button>

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isSubmittingAction}
                          onClick={() => {
                            setRejectingItem(item);
                            setRejectReason('');
                          }}
                        >
                          <XCircle className="size-3.5" />
                          <span>Tolak</span>
                        </Button>
                      </>
                    )}

                    {item.status === 'rejected' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSubmittingAction}
                        onClick={() => handleApprove(item.id)}
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Ubah ke Setujui</span>
                      </Button>
                    )}
                  </ButtonGroup>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog: Preview Bukti Pembayaran */}
      <Dialog
        open={!!previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">
              Bukti Pembayaran: {previewItem?.batchName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewItem?.studentName} ({previewItem?.studentEmail}) &middot; Biaya:{' '}
              <span className="font-semibold text-fd-foreground font-mono">
                {previewItem ? formatRupiah(previewItem.batchPrice) : ''}
              </span>
            </DialogDescription>
          </DialogHeader>

          {previewItem && (
            <div className="w-full max-h-[58vh] overflow-auto rounded-xl border border-fd-border bg-fd-background p-3 flex items-center justify-center">
              {previewItem.paymentProofUrl?.toLowerCase().includes('.pdf') ? (
                <div className="text-center p-8 space-y-3">
                  <FileText className="size-14 text-red-500 mx-auto" />
                  <p className="text-xs font-medium text-fd-foreground">Dokumen Bukti Transfer PDF</p>
                  <a
                    href={previewItem.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fd-primary text-fd-primary-foreground text-xs font-semibold hover:bg-fd-primary/90 transition"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Buka / Unduh File PDF di Tab Baru</span>
                  </a>
                </div>
              ) : previewItem.paymentProofUrl ? (
                <img
                  src={previewItem.paymentProofUrl}
                  alt="Bukti Transfer"
                  className="max-h-[52vh] w-auto object-contain rounded-lg"
                />
              ) : (
                <p className="text-xs text-fd-muted-foreground">Tidak ada berkas bukti transfer.</p>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <ButtonGroup>
              {previewItem?.status === 'pending' && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSubmittingAction}
                    onClick={() => handleApprove(previewItem.id)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Setujui Pembayaran</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isSubmittingAction}
                    onClick={() => {
                      setRejectingItem(previewItem);
                      setRejectReason('');
                    }}
                  >
                    <XCircle className="size-3.5" />
                    <span>Tolak</span>
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewItem(null)}
              >
                Tutup
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Tolak Pendaftaran Siswa */}
      <Dialog
        open={!!rejectingItem}
        onOpenChange={(open) => {
          if (!open) setRejectingItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Tolak Pendaftaran Siswa
            </DialogTitle>
            <DialogDescription className="text-xs">
              {rejectingItem?.studentName} &middot; {rejectingItem?.batchName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmReject} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="rejectReasonInput" className="text-xs font-semibold text-fd-foreground block">
                Alasan Penolakan:
              </label>
              <Textarea
                id="rejectReasonInput"
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Nominal transfer kurang Rp 50.000 / Gambar bukti transfer buram tidak terbaca."
                className="text-xs resize-y"
              />
              <p className="text-[11px] text-fd-muted-foreground">
                Alasan ini akan ditampilkan kepada siswa agar mereka dapat mengunggah bukti yang benar.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectingItem(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={isSubmittingAction || !rejectReason.trim()}
                >
                  {isSubmittingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Konfirmasi Tolak</span>
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
