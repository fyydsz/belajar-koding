import { describe, expect, test } from 'bun:test';
import { app } from '../src/index';

describe('Server & Bot Webhook Tests', () => {
  test('GET /health returns 200 OK', async () => {
    const response = await app.handle(new Request('http://localhost:3001/health'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('belajar-koding-server');
  });

  test('POST /v1/bot/submission rejects without X-Bot-Secret', async () => {
    const response = await app.handle(
      new Request('http://localhost:3001/v1/bot/submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discord_id: '123456789',
          assignment_id: 'test-assign-id',
          file_url: 'https://cdn.discordapp.com/test.zip',
        }),
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('X-Bot-Secret');
  });

  test('POST /v1/bot/submission rejects with invalid X-Bot-Secret', async () => {
    const response = await app.handle(
      new Request('http://localhost:3001/v1/bot/submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Secret': 'wrong-secret-key',
        },
        body: JSON.stringify({
          discord_id: '123456789',
          assignment_id: 'test-assign-id',
          file_url: 'https://cdn.discordapp.com/test.zip',
        }),
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('POST /v1/bot/submission returns 404 if student discord_id not found', async () => {
    const validSecret = process.env.DISCORD_BOT_SECRET || 'fyy_secret_bot_kelas_2026_secure';

    const response = await app.handle(
      new Request('http://localhost:3001/v1/bot/submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Secret': validSecret,
        },
        body: JSON.stringify({
          discord_id: '999999999999999999',
          assignment_id: 'non-existent-uuid',
          file_url: 'https://cdn.discordapp.com/test.zip',
        }),
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('belum menautkan akun Discord');
  });
});
