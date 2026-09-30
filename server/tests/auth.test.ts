import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('Auth Endpoints Validation Tests', () => {
  it('POST /v1/auth/register rejects invalid email format', async () => {
    const res = await app.handle(
      new Request('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'password123',
          fullName: 'Budi Santoso',
        }),
      })
    );

    expect(res.status).toBe(422);
  });

  it('POST /v1/auth/register rejects short password', async () => {
    const res = await app.handle(
      new Request('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: '123',
          fullName: 'Budi Santoso',
        }),
      })
    );

    expect(res.status).toBe(422);
  });

  it('POST /v1/auth/login rejects invalid credentials', async () => {
    const res = await app.handle(
      new Request('http://localhost/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'unknown-user-never-exists@example.com',
          password: 'wrongpassword',
        }),
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('GET /v1/auth/me rejects unauthenticated request', async () => {
    const res = await app.handle(
      new Request('http://localhost/v1/auth/me', {
        method: 'GET',
      })
    );

    expect(res.status).toBe(401);
  });
});
