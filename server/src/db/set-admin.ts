import { db, client } from './index';
import { user, profiles } from './schema';
import { eq } from 'drizzle-orm';

async function main() {
  const targetEmail = 'raffypradest@gmail.com';

  console.log(`Setting role to admin for: ${targetEmail}...`);

  // 1. Bersihkan referensi discord pairing codes lama jika ada
  await client.unsafe('DELETE FROM discord_pairing_codes');

  // 2. Ambil ID user dari tabel Better Auth (user)
  const [currentUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, targetEmail))
    .limit(1);

  if (!currentUser) {
    throw new Error(`User dengan email ${targetEmail} belum terdaftar di tabel user.`);
  }

  // 3. Update tabel user Better Auth menjadi admin
  await db
    .update(user)
    .set({
      role: 'admin',
      updatedAt: new Date(),
    })
    .where(eq(user.id, currentUser.id));

  // 4. Update atau buat record profiles agar sinkron dengan user.id
  const [existingProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, currentUser.id))
    .limit(1);

  if (existingProfile) {
    await db
      .update(profiles)
      .set({
        fullName: currentUser.name || 'Fyy',
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, currentUser.id));
  } else {
    await db.insert(profiles).values({
      id: currentUser.id,
      fullName: currentUser.name || 'Fyy',
    });
  }

  console.log('SUCCESS: Role berhasil diubah menjadi admin!');
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to set role:', err);
  process.exit(1);
});
