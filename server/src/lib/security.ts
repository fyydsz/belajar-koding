import { randomInt, timingSafeEqual } from 'node:crypto';

/** Kode acak dari CSPRNG, bukan Math.random(). */
export function randomCode(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(randomInt(alphabet.length));
  }
  return out;
}

/** Perbandingan string dengan waktu konstan. */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

type Signature = { ext: string[]; match: (b: Uint8Array) => boolean };

const startsWith = (b: Uint8Array, bytes: number[]) => bytes.every((v, i) => b[i] === v);

const SIGNATURES: Record<string, Signature> = {
  'image/jpeg': { ext: ['jpg', 'jpeg'], match: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  'image/png': { ext: ['png'], match: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  'image/gif': { ext: ['gif'], match: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) },
  'image/webp': {
    ext: ['webp'],
    match: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b.slice(8), [0x57, 0x45, 0x42, 0x50]),
  },
  'application/pdf': { ext: ['pdf'], match: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]) },
};

/**
 * Deteksi tipe berkas dari isinya (magic bytes). Mengembalikan MIME dan
 * ekstensi yang aman, atau null jika bukan salah satu tipe yang diizinkan.
 */
export function sniffFile(
  bytes: Uint8Array,
  allowed: string[]
): { mime: string; ext: string } | null {
  for (const mime of allowed) {
    const sig = SIGNATURES[mime];
    if (sig && sig.match(bytes)) return { mime, ext: sig.ext[0] };
  }
  return null;
}
