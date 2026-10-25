'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getAuthToken, handleUnauthorizedRedirect } from '@/lib/auth';
import { useMounted } from '@/lib/use-mounted';
import {
  dashboardCache,
  loadAssignmentsCache,
  topProgress,
} from '@/lib/dashboard-navigation';
import { cn } from '@/lib/cn';
import {
  Check,
  Copy,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  BookOpen,
  FolderGit2,
  Globe,
  Upload,
  FileArchive,
  Layers,
  Send,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
import { toast } from 'sonner';

interface AssignmentItem {
  id: string;
  courseId: string;
  batchId?: string | null;
  batchName?: string | null;
  type: 'tugas' | 'quiz' | 'uts' | 'uas';
  courseTitle: string | null;
  courseSlug?: string | null;
  sessionId?: string | null;
  sessionNumber?: number | null;
  sessionTitle?: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  expiredAt: string;
  isExpired: boolean;
  isSubmitted: boolean;
  submission: {
    id: string;
    repoUrl?: string | null;
    demoUrl?: string | null;
    fileUrl?: string | null;
    notes?: string | null;
    submittedVia?: string | null;
    submittedAt: string;
    grade: string | null;
    feedback: string | null;
  } | null;
}

export default function AssignmentsDashboardPage() {
  const mounted = useMounted();
  const cached = dashboardCache.assignments as {
    assignments?: AssignmentItem[];
    isLinked?: boolean;
    discordUsername?: string | null;
    pairingCode?: string | null;
  } | null;

  const [assignments, setAssignments] = useState<AssignmentItem[]>(
    cached?.assignments || [],
  );
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'tugas' | 'quiz' | 'uts' | 'uas'>('all');
  const [isLoading, setIsLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State Discord Pairing
  const [isLinked, setIsLinked] = useState(cached?.isLinked || false);
  const [discordUsername, setDiscordUsername] = useState<string | null>(
    cached?.discordUsername || null,
  );
  const [pairingCode, setPairingCode] = useState<string | null>(
    cached?.pairingCode || null,
  );
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // State Modal Pengumpulan Tugas
  const [activeSubmitAssignment, setActiveSubmitAssignment] = useState<AssignmentItem | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchData = useCallback(async (isSilent = false) => {
    const token = getAuthToken();
    if (!token) {
      handleUnauthorizedRedirect();
      setIsLoading(false);
      return;
    }

    if (isSilent) {
      setIsRefreshing(true);
    }
    topProgress.start();
    setError(null);
    try {
      const data = await loadAssignmentsCache();
      if (data) {
        setAssignments((data.assignments as AssignmentItem[]) || []);
        setIsLinked(Boolean(data.isLinked));
        setDiscordUsername(data.discordUsername || null);
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kendala saat memuat data.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      topProgress.done();
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!dashboardCache.assignments) {
      fetchData();
    }
  }, [mounted, fetchData]);

  // Fungsi membuat kode pairing Discord baru
  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const res = await fetch(`${apiUrl}/v1/profile/discord/generate-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setPairingCode(json.data.code);
        toast.success('Kode tautan Discord baru berhasil dibuat!');
      }
    } catch {
      toast.error('Gagal membuat kode tautan.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Upload Berkas ZIP ke Backend
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran berkas melebihi batas maksimal 10MB.');
      return;
    }

    setIsUploadingFile(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiUrl}/v1/assignments/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal mengunggah berkas.');
      }

      setUploadedFileUrl(json.data.fileUrl);
      setUploadedFileName(file.name);
      toast.success('Berkas ZIP berhasil diunggah.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah berkas.';
      toast.error(msg);
    } finally {
      setIsUploadingFile(false);
    }
  }

  // Buka Modal Pengumpulan
  function openSubmitModal(item: AssignmentItem) {
    setActiveSubmitAssignment(item);
    setRepoUrl(item.submission?.repoUrl || '');
    setDemoUrl(item.submission?.demoUrl || '');
    setUploadedFileUrl(item.submission?.fileUrl || null);
    setUploadedFileName(item.submission?.fileUrl ? 'Berkas Terlampir' : null);
    setNotes(item.submission?.notes || '');
  }

  // Submit Penugasan
  async function handleSubmitAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSubmitAssignment) return;

    const cleanRepo = repoUrl.trim();
    const cleanFile = uploadedFileUrl?.trim();

    if (!cleanRepo && !cleanFile) {
      toast.error('Harap sertakan kode sumber proyek (Link GitHub atau Berkas ZIP).');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/assignments/${activeSubmitAssignment.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          repo_url: cleanRepo || undefined,
          demo_url: demoUrl.trim() || undefined,
          file_url: cleanFile || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal mengirim tugas.');
      }

      toast.success(json.message || 'Tugas berhasil dikumpulkan!');
      setActiveSubmitAssignment(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala sistem.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter list tugas sesuai kategori
  const filteredAssignments = assignments.filter((a) => {
    if (activeTypeFilter === 'all') return true;
    return a.type === activeTypeFilter;
  });

  if (!mounted || isLoading) {
    return null;
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Halaman */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-fd-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground">
            Tugas & Proyek Evaluasi
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Kumpulkan tugas proyek mingguan, kuis praktikum, UTS, dan UAS Capstone Anda.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={isLoading || isRefreshing}
          className="min-h-[40px] gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
          <span>Segarkan</span>
        </Button>
      </header>

      {/* Filter Tabs Kategori Tugas (Segmented Control Seragam) */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-fd-muted/60 p-1 border border-fd-border/60">
        {(
          [
            { key: 'all', label: `Semua (${assignments.length})` },
            { key: 'tugas', label: 'Tugas Harian (20%)' },
            { key: 'quiz', label: 'Quiz Praktikum (20%)' },
            { key: 'uts', label: 'UTS Proyek (30%)' },
            { key: 'uas', label: 'UAS Capstone (30%)' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTypeFilter(tab.key)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTypeFilter === tab.key
                ? 'bg-fd-card text-fd-foreground shadow-2xs border border-fd-border'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Daftar Tugas Siswa */}
      {error ? (
        <Card className="border-red-500/30 bg-red-500/5 p-6 text-center">
          <AlertCircle className="size-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm font-semibold text-fd-foreground">{error}</p>
        </Card>
      ) : filteredAssignments.length === 0 ? (
        <Empty className="py-12 border border-fd-border bg-fd-card shadow-2xs">
          <EmptyMedia variant="icon">
            <BookOpen className="size-4 text-fd-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-semibold">Belum Ada Penugasan Aktif</EmptyTitle>
            <EmptyDescription className="text-xs">
              {activeTypeFilter === 'all'
                ? 'Tidak ada tugas atau proyek evaluasi yang perlu dikerjakan saat ini.'
                : `Tidak ada tugas untuk kategori ${activeTypeFilter.toUpperCase()} saat ini.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {filteredAssignments.map((item) => {
            const isPassing = item.submission?.grade && parseFloat(item.submission.grade) >= 65;
            const expiredDate = new Date(item.expiredAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card key={item.id} className="border-fd-border bg-fd-card shadow-2xs">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Badge Kategori */}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold text-fd-foreground border-fd-border/70 bg-fd-muted/40"
                        >
                          {item.type === 'tugas'
                            ? 'Tugas (20%)'
                            : item.type === 'quiz'
                            ? 'Quiz (20%)'
                            : item.type === 'uts'
                            ? 'UTS Proyek (30%)'
                            : 'UAS Capstone (30%)'}
                        </Badge>

                        {item.batchName && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Layers className="size-3" />
                            <span>{item.batchName}</span>
                          </Badge>
                        )}

                        {item.isSubmitted ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                            Terkumpul
                          </Badge>
                        ) : item.isExpired ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Kedaluwarsa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                            Perlu Dikerjakan
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-fd-foreground">{item.title}</h3>
                      {item.description && (
                        <p className="text-xs text-fd-muted-foreground whitespace-pre-line leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-[11px] text-fd-muted-foreground">Tenggat Waktu:</p>
                      <p className="text-xs font-bold text-fd-foreground flex items-center gap-1 sm:justify-end">
                        <Clock className="size-3.5 text-fd-muted-foreground" />
                        <span>{expiredDate}</span>
                      </p>
                    </div>
                  </div>

                  {/* Jika Sudah Dikumpulkan: Tampilkan Ringkasan & Nilai */}
                  {item.submission && (
                    <div className="rounded-xl border border-fd-border bg-fd-background p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-fd-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                          <span className="text-xs font-semibold text-fd-foreground">
                            Tugas Telah Dikumpulkan ({item.submission.submittedVia === 'discord' ? 'via Discord' : 'via Web'})
                          </span>
                        </div>
                        {item.submission.grade ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-fd-muted-foreground">Nilai Mentor:</span>
                            <span className="font-mono text-base font-black text-fd-foreground bg-fd-muted px-2 py-0.5 rounded">
                              {item.submission.grade} / 100
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                            Menunggu Penilaian Mentor
                          </Badge>
                        )}
                      </div>

                      {/* Link Lampiran Siswa */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {item.submission.repoUrl && (
                          <a
                            href={item.submission.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-fd-card px-3 py-1.5 font-semibold text-fd-foreground hover:bg-fd-muted transition"
                          >
                            <FolderGit2 className="size-3.5 text-fd-primary" />
                            <span>Repositori GitHub</span>
                            <ExternalLink className="size-3 text-fd-muted-foreground" />
                          </a>
                        )}
                        {item.submission.demoUrl && (
                          <a
                            href={item.submission.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-fd-card px-3 py-1.5 font-semibold text-fd-foreground hover:bg-fd-muted transition"
                          >
                            <Globe className="size-3.5 text-blue-500" />
                            <span>Live Demo</span>
                            <ExternalLink className="size-3 text-fd-muted-foreground" />
                          </a>
                        )}
                        {item.submission.fileUrl && (
                          <a
                            href={item.submission.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-fd-card px-3 py-1.5 font-semibold text-fd-foreground hover:bg-fd-muted transition"
                          >
                            <FileArchive className="size-3.5 text-amber-500" />
                            <span>Unduh Berkas Proyek</span>
                            <ExternalLink className="size-3 text-fd-muted-foreground" />
                          </a>
                        )}
                      </div>

                      {/* Catatan Siswa */}
                      {item.submission.notes && (
                        <p className="text-[11px] text-fd-muted-foreground italic">
                          &quot;{item.submission.notes}&quot;
                        </p>
                      )}

                      {/* Feedback Evaluasi Mentor */}
                      {item.submission.feedback && (
                        <div className="rounded-lg bg-fd-muted/60 p-3 text-xs space-y-1">
                          <p className="font-semibold text-fd-foreground">Catatan Evaluasi Mentor:</p>
                          <p className="text-fd-muted-foreground leading-relaxed">{item.submission.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tombol Aksi Kumpulkan Tugas */}
                  {!item.isExpired && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => openSubmitModal(item)}
                        className="gap-2 min-h-[40px] text-xs font-semibold"
                      >
                        <Send className="size-3.5" />
                        <span>{item.isSubmitted ? 'Perbarui Pengumpulan' : 'Kumpulkan Tugas Sekarang'}</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Banner Omnichannel Discord (Fitur Pendukung) */}
      <Card className="border-fd-border bg-fd-card shadow-2xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-fd-primary/10 text-fd-primary flex items-center justify-center shrink-0">
                <MessageSquare className="size-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-fd-foreground">
                  Integrasi Bot Discord
                </p>
                <p className="text-xs text-fd-muted-foreground">
                  {isLinked ? (
                    <span>
                      Akun terhubung ke Discord:{' '}
                      <strong className="text-fd-foreground">@{discordUsername}</strong>. Anda dapat mengumpulkan tugas langsung via bot.
                    </span>
                  ) : (
                    <span>Tautkan akun Discord untuk notifikasi tenggat waktu dan pengumpulan tugas via bot.</span>
                  )}
                </p>
              </div>
            </div>

            {!isLinked && (
              <div className="flex items-center gap-2 shrink-0">
                {pairingCode ? (
                  <div className="flex items-center gap-2 rounded-lg border border-fd-border bg-fd-background px-3 py-1 font-mono text-xs font-bold">
                    <span>{pairingCode}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pairingCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        toast.success('Kode tautan disalin!');
                      }}
                      className="text-fd-muted-foreground hover:text-fd-foreground"
                    >
                      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    className="text-xs min-h-[36px] gap-1.5"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>{isGeneratingCode ? 'Membuat...' : 'Tautkan Discord'}</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================== */}
      {/* MODAL PENGUMPULAN TUGAS PROYEK                                  */}
      {/* ============================================================== */}
      <Dialog
        open={!!activeSubmitAssignment}
        onOpenChange={(open) => {
          if (!open) setActiveSubmitAssignment(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kumpulkan Penugasan Proyek</DialogTitle>
            <DialogDescription className="text-xs">
              {activeSubmitAssignment?.title} (Tenggat: {activeSubmitAssignment?.expiredAt ? new Date(activeSubmitAssignment.expiredAt).toLocaleDateString('id-ID') : '-'})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAssignment} className="space-y-4 pt-2">
            {/* Input Link GitHub */}
            <div className="space-y-1.5">
              <label htmlFor="repoUrlInput" className="text-xs font-semibold text-fd-foreground flex items-center justify-between">
                <span>Link Repositori GitHub</span>
                <span className="text-[11px] text-fd-muted-foreground">Wajib jika tanpa ZIP</span>
              </label>
              <div className="relative">
                <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fd-muted-foreground" />
                <Input
                  id="repoUrlInput"
                  placeholder="https://github.com/username/project-anda"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Input Live Demo URL */}
            <div className="space-y-1.5">
              <label htmlFor="demoUrlInput" className="text-xs font-semibold text-fd-foreground flex items-center justify-between">
                <span>Link Live Demo / Deployment</span>
                <span className="text-[11px] text-fd-muted-foreground">Opsional</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fd-muted-foreground" />
                <Input
                  id="demoUrlInput"
                  placeholder="https://proyek-anda.vercel.app"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Upload File ZIP */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fd-foreground flex items-center justify-between">
                <span>Unggah Berkas ZIP / Arsip</span>
                <span className="text-[11px] text-fd-muted-foreground">Maks 10MB</span>
              </label>
              <div className="rounded-xl border border-dashed border-fd-border p-4 text-center space-y-2 bg-fd-muted/20">
                {uploadedFileName ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-fd-background border border-fd-border text-xs">
                    <div className="flex items-center gap-2">
                      <FileArchive className="size-4 text-amber-500" />
                      <span className="font-semibold text-fd-foreground truncate max-w-[200px]">
                        {uploadedFileName}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Terunggah
                    </Badge>
                  </div>
                ) : (
                  <>
                    <Upload className="size-6 mx-auto text-fd-muted-foreground/60" />
                    <p className="text-xs text-fd-muted-foreground">
                      Pilih berkas arsip kode sumber (.zip, .rar, .tar.gz)
                    </p>
                  </>
                )}

                <input
                  type="file"
                  id="fileUploadInput"
                  accept=".zip,.rar,.tar.gz,.7z,.pdf"
                  onChange={handleFileUpload}
                  disabled={isUploadingFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingFile}
                  onClick={() => document.getElementById('fileUploadInput')?.click()}
                  className="text-xs min-h-[36px]"
                >
                  {isUploadingFile ? (
                    <>
                      <RefreshCw className="mr-2 size-3 animate-spin" />
                      Mengunggah...
                    </>
                  ) : uploadedFileName ? (
                    'Ganti Berkas ZIP'
                  ) : (
                    'Pilih Berkas ZIP'
                  )}
                </Button>
              </div>
            </div>

            {/* Catatan untuk Mentor */}
            <div className="space-y-1.5">
              <label htmlFor="notesInput" className="text-xs font-semibold text-fd-foreground">
                Catatan Tambahan untuk Mentor (Opsional)
              </label>
              <Textarea
                id="notesInput"
                placeholder="Tuliskan catatan teknis, instruksi menjalankan aplikasi, atau kendala yang dihadapi..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveSubmitAssignment(null)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isUploadingFile || (!repoUrl.trim() && !uploadedFileUrl)}
                className="text-xs font-semibold min-h-[38px] gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Mengirimkan...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    <span>Kirim Penugasan</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
