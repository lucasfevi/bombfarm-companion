import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { PREMIUM_SHARED_MODULES } from '@bombfarm/contracts';
import { premiumShimExports, writePremiumShims } from './write-premium-shims.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('premium shim export lists', () => {
  it('names exactly the shared modules, in the table order', async () => {
    const shims = await premiumShimExports({ root });
    expect(Object.keys(shims)).toEqual([...PREMIUM_SHARED_MODULES]);
  });

  it('lists known names for each module and no list is empty', async () => {
    const shims = await premiumShimExports({ root });
    for (const names of Object.values(shims)) expect(names.length).toBeGreaterThan(0);
    expect(shims['react']).toContain('useState');
    expect(shims['react/jsx-runtime']).toContain('jsx');
    expect(shims['react/compiler-runtime']).toContain('c');
    expect(shims['@bombfarm/ui']).toContain('Button');
  });

  it('lists each name once, as a valid identifier, never default, sorted', async () => {
    const shims = await premiumShimExports({ root });
    for (const names of Object.values(shims)) {
      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual([...names].sort());
      for (const name of names) {
        expect(name).toMatch(/^[A-Za-z_$][\w$]*$/);
        expect(name).not.toBe('default');
      }
    }
  });

  // Removing a name from this list is a breaking change for every Premium bundle: update it only
  // together with the plugin API version.
  it('matches the recorded lists, so a vanished export is noticed', async () => {
    const shims = await premiumShimExports({ root });
    expect(shims).toMatchSnapshot();
  });

  it('writes the lists beside the main bundle as JSON', async () => {
    const dist = mkdtempSync(path.join(os.tmpdir(), 'bfc-shims-'));
    tempDirs.push(dist);
    const file = await writePremiumShims(dist, { root });
    expect(file).toBe(path.join(dist, 'main', 'premium-shims.json'));
    const written = JSON.parse(readFileSync(file, 'utf8'));
    expect(Object.keys(written)).toEqual([...PREMIUM_SHARED_MODULES]);
    expect(written).toEqual(await premiumShimExports({ root }));
  });
});
