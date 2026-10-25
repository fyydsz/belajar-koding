import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { batchEnrollments, batchMentors } from '../db/schema';

type Actor = { id: string; role: string };

/**
 * Cek apakah user boleh mengakses data sebuah batch.
 * Admin: semua batch. Mentor: batch tempat ia terdaftar sebagai mentor.
 * Siswa: batch tempat ia terdaftar sebagai peserta.
 */
export async function canAccessBatch(actor: Actor, batchId: string): Promise<boolean> {
  if (actor.role === 'admin') return true;

  if (actor.role === 'mentor') {
    const [row] = await db
      .select({ id: batchMentors.id })
      .from(batchMentors)
      .where(and(eq(batchMentors.batchId, batchId), eq(batchMentors.mentorId, actor.id)))
      .limit(1);
    return Boolean(row);
  }

  const [row] = await db
    .select({ id: batchEnrollments.id })
    .from(batchEnrollments)
    .where(and(eq(batchEnrollments.batchId, batchId), eq(batchEnrollments.studentId, actor.id)))
    .limit(1);
  return Boolean(row);
}

export function isStaff(role: string): boolean {
  return role === 'mentor' || role === 'admin';
}
