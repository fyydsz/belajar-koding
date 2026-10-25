import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import {
  courses,
  courseSessions,
  courseMaterials,
  assignments,
  assignmentSubmissions,
  profiles,
  batches,
  batchCourses,
  batchEnrollments,
  attendanceSessions,
} from '../db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';

async function getEnrolledCourseIdsForStudent(studentId: string): Promise<string[]> {
  const activeEnrollments = await db
    .select({
      batchId: batchEnrollments.batchId,
    })
    .from(batchEnrollments)
    .where(
      and(
        eq(batchEnrollments.studentId, studentId),
        eq(batchEnrollments.status, 'active')
      )
    );

  if (activeEnrollments.length === 0) return [];

  const batchIds = activeEnrollments.map((e) => e.batchId);
  const enrolledCourses = await db
    .select({ courseId: batchCourses.courseId })
    .from(batchCourses)
    .where(inArray(batchCourses.batchId, batchIds));

  return Array.from(new Set(enrolledCourses.map((c) => c.courseId)));
}

// Ambil pemetaan nomor pertemuan yang presensinya/sesinya sudah dibuka oleh mentor untuk setiap kelas
async function getOpenedSessionsMapForStudent(studentId: string): Promise<Map<string, Set<number>>> {
  const activeEnrollments = await db
    .select({
      batchId: batchEnrollments.batchId,
    })
    .from(batchEnrollments)
    .where(
      and(
        eq(batchEnrollments.studentId, studentId),
        eq(batchEnrollments.status, 'active')
      )
    );

  if (activeEnrollments.length === 0) return new Map();

  const batchIds = activeEnrollments.map((e) => e.batchId);
  const enrolledCourses = await db
    .select({
      batchId: batchCourses.batchId,
      courseId: batchCourses.courseId,
    })
    .from(batchCourses)
    .where(inArray(batchCourses.batchId, batchIds));

  const batchToCourses = new Map<string, Set<string>>();
  for (const ec of enrolledCourses) {
    if (!batchToCourses.has(ec.batchId)) {
      batchToCourses.set(ec.batchId, new Set());
    }
    batchToCourses.get(ec.batchId)!.add(ec.courseId);
  }

  const openedSessions = await db
    .select({
      batchId: attendanceSessions.batchId,
      sessionNumber: attendanceSessions.sessionNumber,
    })
    .from(attendanceSessions)
    .where(inArray(attendanceSessions.batchId, batchIds));

  const courseOpenedSessions = new Map<string, Set<number>>();
  for (const os of openedSessions) {
    const associatedCourses = batchToCourses.get(os.batchId);
    if (associatedCourses) {
      for (const cId of associatedCourses) {
        if (!courseOpenedSessions.has(cId)) {
          courseOpenedSessions.set(cId, new Set());
        }
        courseOpenedSessions.get(cId)!.add(os.sessionNumber);
      }
    }
  }

  return courseOpenedSessions;
}

async function getOpenedSessionNumbersForStudent(studentId: string, courseId: string): Promise<number[]> {
  const map = await getOpenedSessionsMapForStudent(studentId);
  const set = map.get(courseId);
  return set ? Array.from(set) : [];
}

export const classroomRoutes = new Elysia({ prefix: '/v1/classroom' })
  .use(authPlugin)
  // Ambil semua kelas beserta jumlah pertemuan (disaring berdasarkan batch aktif jika mahasiswa)
  .get('/courses', async ({ user, profile, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    let coursesToQuery;

    // Jika role siswa, hanya tampilkan kelas yang memiliki batch aktif dan siswa terdaftar aktif
    if (profile && profile.role === 'student') {
      const enrolledCourseIds = await getEnrolledCourseIdsForStudent(profile.id);

      // Jika belum terdaftar di batch aktif mana pun, kembalikan daftar kosong
      if (enrolledCourseIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      coursesToQuery = await db
        .select()
        .from(courses)
        .where(inArray(courses.id, enrolledCourseIds))
        .orderBy(asc(courses.title));
    } else {
      coursesToQuery = await db.select().from(courses).orderBy(asc(courses.title));
    }

    const openedSessionsMap =
      profile && profile.role === 'student'
        ? await getOpenedSessionsMapForStudent(profile.id)
        : null;

    const courseList = await Promise.all(
      coursesToQuery.map(async (c) => {
        let sessions = await db
          .select({
            id: courseSessions.id,
            sessionNumber: courseSessions.sessionNumber,
            title: courseSessions.title,
          })
          .from(courseSessions)
          .where(eq(courseSessions.courseId, c.id))
          .orderBy(asc(courseSessions.sessionNumber));

        if (openedSessionsMap) {
          const openedSet = openedSessionsMap.get(c.id) || new Set<number>();
          sessions = sessions.filter((s) => openedSet.has(s.sessionNumber));
        }

        return {
          ...c,
          totalSessions: sessions.length,
          sessions,
        };
      })
    );

    return {
      success: true,
      data: courseList,
    };
  })

  // [ADMIN/MENTOR] Buat Kelas Baru beserta Sesi Pertemuan Default
  .post(
    '/courses',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'admin' && profile.role !== 'mentor') {
        set.status = 403;
        return { success: false, message: 'Hanya Admin atau Mentor yang dapat membuat kelas baru.' };
      }

      const { title, slug, description, total_sessions } = body;
      const cleanSlug = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');
      const sessionsCount = total_sessions || 16;

      // Cek apakah slug sudah ada
      const [existing] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.slug, cleanSlug))
        .limit(1);

      if (existing) {
        set.status = 400;
        return { success: false, message: 'Slug kelas sudah digunakan. Gunakan slug atau judul lain.' };
      }

      const newCourseId = uuidv7();
      const [newCourse] = await db
        .insert(courses)
        .values({
          id: newCourseId,
          slug: cleanSlug,
          title: title.trim(),
          description: description ? description.trim() : null,
          totalSessions: sessionsCount,
        })
        .returning();

      // Buat default sesi pertemuan
      const sessionValues = Array.from({ length: sessionsCount }, (_, i) => ({
        id: uuidv7(),
        courseId: newCourse.id,
        sessionNumber: i + 1,
        title: `Pertemuan ${i + 1}`,
        description: `Materi pembelajaran untuk sesi pertemuan ${i + 1}.`,
        orderIndex: i + 1,
      }));

      await db.insert(courseSessions).values(sessionValues);

      return {
        success: true,
        message: `Kelas '${newCourse.title}' beserta ${sessionsCount} sesi pertemuan berhasil dibuat.`,
        data: newCourse,
      };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 2 }),
        slug: t.String({ minLength: 2 }),
        description: t.Optional(t.String()),
        total_sessions: t.Optional(t.Integer({ minimum: 1, maximum: 32 })),
      }),
    }
  )

  // [ADMIN] Hapus Kelas
  .delete(
    '/courses/:courseId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya Admin yang memiliki hak menghapus kelas master.' };
      }

      const [deleted] = await db
        .delete(courses)
        .where(eq(courses.id, params.courseId))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { success: false, message: 'Kelas tidak ditemukan.' };
      }

      return {
        success: true,
        message: `Kelas '${deleted.title}' berhasil dihapus.`,
      };
    },
    {
      params: t.Object({
        courseId: t.String(),
      }),
    }
  )

  // Ambil detail kursus dan daftar semua sesi pertemuan (P1, P2, P3...)
  .get(
    '/courses/:courseSlug',
    async ({ user, profile, params, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.slug, params.courseSlug))
        .limit(1);

      if (!course) {
        set.status = 404;
        return { success: false, message: 'Kelas tidak ditemukan.' };
      }

      // Validasi hak akses mahasiswa: harus terdaftar di batch aktif kelas ini
      if (profile && profile.role === 'student') {
        const enrolledCourseIds = await getEnrolledCourseIdsForStudent(profile.id);

        if (!enrolledCourseIds.includes(course.id)) {
          set.status = 403;
          return {
            success: false,
            message: 'Anda belum terdaftar dalam batch aktif untuk kelas ini.',
            requiresEnrollment: true,
          };
        }
      }

      const sessions = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.courseId, course.id))
        .orderBy(asc(courseSessions.sessionNumber));

      // Ambil ringkasan jumlah materi & tugas per sesi
      let sessionsWithStats = await Promise.all(
        sessions.map(async (sess) => {
          const materialsCount = await db
            .select({ id: courseMaterials.id })
            .from(courseMaterials)
            .where(eq(courseMaterials.sessionId, sess.id));

          const assignmentsCount = await db
            .select({ id: assignments.id })
            .from(assignments)
            .where(eq(assignments.sessionId, sess.id));

          return {
            ...sess,
            materialsCount: materialsCount.length,
            assignmentsCount: assignmentsCount.length,
          };
        })
      );

      // Jika role siswa, hanya tampilkan pertemuan yang sudah dibuka presensinya oleh dosen/mentor
      if (profile && profile.role === 'student') {
        const openedSessionNumbers = await getOpenedSessionNumbersForStudent(profile.id, course.id);
        const openedSet = new Set(openedSessionNumbers);
        sessionsWithStats = sessionsWithStats.filter((s) => openedSet.has(s.sessionNumber));
      }

      return {
        success: true,
        data: {
          course,
          sessions: sessionsWithStats,
        },
      };
    },
    {
      params: t.Object({
        courseSlug: t.String(),
      }),
    }
  )

  // Ambil detail SATU pertemuan fokus (P1, P2, atau P3) beserta materi MDX & tugas di dalamnya
  .get(
    '/courses/:courseSlug/sessions/:sessionNumber',
    async ({ user, profile, params, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const sessionNum = parseInt(params.sessionNumber, 10);
      if (isNaN(sessionNum)) {
        set.status = 400;
        return { success: false, message: 'Nomor pertemuan harus angka valid.' };
      }

      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.slug, params.courseSlug))
        .limit(1);

      if (!course) {
        set.status = 404;
        return { success: false, message: 'Kelas tidak ditemukan.' };
      }

      // Validasi hak akses mahasiswa: harus terdaftar di batch aktif kelas ini & pertemuan sudah dibuka presensinya
      if (profile && profile.role === 'student') {
        const enrolledCourseIds = await getEnrolledCourseIdsForStudent(profile.id);

        if (!enrolledCourseIds.includes(course.id)) {
          set.status = 403;
          return {
            success: false,
            message: 'Anda belum terdaftar dalam batch aktif untuk kelas ini.',
            requiresEnrollment: true,
          };
        }

        const openedSessionNumbers = await getOpenedSessionNumbersForStudent(profile.id, course.id);
        if (!openedSessionNumbers.includes(sessionNum)) {
          set.status = 403;
          return {
            success: false,
            message: `Pertemuan P${sessionNum} belum dibuka oleh dosen/mentor.`,
            notOpenedYet: true,
          };
        }
      }

      const [session] = await db
        .select()
        .from(courseSessions)
        .where(
          and(
            eq(courseSessions.courseId, course.id),
            eq(courseSessions.sessionNumber, sessionNum)
          )
        )
        .limit(1);

      if (!session) {
        set.status = 404;
        return {
          success: false,
          message: `Pertemuan P${sessionNum} belum dibuat untuk kelas ini.`,
        };
      }

      // Ambil materi MDX dalam pertemuan ini
      const materials = await db
        .select({
          id: courseMaterials.id,
          sessionId: courseMaterials.sessionId,
          mentorId: courseMaterials.mentorId,
          mentorName: profiles.fullName,
          title: courseMaterials.title,
          contentMdx: courseMaterials.contentMdx,
          fileUrl: courseMaterials.fileUrl,
          orderIndex: courseMaterials.orderIndex,
          createdAt: courseMaterials.createdAt,
          updatedAt: courseMaterials.updatedAt,
        })
        .from(courseMaterials)
        .leftJoin(profiles, eq(courseMaterials.mentorId, profiles.id))
        .where(eq(courseMaterials.sessionId, session.id))
        .orderBy(asc(courseMaterials.orderIndex), asc(courseMaterials.createdAt));

      // Ambil tugas yang terhubung dengan pertemuan ini
      const sessionAssignments = await db
        .select({
          id: assignments.id,
          batchCourseId: assignments.batchCourseId,
          courseId: batchCourses.courseId,
          sessionId: assignments.sessionId,
          title: assignments.title,
          description: assignments.description,
          createdAt: assignments.createdAt,
          expiredAt: assignments.expiredAt,
        })
        .from(assignments)
        .innerJoin(batchCourses, eq(assignments.batchCourseId, batchCourses.id))
        .where(eq(assignments.sessionId, session.id))
        .orderBy(desc(assignments.createdAt));

      // Cek submission untuk mahasiswa login
      const studentSubmissions = await db
        .select()
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.studentId, user.id));

      const subMap = new Map(studentSubmissions.map((s) => [s.assignmentId, s]));
      const now = new Date();

      const assignmentsWithSubmission = sessionAssignments.map((a) => {
        const sub = subMap.get(a.id);
        return {
          ...a,
          isExpired: new Date(a.expiredAt) < now,
          isSubmitted: !!sub,
          submission: sub || null,
        };
      });

      return {
        success: true,
        data: {
          course,
          session,
          materials,
          assignments: assignmentsWithSubmission,
        },
      };
    },
    {
      params: t.Object({
        courseSlug: t.String(),
        sessionNumber: t.String(),
      }),
    }
  )

  // [DOSEN/ADMIN] Buat Sesi Pertemuan Baru
  .post(
    '/courses/:courseSlug/sessions',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya dosen/mentor yang dapat membuat pertemuan.' };
      }

      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.slug, params.courseSlug))
        .limit(1);

      if (!course) {
        set.status = 404;
        return { success: false, message: 'Kelas tidak ditemukan.' };
      }

      let sessionNumber = body.session_number;
      if (!sessionNumber) {
        // Auto increment session number
        const existingSessions = await db
          .select({ sessionNumber: courseSessions.sessionNumber })
          .from(courseSessions)
          .where(eq(courseSessions.courseId, course.id))
          .orderBy(desc(courseSessions.sessionNumber))
          .limit(1);

        sessionNumber = (existingSessions[0]?.sessionNumber || 0) + 1;
      }

      try {
        const [newSession] = await db
          .insert(courseSessions)
          .values({
            id: uuidv7(),
            courseId: course.id,
            sessionNumber,
            title: body.title || `Pertemuan ${sessionNumber}`,
            description: body.description || null,
            orderIndex: sessionNumber,
          })
          .returning();

        return {
          success: true,
          message: `Pertemuan P${sessionNumber} berhasil dibuat.`,
          data: newSession,
        };
      } catch (err: any) {
        if (err?.code === '23505') {
          set.status = 400;
          return {
            success: false,
            message: `Pertemuan P${sessionNumber} sudah ada untuk kelas ini.`,
          };
        }
        throw err;
      }
    },
    {
      params: t.Object({
        courseSlug: t.String(),
      }),
      body: t.Object({
        session_number: t.Optional(t.Integer({ minimum: 1 })),
        title: t.String({ minLength: 2 }),
        description: t.Optional(t.String()),
      }),
    }
  )

  // [DOSEN/ADMIN] Tambah Materi MDX Baru ke Pertemuan Tertentu
  .post(
    '/sessions/:sessionId/materials',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya dosen/mentor yang dapat mengunggah materi.' };
      }

      const [session] = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, params.sessionId))
        .limit(1);

      if (!session) {
        set.status = 404;
        return { success: false, message: 'Sesi pertemuan tidak ditemukan.' };
      }

      const [newMaterial] = await db
        .insert(courseMaterials)
        .values({
          id: uuidv7(),
          sessionId: session.id,
          mentorId: user.id,
          title: body.title,
          contentMdx: body.content_mdx,
          fileUrl: body.file_url || null,
          orderIndex: body.order_index ?? 0,
        })
        .returning();

      return {
        success: true,
        message: 'Materi berhasil ditambahkan ke pertemuan.',
        data: newMaterial,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        title: t.String({ minLength: 2 }),
        content_mdx: t.String({ minLength: 1 }),
        file_url: t.Optional(t.String()),
        order_index: t.Optional(t.Integer()),
      }),
    }
  )

  // [DOSEN/ADMIN] Edit Materi
  .put(
    '/materials/:materialId',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya dosen/mentor yang dapat mengubah materi.' };
      }

      const [updated] = await db
        .update(courseMaterials)
        .set({
          title: body.title,
          contentMdx: body.content_mdx,
          fileUrl: body.file_url !== undefined ? body.file_url : undefined,
          orderIndex: body.order_index !== undefined ? body.order_index : undefined,
          updatedAt: new Date(),
        })
        .where(eq(courseMaterials.id, params.materialId))
        .returning();

      if (!updated) {
        set.status = 404;
        return { success: false, message: 'Materi tidak ditemukan.' };
      }

      return {
        success: true,
        message: 'Materi berhasil diperbarui.',
        data: updated,
      };
    },
    {
      params: t.Object({
        materialId: t.String(),
      }),
      body: t.Object({
        title: t.String({ minLength: 2 }),
        content_mdx: t.String({ minLength: 1 }),
        file_url: t.Optional(t.String()),
        order_index: t.Optional(t.Integer()),
      }),
    }
  )

  // [DOSEN/ADMIN] Hapus Materi
  .delete(
    '/materials/:materialId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya dosen/mentor yang dapat menghapus materi.' };
      }

      const [deleted] = await db
        .delete(courseMaterials)
        .where(eq(courseMaterials.id, params.materialId))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { success: false, message: 'Materi tidak ditemukan.' };
      }

      return {
        success: true,
        message: 'Materi berhasil dihapus.',
      };
    },
    {
      params: t.Object({
        materialId: t.String(),
      }),
    }
  )

  // [DOSEN/ADMIN] Edit Sesi Pertemuan (Judul & Deskripsi)
  .put(
    '/sessions/:sessionId',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya dosen/mentor yang dapat mengubah sesi pertemuan.' };
      }

      const [session] = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, params.sessionId))
        .limit(1);

      if (!session) {
        set.status = 404;
        return { success: false, message: 'Sesi pertemuan tidak ditemukan.' };
      }

      const [updatedSession] = await db
        .update(courseSessions)
        .set({
          title: body.title.trim(),
          description: body.description !== undefined ? (body.description ? body.description.trim() : null) : session.description,
        })
        .where(eq(courseSessions.id, params.sessionId))
        .returning();

      return {
        success: true,
        message: 'Informasi sesi pertemuan berhasil diperbarui.',
        data: updatedSession,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        title: t.String({ minLength: 2 }),
        description: t.Optional(t.String()),
      }),
    }
  )

  // [DOSEN/ADMIN] Hapus Sesi Pertemuan
  .delete(
    '/sessions/:sessionId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya dosen/mentor yang dapat menghapus pertemuan.' };
      }

      const [session] = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, params.sessionId))
        .limit(1);

      if (!session) {
        set.status = 404;
        return { success: false, message: 'Sesi pertemuan tidak ditemukan.' };
      }

      await db
        .delete(courseSessions)
        .where(eq(courseSessions.id, params.sessionId));

      return {
        success: true,
        message: `Pertemuan P${session.sessionNumber} (${session.title}) berhasil dihapus.`,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
    }
  );

