import { createClient } from './client';

/**
 * Unggah foto profil yang telah di-crop ke Supabase Storage (bucket: avatars)
 */
export async function uploadAvatar(file: File, userId: string): Promise<{ publicUrl: string }> {
  const supabase = createClient();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    throw new Error(`Gagal mengunggah foto profil: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  return { publicUrl: data.publicUrl };
}

/**
 * Hapus foto profil dari Supabase Storage jika ada
 */
export async function deleteAvatarFromStorage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  try {
    const supabase = createClient();
    const bucketMarker = '/avatars/';
    const markerIndex = imageUrl.indexOf(bucketMarker);
    if (markerIndex === -1) return;

    const filePath = imageUrl.substring(markerIndex + bucketMarker.length).split('?')[0];
    if (filePath) {
      await supabase.storage.from('avatars').remove([filePath]);
    }
  } catch (err) {
    console.error('Gagal menghapus avatar lama dari storage:', err);
  }
}
