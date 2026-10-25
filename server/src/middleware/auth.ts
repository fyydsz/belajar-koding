import { Elysia } from 'elysia';
import { auth } from '../lib/auth';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';

function extractCookieToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if ((rawKey === 'bk_session' || rawKey === 'auth_token') && rest.length > 0) {
      const val = rest.join('=').trim();
      if (val) return decodeURIComponent(val);
    }
  }
  return null;
}

export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .derive({ as: 'scoped' }, async ({ request }) => {
    try {
      const headers = new Headers(request.headers);
      if (!headers.get('authorization')) {
        const cookieToken = extractCookieToken(headers.get('cookie'));
        if (cookieToken) {
          headers.set('authorization', `Bearer ${cookieToken}`);
        }
      }

      const session = await auth.api.getSession({
        headers,
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
