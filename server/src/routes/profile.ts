import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import { profiles, user as userTable, discordPairingCodes } from '../db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';
import { supabaseAdmin } from '../lib/supabase';
import { randomCode, sniffFile } from '../lib/security';

function generatePairingCode(): string {
  return 'KF-' + randomCode('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 4);
}

export const profileRoutes = new Elysia({ prefix: '/v1/profile' })
  .use(authPlugin)
  .get('/me', ({ user, profile, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        profile,
      },
    };
  })
  // Pembaruan data profil siswa (nama lengkap & foto avatar)
  .patch(
    '/',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
      }

      const updateData: { fullName?: string; avatarUrl?: string | null; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (body.fullName !== undefined) {
        const trimmed = body.fullName.trim();
        if (trimmed.length < 2 || trimmed.length > 50) {
          set.status = 400;
          return { success: false, message: 'Nama harus memiliki panjang antara 2 hingga 50 karakter.' };
        }
        updateData.fullName = trimmed;
      }

      if (body.avatarUrl !== undefined) {
        const rawUrl = body.avatarUrl ? body.avatarUrl.trim() : null;
        if (rawUrl) {
          let parsedUrl: URL | null = null;
          try {
            parsedUrl = new URL(rawUrl);
          } catch {
            parsedUrl = null;
          }
          const storageHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
          if (!parsedUrl || parsedUrl.protocol !== 'https:' || !storageHost || parsedUrl.host !== storageHost) {
            set.status = 400;
            return { success: false, message: 'URL avatar harus berasal dari penyimpanan aplikasi.' };
          }
        }
        updateData.avatarUrl = rawUrl;
      }

      const [updated] = await db
        .update(profiles)
        .set(updateData)
        .where(eq(profiles.id, user.id))
        .returning();

      return {
        success: true,
        message: 'Profil berhasil diperbarui.',
        data: updated,
      };
    },
    {
      body: t.Object({
        fullName: t.Optional(t.String()),
        avatarUrl: t.Optional(t.Nullable(t.String())),
      }),
    }
  )
  .post(
    '/avatar',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const file = body.file;
      if (!file) {
        set.status = 400;
        return { success: false, message: 'File gambar wajib disertakan.' };
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const detected = sniffFile(buffer, ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
      if (!detected) {
        set.status = 400;
        return { success: false, message: 'Format gambar tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.' };
      }
      const filePath = `${user.id}/avatar-${Date.now()}.${detected.ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('avatars')
        .upload(filePath, buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: detected.mime,
        });

      if (uploadError) {
        set.status = 500;
        return {
          success: false,
          message: `Gagal mengunggah foto profil: ${uploadError.message}`,
        };
      }

      const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = urlData.publicUrl;

      const [updated] = await db
        .update(profiles)
        .set({
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, user.id))
        .returning();

      return {
        success: true,
        message: 'Foto profil berhasil diperbarui.',
        data: {
          avatarUrl,
          profile: updated,
        },
      };
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: 5 * 1024 * 1024,
        }),
      }),
    }
  )
  // 1. Dapatkan status penautan Discord & kode aktif jika ada
  .get('/discord/status', async ({ user, profile, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    const now = new Date();
    // Cari kode pairing aktif milik user yang belum kedaluwarsa
    const [activePairing] = await db
      .select()
      .from(discordPairingCodes)
      .where(
        and(
          eq(discordPairingCodes.userId, user.id),
          gt(discordPairingCodes.expiresAt, now)
        )
      )
      .limit(1);

    return {
      success: true,
      data: {
        isLinked: Boolean(profile.discordId),
        discordId: profile.discordId,
        discordUsername: profile.discordUsername,
        activeCode: activePairing ? activePairing.code : null,
        expiresAt: activePairing ? activePairing.expiresAt.toISOString() : null,
      },
    };
  })
  // 2. Generate kode pairing baru (Opsi 2)
  .post('/discord/generate-code', async ({ user, profile, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    // Hapus kode pairing lama milik user ini
    await db
      .delete(discordPairingCodes)
      .where(eq(discordPairingCodes.userId, user.id));

    // Buat kode baru dengan masa berlaku 15 menit
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const [newPairing] = await db
      .insert(discordPairingCodes)
      .values({
        id: uuidv7(),
        userId: user.id,
        code,
        expiresAt,
      })
      .returning();

    return {
      success: true,
      message: 'Kode tautan Discord berhasil dibuat.',
      data: {
        code: newPairing.code,
        expiresAt: newPairing.expiresAt.toISOString(),
      },
    };
  })
  // 3. Putuskan tautan Discord
  .post('/unlink-discord', async ({ user, profile, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    const [updated] = await db
      .update(userTable)
      .set({
        discordId: null,
        discordUsername: null,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, user.id))
      .returning();

    return {
      success: true,
      message: 'Tautan akun Discord berhasil diputuskan.',
      data: updated,
    };
  })
  // 5. (Admin) Ambil semua daftar pengguna sistem beserta role-nya
  .get('/users', async ({ user, profile, set }) => {
    if (!user || !profile || profile.role !== 'admin') {
      set.status = 403;
      return { success: false, message: 'Hanya Administrator yang dapat mengelola pengguna.' };
    }

    const allUsers = await db
      .select({
        id: userTable.id,
        fullName: profiles.fullName,
        email: userTable.email,
        role: userTable.role,
        avatarUrl: profiles.avatarUrl,
        discordId: userTable.discordId,
        discordUsername: userTable.discordUsername,
        nim: profiles.nim,
        phoneNumber: profiles.phoneNumber,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
      })
      .from(userTable)
      .leftJoin(profiles, eq(userTable.id, profiles.id))
      .orderBy(desc(userTable.createdAt));

    return {
      success: true,
      data: allUsers,
    };
  })
  // 6. (Admin) Ubah role pengguna (student | mentor | admin)
  .patch(
    '/users/:userId/role',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya Administrator yang dapat mengubah peran pengguna.' };
      }

      const targetUserId = params.userId;
      const newRole = body.role;

      if (targetUserId === user.id && newRole !== 'admin') {
        set.status = 400;
        return {
          success: false,
          message: 'Anda tidak dapat menurunkan peran akun Administrator Anda sendiri.',
        };
      }

      const [targetUser] = await db
        .select({
          id: userTable.id,
          fullName: profiles.fullName,
        })
        .from(userTable)
        .leftJoin(profiles, eq(userTable.id, profiles.id))
        .where(eq(userTable.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        set.status = 404;
        return { success: false, message: 'Pengguna tidak ditemukan.' };
      }

      const [updatedUser] = await db
        .update(userTable)
        .set({
          role: newRole,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, targetUserId))
        .returning();

      return {
        success: true,
        message: `Peran ${targetUser.fullName || targetUser.id} berhasil diperbarui menjadi ${
          newRole === 'admin' ? 'Admin' : newRole === 'mentor' ? 'Mentor' : 'Siswa'
        }.`,
        data: updatedUser,
      };
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      body: t.Object({
        role: t.Union([t.Literal('student'), t.Literal('mentor'), t.Literal('admin')]),
      }),
    }
  );

