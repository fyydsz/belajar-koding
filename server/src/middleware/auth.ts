import { Elysia } from 'elysia';
import { auth } from '../lib/auth';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .derive({ as: 'scoped' }, async ({ request }) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session || !session.user) {
        return {
          user: null,
          session: null,
          profile: null,
        };
      }

      const [userProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1);

      const userRecord = session.user as typeof session.user & {
        role?: string;
        discordId?: string;
        discordUsername?: string;
      };

      const profile = {
        id: session.user.id,
        email: session.user.email,
        fullName: userProfile?.fullName || session.user.name,
        avatarUrl: userProfile?.avatarUrl || session.user.image || null,
        role: (userRecord.role as 'student' | 'mentor' | 'admin') || 'student',
        discordId: userRecord.discordId || null,
        discordUsername: userRecord.discordUsername || null,
        nim: userProfile?.nim || null,
        phoneNumber: userProfile?.phoneNumber || null,
        githubUsername: userProfile?.githubUsername || null,
        bio: userProfile?.bio || null,
        createdAt: userProfile?.createdAt || session.user.createdAt,
        updatedAt: userProfile?.updatedAt || session.user.updatedAt,
      };

      return {
        user: session.user,
        session: session.session,
        profile,
      };
    } catch {
      return {
        user: null,
        session: null,
        profile: null,
      };
    }
  });
