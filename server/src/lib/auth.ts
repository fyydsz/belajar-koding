import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { uuidv7 } from './uuid';
import { db } from '../db';
import * as schema from '../db/schema';
import { allowedOrigins, isProduction } from './origins';

// Secret dev hanya dipakai di luar production; di production env wajib ada.
const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  (isProduction ? undefined : 'dev-only-secret-do-not-use-in-production-0123456789');

if (!authSecret) {
  throw new Error('BETTER_AUTH_SECRET wajib di-set di production.');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  trustedOrigins: allowedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'student',
        input: false,
      },
      discordId: {
        type: 'string',
        required: false,
      },
      discordUsername: {
        type: 'string',
        required: false,
      },
    },
  },
  plugins: [
    bearer(),
  ],
});
