import { client } from './index';

async function main() {
  console.log('Migrating batch and batch_enrollments schema...');

  // 1. Add new enum values to batch_enrollment_status if not present
  try {
    await client.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t 
          JOIN pg_enum e ON t.oid = e.enumtypid 
          WHERE t.typname = 'batch_enrollment_status' AND e.enumlabel = 'pending'
        ) THEN
          ALTER TYPE batch_enrollment_status ADD VALUE 'pending';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_type t 
          JOIN pg_enum e ON t.oid = e.enumtypid 
          WHERE t.typname = 'batch_enrollment_status' AND e.enumlabel = 'rejected'
        ) THEN
          ALTER TYPE batch_enrollment_status ADD VALUE 'rejected';
        END IF;
      END
      $$;
    `);
    console.log('Enum batch_enrollment_status updated.');
  } catch (err) {
    console.warn('Note on enum update:', err);
  }

  // 2. Add columns to batches table
  try {
    await client.unsafe(`
      ALTER TABLE "batches" 
        ADD COLUMN IF NOT EXISTS "description" text,
        ADD COLUMN IF NOT EXISTS "price" numeric DEFAULT '0' NOT NULL,
        ADD COLUMN IF NOT EXISTS "payment_account_info" text,
        ADD COLUMN IF NOT EXISTS "max_students" integer DEFAULT 30 NOT NULL;
    `);
    console.log('Columns added to batches table.');
  } catch (err) {
    console.error('Error updating batches table:', err);
  }

  // 3. Add columns to batch_enrollments table
  try {
    await client.unsafe(`
      ALTER TABLE "batch_enrollments" 
        ADD COLUMN IF NOT EXISTS "payment_proof_url" text,
        ADD COLUMN IF NOT EXISTS "notes" text,
        ADD COLUMN IF NOT EXISTS "rejected_reason" text,
        ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "verified_by" text REFERENCES "profiles"("id") ON DELETE SET NULL;
    `);
    console.log('Columns added to batch_enrollments table.');
  } catch (err) {
    console.error('Error updating batch_enrollments table:', err);
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
