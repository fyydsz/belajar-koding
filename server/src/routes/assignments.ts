import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import {
  assignments,
  assignmentSubmissions,
  courses,
  batches,
  batchCourses,
  batchEnrollments,
  profiles,
  courseSessions,
  studentGrades,
  user as userTable,
} from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';
import { supabaseAdmin } from '../lib/supabase';
import { evaluateStudentGrades } from '../lib/grades';
import {
  canAccessBatch,
  getAccessibleBatchIds,
  getBatchIdByAssignment,
  getBatchIdByBatchCourse,
} from '../lib/access';

// Helper sinkronisasi nilai otomatis ke SIAKAD (studentGrades)
async function recalculateAndSyncStudentGrade(
  studentId: string,
  batchCourseId: string
) {
  // Ambil semua submission siswa untuk batchCourse ini yang sudah dinilai
  const gradedRows = await db
    .select({
      submissionGrade: assignmentSubmissions.grade,
      assignmentType: assignments.type,
    })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .where(
      and(
        eq(assignmentSubmissions.studentId, studentId),
        eq(assignments.batchCourseId, batchCourseId)
      )
    );

  const tugasScores: number[] = [];
  const quizScores: number[] = [];
  let utsScore = 0;
  let uasScore = 0;

  for (const row of gradedRows) {
    if (!row.submissionGrade) continue;
    const val = parseFloat(row.submissionGrade);
    if (isNaN(val)) continue;

    if (row.assignmentType === 'tugas') {
      tugasScores.push(val);
    } else if (row.assignmentType === 'quiz') {
      quizScores.push(val);
    } else if (row.assignmentType === 'uts') {
      utsScore = val;
    } else if (row.assignmentType === 'uas') {
      uasScore = val;
    }
  }

  const avgTugas =
    tugasScores.length > 0
      ? Math.round((tugasScores.reduce((a, b) => a + b, 0) / tugasScores.length) * 100) / 100
      : 0;
  const avgQuiz =
    quizScores.length > 0
      ? Math.round((quizScores.reduce((a, b) => a + b, 0) / quizScores.length) * 100) / 100
      : 0;

  // Cari batchId dari batchCourse
  const [batchCourse] = await db
    .select({ batchId: batchCourses.batchId })
    .from(batchCourses)
    .where(eq(batchCourses.id, batchCourseId))
    .limit(1);

  if (!batchCourse) return;

  // Cari enrollment siswa di batch tersebut
  const [enrollment] = await db
    .select({ id: batchEnrollments.id })
    .from(batchEnrollments)
    .where(
      and(
        eq(batchEnrollments.batchId, batchCourse.batchId),
        eq(batchEnrollments.studentId, studentId)
      )
    )
    .limit(1);

  if (!enrollment) return;

  // Cek apakah ada record nilai yang sudah ada
  const [existingGrade] = await db
    .select()
    .from(studentGrades)
    .where(
      and(
        eq(studentGrades.enrollmentId, enrollment.id),
        eq(studentGrades.batchCourseId, batchCourseId)
      )
    )
    .limit(1);

  const evalResult = evaluateStudentGrades({
    tugas: avgTugas,
    quiz: avgQuiz,
    uts: utsScore,
    uas: uasScore,
  });

  const now = new Date();

  if (existingGrade) {
    if (existingGrade.isOverride) {
      // Jika di-override, perbarui komponen nilai mentah saja
      await db
        .update(studentGrades)
        .set({
          tugasScore: avgTugas.toString(),
          quizScore: avgQuiz.toString(),
          utsScore: utsScore.toString(),
          uasScore: uasScore.toString(),
          updatedAt: now,
        })
        .where(eq(studentGrades.id, existingGrade.id));
    } else {
      // Jika tidak di-override, perbarui seluruh nilai & huruf mutu
      await db
        .update(studentGrades)
        .set({
          tugasScore: avgTugas.toString(),
          quizScore: avgQuiz.toString(),
          utsScore: utsScore.toString(),
          uasScore: uasScore.toString(),
          finalScore: evalResult.finalScore.toString(),
          gradeLetter: evalResult.gradeLetter,
          isPassed: evalResult.isPassing,
          updatedAt: now,
        })
        .where(eq(studentGrades.id, existingGrade.id));
    }
  } else {
    // Buat record nilai baru di SIAKAD
    await db.insert(studentGrades).values({
      id: uuidv7(),
      enrollmentId: enrollment.id,
      batchCourseId,
      attendanceScore: '0.00',
      tugasScore: avgTugas.toString(),
      quizScore: avgQuiz.toString(),
      utsScore: utsScore.toString(),
      uasScore: uasScore.toString(),
      finalScore: evalResult.finalScore.toString(),
      gradeLetter: evalResult.gradeLetter,
      isPassed: evalResult.isPassing,
      isOverride: false,
    });
  }
}

export const assignmentRoutes = new Elysia({ prefix: '/v1/assignments' })
  .use(authPlugin)

  // 1. Upload File Tugas (Zip, PDF, Tar.gz maks 50MB) ke Supabase Storage
  .post(
    '/upload',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
      }

      const file = body.file as File;
      if (!file) {
        set.status = 400;
        return { success: false, message: 'File wajib disertakan.' };
      }

      const MAX_SIZE = 50 * 1024 * 1024; // 50MB
      if (file.size > MAX_SIZE) {
        set.status = 400;
        return { success: false, message: 'Ukuran file melebihi batas 50MB.' };
      }

      const fileName = file.name || 'submission.zip';
      const ext = fileName.split('.').pop()?.toLowerCase();
      const allowedExts = ['zip', 'rar', 'tar', 'gz', '7z', 'pdf'];

      if (!ext || !allowedExts.includes(ext)) {
        set.status = 400;
        return {
          success: false,
          message: 'Format file tidak didukung. Harap unggah berkas arsip (ZIP, RAR, 7Z, TAR.GZ) atau PDF.',
        };
      }

      const uniqueFileName = `${user.id}/${Date.now()}-${uuidv7().slice(0, 8)}.${ext}`;
      const buffer = await file.arrayBuffer();

      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(uniqueFileName, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (error) {
        set.status = 500;
        return { success: false, message: `Gagal mengunggah file ke storage: ${error.message}` };
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('submissions')
        .getPublicUrl(data.path);

      return {
        success: true,
        message: 'File tugas berhasil diunggah.',
        url: publicUrlData.publicUrl,
      };
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  )

  // 2. Ambil Semua Penugasan (dengan info batch, tipe, dan status submission siswa)
  .get('/', async ({ user, profile, query, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
    }

    const { batch_id, type } = query;
    const accessibleBatchIds = await getAccessibleBatchIds(profile);

    const queryBuilder = db
      .select({
        id: assignments.id,
        batchCourseId: assignments.batchCourseId,
        courseId: courses.id,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        batchId: batches.id,
        batchName: batches.name,
        type: assignments.type,
        sessionId: assignments.sessionId,
        sessionNumber: courseSessions.sessionNumber,
        sessionTitle: courseSessions.title,
        title: assignments.title,
        description: assignments.description,
        createdAt: assignments.createdAt,
        expiredAt: assignments.expiredAt,
      })
      .from(assignments)
      .innerJoin(batchCourses, eq(assignments.batchCourseId, batchCourses.id))
      .innerJoin(courses, eq(batchCourses.courseId, courses.id))
      .innerJoin(batches, eq(batchCourses.batchId, batches.id))
      .leftJoin(courseSessions, eq(assignments.sessionId, courseSessions.id))
      .orderBy(desc(assignments.createdAt));

    const rows = await queryBuilder;

    // Filter hanya batch yang boleh diakses user
    let filteredRows =
      accessibleBatchIds === 'all'
        ? rows
        : rows.filter((r) => accessibleBatchIds.includes(r.batchId));
    if (batch_id) {
      filteredRows = filteredRows.filter((r) => r.batchId === batch_id);
    }
    if (type) {
      filteredRows = filteredRows.filter((r) => r.type === type);
    }

    // Ambil submission siswa yang sedang login
    const studentSubmissions = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.studentId, user.id));

    const submissionMap = new Map(studentSubmissions.map((s) => [s.assignmentId, s]));

    const now = new Date();
    const result = filteredRows.map((a) => {
      const sub = submissionMap.get(a.id);
      return {
        ...a,
        isExpired: new Date(a.expiredAt) < now,
        isSubmitted: !!sub,
        submission: sub
          ? {
              id: sub.id,
              repoUrl: sub.repoUrl,
              demoUrl: sub.demoUrl,
              fileUrl: sub.fileUrl,
              notes: sub.notes,
              submittedVia: sub.submittedVia,
              submittedAt: sub.submittedAt,
              grade: sub.grade,
              feedback: sub.feedback,
            }
          : null,
      };
    });

    return {
      success: true,
      data: result,
    };
  })

  // 3. (Mentor / Admin) Buat Tugas Baru
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

      const course_id = body.courseId || body.course_id;
      const batch_id = body.batchId || body.batch_id;
      const batch_course_id = body.batchCourseId || body.batch_course_id;
      const session_id = body.sessionId || body.session_id;
      const expired_at = body.expiredAt || body.expired_at;
      const { type, title, description } = body;

      if (!expired_at) {
        set.status = 400;
        return { success: false, message: 'Field expiredAt wajib diisi.' };
      }
      const expiredDate = new Date(expired_at);

      if (isNaN(expiredDate.getTime())) {
        set.status = 400;
        return { success: false, message: 'Format tanggal expired_at tidak valid.' };
      }

      const resolvedBatchId =
        batch_id || (batch_course_id ? await getBatchIdByBatchCourse(batch_course_id) : null);

      if (!resolvedBatchId || !(await canAccessBatch(profile, resolvedBatchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      let targetBatchCourseId = batch_course_id;

      if (!targetBatchCourseId && batch_id && course_id) {
        const [existing] = await db
          .select({ id: batchCourses.id })
          .from(batchCourses)
          .where(and(eq(batchCourses.batchId, batch_id), eq(batchCourses.courseId, course_id)))
          .limit(1);
        if (existing) {
          targetBatchCourseId = existing.id;
        } else {
          const newBcId = uuidv7();
          await db.insert(batchCourses).values({
            id: newBcId,
            batchId: batch_id,
            courseId: course_id,
          });
          targetBatchCourseId = newBcId;
        }
      } else if (!targetBatchCourseId && batch_id) {
        const [bc] = await db
          .select({ id: batchCourses.id })
          .from(batchCourses)
          .where(eq(batchCourses.batchId, batch_id))
          .limit(1);
        targetBatchCourseId = bc?.id;
      }

      if (!targetBatchCourseId) {
        set.status = 400;
        return { success: false, message: 'batch_course_id atau kombinasi batch_id & course_id wajib diisi.' };
      }

      const [newAssignment] = await db
        .insert(assignments)
        .values({
          id: uuidv7(),
          batchCourseId: targetBatchCourseId,
          type: (type as 'tugas' | 'quiz' | 'uts' | 'uas') || 'tugas',
          sessionId: session_id || null,
          mentorId: user.id,
          title: title.trim(),
          description: description ? description.trim() : null,
          expiredAt: expiredDate,
        })
        .returning();

      set.status = 201;
      return {
        success: true,
        message: 'Penugasan proyek berhasil dibuat.',
        data: newAssignment,
      };
    },
    {
      body: t.Object({
        course_id: t.Optional(t.String()),
        courseId: t.Optional(t.String()),
        batch_id: t.Optional(t.String()),
        batchId: t.Optional(t.String()),
        batch_course_id: t.Optional(t.String()),
        batchCourseId: t.Optional(t.String()),
        type: t.Optional(t.String()),
        session_id: t.Optional(t.String()),
        sessionId: t.Optional(t.String()),
        title: t.String({ minLength: 3 }),
        description: t.Optional(t.String()),
        expired_at: t.Optional(t.String()),
        expiredAt: t.Optional(t.String()),
      }),
    }
  )

  // 4. (Mentor / Admin) Update Tugas
  .put(
    '/:id',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const existing = await db
        .select()
        .from(assignments)
        .where(eq(assignments.id, params.id))
        .limit(1);

      if (existing.length === 0) {
        set.status = 404;
        return { success: false, message: 'Tugas tidak ditemukan.' };
      }

      const batchId = await getBatchIdByBatchCourse(existing[0].batchCourseId);
      if (!batchId || !(await canAccessBatch(profile, batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const updateData: Partial<typeof assignments.$inferInsert> = {};
      if (body.title !== undefined) updateData.title = body.title.trim();
      if (body.description !== undefined) updateData.description = body.description.trim() || null;
      if (body.type !== undefined) updateData.type = body.type as 'tugas' | 'quiz' | 'uts' | 'uas';
      if (body.session_id !== undefined) updateData.sessionId = body.session_id || null;
      if (body.expired_at !== undefined) {
        const expiredDate = new Date(body.expired_at);
        if (isNaN(expiredDate.getTime())) {
          set.status = 400;
          return { success: false, message: 'Format tanggal expired_at tidak valid.' };
        }
        updateData.expiredAt = expiredDate;
      }

      const [updated] = await db
        .update(assignments)
        .set(updateData)
        .where(eq(assignments.id, params.id))
        .returning();

      return {
        success: true,
        message: 'Tugas berhasil diperbarui.',
        data: updated,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        type: t.Optional(t.String()),
        session_id: t.Optional(t.Nullable(t.String())),
        expired_at: t.Optional(t.String()),
      }),
    }
  )

  // 5. (Mentor / Admin) Hapus Tugas
  .delete('/:id', async ({ user, profile, params, set }) => {
    if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
      set.status = 403;
      return { success: false, message: 'Akses ditolak.' };
    }

    const batchId = await getBatchIdByAssignment(params.id);
    if (!batchId) {
      set.status = 404;
      return { success: false, message: 'Tugas tidak ditemukan.' };
    }
    if (!(await canAccessBatch(profile, batchId))) {
      set.status = 403;
      return { success: false, message: 'Anda bukan mentor di batch ini.' };
    }

    const [deleted] = await db
      .delete(assignments)
      .where(eq(assignments.id, params.id))
      .returning();

    if (!deleted) {
      set.status = 404;
      return { success: false, message: 'Tugas tidak ditemukan.' };
    }

    return {
      success: true,
      message: 'Tugas berhasil dihapus.',
    };
  })

  // 6. (Siswa) Kumpulkan Tugas (Submit / Re-submit)
  .post(
    '/:id/submit',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
      }

      const [assignment] = await db
        .select()
        .from(assignments)
        .where(eq(assignments.id, params.id))
        .limit(1);

      if (!assignment) {
        set.status = 404;
        return { success: false, message: 'Tugas tidak ditemukan.' };
      }

      const batchId = await getBatchIdByBatchCourse(assignment.batchCourseId);
      if (!batchId || !(await canAccessBatch(profile, batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda tidak terdaftar pada batch tugas ini.' };
      }

      if (new Date() > new Date(assignment.expiredAt)) {
        set.status = 400;
        return {
          success: false,
          message: 'Tenggat waktu pengumpulan tugas ini telah berakhir.',
        };
      }

      const { repoUrl, demoUrl, fileUrl, notes } = body;

      if (!repoUrl && !demoUrl && !fileUrl) {
        set.status = 400;
        return {
          success: false,
          message: 'Sertakan minimal salah satu dari URL repository, demo URL, atau berkas file tugas.',
        };
      }

      // Periksa apakah sudah pernah submit (jika ya, timpa/update)
      const [existing] = await db
        .select()
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, params.id),
            eq(assignmentSubmissions.studentId, user.id)
          )
        )
        .limit(1);

      const submissionPayload = {
        repoUrl: repoUrl ? repoUrl.trim() : null,
        demoUrl: demoUrl ? demoUrl.trim() : null,
        fileUrl: fileUrl ? fileUrl.trim() : null,
        notes: notes ? notes.trim() : null,
        submittedVia: 'web',
        submittedAt: new Date(),
      };

      let result;
      if (existing) {
        const [updated] = await db
          .update(assignmentSubmissions)
          .set(submissionPayload)
          .where(eq(assignmentSubmissions.id, existing.id))
          .returning();
        result = updated;
      } else {
        const [created] = await db
          .insert(assignmentSubmissions)
          .values({
            id: uuidv7(),
            assignmentId: params.id,
            studentId: user.id,
            ...submissionPayload,
          })
          .returning();
        result = created;
        set.status = 201;
      }

      return {
        success: true,
        message: existing
          ? 'Tugas berhasil diperbarui.'
          : 'Tugas berhasil dikumpulkan.',
        data: result,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        repoUrl: t.Optional(t.String()),
        demoUrl: t.Optional(t.String()),
        fileUrl: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    }
  )

  // 7. (Mentor / Admin) Ambil Semua Submission pada Suatu Tugas
  .get('/:assignmentId/submissions', async ({ user, profile, params, set }) => {
    if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
      set.status = 403;
      return { success: false, message: 'Akses terbatas untuk mentor atau admin.' };
    }

    const batchId = await getBatchIdByAssignment(params.assignmentId);
    if (!batchId || !(await canAccessBatch(profile, batchId))) {
      set.status = 403;
      return { success: false, message: 'Anda bukan mentor di batch ini.' };
    }

    const rows = await db
      .select({
        id: assignmentSubmissions.id,
        assignmentId: assignmentSubmissions.assignmentId,
        studentId: assignmentSubmissions.studentId,
        studentName: profiles.fullName,
        studentEmail: userTable.email,
        avatarUrl: profiles.avatarUrl,
        discordUsername: userTable.discordUsername,
        repoUrl: assignmentSubmissions.repoUrl,
        demoUrl: assignmentSubmissions.demoUrl,
        fileUrl: assignmentSubmissions.fileUrl,
        notes: assignmentSubmissions.notes,
        submittedVia: assignmentSubmissions.submittedVia,
        grade: assignmentSubmissions.grade,
        feedback: assignmentSubmissions.feedback,
        submittedAt: assignmentSubmissions.submittedAt,
        gradedAt: assignmentSubmissions.gradedAt,
      })
      .from(assignmentSubmissions)
      .leftJoin(profiles, eq(assignmentSubmissions.studentId, profiles.id))
      .leftJoin(userTable, eq(assignmentSubmissions.studentId, userTable.id))
      .where(eq(assignmentSubmissions.assignmentId, params.assignmentId))
      .orderBy(desc(assignmentSubmissions.submittedAt));

    return {
      success: true,
      data: rows,
    };
  })
  .get('/submissions/:assignmentId', async ({ user, profile, params, set }) => {
    if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
      set.status = 403;
      return { success: false, message: 'Akses terbatas untuk mentor atau admin.' };
    }

    const batchId = await getBatchIdByAssignment(params.assignmentId);
    if (!batchId || !(await canAccessBatch(profile, batchId))) {
      set.status = 403;
      return { success: false, message: 'Anda bukan mentor di batch ini.' };
    }

    const rows = await db
      .select({
        id: assignmentSubmissions.id,
        assignmentId: assignmentSubmissions.assignmentId,
        studentId: assignmentSubmissions.studentId,
        studentName: profiles.fullName,
        studentEmail: userTable.email,
        avatarUrl: profiles.avatarUrl,
        discordUsername: userTable.discordUsername,
        repoUrl: assignmentSubmissions.repoUrl,
        demoUrl: assignmentSubmissions.demoUrl,
        fileUrl: assignmentSubmissions.fileUrl,
        notes: assignmentSubmissions.notes,
        submittedVia: assignmentSubmissions.submittedVia,
        grade: assignmentSubmissions.grade,
        feedback: assignmentSubmissions.feedback,
        submittedAt: assignmentSubmissions.submittedAt,
        gradedAt: assignmentSubmissions.gradedAt,
      })
      .from(assignmentSubmissions)
      .leftJoin(profiles, eq(assignmentSubmissions.studentId, profiles.id))
      .leftJoin(userTable, eq(assignmentSubmissions.studentId, userTable.id))
      .where(eq(assignmentSubmissions.assignmentId, params.assignmentId))
      .orderBy(desc(assignmentSubmissions.submittedAt));

    return {
      success: true,
      data: rows,
    };
  })

  // 8. (Mentor) Beri Nilai Submission & AUTO-SYNC Nilai SIAKAD Realtime
  .post(
    '/submissions/:id/grade',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
        set.status = 403;
        return { success: false, message: 'Hanya mentor atau admin yang dapat memberi nilai.' };
      }

      const { grade, feedback } = body;

      const [targetSub] = await db
        .select({
          id: assignmentSubmissions.id,
          assignmentId: assignmentSubmissions.assignmentId,
        })
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.id, params.id))
        .limit(1);

      if (!targetSub) {
        set.status = 404;
        return { success: false, message: 'Submission tidak ditemukan.' };
      }

      const batchId = await getBatchIdByAssignment(targetSub.assignmentId);
      if (!batchId || !(await canAccessBatch(profile, batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const [updated] = await db
        .update(assignmentSubmissions)
        .set({
          grade: grade.toString(),
          feedback: feedback ? feedback.trim() : null,
          gradedAt: new Date(),
          gradedBy: user.id,
        })
        .where(eq(assignmentSubmissions.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { success: false, message: 'Submission tidak ditemukan.' };
      }

      // Ambil assignment untuk auto-sync ke SIAKAD (studentGrades)
      const [assignmentInfo] = await db
        .select({
          batchCourseId: assignments.batchCourseId,
        })
        .from(assignments)
        .where(eq(assignments.id, updated.assignmentId))
        .limit(1);

      if (assignmentInfo) {
        try {
          await recalculateAndSyncStudentGrade(
            updated.studentId,
            assignmentInfo.batchCourseId
          );
        } catch (syncErr) {
          console.error('Gagal melakukan kalkulasi otomatis nilai SIAKAD:', syncErr);
        }
      }

      return {
        success: true,
        message: 'Nilai dan evaluasi berhasil disimpan serta disinkronkan ke transkrip nilai.',
        data: updated,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        grade: t.Number({ minimum: 0, maximum: 100 }),
        feedback: t.Optional(t.String()),
      }),
    }
  );
