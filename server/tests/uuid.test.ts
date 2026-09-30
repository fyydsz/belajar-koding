import { describe, expect, test } from 'bun:test';
import { uuidv7, isValidUuidV7 } from '../src/lib/uuid';

describe('UUID v7 Utility', () => {
  test('generates valid UUID v7 format', () => {
    const id = uuidv7();
    expect(id).toBeDefined();
    expect(id.length).toBe(36);
    expect(isValidUuidV7(id)).toBe(true);
    // Version is 7
    expect(id.charAt(14)).toBe('7');
    // Variant is 8, 9, a, or b
    expect(['8', '9', 'a', 'b']).toContain(id.charAt(19).toLowerCase());
  });

  test('generates time-ordered UUIDs sequentially', async () => {
    const id1 = uuidv7();
    // Tiny delay to ensure subsequent timestamp
    await Bun.sleep(5);
    const id2 = uuidv7();

    expect(isValidUuidV7(id1)).toBe(true);
    expect(isValidUuidV7(id2)).toBe(true);
    // Lexicographical ordering: id1 < id2
    expect(id1 < id2).toBe(true);
  });
});
