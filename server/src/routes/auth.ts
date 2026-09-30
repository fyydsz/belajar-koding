import { Elysia, t } from 'elysia';
import { supabaseAdmin } from '../lib/supabase';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export const authRoutes = new Elysia({ prefix: '/v1/auth' })
  .post(
    '/register',
    async ({ body, set }) => {
      const { email, password, fullName } = body;

      const { data, error } = await supabaseAdmin.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        set.status = 400;
        return {
          success: false,
          message: error.message,
        };
      }

      if (!data.user) {
        set.status = 400;
        return {
          success: false,
          message: 'Pendaftaran gagal diproses.',
        };
      }

      let [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, data.user.id))
        .limit(1);

      if (!profile) {
        const [newProfile] = await db
          .insert(profiles)
          .values({
            id: data.user.id,
            email: data.user.email!,
            fullName: fullName.trim(),
            role: 'student',
          })
          .onConflictDoNothing()
          .returning();
        profile = newProfile;
      }

      return {
        success: true,
        message: data.session
          ? 'Pendaftaran berhasil.'
          : 'Pendaftaran berhasil. Silakan periksa email untuk konfirmasi akun jika diperlukan.',
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
            fullName: fullName.trim(),
            role: profile?.role || 'student',
          },
          session: data.session
            ? {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresIn: data.session.expires_in,
              }
            : null,
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
        fullName: t.String({ minLength: 2, maxLength: 60 }),
      }),
    }
  )
  .post(
    '/login',
    async ({ body, set }) => {
      const { email, password } = body;

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.user || !data.session) {
        set.status = 401;
        const msg = error?.message.includes('Invalid login credentials')
          ? 'Email atau kata sandi tidak valid.'
          : error?.message || 'Login gagal. Silakan periksa kembali data login.';
        return {
          success: false,
          message: msg,
        };
      }

      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, data.user.id))
        .limit(1);

      return {
        success: true,
        message: 'Login berhasil.',
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
            fullName: profile?.fullName || data.user.user_metadata?.full_name || 'Siswa',
            role: profile?.role || 'student',
            avatarUrl: profile?.avatarUrl || null,
          },
          profile: profile || null,
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in,
          },
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 1 }),
      }),
    }
  )
  .use(authPlugin)
  .get('/me', async ({ user, profile, set }) => {
    if (!user) {
      set.status = 401;
      return {
        success: false,
        message: 'Autentikasi diperlukan. Sesi login telah berakhir.',
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: profile?.fullName || user.user_metadata?.full_name || 'Siswa',
        role: profile?.role || 'student',
        avatarUrl: profile?.avatarUrl || null,
        emailConfirmedAt: user.email_confirmed_at || null,
        profile: profile || null,
      },
    };
  })
  .post('/logout', () => {
    return {
      success: true,
      message: 'Berhasil keluar.',
    };
  })
  .patch(
    '/password',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const { newPassword } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (error) {
        set.status = 400;
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: 'Kata sandi berhasil diperbarui.',
      };
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: 6 }),
      }),
    }
  )
  .post('/resend-verification', async ({ user, set }) => {
    if (!user || !user.email) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const { error } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email: user.email,
    });

    if (error) {
      set.status = 400;
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: 'Email verifikasi berhasil dikirim ulang.',
    };
  });
