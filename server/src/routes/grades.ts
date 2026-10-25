import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import {
  studentGrades,
  courses,
  profiles,
  batches,
  batchCourses,
  batchEnrollments,
  user as userTable,
} from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { evaluateStudentGrades, validateScore, getGradeLetter } from '../lib/grades';
import { uuidv7 } from '../lib/uuid';
import { canAccessBatch } from '../lib/access';

export const gradeRoutes = new Elysia({ prefix: '/v1/grades' })
  .use(authPlugin)

  // 1. (Siswa) Ambil Nilai Sendiri untuk Seluruh Mata Kuliah
  .get('/my', async ({ user, profile, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    const rows = await db
      .select({
        gradeId: studentGrades.id,
        courseId: courses.id,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        batchId: batchEnrollments.batchId,
        attendanceScore: studentGrades.attendanceScore,
        tugasScore: studentGrades.tugasScore,
        quizScore: studentGrades.quizScore,
        utsScore: studentGrades.utsScore,
        uasScore: studentGrades.uasScore,
        finalScore: studentGrades.finalScore,
        gradeLetter: studentGrades.gradeLetter,
        isPassed: studentGrades.isPassed,
        isOverride: studentGrades.isOverride,
        updatedAt: studentGrades.updatedAt,
      })
      .from(studentGrades)
      .innerJoin(batchEnrollments, eq(studentGrades.enrollmentId, batchEnrollments.id))
      .innerJoin(batchCourses, eq(studentGrades.batchCourseId, batchCourses.id))
      .innerJoin(courses, eq(batchCourses.courseId, courses.id))
      .where(eq(batchEnrollments.studentId, user.id));

    const evaluatedGrades = rows.map((row) => {
      const tugas = parseFloat(row.tugasScore) || 0;
      const quiz = parseFloat(row.quizScore) || 0;
      const uts = parseFloat(row.utsScore) || 0;
      const uas = parseFloat(row.uasScore) || 0;

      const evalResult = evaluateStudentGrades({ tugas, quiz, uts, uas });

      // Jika ada nilai override resmi di DB, gunakan nilai tersebut
      const finalScore =
        row.isOverride && row.finalScore ? parseFloat(row.finalScore) : evalResult.finalScore;
      const gradeInfo = getGradeLetter(finalScore);

      return {
        ...row,
        tugas,
        quiz,
        uts,
        uas,
        evaluation: {
          finalScore,
          gradeLetter: gradeInfo.letter,
          gradePoint: gradeInfo.point,
          predicate: gradeInfo.predicate,
          isPassing: gradeInfo.isPassing,
        },
      };
    });

    return {
      success: true,
      data: evaluatedGrades,
    };
  })

  // 2. (Mentor / Admin) Ambil Lembar Rekap Nilai Satu Batch Kelas Lengkap
  .get(
    '/batch/:batchId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya Mentor atau Admin yang dapat mengakses rekap nilai.' };
      }

      if (!(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      // Ambil detail batch
      const [batch] = await db
        .select({
          id: batches.id,
          code: batches.code,
          name: batches.name,
          description: batches.description,
          status: batches.status,
        })
        .from(batches)
        .where(eq(batches.id, params.batchId))
        .limit(1);

      if (!batch) {
        set.status = 404;
        return { success: false, message: 'Batch kelas tidak ditemukan.' };
      }

      // Ambil daftar mata kuliah di batch ini
      const batchCourseList = await db
        .select({
          id: batchCourses.id,
          courseId: courses.id,
          courseTitle: courses.title,
          courseSlug: courses.slug,
        })
        .from(batchCourses)
        .innerJoin(courses, eq(batchCourses.courseId, courses.id))
        .where(eq(batchCourses.batchId, params.batchId));

      const primaryBatchCourse = batchCourseList[0] || null;

      // Ambil seluruh siswa yang terdaftar di batch
      const enrolledStudents = await db
        .select({
          enrollmentId: batchEnrollments.id,
          studentId: profiles.id,
          fullName: profiles.fullName,
          email: userTable.email,
          avatarUrl: profiles.avatarUrl,
          discordUsername: userTable.discordUsername,
          enrolledAt: batchEnrollments.enrolledAt,
        })
        .from(batchEnrollments)
        .innerJoin(profiles, eq(batchEnrollments.studentId, profiles.id))
        .leftJoin(userTable, eq(profiles.id, userTable.id))
        .where(eq(batchEnrollments.batchId, batch.id))
        .orderBy(profiles.fullName);

      // Ambil nilai seluruh siswa untuk batchCourse di batch ini
      const batchCourseIds = batchCourseList.map((bc) => bc.id);
      const gradeRecords =
        batchCourseIds.length > 0
          ? await db
              .select()
              .from(studentGrades)
              .where(inArray(studentGrades.batchCourseId, batchCourseIds))
          : [];

      const gradeMap = new Map(gradeRecords.map((g) => [g.enrollmentId, g]));

      let totalFinalScore = 0;
      let passCount = 0;
      let overrideCount = 0;

      const studentList = enrolledStudents.map((student, idx) => {
        const gradeRow = gradeMap.get(student.enrollmentId);
        const tugas = gradeRow ? parseFloat(gradeRow.tugasScore) || 0 : 0;
        const quiz = gradeRow ? parseFloat(gradeRow.quizScore) || 0 : 0;
        const uts = gradeRow ? parseFloat(gradeRow.utsScore) || 0 : 0;
        const uas = gradeRow ? parseFloat(gradeRow.uasScore) || 0 : 0;
        const isOverride = gradeRow ? Boolean(gradeRow.isOverride) : false;

        const evalResult = evaluateStudentGrades({ tugas, quiz, uts, uas });
        const finalScore =
          isOverride && gradeRow?.finalScore
            ? parseFloat(gradeRow.finalScore)
            : evalResult.finalScore;

        const gradeInfo = getGradeLetter(finalScore);

        totalFinalScore += finalScore;
        if (gradeInfo.isPassing) passCount++;
        if (isOverride) overrideCount++;

        return {
          number: idx + 1,
          enrollmentId: student.enrollmentId,
          studentId: student.studentId,
          fullName: student.fullName,
          email: student.email,
          avatarUrl: student.avatarUrl,
          discordUsername: student.discordUsername,
          tugas,
          quiz,
          uts,
          uas,
          finalScore,
          gradeLetter: gradeInfo.letter,
          gradePoint: gradeInfo.point,
          predicate: gradeInfo.predicate,
          isPassing: gradeInfo.isPassing,
          isOverride,
          updatedAt: gradeRow?.updatedAt || null,
        };
      });

      const totalStudents = studentList.length;
      const classAverage =
        totalStudents > 0 ? Math.round((totalFinalScore / totalStudents) * 100) / 100 : 0;
      const passRate =
        totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0;

      return {
        success: true,
        data: {
          batch: {
            ...batch,
            courseId: primaryBatchCourse?.courseId || null,
            courseTitle: primaryBatchCourse?.courseTitle || null,
            courseSlug: primaryBatchCourse?.courseSlug || null,
          },
          stats: {
            totalStudents,
            classAverage,
            passCount,
            passRate,
            overrideCount,
          },
          students: studentList,
        },
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
    }
  )

  // 3. (Mentor / Admin) Simpan Penyesuaian / Override Nilai Siswa
  .post(
    '/override',
    async ({ user, profile, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (profile.role !== 'mentor' && profile.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Hanya Mentor atau Admin yang dapat mengubah nilai.' };
      }

      const student_id = body.studentId || body.student_id;
      const batch_id = body.batchId || body.batch_id;
      const tugas_score = body.tugasScore ?? body.tugas_score ?? 0;
      const quiz_score = body.quizScore ?? body.quiz_score ?? 0;
      const uts_score = body.utsScore ?? body.uts_score ?? 0;
      const uas_score = body.uasScore ?? body.uas_score ?? 0;
      const final_score = body.finalScore ?? body.final_score;
      const is_override = body.isOverride ?? body.is_override ?? false;

      if (!student_id || !batch_id) {
        set.status = 400;
        return { success: false, message: 'studentId dan batchId wajib diisi.' };
      }

      if (!(await canAccessBatch(profile, batch_id))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      // Cari enrollment siswa di batch
      const [enrollment] = await db
        .select()
        .from(batchEnrollments)
        .where(
          and(
            eq(batchEnrollments.batchId, batch_id),
            eq(batchEnrollments.studentId, student_id)
          )
        )
        .limit(1);

      if (!enrollment) {
        set.status = 404;
        return { success: false, message: 'Data pendaftaran siswa di batch ini tidak ditemukan.' };
      }

      // Ambil batchCourse pertama untuk batch ini
      const [primaryBatchCourse] = await db
        .select()
        .from(batchCourses)
        .where(eq(batchCourses.batchId, batch_id))
        .limit(1);

      if (!primaryBatchCourse) {
        set.status = 404;
        return { success: false, message: 'Kurikulum batch tidak ditemukan.' };
      }

      const now = new Date();

      // Hitung evaluasi standar
      const evalResult = evaluateStudentGrades({
        tugas: tugas_score,
        quiz: quiz_score,
        uts: uts_score,
        uas: uas_score,
      });

      const finalVal =
        is_override && final_score !== undefined ? final_score : evalResult.finalScore;
      const gradeInfo = getGradeLetter(finalVal);

      // Cek apakah record sudah ada
      const [existing] = await db
        .select()
        .from(studentGrades)
        .where(
          and(
            eq(studentGrades.enrollmentId, enrollment.id),
            eq(studentGrades.batchCourseId, primaryBatchCourse.id)
          )
        )
        .limit(1);

      let result;
      if (existing) {
        const [updated] = await db
          .update(studentGrades)
          .set({
            tugasScore: tugas_score.toString(),
            quizScore: quiz_score.toString(),
            utsScore: uts_score.toString(),
            uasScore: uas_score.toString(),
            finalScore: finalVal.toString(),
            gradeLetter: gradeInfo.letter,
            isPassed: gradeInfo.isPassing,
            isOverride: is_override,
            updatedAt: now,
          })
          .where(eq(studentGrades.id, existing.id))
          .returning();
        result = updated;
      } else {
        const [inserted] = await db
          .insert(studentGrades)
          .values({
            id: uuidv7(),
            enrollmentId: enrollment.id,
            batchCourseId: primaryBatchCourse.id,
            attendanceScore: '0.00',
            tugasScore: tugas_score.toString(),
            quizScore: quiz_score.toString(),
            utsScore: uts_score.toString(),
            uasScore: uas_score.toString(),
            finalScore: finalVal.toString(),
            gradeLetter: gradeInfo.letter,
            isPassed: gradeInfo.isPassing,
            isOverride: is_override,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        result = inserted;
      }

      return {
        success: true,
        message: is_override
          ? 'Nilai override berhasil ditetapkan.'
          : 'Nilai berhasil dikembalikan ke kalkulasi otomatis.',
        data: {
          ...result,
          evaluation: {
            finalScore: finalVal,
            gradeLetter: gradeInfo.letter,
            gradePoint: gradeInfo.point,
            predicate: gradeInfo.predicate,
            isPassing: gradeInfo.isPassing,
          },
        },
      };
    },
    {
      body: t.Object({
        studentId: t.Optional(t.String()),
        student_id: t.Optional(t.String()),
        batchId: t.Optional(t.String()),
        batch_id: t.Optional(t.String()),
        tugasScore: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        tugas_score: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        quizScore: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        quiz_score: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        utsScore: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        uts_score: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        uasScore: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        uas_score: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        finalScore: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        final_score: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        isOverride: t.Optional(t.Boolean()),
        is_override: t.Optional(t.Boolean()),
      }),
    }
  );
