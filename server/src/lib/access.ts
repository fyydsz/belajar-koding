import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { assignments, batchCourses, batchEnrollments, batchMentors } from '../db/schema';

export type Actor = { id: string; role: string };

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

/**
 * Daftar batchId yang boleh diakses user, atau 'all' untuk admin.
 */
export async function getAccessibleBatchIds(actor: Actor): Promise<string[] | 'all'> {
  if (actor.role === 'admin') return 'all';

  if (actor.role === 'mentor') {
    const rows = await db
      .select({ batchId: batchMentors.batchId })
      .from(batchMentors)
      .where(eq(batchMentors.mentorId, actor.id));
    return rows.map((r) => r.batchId);
  }

  const rows = await db
    .select({ batchId: batchEnrollments.batchId })
    .from(batchEnrollments)
    .where(and(eq(batchEnrollments.studentId, actor.id), eq(batchEnrollments.status, 'active')));
  return rows.map((r) => r.batchId);
}

export async function getBatchIdByBatchCourse(batchCourseId: string): Promise<string | null> {
  const [row] = await db
    .select({ batchId: batchCourses.batchId })
    .from(batchCourses)
    .where(eq(batchCourses.id, batchCourseId))
    .limit(1);
  return row?.batchId ?? null;
}

export async function getBatchIdByAssignment(assignmentId: string): Promise<string | null> {
  const [row] = await db
    .select({ batchId: batchCourses.batchId })
    .from(assignments)
    .innerJoin(batchCourses, eq(assignments.batchCourseId, batchCourses.id))
    .where(eq(assignments.id, assignmentId))
    .limit(1);
  return row?.batchId ?? null;
}

export function isStaff(role: string): boolean {
  return role === 'mentor' || role === 'admin';
}
