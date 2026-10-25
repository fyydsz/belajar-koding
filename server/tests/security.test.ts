import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { attemptLimiter } from '../src/lib/rate-limit';
import { randomCode, safeEqual, sniffFile } from '../src/lib/security';

describe('Security helpers', () => {
  it('randomCode uses only the given alphabet and length', () => {
    const code = randomCode('ABC', 50);
    expect(code).toHaveLength(50);
    expect(/^[ABC]+$/.test(code)).toBe(true);
  });

  it('safeEqual compares strings and rejects empty values', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
    expect(safeEqual('secret', 'secreT')).toBe(false);
    expect(safeEqual('a', 'ab')).toBe(false);
    expect(safeEqual(undefined, 'secret')).toBe(false);
    expect(safeEqual('', '')).toBe(false);
  });

  it('sniffFile detects type from content, not from the name', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const html = new TextEncoder().encode('<script>alert(1)</script>');
    expect(sniffFile(png, ['image/png'])?.ext).toBe('png');
    expect(sniffFile(png, ['application/pdf'])).toBeNull();
    expect(sniffFile(html, ['image/png', 'image/jpeg', 'application/pdf'])).toBeNull();
  });

  it('attemptLimiter blocks after max failures and can be reset', () => {
    const limiter = attemptLimiter({ max: 3, windowMs: 60_000 });
    expect(limiter.isBlocked('u1')).toBe(false);
    limiter.fail('u1');
    limiter.fail('u1');
    expect(limiter.isBlocked('u1')).toBe(false);
    limiter.fail('u1');
    expect(limiter.isBlocked('u1')).toBe(true);
    expect(limiter.isBlocked('u2')).toBe(false);
    limiter.reset('u1');
    expect(limiter.isBlocked('u1')).toBe(false);
  });
});

describe('Credential rate limit', () => {
  it('returns 429 after too many login attempts from the same IP', async () => {
    const attempt = () =>
      app.handle(
        new Request('http://localhost/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' },
          body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }),
        })
      );

    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await attempt()).status;
    }
    expect(last).toBe(429);
  });

  it('does not rate limit /v1/auth/me with the credential limiter', async () => {
    for (let i = 0; i < 15; i++) {
      const res = await app.handle(
        new Request('http://localhost/v1/auth/me', {
          headers: { 'X-Forwarded-For': '203.0.113.9' },
        })
      );
      expect(res.status).toBe(401);
    }
  });
});
