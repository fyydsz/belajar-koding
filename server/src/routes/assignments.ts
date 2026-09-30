import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import { assignments, assignmentSubmissions, courses } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';

export const assignmentRoutes = new Elysia({ prefix: '/v1/assignments' })
  .use(authPlugin)
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    const rows = await db
      .select({
        id: assignments.id,
        courseId: assignments.courseId,
        courseTitle: courses.title,
        title: assignments.title,
        description: assignments.description,
        createdAt: assignments.createdAt,
        expiredAt: assignments.expiredAt,
      })
      .from(assignments)
      .leftJoin(courses, eq(assignments.courseId, courses.id))
      .orderBy(desc(assignments.createdAt));

    const studentSubmissions = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.studentId, user.id));

    const submissionMap = new Map(studentSubmissions.map((s) => [s.assignmentId, s]));

    const now = new Date();
    const result = rows.map((a) => {
      const sub = submissionMap.get(a.id);
      return {
        ...a,
        isExpired: new Date(a.expiredAt) < now,
        isSubmitted: !!sub,
        submission: sub || null,
      };
    });

    return {
      success: true,
      data: result,
    };
  })
  .post(
    '/',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya mentor atau admin yang dapat membuat tugas.' };
      }

      const { course_id, title, description, expired_at } = body;
      const expiredDate = new Date(expired_at);

      if (isNaN(expiredDate.getTime())) {
        set.status = 400;
        return { success: false, message: 'Format tanggal expired_at tidak valid.' };
      }

      const [newAssignment] = await db
        .insert(assignments)
        .values({
          id: uuidv7(),
          courseId: course_id,
          mentorId: user.id,
          title,
          description: description || null,
          expiredAt: expiredDate,
        })
        .returning();

      return {
        success: true,
        message: 'Tugas baru berhasil dibuat.',
        data: newAssignment,
      };
    },
    {
      body: t.Object({
        course_id: t.String(),
        title: t.String({ minLength: 3 }),
        description: t.Optional(t.String()),
        expired_at: t.String(),
      }),
    }
  );
