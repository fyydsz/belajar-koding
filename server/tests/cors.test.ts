import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('CORS Configuration Tests', () => {
  it('handles preflight OPTIONS request from vercel.app origin', async () => {
    const res = await app.handle(
      new Request('http://localhost:3001/v1/auth/login', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://belajar-koding-web.vercel.app',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      })
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://belajar-koding-web.vercel.app');
  });

  it('handles preflight OPTIONS request from localhost', async () => {
    const res = await app.handle(
      new Request('http://localhost:3001/v1/auth/login', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      })
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });
});
