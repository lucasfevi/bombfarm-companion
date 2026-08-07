import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GEAR_PLAN_WORKER_MARKER } from '@bombfarm/domain/gear-plan';

const root = resolve(__dirname, '../..');
const outRoot = resolve(root, 'out');
const staticRoot = join(outRoot, '_next/static');

function walkJsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

describe('gear-plan worker build artifact', () => {
  it('documents the worker marker exported by the domain solver', () => {
    expect(GEAR_PLAN_WORKER_MARKER).toBe('runGearPlan');
  });

  it('skips with a visible message when out/ is absent', () => {
    if (existsSync(outRoot)) {
      expect(existsSync(outRoot)).toBe(true);
      return;
    }
    // Mirrors apps/web/src/tests/devtools-not-in-production-bundle.test.ts: byte-level
    // proof only runs after `pnpm --filter @bombfarm/web build` (CI runs build first).
    console.info(
      '[gear-plan-worker-bundle] out/ absent — skipping byte-level worker assertion (run web build first)',
    );
    expect(existsSync(outRoot)).toBe(false);
  });

  it('fails when out/ exists but no worker chunk references the gear-plan marker', () => {
    if (!existsSync(outRoot)) {
      console.info(
        '[gear-plan-worker-bundle] out/ absent — skipping worker-chunk presence assertion',
      );
      return;
    }
    const chunks = walkJsFiles(staticRoot);
    expect(chunks.length).toBeGreaterThan(0);
    const matches = chunks.filter((file) => {
      const base = file.replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      return (
        base.includes('gear-plan-worker') ||
        content.includes(GEAR_PLAN_WORKER_MARKER) ||
        (content.includes('forgeList') &&
          content.includes('moveList') &&
          content.includes('pointResets'))
      );
    });
    expect(matches, `no worker chunk contained ${GEAR_PLAN_WORKER_MARKER}`).not.toEqual([]);
  });
});
