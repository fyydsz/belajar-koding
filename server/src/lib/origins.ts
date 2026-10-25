import 'dotenv/config';

export const isProduction = process.env.NODE_ENV === 'production';

const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

function normalize(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

/**
 * Daftar origin frontend yang dipercaya. FRONTEND_URL boleh berisi beberapa
 * origin dipisah koma (mis. domain produksi dan domain preview Vercel tertentu).
 * Origin localhost hanya diizinkan di luar production.
 */
export const allowedOrigins: string[] = [
  ...(process.env.FRONTEND_URL ?? '').split(',').map(normalize).filter(Boolean),
  ...(isProduction ? [] : LOCAL_ORIGINS),
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(normalize(origin));
}
