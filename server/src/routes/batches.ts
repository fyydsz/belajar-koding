import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import {
  batches,
  batchCourses,
  batchMentors,
  batchEnrollments,
  enrollmentPayments,
  courses,
  profiles,
  user as userTable,
} from '../db/schema';
import { eq, and, desc, inArray, or, ilike, sql } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';
import { supabaseAdmin } from '../lib/supabase';
import { canAccessBatch, getAccessibleBatchIds, isStaff } from '../lib/access';
import { sniffFile } from '../lib/security';

function batchEnrollmentStatus(status: unknown) {
  return typeof status === 'string' ? status : 'active';
}

async function enrichBatchesWithRelations<
  T extends {
    id: string;
    code?: string;
    name: string;
    description?: string | null;
    price: string;
    paymentAccountInfo?: string | null;
    maxStudents: number;
    enrolledCount?: number;
    startDate?: Date | null;
    endDate?: Date | null;
    status: string;
    createdAt?: Date;
  },
>(rawBatches: T[]) {
  if (rawBatches.length === 0) return [];

  const batchIds = rawBatches.map((b) => b.id);

  const [courseRows, mentorRows, activeEnrollmentRows] = await Promise.all([
    db
      .select({
        batchId: batchCourses.batchId,
        courseId: courses.id,
        title: courses.title,
        slug: courses.slug,
      })
      .from(batchCourses)
      .innerJoin(courses, eq(batchCourses.courseId, courses.id))
      .where(inArray(batchCourses.batchId, batchIds)),
    db
      .select({
        batchId: batchMentors.batchId,
        mentorId: profiles.id,
        fullName: profiles.fullName,
        email: userTable.email,
        isLead: batchMentors.isLead,
      })
      .from(batchMentors)
      .innerJoin(profiles, eq(batchMentors.mentorId, profiles.id))
      .leftJoin(userTable, eq(profiles.id, userTable.id))
      .where(inArray(batchMentors.batchId, batchIds)),
    db
      .select({
        batchId: batchEnrollments.batchId,
        id: batchEnrollments.id,
      })
      .from(batchEnrollments)
      .where(
        and(
          inArray(batchEnrollments.batchId, batchIds),
          eq(batchEnrollments.status, 'active')
        )
      ),
  ]);

  const coursesByBatch = new Map<string, Array<{ id: string; title: string; slug: string }>>();
  for (const row of courseRows) {
    const list = coursesByBatch.get(row.batchId) || [];
    if (!list.some((c) => c.id === row.courseId)) {
      list.push({ id: row.courseId, title: row.title, slug: row.slug });
    }
    coursesByBatch.set(row.batchId, list);
  }

  const mentorsByBatch = new Map<string, Array<{ id: string; fullName: string; email: string; isLead: boolean }>>();
  for (const row of mentorRows) {
    const list = mentorsByBatch.get(row.batchId) || [];
    if (!list.some((m) => m.id === row.mentorId)) {
      list.push({ id: row.mentorId, fullName: row.fullName, email: row.email || '', isLead: row.isLead });
    }
    mentorsByBatch.set(row.batchId, list);
  }

  const countByBatch = new Map<string, number>();
  for (const row of activeEnrollmentRows) {
    countByBatch.set(row.batchId, (countByBatch.get(row.batchId) || 0) + 1);
  }

  return rawBatches.map((b) => {
    const batchCoursesList = coursesByBatch.get(b.id) || [];
    const batchMentorsList = mentorsByBatch.get(b.id) || [];

    return {
      ...b,
      courseId: batchCoursesList[0]?.id || null,
      courseTitle: batchCoursesList.map((c) => c.title).join(', '),
      courseSlug: batchCoursesList[0]?.slug || '',
      courses: batchCoursesList,
      courseIds: batchCoursesList.map((c) => c.id),
      mentorId: batchMentorsList[0]?.id || null,
      mentorName: batchMentorsList.map((m) => m.fullName).join(', '),
      mentors: batchMentorsList,
      mentorIds: batchMentorsList.map((m) => m.id),
      studentCount: countByBatch.get(b.id) || 0,
    };
  });
}

export const batchRoutes = new Elysia({ prefix: '/v1/batches' })
  .use(authPlugin)

  // 1. Ambil semua batch (dengan info kursus, mentor, harga, rekening, dan jumlah siswa aktif)
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const allBatches = await db
      .select({
        id: batches.id,
        code: batches.code,
        name: batches.name,
        description: batches.description,
        price: batches.price,
        paymentAccountInfo: batches.paymentAccountInfo,
        maxStudents: batches.maxStudents,
        enrolledCount: batches.enrolledCount,
        startDate: batches.startDate,
        endDate: batches.endDate,
        status: batches.status,
        createdAt: batches.createdAt,
      })
      .from(batches)
      .where(sql`${batches.deletedAt} IS NULL`)
      .orderBy(desc(batches.createdAt));

    const enrichedBatches = await enrichBatchesWithRelations(allBatches);

    return {
      success: true,
      data: enrichedBatches,
    };
  })

  // 2. Ambil kelas aktif milik user (sesuai peran: siswa atau mentor)
  .get('/my-batches', async ({ user, profile, set }) => {
    if (!user || !profile) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    if (profile.role === 'mentor' || profile.role === 'admin') {
      let mentorBatchIds: string[] = [];
      if (profile.role === 'mentor') {
        const assignedRows = await db
          .select({ batchId: batchMentors.batchId })
          .from(batchMentors)
          .where(eq(batchMentors.mentorId, profile.id));
        mentorBatchIds = assignedRows.map((r) => r.batchId);
      }

      const mentorBatches = await db
        .select({
          id: batches.id,
          code: batches.code,
          name: batches.name,
          description: batches.description,
          price: batches.price,
          paymentAccountInfo: batches.paymentAccountInfo,
          maxStudents: batches.maxStudents,
          enrolledCount: batches.enrolledCount,
          startDate: batches.startDate,
          endDate: batches.endDate,
          status: batches.status,
          createdAt: batches.createdAt,
        })
        .from(batches)
        .where(
          and(
            sql`${batches.deletedAt} IS NULL`,
            profile.role === 'admin'
              ? undefined
              : mentorBatchIds.length > 0
              ? inArray(batches.id, mentorBatchIds)
              : sql`false`
          )
        )
        .orderBy(desc(batches.createdAt));

      const enrichedMentorBatches = await enrichBatchesWithRelations(mentorBatches);

      return { success: true, data: enrichedMentorBatches };
    }

    // Role Student: ambil batch yang di-enroll siswa beserta pembayaran
    const studentEnrollments = await db
      .select({
        enrollmentId: batchEnrollments.id,
        batchId: batchEnrollments.batchId,
        batchCode: batches.code,
        batchName: batches.name,
        batchDescription: batches.description,
        batchPrice: batches.price,
        paymentAccountInfo: batches.paymentAccountInfo,
        batchStatus: batches.status,
        status: batchEnrollments.status,
        notes: batchEnrollments.notes,
        enrolledAt: batchEnrollments.enrolledAt,
        courseId: courses.id,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        paymentProofUrl: enrollmentPayments.proofUrl,
        paymentStatus: enrollmentPayments.status,
        rejectedReason: enrollmentPayments.rejectionReason,
        verifiedAt: enrollmentPayments.verifiedAt,
      })
      .from(batchEnrollments)
      .innerJoin(batches, eq(batchEnrollments.batchId, batches.id))
      .leftJoin(batchCourses, eq(batches.id, batchCourses.batchId))
      .leftJoin(courses, eq(batchCourses.courseId, courses.id))
      .leftJoin(enrollmentPayments, eq(batchEnrollments.id, enrollmentPayments.enrollmentId))
      .where(eq(batchEnrollments.studentId, profile.id))
      .orderBy(desc(batchEnrollments.enrolledAt));

    return { success: true, data: studentEnrollments };
  })

  // 3. Upload File Bukti Pembayaran (PNG, JPG, PDF maks 5MB)
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
        return { success: false, message: 'Berkas bukti pembayaran tidak ditemukan dalam formulir.' };
      }

      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        set.status = 400;
        return { success: false, message: 'Ukuran file bukti pembayaran melebihi batas 5MB.' };
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
          message: 'Format berkas tidak didukung. Harap unggah gambar (PNG, JPG, WEBP) atau berkas PDF.',
        };
      }

      const uniqueFileName = `payments/${user.id}/${Date.now()}-${uuidv7().slice(0, 8)}.${detected.ext}`;

      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(uniqueFileName, buffer, {
          contentType: detected.mime,
          upsert: false,
        });

      if (error) {
        set.status = 500;
        return { success: false, message: `Gagal menyimpan berkas ke storage: ${error.message}` };
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('submissions')
        .getPublicUrl(data.path);

      return {
        success: true,
        message: 'Bukti pembayaran berhasil diunggah.',
        url: publicUrlData.publicUrl,
      };
    },
    {
      body: t.Object({
        file: t.Any(),
      }),
    }
  )

  // 4. Mahasiswa: Mendaftar ke Batch (Self-Enrollment dengan Bukti Transfer)
  .post(
    '/:batchId/register',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const [batch] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, params.batchId))
        .limit(1);

      if (!batch) {
        set.status = 404;
        return { success: false, message: 'Batch perkuliahan tidak ditemukan.' };
      }

      if (batch.status !== 'open' && (batch.status as string) !== 'active') {
        set.status = 400;
        return { success: false, message: 'Pendaftaran untuk batch ini sedang tidak dibuka.' };
      }

      // Periksa kuota batch
      if (batch.enrolledCount >= batch.maxStudents) {
        set.status = 400;
        return { success: false, message: 'Kuota pendaftaran batch ini telah terpenuhi.' };
      }

      // Periksa pendaftaran sebelumnya
      const [existing] = await db
        .select()
        .from(batchEnrollments)
        .where(
          and(
            eq(batchEnrollments.batchId, params.batchId),
            eq(batchEnrollments.studentId, profile.id)
          )
        )
        .limit(1);

      let enrollmentId = existing?.id;

      if (existing) {
        if (existing.status === 'active') {
          set.status = 400;
          return { success: false, message: 'Anda sudah aktif terdaftar dalam batch ini.' };
        }
        if (existing.status === 'pending') {
          set.status = 400;
          return {
            success: false,
            message: 'Pendaftaran Anda untuk batch ini sedang menunggu verifikasi oleh Dosen/Admin.',
          };
        }
      }

      await db.transaction(async (tx) => {
        if (existing) {
          // Jika sebelumnya ditolak/dropped, ajukan ulang dengan bukti transfer baru
          await tx
            .update(batchEnrollments)
            .set({
              status: 'pending',
              notes: body.notes ? body.notes.trim() : null,
              enrolledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(batchEnrollments.id, existing.id));
        } else {
          enrollmentId = uuidv7();
          await tx.insert(batchEnrollments).values({
            id: enrollmentId,
            batchId: params.batchId,
            studentId: profile.id,
            status: 'pending',
            notes: body.notes ? body.notes.trim() : null,
            enrolledAt: new Date(),
          });
        }

        // Catat histori bukti bayar di enrollmentPayments jika dilampirkan
        if (body.paymentProofUrl && enrollmentId) {
          await tx.insert(enrollmentPayments).values({
            id: uuidv7(),
            enrollmentId,
            amount: batch.price,
            paymentMethod: 'manual_transfer',
            proofUrl: body.paymentProofUrl,
            status: 'pending',
          });
        }
      });

      set.status = 201;
      return {
        success: true,
        message: 'Pendaftaran batch berhasil diajukan dan sedang menunggu verifikasi pembayaran.',
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
      body: t.Object({
        paymentProofUrl: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    }
  )

  // 5. Mahasiswa: Unggah Ulang Bukti Pembayaran untuk Batch yang Ditolak
  .put(
    '/:batchId/re-upload',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const [batch] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, params.batchId))
        .limit(1);

      const [existing] = await db
        .select()
        .from(batchEnrollments)
        .where(
          and(
            eq(batchEnrollments.batchId, params.batchId),
            eq(batchEnrollments.studentId, profile.id)
          )
        )
        .limit(1);

      if (!existing || !batch) {
        set.status = 404;
        return { success: false, message: 'Data pendaftaran tidak ditemukan.' };
      }

      await db.transaction(async (tx) => {
        await tx
          .update(batchEnrollments)
          .set({
            status: 'pending',
            notes: body.notes ? body.notes.trim() : existing.notes,
            enrolledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(batchEnrollments.id, existing.id));

        await tx.insert(enrollmentPayments).values({
          id: uuidv7(),
          enrollmentId: existing.id,
          amount: batch.price,
          paymentMethod: 'manual_transfer',
          proofUrl: body.paymentProofUrl,
          status: 'pending',
        });
      });

      return {
        success: true,
        message: 'Bukti pembayaran berhasil diunggah ulang dan sedang ditinjau.',
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
      body: t.Object({
        paymentProofUrl: t.String({ minLength: 5 }),
        notes: t.Optional(t.String()),
      }),
    }
  )

  // 6. Mentor / Admin: Ambil Semua Pendaftaran Pending
  .get(
    '/pending-enrollments',
    async ({ user, profile, query, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Hanya Admin atau Mentor yang dapat mengakses halaman ini.' };
      }

      const statusFilter = query.status || 'pending';

      const baseQuery = db
        .select({
          id: batchEnrollments.id,
          batchId: batchEnrollments.batchId,
          batchCode: batches.code,
          batchName: batches.name,
          batchPrice: batches.price,
          paymentAccountInfo: batches.paymentAccountInfo,
          courseId: courses.id,
          courseTitle: courses.title,
          courseSlug: courses.slug,
          studentId: profiles.id,
          studentName: profiles.fullName,
          studentEmail: userTable.email,
          studentAvatarUrl: profiles.avatarUrl,
          studentDiscord: userTable.discordUsername,
          status: batchEnrollments.status,
          notes: batchEnrollments.notes,
          enrolledAt: batchEnrollments.enrolledAt,
        })
        .from(batchEnrollments)
        .innerJoin(profiles, eq(batchEnrollments.studentId, profiles.id))
        .leftJoin(userTable, eq(profiles.id, userTable.id))
        .innerJoin(batches, eq(batchEnrollments.batchId, batches.id))
        .leftJoin(batchCourses, eq(batches.id, batchCourses.batchId))
        .leftJoin(courses, eq(batchCourses.courseId, courses.id))
        .orderBy(desc(batchEnrollments.enrolledAt));

      let rows;
      if (statusFilter === 'all') {
        rows = await baseQuery;
      } else {
        rows = await baseQuery.where(eq(batchEnrollments.status, statusFilter as any));
      }

      const accessibleBatchIds = await getAccessibleBatchIds(profile);
      const visibleRows =
        accessibleBatchIds === 'all'
          ? rows
          : rows.filter((r) => accessibleBatchIds.includes(r.batchId));

      return {
        success: true,
        data: visibleRows,
      };
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
      }),
    }
  )

  // 7. Mentor / Admin: Setujui Pendaftaran Mahasiswa (Approve)
  .put(
    '/enrollments/:enrollmentId/approve',
    async ({ user, profile, params, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const [existingEnrollment] = await db
        .select()
        .from(batchEnrollments)
        .where(eq(batchEnrollments.id, params.enrollmentId))
        .limit(1);

      if (!existingEnrollment) {
        set.status = 404;
        return { success: false, message: 'Data pendaftaran tidak ditemukan.' };
      }

      if (!(await canAccessBatch(profile, existingEnrollment.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(batchEnrollments)
          .set({
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(batchEnrollments.id, params.enrollmentId))
          .returning();

        await tx
          .update(enrollmentPayments)
          .set({
            status: 'verified',
            verifiedAt: new Date(),
            verifiedBy: profile.id,
          })
          .where(eq(enrollmentPayments.enrollmentId, params.enrollmentId));

        if (existingEnrollment.status !== 'active') {
          await tx
            .update(batches)
            .set({
              enrolledCount: sql`${batches.enrolledCount} + 1`,
            })
            .where(eq(batches.id, existingEnrollment.batchId));
        }

        return row;
      });

      return {
        success: true,
        message: 'Pendaftaran batch berhasil disetujui. Akses materi kelas mahasiswa telah terbuka.',
        data: updated,
      };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
    }
  )

  // 8. Mentor / Admin: Tolak Pendaftaran Mahasiswa (Reject dengan Alasan)
  .put(
    '/enrollments/:enrollmentId/reject',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const reason = body.reason.trim();
      if (!reason) {
        set.status = 400;
        return { success: false, message: 'Alasan penolakan pembayaran wajib dicantumkan.' };
      }

      const [existingEnrollment] = await db
        .select()
        .from(batchEnrollments)
        .where(eq(batchEnrollments.id, params.enrollmentId))
        .limit(1);

      if (!existingEnrollment) {
        set.status = 404;
        return { success: false, message: 'Data pendaftaran tidak ditemukan.' };
      }

      if (!(await canAccessBatch(profile, existingEnrollment.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(batchEnrollments)
          .set({
            status: 'rejected',
            updatedAt: new Date(),
          })
          .where(eq(batchEnrollments.id, params.enrollmentId))
          .returning();

        await tx
          .update(enrollmentPayments)
          .set({
            status: 'rejected',
            rejectionReason: reason,
            verifiedAt: new Date(),
            verifiedBy: profile.id,
          })
          .where(eq(enrollmentPayments.enrollmentId, params.enrollmentId));

        if (existingEnrollment.status === 'active') {
          await tx
            .update(batches)
            .set({
              enrolledCount: sql`GREATEST(0, ${batches.enrolledCount} - 1)`,
            })
            .where(eq(batches.id, existingEnrollment.batchId));
        }

        return row;
      });

      return {
        success: true,
        message: 'Pendaftaran batch telah ditolak.',
        data: updated,
      };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      body: t.Object({
        reason: t.String({ minLength: 3 }),
      }),
    }
  )

  // 9. Kolom Siswa (Students Pool) untuk dipilih saat mendaftarkan siswa manual
  .get(
    '/students-pool',
    async ({ user, profile, query, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const search = query.search ? query.search.trim() : '';

      const students = await db
        .select({
          id: profiles.id,
          fullName: profiles.fullName,
          email: userTable.email,
          role: userTable.role,
          avatarUrl: profiles.avatarUrl,
          discordUsername: userTable.discordUsername,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .innerJoin(userTable, eq(profiles.id, userTable.id))
        .where(
          search
            ? and(
                eq(userTable.role, 'student'),
                or(
                  ilike(profiles.fullName, `%${search}%`),
                  ilike(userTable.email, `%${search}%`)
                )
              )
            : eq(userTable.role, 'student')
        )
        .orderBy(desc(profiles.createdAt));

      return {
        success: true,
        data: students,
      };
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
      }),
    }
  )

  // 10. Kolom Mentor (Mentors Pool) untuk dipilih saat membuat batch
  .get('/mentors-pool', async ({ user, profile, set }) => {
    if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
      set.status = 403;
      return { success: false, message: 'Akses ditolak.' };
    }

    const mentors = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: userTable.email,
        avatarUrl: profiles.avatarUrl,
        role: userTable.role,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .innerJoin(userTable, eq(profiles.id, userTable.id))
      .where(or(eq(userTable.role, 'mentor'), eq(userTable.role, 'admin')))
      .orderBy(profiles.fullName);

    return {
      success: true,
      data: mentors,
    };
  })

  // 11. (Admin / Mentor) Detail Batch Lengkap beserta Seluruh Siswa Terdaftar
  .get(
    '/:batchId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      if (!isStaff(profile.role) || !(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      const [batch] = await db
        .select({
          id: batches.id,
          code: batches.code,
          name: batches.name,
          description: batches.description,
          price: batches.price,
          paymentAccountInfo: batches.paymentAccountInfo,
          maxStudents: batches.maxStudents,
          enrolledCount: batches.enrolledCount,
          startDate: batches.startDate,
          endDate: batches.endDate,
          status: batches.status,
          createdAt: batches.createdAt,
        })
        .from(batches)
        .where(eq(batches.id, params.batchId))
        .limit(1);

      if (!batch) {
        set.status = 404;
        return { success: false, message: 'Batch tidak ditemukan.' };
      }

      const [enriched] = await enrichBatchesWithRelations([batch]);

      const enrolledStudents = await db
        .select({
          enrollmentId: batchEnrollments.id,
          studentId: profiles.id,
          fullName: profiles.fullName,
          email: userTable.email,
          avatarUrl: profiles.avatarUrl,
          discordUsername: userTable.discordUsername,
          status: batchEnrollments.status,
          enrolledAt: batchEnrollments.enrolledAt,
        })
        .from(batchEnrollments)
        .innerJoin(profiles, eq(batchEnrollments.studentId, profiles.id))
        .leftJoin(userTable, eq(profiles.id, userTable.id))
        .where(eq(batchEnrollments.batchId, batch.id))
        .orderBy(desc(batchEnrollments.enrolledAt));

      return {
        success: true,
        data: {
          ...enriched,
          students: enrolledStudents,
        },
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
    }
  )

  // 12. (Admin / Mentor) Buat Batch Baru (Multi-Mata Kuliah & Multi-Mentor)
  .post(
    '/',
    async ({ user, profile, body, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Hanya Admin atau Mentor yang dapat membuat batch.' };
      }

      const {
        code,
        courseId,
        courseIds,
        name,
        description,
        price,
        paymentAccountInfo,
        maxStudents,
        mentorId,
        mentorIds,
        startDate,
        endDate,
      } = body;

      const resolvedCourseIds = Array.from(
        new Set(
          courseIds && courseIds.length > 0
            ? courseIds.filter(Boolean)
            : courseId
            ? [courseId]
            : []
        )
      );

      if (resolvedCourseIds.length === 0) {
        set.status = 400;
        return { success: false, message: 'Pilih minimal satu mata kuliah untuk batch ini.' };
      }

      const resolvedMentorIds = Array.from(
        new Set(
          mentorIds && mentorIds.length > 0
            ? mentorIds.filter(Boolean)
            : mentorId
            ? [mentorId]
            : [profile.id]
        )
      );

      const newBatchId = uuidv7();
      const batchCode = code ? code.trim().toUpperCase() : `BK-${newBatchId.slice(0, 8).toUpperCase()}`;

      const newBatch = await db.transaction(async (tx) => {
        const [createdBatch] = await tx
          .insert(batches)
          .values({
            id: newBatchId,
            code: batchCode,
            name: name.trim(),
            description: description ? description.trim() : null,
            price: price !== undefined ? String(price) : '0.00',
            paymentAccountInfo: paymentAccountInfo ? paymentAccountInfo.trim() : null,
            maxStudents: maxStudents || 30,
            enrolledCount: 0,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            status: 'open',
          })
          .returning();

        await tx
          .insert(batchCourses)
          .values(
            resolvedCourseIds.map((cId) => ({
              id: uuidv7(),
              batchId: createdBatch.id,
              courseId: cId,
              weightAttendance: '10.00',
              weightTugas: '20.00',
              weightQuiz: '20.00',
              weightUts: '20.00',
              weightUas: '30.00',
              passingScore: '70.00',
            }))
          )
          .onConflictDoNothing();

        await tx
          .insert(batchMentors)
          .values(
            resolvedMentorIds.map((mId, index) => ({
              id: uuidv7(),
              batchId: createdBatch.id,
              mentorId: mId,
              isLead: index === 0,
            }))
          )
          .onConflictDoNothing();

        return createdBatch;
      });

      set.status = 201;
      return {
        success: true,
        message: 'Batch kelas berhasil dibuat.',
        data: newBatch,
      };
    },
    {
      body: t.Object({
        code: t.Optional(t.String()),
        courseId: t.Optional(t.String()),
        courseIds: t.Optional(t.Array(t.String())),
        name: t.String({ minLength: 2 }),
        description: t.Optional(t.String()),
        price: t.Optional(t.Union([t.Number(), t.String()])),
        paymentAccountInfo: t.Optional(t.String()),
        maxStudents: t.Optional(t.Integer({ minimum: 1, maximum: 500 })),
        mentorId: t.Optional(t.String()),
        mentorIds: t.Optional(t.Array(t.String())),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
    }
  )

  // 13. (Admin / Mentor) Daftarkan / Plot Siswa Manual ke Batch
  .post(
    '/:batchId/enroll',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Hanya Admin atau Mentor yang dapat mendaftarkan siswa.' };
      }

      if (!(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const { studentIds } = body;

      if (!studentIds || studentIds.length === 0) {
        set.status = 400;
        return { success: false, message: 'Daftar ID siswa tidak boleh kosong.' };
      }

      const records = studentIds.map((studentId) => ({
        id: uuidv7(),
        batchId: params.batchId,
        studentId,
        status: 'active' as const,
        enrolledAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(batchEnrollments)
          .values(records)
          .onConflictDoNothing()
          .returning({ id: batchEnrollments.id });

        if (inserted.length > 0) {
          await tx
            .update(batches)
            .set({
              enrolledCount: sql`${batches.enrolledCount} + ${inserted.length}`,
            })
            .where(eq(batches.id, params.batchId));
        }
      });

      return {
        success: true,
        message: `${records.length} siswa berhasil didaftarkan ke batch.`,
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
      body: t.Object({
        studentIds: t.Array(t.String()),
      }),
    }
  )

  // 14. (Admin / Mentor) Hapus / Unenroll Siswa dari Batch
  .delete(
    '/:batchId/enroll/:studentId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Akses ditolak.' };
      }

      if (!(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      await db.transaction(async (tx) => {
        const deleted = await tx
          .delete(batchEnrollments)
          .where(
            and(
              eq(batchEnrollments.batchId, params.batchId),
              eq(batchEnrollments.studentId, params.studentId)
            )
          )
          .returning({ status: batchEnrollments.status });

        if (deleted.some((d) => d.status === 'active')) {
          await tx
            .update(batches)
            .set({
              enrolledCount: sql`GREATEST(0, ${batches.enrolledCount} - 1)`,
            })
            .where(eq(batches.id, params.batchId));
        }
      });

      return {
        success: true,
        message: 'Siswa berhasil dikeluarkan dari batch.',
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
        studentId: t.String(),
      }),
    }
  )

  // 15. (Admin / Mentor) Edit / Perbarui Batch Kelas (Multi-Mata Kuliah & Multi-Mentor)
  .put(
    '/:batchId',
    async ({ user, profile, params, body, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Hanya Admin atau Mentor yang dapat mengubah data batch.' };
      }

      if (!(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const [existing] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, params.batchId))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { success: false, message: 'Batch kelas tidak ditemukan.' };
      }

      const {
        code,
        courseId,
        courseIds,
        name,
        description,
        price,
        paymentAccountInfo,
        maxStudents,
        mentorId,
        mentorIds,
        startDate,
        endDate,
        status,
      } = body;

      const resolvedCourseIds =
        courseIds && courseIds.length > 0
          ? Array.from(new Set(courseIds.filter(Boolean)))
          : courseId
          ? [courseId]
          : null;

      const resolvedMentorIds =
        mentorIds !== undefined
          ? Array.from(new Set(mentorIds.filter(Boolean)))
          : mentorId
          ? [mentorId]
          : null;

      const resolvedStatus = status === 'active' ? 'open' : (status as any) || existing.status;

      const updatedBatch = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(batches)
          .set({
            code: code ? code.trim().toUpperCase() : existing.code,
            name: name ? name.trim() : existing.name,
            description: description !== undefined ? (description.trim() || null) : existing.description,
            price: price !== undefined ? String(price) : existing.price,
            paymentAccountInfo:
              paymentAccountInfo !== undefined
                ? paymentAccountInfo.trim() || null
                : existing.paymentAccountInfo,
            maxStudents: maxStudents !== undefined ? Number(maxStudents) : existing.maxStudents,
            startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate,
            endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate,
            status: resolvedStatus,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, params.batchId))
          .returning();

        if (resolvedCourseIds && resolvedCourseIds.length > 0) {
          await tx.delete(batchCourses).where(eq(batchCourses.batchId, params.batchId));
          await tx
            .insert(batchCourses)
            .values(
              resolvedCourseIds.map((cId) => ({
                id: uuidv7(),
                batchId: params.batchId,
                courseId: cId,
                weightAttendance: '10.00',
                weightTugas: '20.00',
                weightQuiz: '20.00',
                weightUts: '20.00',
                weightUas: '30.00',
                passingScore: '70.00',
              }))
            )
            .onConflictDoNothing();
        }

        if (resolvedMentorIds !== null) {
          await tx.delete(batchMentors).where(eq(batchMentors.batchId, params.batchId));
          await tx
            .insert(batchMentors)
            .values(
              resolvedMentorIds.map((mId, index) => ({
                id: uuidv7(),
                batchId: params.batchId,
                mentorId: mId,
                isLead: index === 0,
              }))
            )
            .onConflictDoNothing();
        }

        return updated;
      });

      return {
        success: true,
        message: 'Data batch kelas berhasil diperbarui.',
        data: updatedBatch,
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
      body: t.Object({
        code: t.Optional(t.String()),
        courseId: t.Optional(t.String()),
        courseIds: t.Optional(t.Array(t.String())),
        name: t.Optional(t.String({ minLength: 2 })),
        description: t.Optional(t.String()),
        price: t.Optional(t.Union([t.Number(), t.String()])),
        paymentAccountInfo: t.Optional(t.String()),
        maxStudents: t.Optional(t.Integer({ minimum: 1, maximum: 500 })),
        mentorId: t.Optional(t.String()),
        mentorIds: t.Optional(t.Array(t.String())),
        startDate: t.Optional(t.Union([t.String(), t.Null()])),
        endDate: t.Optional(t.Union([t.String(), t.Null()])),
        status: t.Optional(t.Union([t.Literal('draft'), t.Literal('open'), t.Literal('active'), t.Literal('ongoing'), t.Literal('completed'), t.Literal('archived')])),
      }),
    }
  )

  // 16. (Admin / Mentor) Hapus Batch Kelas (Soft Delete)
  .delete(
    '/:batchId',
    async ({ user, profile, params, set }) => {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
        set.status = 403;
        return { success: false, message: 'Hanya Admin atau Mentor yang dapat menghapus batch.' };
      }

      if (!(await canAccessBatch(profile, params.batchId))) {
        set.status = 403;
        return { success: false, message: 'Anda bukan mentor di batch ini.' };
      }

      const [existing] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, params.batchId))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { success: false, message: 'Batch kelas tidak ditemukan.' };
      }

      await db
        .update(batches)
        .set({ deletedAt: new Date() })
        .where(eq(batches.id, params.batchId));

      return {
        success: true,
        message: `Batch "${existing.name}" berhasil dihapus.`,
      };
    },
    {
      params: t.Object({
        batchId: t.String(),
      }),
    }
  );
