import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  pgEnum,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from '../lib/uuid';

// ==========================================
// 1. ENUMS
// ==========================================
export const userRoleEnum = pgEnum('user_role', ['student', 'mentor', 'admin']);
export const batchStatusEnum = pgEnum('batch_status', [
  'draft',
  'open',
  'ongoing',
  'completed',
  'archived',
]);
export const batchEnrollmentStatusEnum = pgEnum('batch_enrollment_status', [
  'pending',
  'active',
  'rejected',
  'dropped',
  'graduated',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'verified',
  'rejected',
  'refunded',
]);
export const assignmentTypeEnum = pgEnum('assignment_type', ['tugas', 'quiz', 'uts', 'uas']);

// ==========================================
// 2. MODUL AUTENTIKASI (BETTER-AUTH SSoT)
// ==========================================
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('student'),
  discordId: text('discord_id').unique(),
  discordUsername: text('discord_username'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

// Profil bisnis akademik (Bebas duplikasi identitas)
export const profiles = pgTable('profiles', {
  id: text('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  nim: text('nim').unique(),
  fullName: text('full_name').notNull(),
  phoneNumber: text('phone_number'),
  githubUsername: text('github_username'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ==========================================
// 3. MODUL KURIKULUM & MATERI
// ==========================================
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  totalSessions: integer('total_sessions').default(16).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const courseSessions = pgTable(
  'course_sessions',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    sessionNumber: integer('session_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    orderIndex: integer('order_index').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('course_sessions_course_session_idx').on(
      table.courseId,
      table.sessionNumber
    ),
  ]
);

export const courseMaterials = pgTable('course_materials', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => courseSessions.id, { onDelete: 'cascade' }),
  mentorId: text('mentor_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  contentMdx: text('content_mdx').notNull(),
  fileUrl: text('file_url'),
  orderIndex: integer('order_index').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ==========================================
// 4. MODUL BATCH, REGISTRASI & KEUANGAN
// ==========================================
export const batches = pgTable('batches', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 12, scale: 2 }).default('0.00').notNull(),
  paymentAccountInfo: text('payment_account_info'),
  maxStudents: integer('max_students').default(30).notNull(),
  enrolledCount: integer('enrolled_count').default(0).notNull(),
  status: batchStatusEnum('status').default('draft').notNull(),
  registrationStartDate: timestamp('registration_start_date', { withTimezone: true }),
  registrationEndDate: timestamp('registration_end_date', { withTimezone: true }),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const batchCourses = pgTable(
  'batch_courses',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'restrict' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    weightAttendance: numeric('weight_attendance', { precision: 5, scale: 2 })
      .notNull()
      .default('10.00'),
    weightTugas: numeric('weight_tugas', { precision: 5, scale: 2 })
      .notNull()
      .default('20.00'),
    weightQuiz: numeric('weight_quiz', { precision: 5, scale: 2 })
      .notNull()
      .default('20.00'),
    weightUts: numeric('weight_uts', { precision: 5, scale: 2 })
      .notNull()
      .default('20.00'),
    weightUas: numeric('weight_uas', { precision: 5, scale: 2 })
      .notNull()
      .default('30.00'),
    passingScore: numeric('passing_score', { precision: 5, scale: 2 })
      .notNull()
      .default('70.00'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('batch_courses_unique_idx').on(table.batchId, table.courseId),
    check(
      'total_weight_100_check',
      sql`${table.weightAttendance} + ${table.weightTugas} + ${table.weightQuiz} + ${table.weightUts} + ${table.weightUas} = 100.00`
    ),
  ]
);

export const batchMentors = pgTable(
  'batch_mentors',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    mentorId: text('mentor_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    isLead: boolean('is_lead').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('batch_mentors_unique_idx').on(table.batchId, table.mentorId),
  ]
);

export const batchEnrollments = pgTable(
  'batch_enrollments',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'restrict' }),
    studentId: text('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    status: batchEnrollmentStatusEnum('status').default('pending').notNull(),
    notes: text('notes'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('batch_enrollments_unique_idx').on(table.batchId, table.studentId),
  ]
);

export const enrollmentPayments = pgTable(
  'enrollment_payments',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => batchEnrollments.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').default('manual_transfer').notNull(),
    proofUrl: text('proof_url').notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    rejectionReason: text('rejection_reason'),
    verifiedBy: text('verified_by').references(() => profiles.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('enrollment_payments_enrollment_idx').on(table.enrollmentId),
    index('enrollment_payments_status_idx').on(table.status),
  ]
);

// ==========================================
// 5. MODUL PRESENSI
// ==========================================
export const attendanceSessions = pgTable('attendance_sessions', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => batches.id, { onDelete: 'restrict' }),
  sessionId: uuid('session_id').references(() => courseSessions.id, { onDelete: 'set null' }),
  sessionNumber: integer('session_number').notNull(),
  tokenCode: text('token_code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  openedBy: text('opened_by')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    attendanceSessionId: uuid('attendance_session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }).defaultNow().notNull(),
    channel: text('channel').default('web').notNull(),
    status: text('status').default('present').notNull(),
    note: text('note'),
    attachmentUrl: text('attachment_url'),
  },
  (table) => [
    uniqueIndex('attendance_logs_session_student_idx').on(
      table.attendanceSessionId,
      table.studentId
    ),
  ]
);

// ==========================================
// 6. MODUL TUGAS & PENILAIAN SIAKAD
// ==========================================
export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  batchCourseId: uuid('batch_course_id')
    .notNull()
    .references(() => batchCourses.id, { onDelete: 'restrict' }),
  sessionId: uuid('session_id').references(() => courseSessions.id, { onDelete: 'set null' }),
  mentorId: text('mentor_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  type: assignmentTypeEnum('type').default('tugas').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiredAt: timestamp('expired_at', { withTimezone: true }).notNull(),
});

export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    repoUrl: text('repo_url'),
    demoUrl: text('demo_url'),
    fileUrl: text('file_url'),
    notes: text('notes'),
    submittedVia: text('submitted_via').default('web').notNull(),
    discordMessageId: text('discord_message_id'),
    discordChannelId: text('discord_channel_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    grade: numeric('grade', { precision: 5, scale: 2 }),
    feedback: text('feedback'),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    gradedBy: text('graded_by').references(() => profiles.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('assignment_submissions_unique_idx').on(table.assignmentId, table.studentId),
  ]
);

export const studentGrades = pgTable(
  'student_grades',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => batchEnrollments.id, { onDelete: 'restrict' }),
    batchCourseId: uuid('batch_course_id')
      .notNull()
      .references(() => batchCourses.id, { onDelete: 'restrict' }),
    attendanceScore: numeric('attendance_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    tugasScore: numeric('tugas_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    quizScore: numeric('quiz_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    utsScore: numeric('uts_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    uasScore: numeric('uas_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    finalScore: numeric('final_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    gradeLetter: text('grade_letter'),
    isPassed: boolean('is_passed').notNull().default(false),
    isOverride: boolean('is_override').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('student_grades_enrollment_course_idx').on(
      table.enrollmentId,
      table.batchCourseId
    ),
  ]
);

// ==========================================
// 7. MODUL SERTIFIKAT, GAMIFIKASI & NOTIFIKASI
// ==========================================
export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => batchEnrollments.id, { onDelete: 'restrict' }),
    certificateNumber: text('certificate_number').notNull().unique(),
    credentialUrl: text('credential_url').notNull(),
    pdfUrl: text('pdf_url'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
  },
  (table) => [
    uniqueIndex('certificates_enrollment_unique_idx').on(table.enrollmentId),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    actionUrl: text('action_url'),
    isRead: boolean('is_read').default(false).notNull(),
    discordSent: boolean('discord_sent').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId),
  ]
);

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    studentId: text('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => courseMaterials.id, { onDelete: 'cascade' }),
    completed: boolean('completed').default(false).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('lesson_progress_student_material_idx').on(
      table.studentId,
      table.materialId
    ),
  ]
);

export const discordPairingCodes = pgTable('discord_pairing_codes', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 8. RELASI (DRIZZLE ORM RELATIONS)
// ==========================================
export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  profile: one(profiles, {
    fields: [user.id],
    references: [profiles.id],
  }),
  notifications: many(notifications),
  discordPairingCodes: many(discordPairingCodes),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(user, {
    fields: [profiles.id],
    references: [user.id],
  }),
  mentoredBatches: many(batchMentors),
  enrollments: many(batchEnrollments),
  lessonProgresses: many(lessonProgress),
  courseMaterials: many(courseMaterials),
  attendanceLogs: many(attendanceLogs),
  submissions: many(assignmentSubmissions),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  sessions: many(courseSessions),
  batchCourses: many(batchCourses),
}));

export const courseSessionsRelations = relations(courseSessions, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseSessions.courseId],
    references: [courses.id],
  }),
  materials: many(courseMaterials),
  attendanceSessions: many(attendanceSessions),
  assignments: many(assignments),
}));

export const courseMaterialsRelations = relations(courseMaterials, ({ one, many }) => ({
  session: one(courseSessions, {
    fields: [courseMaterials.sessionId],
    references: [courseSessions.id],
  }),
  mentor: one(profiles, {
    fields: [courseMaterials.mentorId],
    references: [profiles.id],
  }),
  progresses: many(lessonProgress),
}));

export const batchesRelations = relations(batches, ({ many }) => ({
  batchCourses: many(batchCourses),
  batchMentors: many(batchMentors),
  enrollments: many(batchEnrollments),
  attendanceSessions: many(attendanceSessions),
}));

export const batchCoursesRelations = relations(batchCourses, ({ one, many }) => ({
  batch: one(batches, {
    fields: [batchCourses.batchId],
    references: [batches.id],
  }),
  course: one(courses, {
    fields: [batchCourses.courseId],
    references: [courses.id],
  }),
  assignments: many(assignments),
  studentGrades: many(studentGrades),
}));

export const batchMentorsRelations = relations(batchMentors, ({ one }) => ({
  batch: one(batches, {
    fields: [batchMentors.batchId],
    references: [batches.id],
  }),
  mentor: one(profiles, {
    fields: [batchMentors.mentorId],
    references: [profiles.id],
  }),
}));

export const batchEnrollmentsRelations = relations(batchEnrollments, ({ one, many }) => ({
  batch: one(batches, {
    fields: [batchEnrollments.batchId],
    references: [batches.id],
  }),
  student: one(profiles, {
    fields: [batchEnrollments.studentId],
    references: [profiles.id],
  }),
  payments: many(enrollmentPayments),
  certificate: one(certificates, {
    fields: [batchEnrollments.id],
    references: [certificates.enrollmentId],
  }),
  studentGrades: many(studentGrades),
}));

export const enrollmentPaymentsRelations = relations(enrollmentPayments, ({ one }) => ({
  enrollment: one(batchEnrollments, {
    fields: [enrollmentPayments.enrollmentId],
    references: [batchEnrollments.id],
  }),
  verifier: one(profiles, {
    fields: [enrollmentPayments.verifiedBy],
    references: [profiles.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  enrollment: one(batchEnrollments, {
    fields: [certificates.enrollmentId],
    references: [batchEnrollments.id],
  }),
}));

export const attendanceSessionsRelations = relations(attendanceSessions, ({ one, many }) => ({
  batch: one(batches, {
    fields: [attendanceSessions.batchId],
    references: [batches.id],
  }),
  courseSession: one(courseSessions, {
    fields: [attendanceSessions.sessionId],
    references: [courseSessions.id],
  }),
  mentor: one(profiles, {
    fields: [attendanceSessions.openedBy],
    references: [profiles.id],
  }),
  logs: many(attendanceLogs),
}));

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
  session: one(attendanceSessions, {
    fields: [attendanceLogs.attendanceSessionId],
    references: [attendanceSessions.id],
  }),
  student: one(profiles, {
    fields: [attendanceLogs.studentId],
    references: [profiles.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  batchCourse: one(batchCourses, {
    fields: [assignments.batchCourseId],
    references: [batchCourses.id],
  }),
  session: one(courseSessions, {
    fields: [assignments.sessionId],
    references: [courseSessions.id],
  }),
  mentor: one(profiles, {
    fields: [assignments.mentorId],
    references: [profiles.id],
  }),
  submissions: many(assignmentSubmissions),
}));

export const assignmentSubmissionsRelations = relations(assignmentSubmissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [assignmentSubmissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(profiles, {
    fields: [assignmentSubmissions.studentId],
    references: [profiles.id],
  }),
  grader: one(profiles, {
    fields: [assignmentSubmissions.gradedBy],
    references: [profiles.id],
  }),
}));

export const studentGradesRelations = relations(studentGrades, ({ one }) => ({
  enrollment: one(batchEnrollments, {
    fields: [studentGrades.enrollmentId],
    references: [batchEnrollments.id],
  }),
  batchCourse: one(batchCourses, {
    fields: [studentGrades.batchCourseId],
    references: [batchCourses.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  student: one(profiles, {
    fields: [lessonProgress.studentId],
    references: [profiles.id],
  }),
  material: one(courseMaterials, {
    fields: [lessonProgress.materialId],
    references: [courseMaterials.id],
  }),
}));

export const discordPairingCodesRelations = relations(discordPairingCodes, ({ one }) => ({
  user: one(user, {
    fields: [discordPairingCodes.userId],
    references: [user.id],
  }),
}));
