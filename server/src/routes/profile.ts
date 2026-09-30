import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import { profiles, discordPairingCodes } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';

function generatePairingCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'KF-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
        updateData.avatarUrl = body.avatarUrl ? body.avatarUrl.trim() : null;
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
      .update(profiles)
      .set({
        discordId: null,
        discordUsername: null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id))
      .returning();

    return {
      success: true,
      message: 'Tautan akun Discord berhasil diputuskan.',
      data: updated,
    };
  })
  // 4. Fallback link langsung (untuk backward compatibility)
  .post(
    '/link-discord',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
      }

      const { discord_id, discord_username } = body;

      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.discordId, discord_id))
        .limit(1);

      if (existing && existing.id !== user.id) {
        set.status = 400;
        return {
          success: false,
          message: 'Akun Discord ini sudah ditautkan ke profil siswa lain.',
        };
      }

      const [updated] = await db
        .update(profiles)
        .set({
          discordId: discord_id,
          discordUsername: discord_username || null,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, user.id))
        .returning();

      return {
        success: true,
        message: 'Akun Discord berhasil ditautkan ke profil Anda.',
        data: updated,
      };
    },
    {
      body: t.Object({
        discord_id: t.String({ minLength: 1 }),
        discord_username: t.Optional(t.String()),
      }),
    }
  );
