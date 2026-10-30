import { client } from './index';

async function main() {
  console.log('Migrating batches registration dates...');

  try {
    await client.unsafe(`
      ALTER TABLE "batches" 
        ADD COLUMN IF NOT EXISTS "registration_start_date" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "registration_end_date" timestamp with time zone;
    `);
    console.log('Registration date columns added to batches table successfully.');
  } catch (err) {
    console.error('Error updating batches table:', err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
