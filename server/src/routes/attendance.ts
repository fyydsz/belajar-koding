import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import {
  attendanceSessions,
  attendanceLogs,
  batchEnrollments,
  batches,
  profiles,
  user as userTable,
} from '../db/schema';
import { eq, and, gt, desc, asc, inArray } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';
import { supabaseAdmin } from '../lib/supabase';
import { canAccessBatch, isStaff } from '../lib/access';
import { attemptLimiter } from '../lib/rate-limit';
import { randomCode, sniffFile } from '../lib/security';

// Helper pembuat kode token presensi unik (misal: "KDG-7382")
function generateAttendanceCode(): string {
  return `KDG-${randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4)}`;
}

// Batasi tebak-tebakan kode presensi per user.
const submitAttempts = attemptLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

export const attendanceRoutes = new Elysia({ prefix: '/v1/attendance' })
  .use(authPlugin)

  // 1. (Mentor/Admin) Buka Sesi Presensi Baru dengan Kode Token & Batas Waktu
  .post(
    '/open',
    async ({ user, profile, body, set }) => {
      if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
        set.status = 403;
        return { success: false, message: 'Hanya Mentor atau Admin yang dapat membuka sesi presensi.' };
      }

      const { batchId, sessionNumber, durationMinutes } = body;
      if (!(await canAccessBatch(profile, batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }
      const now = new Date();

      // Cek apakah sudah ada sesi untuk pertemuan ini di batch ini
      const [existingSession] = await db
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.batchId, batchId),
            eq(attendanceSessions.sessionNumber, sessionNumber)
          )
        )
        .orderBy(desc(attendanceSessions.createdAt))
        .limit(1);

      if (existingSession && new Date(existingSession.expiresAt) > now) {
        return {
          success: true,
          message: `Sesi presensi pertemuan ${sessionNumber} sedang berlangsung.`,
          data: {
            sessionId: existingSession.id,
            tokenCode: existingSession.tokenCode,
            sessionNumber: existingSession.sessionNumber,
            expiresAt: existingSession.expiresAt,
          },
        };
      }

      const duration = durationMinutes || 30; // default 30 menit
      const expiresAt = new Date(Date.now() + duration * 60 * 1000);
      const tokenCode = generateAttendanceCode();

      let targetSession = existingSession;
      if (existingSession) {
        const [updated] = await db
          .update(attendanceSessions)
          .set({
            tokenCode,
            expiresAt,
            openedBy: profile.id,
          })
          .where(eq(attendanceSessions.id, existingSession.id))
          .returning();
        targetSession = updated;
      } else {
        const [newSession] = await db
          .insert(attendanceSessions)
          .values({
            id: uuidv7(),
            batchId,
            sessionNumber,
            tokenCode,
            expiresAt,
            openedBy: profile.id,
          })
          .returning();
        targetSession = newSession;
      }

      return {
        success: true,
        message: `Sesi presensi pertemuan ${sessionNumber} dibuka. Berlaku selama ${duration} menit.`,
        data: {
          sessionId: targetSession.id,
          tokenCode: targetSession.tokenCode,
          sessionNumber: targetSession.sessionNumber,
          expiresAt: targetSession.expiresAt,
        },
      };
    },
    {
      body: t.Object({
        batchId: t.String(),
        sessionNumber: t.Integer({ minimum: 1, maximum: 32 }),
        durationMinutes: t.Optional(t.Integer({ minimum: 5, maximum: 180 })),
      }),
    }
  )

  // 2. (Siswa) Input Kode Presensi via Web
  .post(
    '/submit',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (submitAttempts.isBlocked(profile.id)) {
        set.status = 429;
        return { success: false, message: 'Terlalu banyak percobaan kode. Coba lagi dalam beberapa menit.' };
      }

      const normalizedCode = body.code.trim().toUpperCase();
      const now = new Date();

      // Cari sesi presensi yang kodenya cocok dan belum expired
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
        submitAttempts.fail(profile.id);
        set.status = 400;
        return {
          success: false,
          message: 'Kode presensi tidak valid atau waktu presensi telah berakhir.',
        };
      }

      // Pastikan siswa terdaftar di batch tersebut
      const [enrollment] = await db
        .select()
        .from(batchEnrollments)
        .where(
          and(
            eq(batchEnrollments.batchId, session.batchId),
            eq(batchEnrollments.studentId, profile.id)
          )
        )
        .limit(1);

      if (!enrollment && profile.role === 'student') {
        set.status = 403;
        return {
          success: false,
          message: 'Anda tidak terdaftar sebagai siswa di kelas ini.',
        };
      }

      // Cek apakah siswa sudah presensi di sesi ini sebelumnya
      const [existingLog] = await db
        .select()
        .from(attendanceLogs)
        .where(
          and(
            eq(attendanceLogs.attendanceSessionId, session.id),
            eq(attendanceLogs.studentId, profile.id)
          )
        )
        .limit(1);

      if (existingLog) {
        return {
          success: true,
          message: 'Anda sudah tercatat hadir untuk pertemuan ini sebelumnya.',
          data: {
            sessionNumber: session.sessionNumber,
            checkedInAt: existingLog.checkedInAt,
          },
        };
      }

      // Simpan log presensi (idempotent terhadap race condition)
      const [log] = await db
        .insert(attendanceLogs)
        .values({
          id: uuidv7(),
          attendanceSessionId: session.id,
          studentId: profile.id,
          channel: 'web',
        })
        .onConflictDoNothing()
        .returning();

      return {
        success: true,
        message: `Presensi Pertemuan ${session.sessionNumber} berhasil! Kehadiran Anda telah dicatat.`,
        data: {
          sessionNumber: session.sessionNumber,
          checkedInAt: log?.checkedInAt ?? new Date(),
        },
      };
    },
    {
      body: t.Object({
        code: t.String({ minLength: 3 }),
      }),
    }
  )

  // 2b. (Siswa) Upload Surat Izin / Keterangan Sakit (PNG/JPG/PDF maks 5MB)
  .post(
    '/upload-proof',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const file = body.file as File;
      if (!file || !(file instanceof Blob)) {
        set.status = 400;
        return { success: false, message: 'Berkas surat izin/sakit tidak ditemukan.' };
      }

      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        set.status = 400;
        return { success: false, message: 'Ukuran file melebihi batas maksimal 5MB.' };
      }

      const buffer = await file.arrayBuffer();
      const detected = sniffFile(new Uint8Array(buffer), [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
      ]);
      if (!detected) {
        set.status = 400;
        return {
          success: false,
          message: 'Format berkas tidak didukung. Harap unggah file foto (JPG, PNG) atau dokumen PDF.',
        };
      }

      const ext = detected.ext;
      const uniqueFileName = `permits/${user.id}/${Date.now()}-${uuidv7().slice(0, 8)}.${ext}`;

      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(uniqueFileName, buffer, {
          contentType: detected.mime,
          upsert: false,
        });

      if (error) {
        set.status = 500;
        return { success: false, message: `Gagal mengunggah berkas: ${error.message}` };
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('submissions')
        .getPublicUrl(data.path);

      return {
        success: true,
        message: 'Surat keterangan berhasil diunggah.',
        data: {
          url: publicUrlData.publicUrl,
        },
      };
    },
    {
      body: t.Object({
        file: t.Any(),
      }),
    }
  )

  // 2c. (Siswa) Ajukan Izin / Sakit untuk Sesi Pertemuan
  .post(
    '/permit',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const { batchId, sessionNumber, status, note, attachmentUrl } = body;
      if (status !== 'permission' && status !== 'sick') {
        set.status = 400;
        return { success: false, message: "Status pengajuan harus 'permission' (izin) atau 'sick' (sakit)." };
      }

      // Pastikan siswa terdaftar aktif di batch ini
      const [enrollment] = await db
        .select()
        .from(batchEnrollments)
        .where(
          and(
            eq(batchEnrollments.batchId, batchId),
            eq(batchEnrollments.studentId, profile.id)
          )
        )
        .limit(1);

      if (!enrollment && profile.role === 'student') {
        set.status = 403;
        return { success: false, message: 'Anda tidak terdaftar sebagai siswa di batch kelas ini.' };
      }

      // Ambil session di attendanceSessions untuk pertemuan ini
      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.batchId, batchId),
            eq(attendanceSessions.sessionNumber, sessionNumber)
          )
        )
        .orderBy(desc(attendanceSessions.createdAt))
        .limit(1);

      if (!session) {
        set.status = 400;
        return {
          success: false,
          message: `Pertemuan ${sessionNumber} belum memiliki sesi presensi yang dibuat oleh mentor.`,
        };
      }

      // Cek apakah sudah ada log kehadiran/izin siswa di sesi ini
      const [existingLog] = await db
        .select()
        .from(attendanceLogs)
        .where(
          and(
            eq(attendanceLogs.attendanceSessionId, session.id),
            eq(attendanceLogs.studentId, profile.id)
          )
        )
        .limit(1);

      let log;
      if (existingLog) {
        const [updated] = await db
          .update(attendanceLogs)
          .set({
            status,
            note: note || null,
            attachmentUrl: attachmentUrl || existingLog.attachmentUrl,
            checkedInAt: new Date(),
          })
          .where(eq(attendanceLogs.id, existingLog.id))
          .returning();
        log = updated;
      } else {
        const [inserted] = await db
          .insert(attendanceLogs)
          .values({
            id: uuidv7(),
            attendanceSessionId: session.id,
            studentId: profile.id,
            channel: 'web',
            status,
            note: note || null,
            attachmentUrl: attachmentUrl || null,
          })
          .returning();
        log = inserted;
      }

      const statusLabel = status === 'sick' ? 'Sakit' : 'Izin';
      return {
        success: true,
        message: `Keterangan ${statusLabel} untuk Pertemuan ${sessionNumber} berhasil dicatat.`,
        data: {
          sessionNumber,
          status: log.status,
          checkedInAt: log.checkedInAt,
        },
      };
    },
    {
      body: t.Object({
        batchId: t.String(),
        sessionNumber: t.Integer({ minimum: 1, maximum: 32 }),
        status: t.String(),
        note: t.Optional(t.String()),
        attachmentUrl: t.Optional(t.String()),
      }),
    }
  )

  // 3. Cek sesi presensi yang sedang aktif untuk sebuah batch
  .get(
    '/active/:batchId',
    async ({ user, profile, params, query, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (!profile || !(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda tidak memiliki akses ke batch ini.' };
      }

      const now = new Date();
      const sessionNumberParam = query?.sessionNumber ? parseInt(query.sessionNumber, 10) : null;

      const whereConditions = [
        eq(attendanceSessions.batchId, params.batchId),
        gt(attendanceSessions.expiresAt, now),
      ];

      if (sessionNumberParam && !Number.isNaN(sessionNumberParam)) {
        whereConditions.push(eq(attendanceSessions.sessionNumber, sessionNumberParam));
      }

      const [activeSession] = await db
        .select()
        .from(attendanceSessions)
        .where(and(...whereConditions))
        .orderBy(desc(attendanceSessions.createdAt))
        .limit(1);

      if (!activeSession) {
        return {
          success: true,
          data: null,
        };
      }

      const logs = await db
        .select({
          id: attendanceLogs.id,
          studentId: profiles.id,
          studentName: profiles.fullName,
          email: userTable.email,
          avatarUrl: profiles.avatarUrl,
          discordUsername: userTable.discordUsername,
          checkedInAt: attendanceLogs.checkedInAt,
          channel: attendanceLogs.channel,
        })
        .from(attendanceLogs)
        .innerJoin(profiles, eq(attendanceLogs.studentId, profiles.id))
        .leftJoin(userTable, eq(attendanceLogs.studentId, userTable.id))
        .where(eq(attendanceLogs.attendanceSessionId, activeSession.id))
        .orderBy(desc(attendanceLogs.checkedInAt));

      // Kode token hanya boleh dilihat mentor/admin; siswa wajib mendapat kodenya dari pengajar.
      const { tokenCode: _tokenCode, ...sessionWithoutToken } = activeSession;
      const sessionView = isStaff(profile.role) ? activeSession : sessionWithoutToken;

      return {
        success: true,
        data: {
          ...sessionView,
          attendeesCount: logs.length,
          attendees: isStaff(profile.role) ? logs : [],
        },
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
      query: t.Optional(
        t.Object({
          sessionNumber: t.Optional(t.String()),
        })
      ),
    }
  )

  // 3b. Tutup sesi presensi lebih awal
  .post(
    '/close/:sessionId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const now = new Date();
      const [target] = await db
        .select({ batchId: attendanceSessions.batchId })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, params.sessionId))
        .limit(1);

      if (!target) {
        set.status = 404;
        return { success: false, message: 'Sesi presensi tidak ditemukan.' };
      }
      if (!(await canAccessBatch(profile, target.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      await db
        .update(attendanceSessions)
        .set({ expiresAt: now })
        .where(eq(attendanceSessions.id, params.sessionId));

      return {
        success: true,
        message: 'Sesi presensi telah ditutup.',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
    }
  )

  // 3c. Riwayat kehadiran spesifik siswa di batch tertentu (dijamin 1 per pertemuan)
  .get(
    '/student-history/:batchId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (!(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda tidak memiliki akses ke batch ini.' };
      }

      const sessions = await db
        .select({
          id: attendanceSessions.id,
          sessionNumber: attendanceSessions.sessionNumber,
          tokenCode: attendanceSessions.tokenCode,
          createdAt: attendanceSessions.createdAt,
          expiresAt: attendanceSessions.expiresAt,
        })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.batchId, params.batchId))
        .orderBy(asc(attendanceSessions.sessionNumber), desc(attendanceSessions.createdAt));

      if (sessions.length === 0) {
        return { success: true, data: [] };
      }

      const sessionIds = sessions.map((s) => s.id);
      const myLogs = await db
        .select()
        .from(attendanceLogs)
        .where(
          and(
            eq(attendanceLogs.studentId, profile.id),
            inArray(attendanceLogs.attendanceSessionId, sessionIds)
          )
        );

      const logMap = new Map(myLogs.map((l) => [l.attendanceSessionId, l]));
      const now = new Date();

      // Kelompokkan berdasarkan sessionNumber agar pertemuan tidak double
      const groupedBySessionNumber = new Map<number, typeof sessions>();
      for (const sess of sessions) {
        if (!groupedBySessionNumber.has(sess.sessionNumber)) {
          groupedBySessionNumber.set(sess.sessionNumber, []);
        }
        groupedBySessionNumber.get(sess.sessionNumber)!.push(sess);
      }

      const history = Array.from(groupedBySessionNumber.entries())
        .map(([sessNum, sessList]) => {
          // Cari apakah siswa hadir di salah satu sesi pertemuan ini
          let attendedLog: (typeof myLogs)[0] | undefined;
          for (const s of sessList) {
            const foundLog = logMap.get(s.id);
            if (foundLog) {
              attendedLog = foundLog;
              break;
            }
          }

          // Prioritaskan sesi yang masih aktif jika ada, selain itu sesi terbaru
          const activeSess = sessList.find((s) => new Date(s.expiresAt) > now);
          const primarySess = activeSess || sessList[0];
          const isExpired = !activeSess;

          return {
            sessionId: primarySess.id,
            sessionNumber: sessNum,
            attended: attendedLog ? attendedLog.status === 'present' : false,
            status: attendedLog?.status || (isExpired ? 'absent' : null),
            note: attendedLog?.note || null,
            attachmentUrl: attendedLog?.attachmentUrl || null,
            checkedInAt: attendedLog?.checkedInAt || null,
            channel: attendedLog?.channel || null,
            isExpired,
            isActive: !isExpired,
            createdAt: primarySess.createdAt,
            tokenCode: isStaff(profile.role) ? primarySess.tokenCode : null,
          };
        })
        .sort((a, b) => a.sessionNumber - b.sessionNumber);

      return { success: true, data: history };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
    }
  )

  // 4. Rekap kehadiran satu batch per sesi (dijamin 1 record per pertemuan)
  .get(
    '/batch/:batchId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile || !isStaff(profile.role)) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      if (!(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const sessions = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.batchId, params.batchId))
        .orderBy(desc(attendanceSessions.sessionNumber), desc(attendanceSessions.createdAt));

      if (sessions.length === 0) {
        return { success: true, data: [] };
      }

      const sessionIds = sessions.map((s) => s.id);
      const allLogs = await db
        .select({
          id: attendanceLogs.id,
          attendanceSessionId: attendanceLogs.attendanceSessionId,
          studentId: profiles.id,
          studentName: profiles.fullName,
          email: userTable.email,
          avatarUrl: profiles.avatarUrl,
          discordUsername: userTable.discordUsername,
          checkedInAt: attendanceLogs.checkedInAt,
          channel: attendanceLogs.channel,
        })
        .from(attendanceLogs)
        .innerJoin(profiles, eq(attendanceLogs.studentId, profiles.id))
        .leftJoin(userTable, eq(attendanceLogs.studentId, userTable.id))
        .where(inArray(attendanceLogs.attendanceSessionId, sessionIds));

      // Group sessions by sessionNumber
      const groupedBySessionNumber = new Map<number, typeof sessions>();
      for (const sess of sessions) {
        if (!groupedBySessionNumber.has(sess.sessionNumber)) {
          groupedBySessionNumber.set(sess.sessionNumber, []);
        }
        groupedBySessionNumber.get(sess.sessionNumber)!.push(sess);
      }

      const now = new Date();
      const sessionsWithLogs = Array.from(groupedBySessionNumber.entries())
        .map(([sessNum, sessList]) => {
          const listIds = new Set(sessList.map((s) => s.id));
          const sessionLogs = allLogs.filter((l) => listIds.has(l.attendanceSessionId));

          // Deduplikasi peserta berdasarkan studentId
          const uniqueAttendeesMap = new Map<string, (typeof sessionLogs)[0]>();
          for (const l of sessionLogs) {
            if (!uniqueAttendeesMap.has(l.studentId)) {
              uniqueAttendeesMap.set(l.studentId, l);
            }
          }
          const uniqueAttendees = Array.from(uniqueAttendeesMap.values());

          const activeSess = sessList.find((s) => new Date(s.expiresAt) > now);
          const primarySess = activeSess || sessList[0];

          return {
            ...primarySess,
            attendeesCount: uniqueAttendees.length,
            attendees: uniqueAttendees,
          };
        })
        .sort((a, b) => b.sessionNumber - a.sessionNumber);

      return {
        success: true,
        data: sessionsWithLogs,
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
    }
  )

  // 4b. (Mentor/Admin) Ambil Roster Seluruh Siswa & Status Kehadiran Sesi Tertentu
  .get(
    '/session/:sessionId/roster',
    async ({ user, profile, params, set }) => {
      if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, params.sessionId))
        .limit(1);

      if (!session) {
        set.status = 404;
        return { success: false, message: 'Sesi presensi tidak ditemukan.' };
      }

      if (!(await canAccessBatch(profile, session.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      // Ambil seluruh ID sesi dengan pertemuan yang sama (jika ada data historis ganda)
      const relatedSessions = await db
        .select({ id: attendanceSessions.id })
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.batchId, session.batchId),
            eq(attendanceSessions.sessionNumber, session.sessionNumber)
          )
        );
      const relatedSessionIds = relatedSessions.map((s) => s.id);

      // Ambil seluruh siswa aktif di batch ini
      const enrolledStudents = await db
        .select({
          studentId: profiles.id,
          fullName: profiles.fullName,
          email: userTable.email,
          avatarUrl: profiles.avatarUrl,
          discordUsername: userTable.discordUsername,
          enrollmentStatus: batchEnrollments.status,
        })
        .from(batchEnrollments)
        .innerJoin(profiles, eq(batchEnrollments.studentId, profiles.id))
        .leftJoin(userTable, eq(batchEnrollments.studentId, userTable.id))
        .where(
          and(
            eq(batchEnrollments.batchId, session.batchId),
            eq(batchEnrollments.status, 'active')
          )
        )
        .orderBy(asc(profiles.fullName));

      // Ambil seluruh log kehadiran untuk sesi pertemuan ini
      const logs = await db
        .select()
        .from(attendanceLogs)
        .where(inArray(attendanceLogs.attendanceSessionId, relatedSessionIds));

      const logMap = new Map(logs.map((l) => [l.studentId, l]));

      const roster = enrolledStudents.map((std) => {
        const log = logMap.get(std.studentId);
        return {
          studentId: std.studentId,
          fullName: std.fullName,
          email: std.email,
          avatarUrl: std.avatarUrl,
          discordUsername: std.discordUsername,
          attended: !!log,
          checkedInAt: log?.checkedInAt || null,
          channel: log?.channel || null,
          logId: log?.id || null,
        };
      });

      return {
        success: true,
        data: {
          session: {
            ...session,
            isExpired: new Date(session.expiresAt) <= new Date(),
          },
          roster,
          totalStudents: enrolledStudents.length,
          attendedCount: logs.length,
        },
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
    }
  )

  // 4c. (Mentor/Admin) Edit / Toggle Status Kehadiran Siswa Secara Manual
  .post(
    '/session/:sessionId/manual-toggle',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, params.sessionId))
        .limit(1);

      if (!session) {
        set.status = 404;
        return { success: false, message: 'Sesi presensi tidak ditemukan.' };
      }

      if (!(await canAccessBatch(profile, session.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const { studentId, attended } = body;

      const relatedSessions = await db
        .select({ id: attendanceSessions.id })
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.batchId, session.batchId),
            eq(attendanceSessions.sessionNumber, session.sessionNumber)
          )
        );
      const relatedSessionIds = relatedSessions.map((s) => s.id);

      if (attended) {
        // Cek apakah sudah pernah log hadir
        const [existingLog] = await db
          .select()
          .from(attendanceLogs)
          .where(
            and(
              inArray(attendanceLogs.attendanceSessionId, relatedSessionIds),
              eq(attendanceLogs.studentId, studentId)
            )
          )
          .limit(1);

        if (!existingLog) {
          await db.insert(attendanceLogs).values({
            id: uuidv7(),
            attendanceSessionId: session.id,
            studentId,
            checkedInAt: new Date(),
            channel: 'manual',
          });
        }
        return {
          success: true,
          message: 'Status siswa diperbarui menjadi Hadir (Manual).',
        };
      } else {
        // Hapus log kehadiran
        await db
          .delete(attendanceLogs)
          .where(
            and(
              inArray(attendanceLogs.attendanceSessionId, relatedSessionIds),
              eq(attendanceLogs.studentId, studentId)
            )
          );
        return {
          success: true,
          message: 'Status kehadiran siswa diubah menjadi Tidak Hadir.',
        };
      }
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        studentId: t.String(),
        attended: t.Boolean(),
      }),
    }
  )

  // 4d. (Mentor/Admin) Edit Detail Sesi Presensi (Perpanjang Waktu, Buka Ulang, Tutup)
  .patch(
    '/session/:sessionId',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, params.sessionId))
        .limit(1);

      if (!session) {
        set.status = 404;
        return { success: false, message: 'Sesi presensi tidak ditemukan.' };
      }

      if (!(await canAccessBatch(profile, session.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const now = new Date();
      const updates: { expiresAt?: Date; tokenCode?: string } = {};

      if (body.action === 'extend' && body.extendMinutes) {
        const currentExpiry = new Date(session.expiresAt).getTime();
        const baseTime = currentExpiry > now.getTime() ? currentExpiry : now.getTime();
        updates.expiresAt = new Date(baseTime + body.extendMinutes * 60 * 1000);
      } else if (body.action === 'close') {
        updates.expiresAt = now;
      } else if (body.action === 'reopen') {
        const duration = body.durationMinutes || 30;
        updates.expiresAt = new Date(now.getTime() + duration * 60 * 1000);
        updates.tokenCode = generateAttendanceCode();
      }

      const [updated] = await db
        .update(attendanceSessions)
        .set(updates)
        .where(eq(attendanceSessions.id, params.sessionId))
        .returning();

      return {
        success: true,
        message: 'Sesi presensi berhasil diperbarui.',
        data: updated,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        action: t.Union([t.Literal('extend'), t.Literal('close'), t.Literal('reopen')]),
        extendMinutes: t.Optional(t.Integer({ minimum: 5, maximum: 180 })),
        durationMinutes: t.Optional(t.Integer({ minimum: 5, maximum: 180 })),
      }),
    }
  )

  // 5. (Siswa) Ambil Ringkasan Metrik Kehadiran Pribadi
  .get('/my-summary', async ({ user, profile, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    // Cari batch yang diikuti oleh siswa
    const enrollments = await db
      .select({
        batchId: batchEnrollments.batchId,
        batchName: batches.name,
      })
      .from(batchEnrollments)
      .innerJoin(batches, eq(batchEnrollments.batchId, batches.id))
      .where(
        and(
          eq(batchEnrollments.studentId, profile.id),
          eq(batchEnrollments.status, 'active')
        )
      );

    if (enrollments.length === 0) {
      return {
        success: true,
        data: {
          enrolled: false,
          totalSessionsOpened: 0,
          attendedCount: 0,
          attendanceRate: 0,
          recentLogs: [],
        },
      };
    }

    const batchIds = enrollments.map((e) => e.batchId);

    // Ambil seluruh sesi presensi yang telah dibuka pada batch siswa
    const openedSessions = await db
      .select({
        id: attendanceSessions.id,
        sessionNumber: attendanceSessions.sessionNumber,
        batchId: attendanceSessions.batchId,
        createdAt: attendanceSessions.createdAt,
      })
      .from(attendanceSessions)
      .where(inArray(attendanceSessions.batchId, batchIds));

    const totalSessionsOpened = openedSessions.length;

    if (totalSessionsOpened === 0) {
      return {
        success: true,
        data: {
          enrolled: true,
          totalSessionsOpened: 0,
          attendedCount: 0,
          attendanceRate: 100, // Belum ada sesi yang dibuka = 100%
          recentLogs: [],
        },
      };
    }

    const sessionIds = openedSessions.map((s) => s.id);

    // Ambil log kehadiran siswa
    const myLogs = await db
      .select({
        id: attendanceLogs.id,
        attendanceSessionId: attendanceLogs.attendanceSessionId,
        checkedInAt: attendanceLogs.checkedInAt,
        channel: attendanceLogs.channel,
      })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.studentId, profile.id),
          inArray(attendanceLogs.attendanceSessionId, sessionIds)
        )
      )
      .orderBy(desc(attendanceLogs.checkedInAt));

    const attendedCount = myLogs.length;
    const attendanceRate = Math.round((attendedCount / totalSessionsOpened) * 100);

    const sessionMap = new Map(openedSessions.map((s) => [s.id, s.sessionNumber]));

    const recentLogs = myLogs.slice(0, 5).map((l) => ({
      ...l,
      sessionNumber: sessionMap.get(l.attendanceSessionId) || 1,
    }));

    return {
      success: true,
      data: {
        enrolled: true,
        totalSessionsOpened,
        attendedCount,
        attendanceRate,
        recentLogs,
      },
    };
  });

