import { pgTable, uuid, text, timestamp, numeric, boolean, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { uuidv7 } from '../lib/uuid';

// Enum Role Pengguna
export const userRoleEnum = pgEnum('user_role', ['student', 'mentor', 'admin']);

// 1. Profil Pengguna (relasi 1-to-1 dengan auth.users Supabase)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // Terhubung dengan auth.users.id
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('student').notNull(),
  discordId: text('discord_id').unique(),
  discordUsername: text('discord_username'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Mata Kuliah / Kelas
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Pendaftaran Siswa ke Kelas (Enrollment)
export const courseEnrollments = pgTable('course_enrollments', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('course_enrollments_course_student_idx').on(table.courseId, table.studentId),
]);

// 4. Tugas (Assignments)
export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  mentorId: uuid('mentor_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiredAt: timestamp('expired_at', { withTimezone: true }).notNull(),
});

// 5. Pengumpulan Tugas (Submissions lewat Bot Discord atau Web)
export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  assignmentId: uuid('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  discordMessageId: text('discord_message_id'),
  discordChannelId: text('discord_channel_id'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  grade: numeric('grade', { precision: 5, scale: 2 }),
  feedback: text('feedback'),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  gradedBy: uuid('graded_by').references(() => profiles.id),
}, (table) => [
  uniqueIndex('assignment_submissions_assign_student_idx').on(table.assignmentId, table.studentId),
]);

// 6. Nilai Akademik Siswa (SIAKAD)
export const studentGrades = pgTable('student_grades', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  tugasScore: numeric('tugas_score', { precision: 5, scale: 2 }).default('0').notNull(),
  quizScore: numeric('quiz_score', { precision: 5, scale: 2 }).default('0').notNull(),
  utsScore: numeric('uts_score', { precision: 5, scale: 2 }).default('0').notNull(),
  uasScore: numeric('uas_score', { precision: 5, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('student_grades_course_student_idx').on(table.courseId, table.studentId),
]);

// 7. Tracking Materi Dokumen (Fumadocs Progress)
export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  studentId: uuid('student_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  courseSlug: text('course_slug').notNull(),
  lessonSlug: text('lesson_slug').notNull(),
  completed: boolean('completed').default(false).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('lesson_progress_student_course_lesson_idx').on(table.studentId, table.courseSlug, table.lessonSlug),
]);

// 8. Kode Tautan Discord Siswa (Pairing Code untuk integrasi Bot)
export const discordPairingCodes = pgTable('discord_pairing_codes', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

