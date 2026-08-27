import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The domain countdown tests run against a per-hero energy series derived from the committed raw
 * capture. A derivative nobody can regenerate becomes a set of numbers no one dares touch and no
 * one can check, so the generator is the single documented way to produce it and this guard proves
 * the committed copy still matches what the capture yields.
 */
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

describe('the committed energy-series fixture still matches the capture it derives from', () => {
  it('regenerating from the capture reproduces the committed file byte for byte', () => {
    const run = () =>
      execFileSync(process.execPath, ['tools/generate-live-capture-energy-fixture.mjs', '--check'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

    expect(run).not.toThrow();
    expect(run()).toContain('58 ticks, 9 heroes');
  });
});
