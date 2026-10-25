import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth';
import { authPlugin } from '../middleware/auth';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { rateLimit } from '../lib/rate-limit';
import { isProduction } from '../lib/origins';

function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const flags = [
    `bk_session=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    isProduction ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  return flags.join('; ');
}

// Tanpa prefix sendiri: prefix '/v1/auth' diwarisi dari authRoutes.
const credentialRoutes = new Elysia()
  .use(rateLimit({ name: 'credentials', max: 10, windowMs: 15 * 60 * 1000 }))
  .post(
    '/register',
    async ({ body, set }) => {
      const { email, password, fullName } = body;

      try {
        const result = await auth.api.signUpEmail({
          body: {
            email: email.trim().toLowerCase(),
            password,
            name: fullName.trim(),
          },
          asResponse: false,
        });

        if (!result || !result.user) {
          set.status = 400;
          return {
            success: false,
            message: 'Pendaftaran gagal diproses.',
          };
        }

        let [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, result.user.id))
          .limit(1);

        if (!profile) {
          const [newProfile] = await db
            .insert(profiles)
            .values({
              id: result.user.id,
              fullName: fullName.trim(),
            })
            .onConflictDoNothing()
            .returning();
          profile = newProfile;
        }

        const userRole = (result.user as { role?: string }).role || 'student';

        const maxAge = 7 * 24 * 60 * 60;
        if (result.token) {
          set.headers['set-cookie'] = buildSessionCookie(result.token, maxAge);
        }

        set.status = 201;
        return {
          success: true,
          message: 'Pendaftaran berhasil.',
          data: {
            user: {
              id: result.user.id,
              email: result.user.email,
              fullName: fullName.trim(),
              role: userRole,
            },
            session: result.token
              ? {
                  accessToken: result.token,
                  expiresIn: maxAge,
                }
              : null,
          },
        };
      } catch (err: unknown) {
        set.status = 400;
        const msg = err instanceof Error ? err.message : 'Pendaftaran gagal diproses.';
        return {
          success: false,
          message: msg,
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8, maxLength: 128 }),
        fullName: t.String({ minLength: 2, maxLength: 60 }),
      }),
    }
  )
  .post(
    '/login',
    async ({ body, set }) => {
      const { email, password } = body;

      try {
        const result = await auth.api.signInEmail({
          body: {
            email: email.trim().toLowerCase(),
            password,
          },
          asResponse: false,
        });

        if (!result || !result.user) {
          set.status = 401;
          return {
            success: false,
            message: 'Email atau kata sandi tidak valid.',
          };
        }

        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, result.user.id))
          .limit(1);

        const userRole = (result.user as { role?: string }).role || 'student';
        const maxAge = 7 * 24 * 60 * 60;
        if (result.token) {
          set.headers['set-cookie'] = buildSessionCookie(result.token, maxAge);
        }

        return {
          success: true,
          message: 'Login berhasil.',
          data: {
            user: {
              id: result.user.id,
              email: result.user.email,
              fullName: profile?.fullName || result.user.name || 'Siswa',
              role: userRole,
              avatarUrl: profile?.avatarUrl || result.user.image || null,
            },
            profile: profile || null,
            session: {
              accessToken: result.token,
              expiresIn: maxAge,
            },
          },
        };
      } catch {
        set.status = 401;
        return {
          success: false,
          message: 'Email atau kata sandi tidak valid.',
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 1 }),
      }),
    }
  );

export const authRoutes = new Elysia({ prefix: '/v1/auth' })
  .use(credentialRoutes)
  .use(authPlugin)
  .get('/me', async ({ user, profile, set }) => {
    if (!user) {
      set.status = 401;
      return {
        success: false,
        message: 'Autentikasi diperlukan. Sesi login telah berakhir.',
      };
    }

    const userRole = (user as { role?: string }).role || 'student';

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: profile?.fullName || user.name || 'Siswa',
        role: profile?.role || userRole,
        avatarUrl: profile?.avatarUrl || user.image || null,
        emailConfirmedAt: user.emailVerified ? new Date().toISOString() : null,
        profile: profile || null,
      },
    };
  })
  .post('/logout', async ({ request, set }) => {
    try {
      await auth.api.signOut({
        headers: request.headers,
      });
    } catch {
      // ignore
    }

    set.headers['set-cookie'] = buildSessionCookie('', 0);

    return {
      success: true,
      message: 'Berhasil keluar.',
    };
  })
  .patch(
    '/password',
    async ({ user, request, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan.' };
      }

      const { currentPassword, newPassword, revokeOtherSessions } = body;
      try {
        await auth.api.changePassword({
          body: {
            currentPassword,
            newPassword,
            revokeOtherSessions: revokeOtherSessions !== false,
          },
          headers: request.headers,
        });

        return {
          success: true,
          message: 'Kata sandi berhasil diperbarui.',
        };
      } catch (err: unknown) {
        set.status = 400;
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.';
        return { success: false, message: msg };
      }
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 8, maxLength: 128 }),
        revokeOtherSessions: t.Optional(t.Boolean()),
      }),
    }
  )
  .post('/resend-verification', async ({ user, set }) => {
    if (!user || !user.email) {
      set.status = 401;
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    try {
      await auth.api.sendVerificationEmail({
        body: {
          email: user.email,
        },
      });

      return {
        success: true,
        message: 'Email verifikasi berhasil dikirim ulang.',
      };
    } catch (err: unknown) {
      set.status = 400;
      const msg = err instanceof Error ? err.message : 'Gagal mengirim email verifikasi.';
      return { success: false, message: msg };
    }
  });
