import { Elysia } from 'elysia';
import { supabaseAdmin } from '../lib/supabase';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .derive({ as: 'scoped' }, async ({ headers }) => {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, profile: null };
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return { user: null, profile: null };
    }

    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return { user: null, profile: null };
      }

      const [userProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      return {
        user,
        profile: userProfile || null,
      };
    } catch {
      return { user: null, profile: null };
    }
  });
