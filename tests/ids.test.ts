import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from '../src/lib/ids';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, newId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it('falls back when randomUUID is unavailable (plain http)', () => {
    const real = globalThis.crypto;
    const getRandomValues = vi.fn((a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a));
    vi.stubGlobal('crypto', { getRandomValues });
    const ids = new Set(Array.from({ length: 100 }, newId));
    expect(getRandomValues).toHaveBeenCalledTimes(100);
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
