import { client, db } from './index';
import {
  courses,
  courseSessions,
  batches,
  batchCourses,
  batchMentors,
  batchEnrollments,
  assignments,
  profiles,
  user,
} from './schema';
import { auth } from '../lib/auth';
import { uuidv7 } from '../lib/uuid';
import { eq } from 'drizzle-orm';

async function resetDatabase() {
  console.log('🔄 Memulai Full Refresh Database Belajar Koding...');

  try {
    // 1. Bersihkan seluruh data tabel transaksi & autentikasi
    console.log('🧹 Membersihkan tabel transaksi, relasi, sesi, dan akun...');
    await client.unsafe(`
      TRUNCATE TABLE 
        "notifications",
        "certificates",
        "enrollment_payments",
        "attendance_logs",
        "attendance_sessions",
        "assignment_submissions",
        "assignments",
        "student_grades",
        "lesson_progress",
        "batch_enrollments",
        "batch_mentors",
        "batch_courses",
        "batches",
        "discord_pairing_codes",
        "session",
        "account",
        "verification",
        "profiles",
        "user"
      CASCADE;
    `);
    console.log('✅ Semua data transaksi dan user lama berhasil dihapus.');

    // 2. Pastikan Master Kurikulum (Courses & 16 Sesi) tersedia
    console.log('📚 Memeriksa dan menyiapkan Master Kurikulum...');
    let [fullstackCourse] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, 'fullstack-web'))
      .limit(1);

    if (!fullstackCourse) {
      const [newCourse] = await db
        .insert(courses)
        .values({
          id: uuidv7(),
          slug: 'fullstack-web',
          title: 'Full-Stack Web Development',
          description: 'Kurikulum intensif pengembangan aplikasi web modern dari hulu ke hilir.',
          totalSessions: 16,
        })
        .returning();
      fullstackCourse = newCourse;

      // Seed 16 Sesi Pertemuan
      const sessionValues = Array.from({ length: 16 }, (_, i) => ({
        id: uuidv7(),
        courseId: fullstackCourse.id,
        sessionNumber: i + 1,
        title: `Pertemuan ${i + 1}: ${
          [
            'Fondasi Web & Lingkungan Kerja',
            'Modern JavaScript & TypeScript',
            'Dasar Backend & Arsitektur REST API',
            'Database Relasional & SQL Mastery',
            'ORM & Migrasi Data dengan Drizzle',
            'Autentikasi & Autorisasi Role-Based',
            'Komponen UI Modern & Styling Tailwind',
            'UTS: Evaluasi Proyek RESTful API',
            'Fullstack React & Next.js App Router',
            'Server Components & Data Fetching',
            'State Management & Form Handling',
            'Integrasi Omnichannel & Webhook',
            'Keamanan Aplikasi & Validasi Data',
            'Testing Terintegrasi (Unit & E2E)',
            'CI/CD & Cloud Deployment',
            'UAS: Capstone Project Showcase',
          ][i]
        }`,
        description: `Materi komprehensif pertemuan ke-${i + 1}.`,
        orderIndex: i + 1,
      }));

      await db.insert(courseSessions).values(sessionValues);
      console.log('✅ Master Kurikulum Fullstack Web & 16 Sesi berhasil dibuat.');
    }

    // 3. Buat Akun Fresh via Better-Auth
    console.log('👤 Membuat akun uji coba fresh...');

    // A. Akun Administrator
    const adminEmail = 'admin@belajarkoding.com';
    const adminPassword = 'Password123!';
    const adminAuth = await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: 'Administrator SIAKAD',
      },
    });

    await db
      .update(user)
      .set({ role: 'admin' })
      .where(eq(user.id, adminAuth.user.id));

    await db.insert(profiles).values({
      id: adminAuth.user.id,
      fullName: 'Administrator SIAKAD',
    });
    console.log(`✅ Admin dibuat: ${adminEmail} (Password: ${adminPassword})`);

    // B. Akun Mentor
    const mentorEmail = 'mentor@belajarkoding.com';
    const mentorPassword = 'Password123!';
    const mentorAuth = await auth.api.signUpEmail({
      body: {
        email: mentorEmail,
        password: mentorPassword,
        name: 'Budi Santoso, M.Kom.',
      },
    });

    await db
      .update(user)
      .set({ role: 'mentor' })
      .where(eq(user.id, mentorAuth.user.id));

    await db.insert(profiles).values({
      id: mentorAuth.user.id,
      fullName: 'Budi Santoso, M.Kom.',
    });
    console.log(`✅ Mentor dibuat: ${mentorEmail} (Password: ${mentorPassword})`);

    // C. Akun Siswa (Student)
    const studentEmail = 'siswa@belajarkoding.com';
    const studentPassword = 'Password123!';
    const studentAuth = await auth.api.signUpEmail({
      body: {
        email: studentEmail,
        password: studentPassword,
        name: 'Ahmad Siswa',
      },
    });

    await db
      .update(user)
      .set({ role: 'student', discordUsername: 'ahmadsiswa_id' })
      .where(eq(user.id, studentAuth.user.id));

    await db.insert(profiles).values({
      id: studentAuth.user.id,
      fullName: 'Ahmad Siswa',
    });

    console.log(`✅ Siswa dibuat: ${studentEmail} (Password: ${studentPassword})`);

    // 4. Buat Batch Angkatan Aktif & Daftarkan Siswa
    console.log('🚀 Menyiapkan Batch Angkatan Aktif...');
    const now = new Date();
    const nextMonth = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const [activeBatch] = await db
      .insert(batches)
      .values({
        id: uuidv7(),
        code: 'FSW-B01',
        name: 'Fullstack Batch 1 - 2026',
        startDate: now,
        endDate: nextMonth,
        status: 'open',
      })
      .returning();

    // Link Batch Courses
    const batchCourseId = uuidv7();
    await db.insert(batchCourses).values({
      id: batchCourseId,
      batchId: activeBatch.id,
      courseId: fullstackCourse.id,
      weightAttendance: '10.00',
      weightTugas: '20.00',
      weightQuiz: '20.00',
      weightUts: '20.00',
      weightUas: '30.00',
      passingScore: '70.00',
    });

    // Link Batch Mentors
    await db.insert(batchMentors).values({
      id: uuidv7(),
      batchId: activeBatch.id,
      mentorId: mentorAuth.user.id,
      isLead: true,
    });

    // Plot Siswa ke Batch
    await db.insert(batchEnrollments).values({
      id: uuidv7(),
      batchId: activeBatch.id,
      studentId: studentAuth.user.id,
      status: 'active',
    });
    console.log(`✅ Siswa ${studentEmail} berhasil di-plot ke ${activeBatch.name}.`);

    // 5. Buat 1 Penugasan Uji Coba (UTS Proyek)
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(assignments).values({
      id: uuidv7(),
      batchCourseId,
      mentorId: mentorAuth.user.id,
      type: 'uts',
      title: 'UTS Proyek: Membangun Fullstack REST API SIAKAD',
      description:
        'Kembangkan REST API lengkap dengan otentikasi role-based, migrasi Drizzle ORM, dan pengujian endpoint. Wajib melampirkan link GitHub repo atau file ZIP arsip.',
      expiredAt: deadline,
    });
    console.log('✅ Penugasan UTS Proyek berhasil diterbitkan.');

    console.log('\n🎉 FULL REFRESH SELESAI DENGAN SUKSES!');
    console.log('====================================================');
    console.log('Kredensial Akun Bersih:');
    console.log('1. Admin : admin@belajarkoding.com  | Password123!');
    console.log('2. Mentor: mentor@belajarkoding.com | Password123!');
    console.log('3. Siswa : siswa@belajarkoding.com  | Password123!');
    console.log('====================================================');
  } catch (error) {
    console.error('❌ Gagal menjalankan Full Refresh:', error);
  } finally {
    await client.end();
  }
}

resetDatabase();
