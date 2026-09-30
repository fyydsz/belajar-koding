'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Check,
  Copy,
  RefreshCw,
  Unlink,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface AssignmentItem {
  id: string;
  courseId: string;
  courseTitle: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  expiredAt: string;
  isExpired: boolean;
  isSubmitted: boolean;
  submission: {
    id: string;
    fileUrl: string;
    submittedAt: string;
    grade: string | null;
    feedback: string | null;
  } | null;
}

export default function AssignmentsDashboardPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [isLinked, setIsLinked] = useState(false);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Sesi login telah berakhir. Silakan masuk kembali.');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // 1. Ambil status penautan Discord & kode pairing aktif
      const resDiscord = await fetch(`${apiUrl}/v1/profile/discord/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const jsonDiscord = await resDiscord.json();
      if (resDiscord.ok && jsonDiscord.success) {
        setIsLinked(jsonDiscord.data.isLinked);
        setDiscordUsername(jsonDiscord.data.discordUsername || null);
        if (jsonDiscord.data.activeCode) {
          setPairingCode(jsonDiscord.data.activeCode);
          setPairingExpiresAt(jsonDiscord.data.expiresAt);
        }
      }

      // 2. Ambil data assignments
      const resAssign = await fetch(`${apiUrl}/v1/assignments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const jsonAssign = await resAssign.json();
      if (resAssign.ok && jsonAssign.success) {
        setAssignments(jsonAssign.data || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kendala saat memuat data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fungsi membuat kode pairing baru
  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    setNotice(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setNotice({ type: 'error', message: 'Sesi login telah berakhir.' });
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/v1/profile/discord/generate-code`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal membuat kode tautan.');
      }

      setPairingCode(json.data.code);
      setPairingExpiresAt(json.data.expiresAt);
      setNotice({ type: 'success', message: 'Kode tautan baru berhasil dibuat!' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kendala.';
      setNotice({ type: 'error', message });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Fungsi memutuskan tautan Discord
  const handleUnlinkDiscord = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan tautan akun Discord ini?')) return;

    setIsUnlinking(true);
    setNotice(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setNotice({ type: 'error', message: 'Sesi login telah berakhir.' });
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/v1/profile/unlink-discord`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memutuskan tautan.');
      }

      setIsLinked(false);
      setDiscordUsername(null);
      setPairingCode(null);
      setNotice({ type: 'success', message: 'Tautan akun Discord berhasil diputuskan.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kendala.';
      setNotice({ type: 'error', message });
    } finally {
      setIsUnlinking(false);
    }
  };

  // Salin kode ke clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Tugas & Pengumpulan Discord
          </h1>
          <p className="text-xs text-fd-muted-foreground sm:text-sm">
            Daftar tugas kelas dan integrasi pengumpulan file otomatis via bot Discord.
          </p>
        </div>
        <div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-fd-border bg-fd-card px-4 py-2 text-xs font-semibold text-fd-foreground shadow-2xs transition hover:bg-fd-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            Lihat Beranda Nilai
          </Link>
        </div>
      </div>

      {/* Notifikasi feedback */}
      {notice && (
        <div
          role="status"
          className={`rounded-xl p-3.5 text-xs font-medium ${
            notice.type === 'success'
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* Bagian Penautan Akun Discord (Compact) */}
      <div className="rounded-2xl border border-fd-border bg-fd-card p-4 sm:p-5 shadow-2xs">
        {isLinked ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-mono text-fd-foreground">
                    @{discordUsername || 'Pengguna Discord'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    <span>Terhubung</span>
                  </span>
                </div>
                <p className="text-xs text-fd-muted-foreground">
                  Akun Discord tertaut. Pengumpulan file tugas otomatis tersinkronisasi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUnlinkDiscord}
              disabled={isUnlinking}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:opacity-50"
            >
              <Unlink className="size-3.5" />
              <span>{isUnlinking ? 'Memutuskan...' : 'Putuskan'}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fd-muted text-fd-muted-foreground">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fd-foreground">
                    Kode Tautan Discord
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="size-3" />
                    <span>Belum Tertaut</span>
                  </span>
                </div>
                <p className="text-xs text-fd-muted-foreground">
                  {pairingCode
                    ? 'Masukkan kode ini ke bot Discord kelas. Berlaku 15 menit.'
                    : 'Buat kode singkat untuk menghubungkan akun Discord Anda.'}
                </p>
              </div>
            </div>

            {pairingCode ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-fd-border bg-fd-background px-3 py-1.5">
                  <span className="font-mono text-sm font-bold tracking-wider text-fd-foreground">
                    {pairingCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(pairingCode)}
                    aria-label="Salin kode tautan"
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-fd-muted px-2 py-1 text-xs font-medium text-fd-muted-foreground transition hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={isGeneratingCode}
                  aria-label="Buat kode baru"
                  title="Buat kode baru"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-fd-border bg-fd-background text-fd-muted-foreground transition hover:bg-fd-muted hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${isGeneratingCode ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateCode}
                disabled={isGeneratingCode}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-fd-primary px-4 py-2 text-xs font-semibold text-fd-primary-foreground shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:opacity-50"
              >
                <Sparkles className="size-3.5" />
                <span>{isGeneratingCode ? 'Membuat...' : 'Buat Kode'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* State: Loading Assignments */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-28 w-full animate-pulse rounded-2xl bg-fd-card border border-fd-border" />
          <div className="h-28 w-full animate-pulse rounded-2xl bg-fd-card border border-fd-border" />
        </div>
      )}

      {/* State: Error */}
      {!isLoading && error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm"
        >
          <AlertCircle className="mx-auto size-6 text-red-600 dark:text-red-400" />
          <p className="mt-2 font-semibold text-red-600 dark:text-red-400">{error}</p>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Pastikan server backend Elysia telah berjalan pada port 3001.
          </p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 justify-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
          >
            <RefreshCw className="size-3.5" />
            <span>Coba Muat Ulang</span>
          </button>
        </div>
      )}

      {/* State: Empty Assignments */}
      {!isLoading && !error && assignments.length === 0 && (
        <div className="rounded-2xl border border-fd-border bg-fd-card p-10 text-center shadow-2xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-fd-muted text-fd-muted-foreground">
            📋
          </div>
          <h3 className="mt-4 text-base font-semibold text-fd-foreground">Belum Ada Tugas Aktif</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-fd-muted-foreground">
            Mentor belum membuat tugas untuk kurikulum kelas ini. Tugas baru akan muncul di sini.
          </p>
        </div>
      )}

      {/* State: Daftar Tugas */}
      {!isLoading && !error && assignments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-fd-foreground">Daftar Tugas Kelas</h2>
          <div className="grid grid-cols-1 gap-4">
            {assignments.map((item) => {
              const expiredDate = new Date(item.expiredAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-fd-border bg-fd-card p-5 shadow-2xs transition hover:border-fd-border/80"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-fd-primary/10 px-2 py-0.5 text-[10px] font-semibold text-fd-primary">
                          {item.courseTitle || 'Materi Umum'}
                        </span>
                        {item.isSubmitted && (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Terkumpul
                          </span>
                        )}
                        {item.isExpired && !item.isSubmitted && (
                          <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                            Kedaluwarsa
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-base font-bold text-fd-foreground">{item.title}</h3>
                      {item.description && (
                        <p className="mt-1 text-xs text-fd-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-3 text-[11px] text-fd-muted-foreground">
                        Tenggat Waktu: <span className="font-semibold text-fd-foreground">{expiredDate}</span>
                      </p>
                    </div>

                    <div className="mt-3 sm:mt-0 sm:text-right">
                      <span className="text-[10px] font-mono text-fd-muted-foreground block">
                        ID: {item.id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>

                  {/* Info Pengumpulan File */}
                  {item.submission && (
                    <div className="mt-4 rounded-xl border border-fd-border bg-fd-background/50 p-3.5 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="size-4" />
                          <span>Tugas Berhasil Terkirim</span>
                        </p>
                        {item.submission.grade && (
                          <span className="font-bold text-fd-foreground">
                            Nilai: {item.submission.grade}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-fd-muted-foreground">
                        Terkumpul pada:{' '}
                        {new Date(item.submission.submittedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <div className="mt-2">
                        <a
                          href={item.submission.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-fd-primary hover:underline"
                        >
                          <span>Buka File Lampiran</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                      {item.submission.feedback && (
                        <p className="mt-2 rounded bg-fd-muted p-2 text-[11px] text-fd-foreground">
                          Catatan Mentor: {item.submission.feedback}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
