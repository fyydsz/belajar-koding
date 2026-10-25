import { Elysia } from 'elysia';

type Bucket = { count: number; resetAt: number };

/**
 * Rate limiter in-memory per IP. Cukup untuk satu instance Render; kalau backend
 * di-scale ke banyak instance, pindahkan penyimpanan ke Redis.
 */
export function rateLimit(options: { name: string; max: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  sweep.unref?.();

  return new Elysia({ name: `rate-limit-${options.name}` }).onBeforeHandle(
    { as: 'scoped' },
    ({ request, set }) => {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

      const now = Date.now();
      const bucket = buckets.get(ip);

      if (!bucket || bucket.resetAt <= now) {
        buckets.set(ip, { count: 1, resetAt: now + options.windowMs });
        return;
      }

      bucket.count += 1;
      if (bucket.count > options.max) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        set.status = 429;
        set.headers['retry-after'] = String(retryAfter);
        return {
          success: false,
          message: 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.',
        };
      }
    }
  );
}

/**
 * Pembatas percobaan gagal per kunci (mis. user ID). Dipakai untuk tebak kode
 * presensi/pairing, di mana pembatas per IP kurang cocok karena banyak siswa
 * berbagi satu jaringan kampus.
 */
export function attemptLimiter(options: { max: number; windowMs: number }) {
  const failures = new Map<string, Bucket>();

  return {
    isBlocked(key: string): boolean {
      const bucket = failures.get(key);
      if (!bucket) return false;
      if (bucket.resetAt <= Date.now()) {
        failures.delete(key);
        return false;
      }
      return bucket.count >= options.max;
    },
    fail(key: string): void {
      const now = Date.now();
      const bucket = failures.get(key);
      if (!bucket || bucket.resetAt <= now) {
        failures.set(key, { count: 1, resetAt: now + options.windowMs });
      } else {
        bucket.count += 1;
      }
    },
    reset(key: string): void {
      failures.delete(key);
    },
  };
}
