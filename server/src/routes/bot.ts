import { Elysia, t } from 'elysia';
import { db } from '../db';
import { assignments, assignmentSubmissions, profiles, user as userTable, discordPairingCodes } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';
import { attemptLimiter } from '../lib/rate-limit';
import { safeEqual } from '../lib/security';

const codeAttempts = attemptLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

export const botRoutes = new Elysia({ prefix: '/v1/bot' })
  // 1. Endpoint Tautan Akun Discord via Bot (/tautkan <kode>)
  .post(
    '/link-discord',
    async ({ headers, body, set }) => {
      if (!safeEqual(headers['x-bot-secret'], process.env.DISCORD_BOT_SECRET)) {
        set.status = 401;
        return {
          success: false,
          message: 'Autentikasi bot gagal. Header X-Bot-Secret tidak valid atau tidak disertakan.',
        };
      }

      const { code } = body;
      const discord_user_id = body.discordUserId || body.discord_user_id;
      const discord_username = body.discordUsername || body.discord_username;

      if (!discord_user_id || !discord_username) {
        set.status = 400;
        return {
          success: false,
          message: 'discordUserId dan discordUsername wajib diisi.',
        };
      }
      if (codeAttempts.isBlocked('link:' + discord_user_id)) {
        set.status = 429;
        return { success: false, message: 'Terlalu banyak percobaan kode. Coba lagi dalam beberapa menit.' };
      }
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
        codeAttempts.fail('link:' + discord_user_id);
        set.status = 400;
        return {
          success: false,
          message: 'Kode tautan tidak valid atau telah kedaluwarsa. Silakan buat kode baru di dashboard web.',
        };
      }

      // 2. Cek apakah discord_user_id sudah dipakai oleh akun siswa lain
      const [existingDiscord] = await db
        .select({
          id: userTable.id,
          fullName: profiles.fullName,
        })
        .from(userTable)
        .leftJoin(profiles, eq(userTable.id, profiles.id))
        .where(eq(userTable.discordId, discord_user_id))
        .limit(1);

      if (existingDiscord && existingDiscord.id !== pairing.userId) {
        set.status = 400;
        return {
          success: false,
          message: `Akun Discord ini sudah ditautkan ke siswa lain (${existingDiscord.fullName || existingDiscord.id}).`,
        };
      }

      // 3. Update profil siswa & hapus kode pairing dalam satu transaksi
      const updatedUser = await db.transaction(async (tx) => {
        const [userRow] = await tx
          .update(userTable)
          .set({
            discordId: discord_user_id,
            discordUsername: discord_username,
            updatedAt: new Date(),
          })
          .where(eq(userTable.id, pairing.userId))
          .returning();

        if (!userRow) return null;

        await tx
          .delete(discordPairingCodes)
          .where(eq(discordPairingCodes.id, pairing.id));

        return userRow;
      });

      if (!updatedUser) {
        set.status = 404;
        return {
          success: false,
          message: 'Profil siswa tidak ditemukan.',
        };
      }

      const [studentProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, pairing.userId))
        .limit(1);

      return {
        success: true,
        message: `Akun Discord @${discord_username} berhasil ditautkan ke akun ${studentProfile?.fullName || updatedUser.name}.`,
        data: {
          studentName: studentProfile?.fullName || updatedUser.name,
          email: updatedUser.email,
          discordUsername: discord_username,
        },
      };
    },
    {
      body: t.Object({
        code: t.String({ minLength: 3 }),
        discord_user_id: t.Optional(t.String()),
        discordUserId: t.Optional(t.String()),
        discord_username: t.Optional(t.String()),
        discordUsername: t.Optional(t.String()),
      }),
    }
  )

  // 2. Endpoint Pengumpulan Tugas via Bot Discord
  .post(
    '/submission',
    async ({ headers, body, set }) => {
      if (!safeEqual(headers['x-bot-secret'], process.env.DISCORD_BOT_SECRET)) {
        set.status = 401;
        return {
          success: false,
          message: 'Autentikasi bot gagal. Header X-Bot-Secret tidak valid atau tidak disertakan.',
        };
      }

      const discord_id = body.discordId || body.discord_id;
      const assignment_id = body.assignmentId || body.assignment_id;
      const file_url = body.fileUrl || body.file_url;
      const repo_url = body.repoUrl || body.repo_url;
      const demo_url = body.demoUrl || body.demo_url;
      const message_id = body.messageId || body.message_id;
      const channel_id = body.channelId || body.channel_id;
      const notes = body.notes;

      if (!discord_id || !assignment_id) {
        set.status = 400;
        return {
          success: false,
          message: 'discordId dan assignmentId wajib diisi.',
        };
      }

      // 1. Cari profil siswa berdasarkan discord_id
      const [student] = await db
        .select({
          id: userTable.id,
          fullName: profiles.fullName,
          role: userTable.role,
        })
        .from(userTable)
        .leftJoin(profiles, eq(userTable.id, profiles.id))
        .where(eq(userTable.discordId, discord_id))
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
            fileUrl: file_url || existingSubmission[0].fileUrl,
            repoUrl: repo_url || existingSubmission[0].repoUrl,
            demoUrl: demo_url || existingSubmission[0].demoUrl,
            notes: notes || existingSubmission[0].notes,
            submittedVia: 'discord',
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
            fileUrl: file_url || null,
            repoUrl: repo_url || null,
            demoUrl: demo_url || null,
            notes: notes || null,
            submittedVia: 'discord',
            discordMessageId: message_id || null,
            discordChannelId: channel_id || null,
            submittedAt: now,
          })
          .returning();
        result = inserted;
        set.status = 201;
      }

      return {
        success: true,
        message: `Tugas '${assignment.title}' berhasil dikumpulkan oleh ${student.fullName} via Discord.`,
        data: result,
      };
    },
    {
      body: t.Object({
        discord_id: t.Optional(t.String()),
        discordId: t.Optional(t.String()),
        assignment_id: t.Optional(t.String()),
        assignmentId: t.Optional(t.String()),
        file_url: t.Optional(t.String()),
        fileUrl: t.Optional(t.String()),
        repo_url: t.Optional(t.String()),
        repoUrl: t.Optional(t.String()),
        demo_url: t.Optional(t.String()),
        demoUrl: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        message_id: t.Optional(t.String()),
        messageId: t.Optional(t.String()),
        channel_id: t.Optional(t.String()),
        channelId: t.Optional(t.String()),
      }),
    }
  )

  // 3. Endpoint Presensi Mahasiswa via Bot Discord (/presensi <kode>)
  .post(
    '/attendance',
    async ({ headers, body, set }) => {
      if (!safeEqual(headers['x-bot-secret'], process.env.DISCORD_BOT_SECRET)) {
        set.status = 401;
        return {
          success: false,
          message: 'Autentikasi bot gagal. Header X-Bot-Secret tidak valid atau tidak disertakan.',
        };
      }

      const discord_id = body.discordId || body.discord_id;
      const { code } = body;

      if (!discord_id) {
        set.status = 400;
        return {
          success: false,
          message: 'discordId wajib diisi.',
        };
      }
      if (codeAttempts.isBlocked('att:' + discord_id)) {
        set.status = 429;
        return { success: false, message: 'Terlalu banyak percobaan kode. Coba lagi dalam beberapa menit.' };
      }
      const normalizedCode = code.trim().toUpperCase();
      const now = new Date();

      // 1. Cari profil siswa berdasarkan discord_id
      const [student] = await db
        .select({
          id: userTable.id,
          fullName: profiles.fullName,
          role: userTable.role,
        })
        .from(userTable)
        .leftJoin(profiles, eq(userTable.id, profiles.id))
        .where(eq(userTable.discordId, discord_id))
        .limit(1);

      if (!student) {
        set.status = 404;
        return {
          success: false,
          message: `Siswa dengan akun Discord ini belum menautkan akun di platform Belajar Koding.`,
        };
      }

      // 2. Cari sesi presensi aktif
      const { attendanceSessions, attendanceLogs, batchEnrollments } = await import('../db/schema');
      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.tokenCode, normalizedCode),
            gt(attendanceSessions.expiresAt, now)
          )
        )
        .limit(1);

      if (!session) {
        codeAttempts.fail('att:' + discord_id);
        set.status = 400;
        return {
          success: false,
          message: 'Kode presensi tidak valid atau waktu presensi telah berakhir.',
        };
      }

      // 3. Pastikan siswa terdaftar di batch tersebut
      const [enrollment] = await db
        .select()
        .from(batchEnrollments)
        .where(
          and(
            eq(batchEnrollments.batchId, session.batchId),
            eq(batchEnrollments.studentId, student.id)
          )
        )
        .limit(1);

      if (!enrollment && student.role === 'student') {
        set.status = 403;
        return {
          success: false,
          message: 'Anda tidak terdaftar sebagai siswa di kelas batch ini.',
        };
      }

      // 4. Cek apakah sudah presensi
      const [existingLog] = await db
        .select()
        .from(attendanceLogs)
        .where(
          and(
            eq(attendanceLogs.attendanceSessionId, session.id),
            eq(attendanceLogs.studentId, student.id)
          )
        )
        .limit(1);

      if (existingLog) {
        return {
          success: true,
          message: `Halo ${student.fullName}, Anda sudah tercatat hadir untuk Pertemuan ${session.sessionNumber} sebelumnya.`,
        };
      }

      // 5. Catat log presensi
      await db
        .insert(attendanceLogs)
        .values({
          id: uuidv7(),
          attendanceSessionId: session.id,
          studentId: student.id,
          channel: 'discord',
        })
        .onConflictDoNothing();

      return {
        success: true,
        message: `✅ Presensi Pertemuan ${session.sessionNumber} berhasil dicatat atas nama ${student.fullName}!`,
        data: {
          studentName: student.fullName,
          sessionNumber: session.sessionNumber,
          channel: 'discord',
        },
      };
    },
    {
      body: t.Object({
        discord_id: t.Optional(t.String()),
        discordId: t.Optional(t.String()),
        code: t.String({ minLength: 3 }),
      }),
    }
  );
