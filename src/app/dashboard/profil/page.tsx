'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchCurrentUser,
  uploadAvatarViaBackend,
  updateUserPassword,
  resendVerificationEmail,
  getAuthToken,
  type AuthUser,
} from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/components/ui/avatar';
import { AvatarCropperDialog } from '@/components/avatar-cropper-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Check,
  Camera,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

const LANGUAGES = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
];

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = 'belajarkoding_email_resend_cooldown';

export default function AccountSettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Profile Picture Upload & Cropper State
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedImageForCrop, setSelectedImageForCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Information State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('id');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Email verification resend state
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Initial loaded values to detect changes
  const [initialProfile, setInitialProfile] = useState<{
    name: string;
    email: string;
    language: string;
  } | null>(null);

  // Update Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Restore cooldown from localStorage
  useEffect(() => {
    try {
      const storedTime = localStorage.getItem(STORAGE_KEY);
      if (storedTime) {
        const remaining = Math.max(
          0,
          Math.ceil((parseInt(storedTime, 10) - Date.now()) / 1000)
        );
        if (remaining > 0) {
          setCooldown(remaining);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {}
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const refreshUser = async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);

    if (currentUser) {
      const currentName = currentUser.fullName || '';
      const currentAvatar = currentUser.avatarUrl || null;
      const currentEmail = currentUser.email || '';
      let currentLanguage = 'id';

      if (typeof window !== 'undefined') {
        const savedLanguage = localStorage.getItem('belajarkoding_pref_language');
        if (savedLanguage) currentLanguage = savedLanguage;
      }

      setName(currentName);
      setEmail(currentEmail);
      setLanguage(currentLanguage);
      setAvatarUrl(currentAvatar);

      setInitialProfile({
        name: currentName,
        email: currentEmail,
        language: currentLanguage,
      });
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const getInitials = (displayName: string) => {
    if (!displayName) return 'U';
    return displayName
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Pilih file gambar yang valid (JPG, PNG, WebP, atau GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file gambar terlalu besar (maksimal 10MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageForCrop(reader.result?.toString() || null);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCroppedSave = async (croppedFile: File) => {
    if (!user) return;

    setIsUploadingAvatar(true);
    try {
      const { avatarUrl: newAvatarUrl } = await uploadAvatarViaBackend(croppedFile);
      setAvatarUrl(newAvatarUrl);
      await refreshUser();
      toast.success('Foto profil berhasil diperbarui.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah foto profil.';
      toast.error(msg);
      throw err;
    } finally {
      setIsUploadingAvatar(false);
      setSelectedImageForCrop(null);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || isDeletingAvatar) return;

    setIsDeletingAvatar(true);
    try {
      const token = getAuthToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const res = await fetch(`${apiUrl}/v1/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ avatarUrl: null }),
      });

      if (!res.ok) {
        throw new Error('Gagal menghapus avatar di server.');
      }

      setAvatarUrl(null);
      await refreshUser();
      toast.success('Foto profil berhasil dihapus.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus foto profil.';
      toast.error(msg);
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const handleResendVerification = async () => {
    if (isSendingVerification || cooldown > 0 || !email) return;
    setIsSendingVerification(true);
    try {
      await resendVerificationEmail();

      toast.success('Email verifikasi telah dikirim.', {
        description: `Silakan periksa kotak masuk atau folder spam di ${email}.`,
      });
      const targetTime = Date.now() + COOLDOWN_SECONDS * 1000;
      try {
        localStorage.setItem(STORAGE_KEY, targetTime.toString());
      } catch {}
      setCooldown(COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim email verifikasi.';
      toast.error(msg);
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setProfileError('Nama tidak boleh kosong.');
      return;
    }

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setProfileError('Nama harus memiliki panjang antara 2 hingga 50 karakter.');
      return;
    }

    setIsSavingProfile(true);
    setProfileSuccess(false);

    try {
      const token = getAuthToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const res = await fetch(`${apiUrl}/v1/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fullName: trimmedName }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memperbarui profil.');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('belajarkoding_pref_language', language);
      }

      setInitialProfile({
        name: trimmedName,
        email,
        language,
      });

      await refreshUser();
      setProfileSuccess(true);
      toast.success('Informasi profil berhasil disimpan.');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui profil.';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!newPassword) {
      setPasswordError('Kata sandi baru wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Kata sandi baru minimal harus 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await updateUserPassword(newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Kata sandi berhasil diperbarui.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const hasProfileChanges = initialProfile
    ? name.trim() !== initialProfile.name.trim() ||
      language !== initialProfile.language
    : false;

  const isSaveDisabled =
    isSavingProfile ||
    !hasProfileChanges ||
    !name.trim();

  const isEmailVerified = Boolean(user?.emailConfirmedAt);

  return (
    <div className="space-y-10 w-full max-w-2xl mx-auto py-2">
      {/* Profile Photo Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-fd-foreground">
            Foto Profil
          </h2>
          <p className="text-xs text-fd-muted-foreground">
            Foto ini akan ditampilkan pada profil dan akun Belajar Koding Anda.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl border border-fd-border/70 bg-fd-card/40">
          {/* Avatar dengan loading overlay */}
          <div className="relative group shrink-0">
            <Avatar className="size-20 border-2 border-fd-border shadow-xs">
              <AvatarImage
                src={avatarUrl || undefined}
                alt={name || user?.email || 'Foto profil'}
                className="object-cover"
              />
              <AvatarFallback className="text-xl font-bold bg-fd-primary/10 text-fd-primary">
                {getInitials(name || user?.email || 'U')}
              </AvatarFallback>
            </Avatar>

            {/* Spinner overlay saat upload/delete */}
            {(isUploadingAvatar || isDeletingAvatar) && (
              <div className="absolute inset-0 rounded-full bg-fd-background/80 backdrop-blur-xs flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-fd-primary" />
              </div>
            )}
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarFileChange}
                className="hidden"
                id="avatar-upload-input"
                disabled={isUploadingAvatar || isDeletingAvatar}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar || isDeletingAvatar}
                className="min-h-[44px] text-xs font-semibold gap-1.5 cursor-pointer"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5 text-fd-muted-foreground" />
                )}
                <span>{avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
              </Button>

              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar || isDeletingAvatar}
                  className="min-h-[44px] text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 gap-1.5 cursor-pointer"
                >
                  {isDeletingAvatar ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  <span>Hapus</span>
                </Button>
              )}
            </div>

            <p className="text-[11px] text-fd-muted-foreground">
              Format JPG, PNG, WebP, atau GIF. Ukuran maksimal 10MB.
            </p>
          </div>
        </div>
      </section>

      <div className="border-t border-fd-border/40" />

      {/* Profile Information Section */}
      <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-fd-foreground">
            Informasi Profil
          </h2>
          <p className="text-xs text-fd-muted-foreground">
            Perbarui nama lengkap dan setelan akun Anda
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {profileError && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 border border-red-500/20">
              {profileError}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fd-foreground">
              Nama Lengkap
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (profileError) setProfileError(null);
              }}
              placeholder="Nama lengkap Anda"
              className="h-10 text-sm"
              maxLength={50}
              disabled={isSavingProfile}
            />
          </div>

          {/* Email address */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fd-foreground">
              Alamat Email
            </label>
            <Input
              type="email"
              value={email}
              readOnly
              disabled
              placeholder="nama@email.com"
              className="h-10 text-sm bg-fd-muted/40 cursor-not-allowed opacity-80"
              maxLength={100}
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fd-foreground">
              Bahasa
            </label>
            <Select value={language} onValueChange={(val) => val && setLanguage(val)}>
              <SelectTrigger className="w-full h-10 text-sm">
                <SelectValue placeholder="Pilih bahasa">
                  {LANGUAGES.find((l) => l.value === language)?.label || 'Pilih bahasa'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value} className="text-sm">
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unverified email notice */}
          {!isEmailVerified && (
            <div className="text-xs text-fd-muted-foreground pt-1">
              Alamat email Anda belum terverifikasi.{' '}
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSendingVerification || cooldown > 0}
                className="font-medium text-fd-foreground underline hover:text-fd-primary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSendingVerification
                  ? 'Mengirim...'
                  : cooldown > 0
                  ? `Kirim ulang dalam ${cooldown} detik`
                  : 'Klik di sini untuk mengirim ulang email verifikasi.'}
              </button>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              variant="default"
              disabled={isSaveDisabled}
              className="min-h-[44px] px-5 font-semibold text-xs cursor-pointer bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:opacity-60 transition"
            >
              {isSavingProfile && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              {profileSuccess && (
                <Check className="mr-1.5 size-3.5 text-emerald-400" />
              )}
              <span>Save</span>
            </Button>
          </div>
        </form>
      </section>

      <div className="border-t border-fd-border/40" />

      {/* Update Password Section */}
      <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-fd-foreground">
            Perbarui Kata Sandi
          </h2>
          <p className="text-xs text-fd-muted-foreground">
            Pastikan akun Anda menggunakan kata sandi yang aman dan tidak mudah ditebak.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {passwordError && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 border border-red-500/20">
              {passwordError}
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fd-foreground">
              Kata Sandi Saat Ini
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="••••••••"
              className="h-10 text-sm"
              disabled={isUpdatingPassword}
            />
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fd-foreground">
              Kata Sandi Baru
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="••••••••"
              className="h-10 text-sm"
              disabled={isUpdatingPassword}
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fd-foreground">
              Konfirmasi Kata Sandi Baru
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="••••••••"
              className="h-10 text-sm"
              disabled={isUpdatingPassword}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="default"
              disabled={
                isUpdatingPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="min-h-[44px] px-5 font-semibold text-xs cursor-pointer bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:opacity-60 transition"
            >
              {isUpdatingPassword && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              <span>Save</span>
            </Button>
          </div>
        </form>
      </section>

      {/* Avatar Cropper Dialog */}
      <AvatarCropperDialog
        open={isCropperOpen}
        onOpenChange={setIsCropperOpen}
        imageSrc={selectedImageForCrop}
        onCropSave={handleCroppedSave}
      />
    </div>
  );
}
