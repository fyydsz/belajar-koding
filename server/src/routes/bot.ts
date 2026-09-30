import { Elysia, t } from 'elysia';
import { db } from '../db';
import { assignments, assignmentSubmissions, profiles, discordPairingCodes } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';

export const botRoutes = new Elysia({ prefix: '/v1/bot' })
  // 1. Endpoint Tautan Akun Discord via Bot (/tautkan <kode>)
  .post(
    '/link-discord',
    async ({ headers, body, set }) => {
      const secret = headers['x-bot-secret'];
      const expectedSecret = process.env.DISCORD_BOT_SECRET;

      if (!expectedSecret || secret !== expectedSecret) {
        set.status = 401;
        return {
          success: false,
          message: 'Autentikasi bot gagal. Header X-Bot-Secret tidak valid atau tidak disertakan.',
        };
      }

      const { code, discord_user_id, discord_username } = body;
      const normalizedCode = code.trim().toUpperCase();
      const now = new Date();

      // 1. Cari kode pairing yang valid dan belum kedaluwarsa
      const [pairing] = await db
        .select()
        .from(discordPairingCodes)
        .where(
          and(
            eq(discordPairingCodes.code, normalizedCode),
            gt(discordPairingCodes.expiresAt, now)
          )
        )
        .limit(1);

      if (!pairing) {
        set.status = 400;
        return {
          success: false,
          message: 'Kode tautan tidak valid atau telah kedaluwarsa. Silakan buat kode baru di dashboard web.',
        };
      }

      // 2. Cek apakah discord_user_id sudah dipakai oleh akun siswa lain
      const [existingDiscord] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.discordId, discord_user_id))
        .limit(1);

      if (existingDiscord && existingDiscord.id !== pairing.userId) {
        set.status = 400;
        return {
          success: false,
          message: `Akun Discord ini sudah ditautkan ke siswa lain (${existingDiscord.fullName}).`,
        };
      }

      // 3. Update profil siswa
      const [updatedStudent] = await db
        .update(profiles)
        .set({
          discordId: discord_user_id,
          discordUsername: discord_username,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, pairing.userId))
        .returning();

      if (!updatedStudent) {
        set.status = 404;
        return {
          success: false,
          message: 'Profil siswa tidak ditemukan.',
        };
      }

      // 4. Hapus kode pairing yang sudah digunakan
      await db
        .delete(discordPairingCodes)
        .where(eq(discordPairingCodes.id, pairing.id));

      return {
        success: true,
        message: `Akun Discord @${discord_username} berhasil ditautkan ke akun ${updatedStudent.fullName}.`,
        data: {
          studentName: updatedStudent.fullName,
          email: updatedStudent.email,
          discordUsername: discord_username,
        },
      };
    },
    {
      body: t.Object({
        code: t.String({ minLength: 3 }),
        discord_user_id: t.String({ minLength: 1 }),
        discord_username: t.String({ minLength: 1 }),
      }),
    }
  )

  // 2. Endpoint Pengumpulan Tugas via Bot Discord
  .post(
    '/submission',
    async ({ headers, body, set }) => {
      const secret = headers['x-bot-secret'];
      const expectedSecret = process.env.DISCORD_BOT_SECRET;

      if (!expectedSecret || secret !== expectedSecret) {
        set.status = 401;
        return {
          success: false,
          message: 'Autentikasi bot gagal. Header X-Bot-Secret tidak valid atau tidak disertakan.',
        };
      }

      const { discord_id, assignment_id, file_url, message_id, channel_id } = body;

      // 1. Cari profil siswa berdasarkan discord_id
      const [student] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.discordId, discord_id))
        .limit(1);

      if (!student) {
        set.status = 404;
        return {
          success: false,
          message: `Siswa dengan Discord ID ${discord_id} belum menautkan akun Discord di profil web Belajar Koding.`,
        };
      }

      // 2. Cari assignment dan validasi tenggat waktu
      const [assignment] = await db
        .select()
        .from(assignments)
        .where(eq(assignments.id, assignment_id))
        .limit(1);

      if (!assignment) {
        set.status = 404;
        return {
          success: false,
          message: 'Tugas (assignment) tidak ditemukan.',
        };
      }

      const now = new Date();
      if (assignment.expiredAt < now) {
        set.status = 400;
        return {
          success: false,
          message: `Tenggat waktu pengumpulan tugas '${assignment.title}' telah berakhir pada ${assignment.expiredAt.toISOString()}.`,
        };
      }

      // 3. Simpan atau perbarui data pengumpulan tugas
      const existingSubmission = await db
        .select()
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignment.id),
            eq(assignmentSubmissions.studentId, student.id)
          )
        )
        .limit(1);

      let result;
      if (existingSubmission.length > 0) {
        const [updated] = await db
          .update(assignmentSubmissions)
          .set({
            fileUrl: file_url,
            discordMessageId: message_id || null,
            discordChannelId: channel_id || null,
            submittedAt: now,
          })
          .where(eq(assignmentSubmissions.id, existingSubmission[0].id))
          .returning();
        result = updated;
      } else {
        const [inserted] = await db
          .insert(assignmentSubmissions)
          .values({
            id: uuidv7(),
            assignmentId: assignment.id,
            studentId: student.id,
            fileUrl: file_url,
            discordMessageId: message_id || null,
            discordChannelId: channel_id || null,
            submittedAt: now,
          })
          .returning();
        result = inserted;
      }

      return {
        success: true,
        message: `Tugas '${assignment.title}' berhasil dikumpulkan oleh ${student.fullName}.`,
        data: result,
      };
    },
    {
      body: t.Object({
        discord_id: t.String({ minLength: 1 }),
        assignment_id: t.String({ minLength: 1 }),
        file_url: t.String({ minLength: 1 }),
        message_id: t.Optional(t.String()),
        channel_id: t.Optional(t.String()),
      }),
    }
  );
