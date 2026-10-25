'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Mail,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken, fetchCurrentUser, type AuthUser } from '@/lib/auth';
import { topProgress } from '@/lib/dashboard-navigation';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

type UserRole = 'student' | 'mentor' | 'admin';

interface UserListItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  discordUsername?: string | null;
  createdAt: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'student', label: 'Siswa' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminPenggunaPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    topProgress.start();
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Sesi autentikasi telah berakhir.');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [me, res] = await Promise.all([
        fetchCurrentUser(),
        fetch(`${apiUrl}/v1/profile/users`, { headers }),
      ]);

      if (me) {
        setCurrentUser(me);
      }

      const json = await res.json();

      if (res.ok && json.success) {
        const mapped: UserListItem[] = (json.data || []).map((u: any) => ({
          id: u.id,
          fullName: u.fullName || 'Pengguna Tanpa Nama',
          email: u.email,
          role: (u.role as UserRole) || 'student',
          avatarUrl: u.avatarUrl || null,
          discordUsername: u.discordUsername || null,
          createdAt: u.createdAt || new Date().toISOString(),
        }));
        setUsers(mapped);
      } else {
        throw new Error(json.message || 'Gagal memuat daftar pengguna.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memuat data.';
      setError(msg);
    } finally {
      setIsLoading(false);
      topProgress.done();
    }
  }, [apiUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRoleChange(targetUser: UserListItem, newRole: UserRole) {
    if (targetUser.role === newRole) return;

    if (currentUser && targetUser.id === currentUser.id && newRole !== 'admin') {
      toast.error('Anda tidak dapat menurunkan peran akun Administrator Anda sendiri.');
      return;
    }

    setUpdatingUserId(targetUser.id);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/v1/profile/users/${targetUser.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memperbarui peran pengguna.');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
      toast.success(json.message || 'Peran pengguna berhasil diperbarui.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah peran pengguna.';
      toast.error(msg);
    } finally {
      setUpdatingUserId(null);
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const studentCount = users.filter((u) => u.role === 'student').length;
  const mentorCount = users.filter((u) => u.role === 'mentor').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  if (isLoading && users.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Kelola Pengguna Sistem
          </h1>
          <p className="text-sm text-fd-muted-foreground">
            Direktori akun pengguna terdaftar dan pengaturan hak akses peran: Siswa, Mentor, dan Administrator.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
          >
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
            <span>Segarkan</span>
          </Button>
        </div>
      </header>

      {/* Ringkasan Jumlah Pengguna */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-fd-muted-foreground">Total Siswa</p>
            <p className="text-2xl font-bold text-fd-foreground font-mono tabular-nums">
              {isLoading ? '...' : studentCount}
            </p>
            <p className="text-xs text-fd-muted-foreground">Peserta kelas &amp; program belajar</p>
          </div>
          <div className="size-10 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="size-5" />
          </div>
        </div>

        <div className="rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-fd-muted-foreground">Mentor Pengajar</p>
            <p className="text-2xl font-bold text-fd-foreground font-mono tabular-nums">
              {isLoading ? '...' : mentorCount}
            </p>
            <p className="text-xs text-fd-muted-foreground">Pengampu kurikulum &amp; evaluasi</p>
          </div>
          <div className="size-10 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <UserCheck className="size-5" />
          </div>
        </div>

        <div className="rounded-xl border border-fd-border bg-fd-card p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-fd-muted-foreground">Administrator Sistem</p>
            <p className="text-2xl font-bold text-fd-foreground font-mono tabular-nums">
              {isLoading ? '...' : adminCount}
            </p>
            <p className="text-xs text-fd-muted-foreground">Hak akses penuh pengelolaan sistem</p>
          </div>
          <div className="size-10 rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <ShieldCheck className="size-5" />
          </div>
        </div>
      </div>

      {/* Filter & Pencarian */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fd-muted-foreground" />
          <Input
            placeholder="Cari nama pengguna atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-xs"
          />
        </div>

        <ButtonGroup className="self-start sm:self-auto">
          {(['all', 'student', 'mentor', 'admin'] as const).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={filterRole === r ? 'default' : 'outline'}
              onClick={() => setFilterRole(r)}
            >
              {r === 'all' ? 'Semua Role' : r === 'student' ? 'Siswa' : r === 'mentor' ? 'Mentor' : 'Admin'}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Tabel Pengguna */}
      <Card className="border-fd-border bg-fd-card shadow-2xs">
        <CardHeader className="p-5 pb-3 border-b border-fd-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="size-4 text-fd-primary" />
            Daftar Pengguna ({filteredUsers.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Pilih peran pada kolom kanan untuk mengubah hak akses akun secara langsung.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-xs text-fd-muted-foreground">
              Tidak ada pengguna yang cocok dengan kriteria pencarian.
            </div>
          ) : (
            <div className="divide-y divide-fd-border">
              {filteredUsers.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isUpdating = updatingUserId === u.id;

                return (
                  <div
                    key={u.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-fd-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-fd-muted flex items-center justify-center font-bold text-xs text-fd-foreground shrink-0 border border-fd-border">
                        {u.fullName ? u.fullName.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-fd-foreground">{u.fullName}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-medium',
                              u.role === 'admin'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                                : u.role === 'mentor'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            )}
                          >
                            {u.role === 'student' ? 'Siswa' : u.role === 'mentor' ? 'Mentor' : 'Admin'}
                          </Badge>
                          {isSelf && (
                            <Badge variant="outline" className="text-[10px] font-mono text-fd-muted-foreground">
                              Anda
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-fd-muted-foreground flex items-center gap-1.5">
                          <Mail className="size-3" />
                          <span>{u.email}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-fd-muted-foreground">
                      {u.createdAt && (
                        <span className="hidden md:inline font-mono text-[11px]">
                          Terdaftar: {new Date(u.createdAt).toLocaleDateString('id-ID')}
                        </span>
                      )}

                      <div className="inline-flex items-center gap-1 rounded-lg border border-fd-border bg-fd-muted/30 p-1">
                        {ROLE_OPTIONS.map((opt) => {
                          const isActive = u.role === opt.value;
                          const isDisabled = isUpdating || (isSelf && opt.value !== 'admin');

                          const activeColorClass =
                            opt.value === 'admin'
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
                              : opt.value === 'mentor'
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleRoleChange(u, opt.value)}
                              title={
                                isSelf && opt.value !== 'admin'
                                  ? 'Akun Anda sendiri tidak dapat diturunkan dari Admin'
                                  : `Ubah peran menjadi ${opt.label}`
                              }
                              className={cn(
                                'h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all border',
                                isActive
                                  ? cn('shadow-2xs', activeColorClass)
                                  : 'border-transparent text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted/50',
                                isDisabled && !isActive && 'opacity-40 cursor-not-allowed'
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

