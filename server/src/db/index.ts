import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. Database operations will fail if called without proper configuration.');
}

// In transaction pooling mode (port 6543), prepare must be false.
export const client = postgres(connectionString || '', {
  prepare: false,
  ssl: 'require',
  max: 10,
});

export const db = drizzle(client, { schema });
