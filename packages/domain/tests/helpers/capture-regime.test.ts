/**
 * Deterministic proof of `capture-regime.ts`'s parsing and comparison logic, decoupled from
 * vitest's own skip semantics (a fake {@link TestContext} stands in — see the runtime-skip proof
 * in `capture-regime-expiry.test.ts` for the real thing firing inside an actual test).
 */
import { describe, expect, it, vi } from 'vitest';
import { captureDateOf, isBefore, skipIfBefore } from './capture-regime';

describe('captureDateOf', () => {
  it('parses a bare "save-YYYYMMDD-..." filename', () => {
    expect(captureDateOf('save-20260813-5heroes.json')).toBe('2026-08-13');
  });

  it('parses a bare "payload-YYYYMMDD-..." filename', () => {
    expect(captureDateOf('payload-20260812-8heroes.json')).toBe('2026-08-12');
  });

  it('parses a "dir/filename" path, the shape NON_CURRENT_REGIME_CAPTURES uses', () => {
    expect(captureDateOf('sheet-math/save-20260818-12heroes.json')).toBe('2026-08-18');
    expect(captureDateOf('farm-rate/save-20260815-486-7heroes.json')).toBe('2026-08-15');
  });

  it('resolves the same date for a bare filename, a forward-slash path and a backslash path', () => {
    // `path.join('sheet-math', 'save-...')` emits `\` on Windows, where this repo is developed
    // and CI'd — a `dir/filename` path built that way must parse identically to the POSIX shape.
    const bare = captureDateOf('save-20260813-5heroes.json');
    const forwardSlash = captureDateOf('sheet-math/save-20260813-5heroes.json');
    const backslash = captureDateOf('sheet-math\\save-20260813-5heroes.json');
    expect({ bare, forwardSlash, backslash }).toEqual({
      bare: '2026-08-13',
      forwardSlash: '2026-08-13',
      backslash: '2026-08-13',
    });
  });

  it('throws on a name with no embedded capture date, rather than returning undefined', () => {
    expect(() => captureDateOf('export-capture.json')).toThrow(/does not carry/);
    expect(() => captureDateOf('pair.json')).toThrow(/does not carry/);
  });
});

describe('isBefore', () => {
  it('is true when the capture predates the boundary', () => {
    expect(isBefore('save-20260813-5heroes.json', '2026-08-18')).toBe(true);
  });

  it('is false on the boundary date itself (the boundary is inclusive of "current")', () => {
    expect(isBefore('save-20260818-12heroes.json', '2026-08-18')).toBe(false);
  });

  it('is false when the capture postdates the boundary', () => {
    expect(isBefore('save-20260823-13heroes-crit-points.json', '2026-08-18')).toBe(false);
  });
});

describe('skipIfBefore', () => {
  function fakeContext() {
    return { skip: vi.fn() } as unknown as import('vitest').TestContext;
  }

  it('skips (condition true) with a message naming the fixture, its date and the boundary', () => {
    const ctx = fakeContext();
    skipIfBefore(ctx, 'save-20260813-5heroes.json', '2026-08-18', 'crit chance and cooldown reverted to percent-of-base.');
    expect(ctx.skip).toHaveBeenCalledTimes(1);
    const [condition, message] = vi.mocked(ctx.skip).mock.calls[0];
    expect(condition).toBe(true);
    expect(message).toContain('save-20260813-5heroes.json');
    expect(message).toContain('2026-08-13');
    expect(message).toContain('2026-08-18');
    expect(message).toContain('EXPIRED');
  });

  it('does not skip (condition false) for a capture at or after the boundary', () => {
    const ctx = fakeContext();
    skipIfBefore(ctx, 'save-20260823-13heroes-crit-points.json', '2026-08-18', 'irrelevant to this case.');
    expect(ctx.skip).toHaveBeenCalledTimes(1);
    const [condition] = vi.mocked(ctx.skip).mock.calls[0];
    expect(condition).toBe(false);
  });
});
