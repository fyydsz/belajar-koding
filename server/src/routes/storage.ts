import { Elysia, t } from 'elysia';
import { authPlugin } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { uuidv7 } from '../lib/uuid';

const BUCKET_CONFIG: Record<string, { maxSize: number; allowedTypes: string[] }> = {
  avatars: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  payments: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  submissions: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
      'application/pdf',
      'image/jpeg',
      'image/png',
    ],
  },
  materials: {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedTypes: [
      'application/pdf',
      'application/zip',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
};

export const storageRoutes = new Elysia({ prefix: '/v1/storage' })
  .use(authPlugin)
  .post(
    '/presigned-url',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' };
      }

      const { bucket, fileName, contentType, fileSize } = body;
      const config = BUCKET_CONFIG[bucket];

      if (!config) {
        set.status = 400;
        return { success: false, message: `Bucket '${bucket}' tidak valid.` };
      }

      if (fileSize && fileSize > config.maxSize) {
        set.status = 400;
        const maxMb = Math.round(config.maxSize / (1024 * 1024));
        return {
          success: false,
          message: `Ukuran berkas melebihi batas maksimum ${maxMb}MB untuk bucket '${bucket}'.`,
        };
      }

      if (contentType && !config.allowedTypes.includes(contentType.toLowerCase())) {
        set.status = 400;
        return {
          success: false,
          message: `Tipe berkas '${contentType}' tidak diizinkan untuk bucket '${bucket}'.`,
        };
      }

      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePath = `${user.id}/${uuidv7()}-${cleanFileName}`;

      try {
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUploadUrl(uniquePath);

        if (error || !data) {
          set.status = 500;
          return {
            success: false,
            message: `Gagal membuat presigned upload URL: ${error?.message || 'Storage error'}`,
          };
        }

        const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(uniquePath);

        return {
          success: true,
          message: 'Presigned upload URL berhasil dibuat.',
          data: {
            uploadUrl: data.signedUrl,
            publicUrl: publicData.publicUrl,
            fileKey: uniquePath,
            expiresIn: 300,
          },
        };
      } catch (err: unknown) {
        set.status = 500;
        const msg = err instanceof Error ? err.message : 'Kesalahan internal storage.';
        return { success: false, message: msg };
      }
    },
    {
      body: t.Object({
        bucket: t.Union([
          t.Literal('avatars'),
          t.Literal('payments'),
          t.Literal('submissions'),
          t.Literal('materials'),
        ]),
        fileName: t.String({ minLength: 1 }),
        contentType: t.Optional(t.String()),
        fileSize: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );
