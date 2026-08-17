import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DOMAIN_DIST_ROOT,
  assertDomainDistBuilt,
  setup,
} from './require-domain-dist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');

/**
 * The guard is exercised against injected paths, never against real build output: deleting
 * `packages/domain/dist` from inside a test would break every other file in this project.
 */
let presentDir;
let absentDir;

beforeAll(() => {
  presentDir = mkdtempSync(path.join(tmpdir(), 'bfc-domain-dist-'));
  absentDir = path.join(presentDir, 'does-not-exist');
});

afterAll(() => {
  rmSync(presentDir, { recursive: true, force: true });
});

describe('assertDomainDistBuilt', () => {
  it('throws when the dist path is absent', () => {
    expect(() => assertDomainDistBuilt(absentDir)).toThrow(/is missing/);
  });

  it('names both build commands and the path in the error', () => {
    let message = '';
    try {
      assertDomainDistBuilt(absentDir);
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain(absentDir);
    expect(message).toContain('pnpm build');
    expect(message).toContain('pnpm --filter @bombfarm/domain build');
    expect(message).toContain('@bombfarm/domain');
  });

  it('returns cleanly when the dist path is present', () => {
    expect(existsSync(presentDir)).toBe(true);
    expect(() => assertDomainDistBuilt(presentDir)).not.toThrow();
    expect(assertDomainDistBuilt(presentDir)).toBeUndefined();
  });
});

describe('DOMAIN_DIST_ROOT', () => {
  it('points at packages/domain/dist inside this workspace', () => {
    expect(DOMAIN_DIST_ROOT).toBe(path.join(repoRoot, 'packages', 'domain', 'dist'));
    // The anchor, not the artifact: the package must exist even when it has not been built.
    expect(existsSync(path.join(repoRoot, 'packages', 'domain', 'package.json'))).toBe(true);
  });
});

describe('setup (the globalSetup hook)', () => {
  it('checks the real DOMAIN_DIST_ROOT — it throws iff that path is absent', () => {
    if (existsSync(DOMAIN_DIST_ROOT)) {
      expect(() => setup()).not.toThrow();
    } else {
      expect(() => setup()).toThrow(/require-domain-dist/);
    }
  });
});
