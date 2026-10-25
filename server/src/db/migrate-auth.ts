import { client } from './index';

async function main() {
  console.log('Creating Better Auth tables in database...');

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "email_verified" boolean DEFAULT false NOT NULL,
      "image" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "role" text DEFAULT 'student',
      "discord_id" text UNIQUE,
      "discord_username" text
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY,
      "expires_at" timestamp with time zone NOT NULL,
      "token" text NOT NULL UNIQUE,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "ip_address" text,
      "user_agent" text,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("user_id");

    CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY,
      "account_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "access_token" text,
      "refresh_token" text,
      "id_token" text,
      "access_token_expires_at" timestamp with time zone,
      "refresh_token_expires_at" timestamp with time zone,
      "scope" text,
      "password" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("user_id");

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

    -- Convert profiles.id and all foreign keys from uuid to text
    ALTER TABLE assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_student_id_profiles_id_fk;
    ALTER TABLE assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_graded_by_profiles_id_fk;
    ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_mentor_id_profiles_id_fk;
    ALTER TABLE course_enrollments DROP CONSTRAINT IF EXISTS course_enrollments_student_id_profiles_id_fk;
    ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_student_id_profiles_id_fk;
    ALTER TABLE student_grades DROP CONSTRAINT IF EXISTS student_grades_student_id_profiles_id_fk;
    ALTER TABLE discord_pairing_codes DROP CONSTRAINT IF EXISTS discord_pairing_codes_user_id_fkey;

    ALTER TABLE profiles ALTER COLUMN id TYPE text;
    ALTER TABLE assignment_submissions ALTER COLUMN student_id TYPE text;
    ALTER TABLE assignment_submissions ALTER COLUMN graded_by TYPE text;
    ALTER TABLE assignments ALTER COLUMN mentor_id TYPE text;
    ALTER TABLE course_enrollments ALTER COLUMN student_id TYPE text;
    ALTER TABLE lesson_progress ALTER COLUMN student_id TYPE text;
    ALTER TABLE student_grades ALTER COLUMN student_id TYPE text;
    ALTER TABLE discord_pairing_codes ALTER COLUMN user_id TYPE text;

    ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_student_id_profiles_id_fk FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_graded_by_profiles_id_fk FOREIGN KEY (graded_by) REFERENCES profiles(id);
    ALTER TABLE assignments ADD CONSTRAINT assignments_mentor_id_profiles_id_fk FOREIGN KEY (mentor_id) REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE course_enrollments ADD CONSTRAINT course_enrollments_student_id_profiles_id_fk FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_student_id_profiles_id_fk FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE student_grades ADD CONSTRAINT student_grades_student_id_profiles_id_fk FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE discord_pairing_codes ADD CONSTRAINT discord_pairing_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  `);

  console.log('Better Auth tables created successfully!');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
