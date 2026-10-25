import { eq } from 'drizzle-orm';
import { client, db } from './index';
import { profiles, user } from './schema';
import { auth } from '../lib/auth';

const SEED_ACCOUNTS = [
  {
    email: 'admin@belajarkoding.com',
    password: 'BelajarKoding.',
    fullName: 'Administrator Belajar Koding',
    role: 'admin' as const,
  },
  {
    email: 'mentortest@belajarkoding.com',
    password: 'MentorKoding.',
    fullName: 'Mentor Belajar Koding',
    role: 'mentor' as const,
  },
  {
    email: 'siswa@gmail.com',
    password: 'SiswaKoding.',
    fullName: 'Siswa Belajar Koding',
    role: 'student' as const,
  },
];

async function resetDatabase() {
  console.log('🔄 Memulai Full Reset Database Belajar Koding (Menghapus Semua Data)...');

  try {
    // 1. Ambil seluruh tabel di schema public dan kosongkan semuanya dengan TRUNCATE ... CASCADE
    const tables = await client<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `;

    if (tables.length > 0) {
      const quotedList = tables
        .map((t) => `"public"."${t.tablename.replace(/"/g, '""')}"`)
        .join(', ');
      console.log(`🧹 Mengosongkan ${tables.length} tabel di schema public...`);
      await client.unsafe(`TRUNCATE TABLE ${quotedList} RESTART IDENTITY CASCADE;`);
      console.log('✅ Seluruh tabel di database berhasil dikosongkan.');
    }

    // 2. Buat 3 akun utama (Admin, Mentor, Siswa)
    console.log('👤 Membuat akun Admin, Mentor, dan Siswa...');

    for (const acc of SEED_ACCOUNTS) {
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: acc.email,
          password: acc.password,
          name: acc.fullName,
        },
      });

      if (!signUpResult?.user) {
        throw new Error(`Gagal membuat akun ${acc.email}`);
      }

      await db
        .update(user)
        .set({
          role: acc.role,
          emailVerified: true,
        })
        .where(eq(user.id, signUpResult.user.id));

      await db
        .insert(profiles)
        .values({
          id: signUpResult.user.id,
          fullName: acc.fullName,
        })
        .onConflictDoNothing();

      console.log(`✅ [${acc.role.toUpperCase()}] ${acc.email} (Password: ${acc.password})`);
    }

    // Bersihkan sesi yang otomatis terbuat saat signUp agar tabel session bersih
    await client.unsafe(`TRUNCATE TABLE "public"."session" RESTART IDENTITY CASCADE;`);

    console.log('\n🎉 DATABASE RESET SELESAI DENGAN SUKSES!');
    console.log('====================================================');
    console.log('Kredensial Akun:');
    console.log('1. Admin  : admin@belajarkoding.com      | BelajarKoding.');
    console.log('2. Mentor : mentortest@belajarkoding.com | MentorKoding.');
    console.log('3. Siswa  : siswa@gmail.com              | SiswaKoding.');
    console.log('====================================================');
  } catch (error) {
    console.error('❌ Gagal menjalankan reset database:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

resetDatabase();
