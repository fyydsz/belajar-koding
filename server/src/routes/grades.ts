import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import { studentGrades, courses, profiles } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { evaluateStudentGrades, validateScore } from '../lib/grades';
import { uuidv7 } from '../lib/uuid';

export const gradeRoutes = new Elysia({ prefix: '/v1/grades' })
  .use(authPlugin)
  .get('/my', async ({ user, profile, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    const rows = await db
      .select({
        gradeId: studentGrades.id,
        courseId: studentGrades.courseId,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        tugasScore: studentGrades.tugasScore,
        quizScore: studentGrades.quizScore,
        utsScore: studentGrades.utsScore,
        uasScore: studentGrades.uasScore,
        updatedAt: studentGrades.updatedAt,
      })
      .from(studentGrades)
      .leftJoin(courses, eq(studentGrades.courseId, courses.id))
      .where(eq(studentGrades.studentId, user.id));

    const evaluatedGrades = rows.map((row) => {
      const tugas = parseFloat(row.tugasScore) || 0;
      const quiz = parseFloat(row.quizScore) || 0;
      const uts = parseFloat(row.utsScore) || 0;
      const uas = parseFloat(row.uasScore) || 0;

      const evalResult = evaluateStudentGrades({ tugas, quiz, uts, uas });

      return {
        ...row,
        tugas,
        quiz,
        uts,
        uas,
        evaluation: evalResult,
      };
    });

    return {
      success: true,
      data: evaluatedGrades,
    };
  })
  .post(
    '/update',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya mentor atau admin yang dapat memperbarui nilai siswa.' };
      }

      const { student_id, course_id, tugas_score, quiz_score, uts_score, uas_score } = body;

      if (
        !validateScore(tugas_score) ||
        !validateScore(quiz_score) ||
        !validateScore(uts_score) ||
        !validateScore(uas_score)
      ) {
        set.status = 400;
        return { success: false, message: 'Nilai harus berupa angka valid antara 0 sampai 100.' };
      }

      const existing = await db
        .select()
        .from(studentGrades)
        .where(
          and(
            eq(studentGrades.studentId, student_id),
            eq(studentGrades.courseId, course_id)
          )
        )
        .limit(1);

      let result;
      const now = new Date();

      if (existing.length > 0) {
        const [updated] = await db
          .update(studentGrades)
          .set({
            tugasScore: tugas_score.toString(),
            quizScore: quiz_score.toString(),
            utsScore: uts_score.toString(),
            uasScore: uas_score.toString(),
            updatedAt: now,
          })
          .where(eq(studentGrades.id, existing[0].id))
          .returning();
        result = updated;
      } else {
        const [inserted] = await db
          .insert(studentGrades)
          .values({
            id: uuidv7(),
            courseId: course_id,
            studentId: student_id,
            tugasScore: tugas_score.toString(),
            quizScore: quiz_score.toString(),
            utsScore: uts_score.toString(),
            uasScore: uas_score.toString(),
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        result = inserted;
      }

      const evalResult = evaluateStudentGrades({
        tugas: tugas_score,
        quiz: quiz_score,
        uts: uts_score,
        uas: uas_score,
      });

      return {
        success: true,
        message: 'Nilai siswa berhasil diperbarui.',
        data: {
          ...result,
          evaluation: evalResult,
        },
      };
    },
    {
      body: t.Object({
        student_id: t.String(),
        course_id: t.String(),
        tugas_score: t.Number(),
        quiz_score: t.Number(),
        uts_score: t.Number(),
        uas_score: t.Number(),
      }),
    }
  );
