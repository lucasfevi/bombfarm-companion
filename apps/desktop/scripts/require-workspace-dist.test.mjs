import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  PACKAGES_ROOT,
  REQUIRED_DIST_PACKAGES,
  assertWorkspaceDistBuilt,
  missingDistPackages,
  setup,
} from './require-workspace-dist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');

/**
 * The guard is exercised against injected fixture roots, never against real build output:
 * deleting a real package's `dist` from inside a test would break every other file here.
 */
let fixtureRoot;

/** Builds a fake `packages/` root in which exactly `built` have a `dist/`. */
function makeRoot(label, built) {
  const root = path.join(fixtureRoot, label);
  for (const name of built) {
    mkdirSync(path.join(root, name, 'dist'), { recursive: true });
  }
  mkdirSync(root, { recursive: true });
  return root;
}

beforeAll(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), 'bfc-workspace-dist-'));
});

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('REQUIRED_DIST_PACKAGES', () => {
  it('is the measured set the desktop vitest project needs built', () => {
    expect(REQUIRED_DIST_PACKAGES).toEqual(['contracts', 'domain', 'game-api', 'game-data']);
  });

  it('names packages that exist in the workspace (the anchor, not the artifact)', () => {
    for (const name of REQUIRED_DIST_PACKAGES) {
      const manifest = path.join(repoRoot, 'packages', name, 'package.json');
      expect(existsSync(manifest), manifest).toBe(true);
    }
  });

  it('PACKAGES_ROOT points at packages/ inside this workspace', () => {
    expect(PACKAGES_ROOT).toBe(path.join(repoRoot, 'packages'));
  });
});

describe('missingDistPackages', () => {
  it('reports every unbuilt package, in declaration order', () => {
    const root = makeRoot('none', []);
    expect(missingDistPackages(root)).toEqual(REQUIRED_DIST_PACKAGES);
  });

  it('reports nothing when all four are built', () => {
    const root = makeRoot('all', REQUIRED_DIST_PACKAGES);
    expect(missingDistPackages(root)).toEqual([]);
  });

  it('still reports the other three when only domain is built (the false all-clear this closes)', () => {
    const root = makeRoot('domain-only', ['domain']);
    expect(missingDistPackages(root)).toEqual(['contracts', 'game-api', 'game-data']);
  });
});

describe('assertWorkspaceDistBuilt', () => {
  it('throws when nothing is built', () => {
    const root = makeRoot('throw-none', []);
    expect(() => assertWorkspaceDistBuilt(root)).toThrow(/require-workspace-dist/);
  });

  it('throws when only domain is built — a domain-only build is not enough', () => {
    const root = makeRoot('throw-domain-only', ['domain']);
    expect(() => assertWorkspaceDistBuilt(root)).toThrow(/require-workspace-dist/);
  });

  it('names every missing package, its full path, and the build command', () => {
    const root = makeRoot('message', ['domain']);
    let message = '';
    try {
      assertWorkspaceDistBuilt(root);
    } catch (error) {
      message = error.message;
    }

    for (const name of ['contracts', 'game-api', 'game-data']) {
      expect(message).toContain(path.join(root, name, 'dist'));
    }
    // The one that IS built must not be named as missing.
    expect(message).not.toContain(path.join(root, 'domain', 'dist'));
    expect(message).toContain('pnpm build');
    expect(message).toContain('@bombfarm/desktop');
  });

  it('returns cleanly when all four are built', () => {
    const root = makeRoot('ok', REQUIRED_DIST_PACKAGES);
    expect(() => assertWorkspaceDistBuilt(root)).not.toThrow();
    expect(assertWorkspaceDistBuilt(root)).toBeUndefined();
  });
});

describe('setup (the globalSetup hook)', () => {
  afterEach(() => {
    vi.doUnmock('node:fs');
    vi.resetModules();
  });

  /**
   * Asserting `expect(() => setup()).not.toThrow()` against the real, built tree would pass
   * just as happily if `setup` were an empty function — and because a genuinely missing build
   * makes globalSetup throw, no test in this project ever runs to observe the other branch.
   * So the wiring is observed with the filesystem mocked out instead: gutting `setup` fails
   * this test.
   */
  it('delegates to the assert against the real PACKAGES_ROOT', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ existsSync: () => false }));

    const fresh = await import('./require-workspace-dist.mjs');
    expect(() => fresh.setup()).toThrow(/require-workspace-dist/);
  });

  it('does not throw when the filesystem reports every dist present', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ existsSync: () => true }));

    const fresh = await import('./require-workspace-dist.mjs');
    expect(() => fresh.setup()).not.toThrow();
  });
});
