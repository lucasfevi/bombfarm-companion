/**
 * The shared build-prerequisite guard (`tools/require-workspace-dist.mjs`), which three vitest
 * projects use: `@bombfarm/desktop` and `@bombfarm/game-api` as a project-wide `globalSetup`,
 * and `tools` as a per-file call from its one build-dependent test (see WIRED_PROJECTS below).
 *
 * It lives here rather than beside a single consumer because it belongs to none of them: `tools/`
 * is where the repo keeps build/CI tooling shared across packages, and `tools/vitest.config.ts`'s
 * `include: ['**\/*.test.mjs']` is the only one of the three that matches a bare `.mjs` test at
 * all (`apps/desktop` matches `scripts/**\/*.test.mjs`, `packages/game-api` only
 * `src/**\/*.test.ts`). `.github/workflows/ci-desktop.yml` runs the root vitest minus the web
 * project, so this file runs in CI.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  PACKAGES_ROOT,
  REQUIRED_DIST_PACKAGES,
  assertWorkspaceDistBuilt,
  missingDistPackages,
  projectNameOf,
  requiredDistPackages,
  setup,
} from './require-workspace-dist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const guardModule = path.join(__dirname, 'require-workspace-dist.mjs');

/**
 * Every vitest project that wires the guard up, and HOW. Kept as data so the wiring assertions
 * below and the required-list table can be checked against each other: a project listed here but
 * missing from REQUIRED_DIST_PACKAGES (or the reverse) is a drift bug.
 *
 * Two projects run it project-wide as `globalSetup`; every CI invocation of those two builds the
 * workspace packages first (`ci-desktop.yml` builds before `pnpm vitest run --project
 * '!@bombfarm/web'`, `ci-fidelity.yml` builds before `pnpm vitest run --project tools`), so a
 * project-wide throw never fires in a job that did not need a build.
 *
 * `tools` carries it per-file instead (`globalSetupConfig: null`). `globalSetup` runs once per
 * PROJECT before collection regardless of any filename filter, and
 * `.github/workflows/line-endings.yml` runs `pnpm vitest run --project tools line-endings`
 * build-free by design — a project-wide guard there failed a job that needed no build. Exactly one
 * of the project's 33 files needs `packages/domain/dist`, so the assert lives in that file.
 */
const WIRED_PROJECTS = [
  { project: '@bombfarm/desktop', globalSetupConfig: 'apps/desktop/vitest.config.ts' },
  { project: '@bombfarm/game-api', globalSetupConfig: 'packages/game-api/vitest.config.ts' },
  { project: 'tools', globalSetupConfig: null },
];

/** The `tools` project's per-file wiring — the config that must NOT carry it, and the file that must. */
const TOOLS_CONFIG = 'tools/vitest.config.ts';
const TOOLS_GUARDED_FILE = 'tools/advice-change-key-coverage.test.mjs';

/**
 * The guard is exercised against injected fixture roots, never against real build output:
 * deleting a real package's `dist` from inside a test would break every other file here.
 */
let fixtureRoot;

/** Builds a fake `packages/` root in which exactly `built` have a `dist/`. */
function makeRoot(label, built) {
  const root = path.join(fixtureRoot, label);
  mkdirSync(root, { recursive: true });
  for (const name of built) {
    mkdirSync(path.join(root, name, 'dist'), { recursive: true });
  }
  return root;
}

/** The `globalSetup` entry of a vitest config, resolved to an absolute path. */
function globalSetupTargets(configRelPath) {
  const configPath = path.join(repoRoot, configRelPath);
  const source = readFileSync(configPath, 'utf8');
  const match = /globalSetup:\s*\[([^\]]*)\]/.exec(source);
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(([, specifier]) =>
    path.resolve(path.dirname(configPath), specifier),
  );
}

beforeAll(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), 'bfc-workspace-dist-'));
});

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('REQUIRED_DIST_PACKAGES', () => {
  it('is the measured set each project needs built', () => {
    expect(REQUIRED_DIST_PACKAGES).toEqual({
      '@bombfarm/desktop': ['contracts', 'domain', 'game-api', 'game-data', 'tap-runtime'],
      '@bombfarm/game-api': ['domain'],
      tools: ['domain'],
    });
  });

  it('covers exactly the projects that wire the guard up — no more, no fewer', () => {
    expect(Object.keys(REQUIRED_DIST_PACKAGES).sort()).toEqual(
      WIRED_PROJECTS.map(({ project }) => project).sort(),
    );
  });

  it('names packages that exist in the workspace (the anchor, not the artifact)', () => {
    for (const required of Object.values(REQUIRED_DIST_PACKAGES)) {
      expect(required.length).toBeGreaterThan(0);
      for (const name of required) {
        const manifest = path.join(repoRoot, 'packages', name, 'package.json');
        expect(existsSync(manifest), manifest).toBe(true);
      }
    }
  });

  it('PACKAGES_ROOT points at packages/ inside this workspace', () => {
    expect(PACKAGES_ROOT).toBe(path.join(repoRoot, 'packages'));
  });
});

describe('guard wiring (every consumer reaches this one module)', () => {
  for (const { project, globalSetupConfig } of WIRED_PROJECTS) {
    if (globalSetupConfig) {
      it(`${globalSetupConfig} runs the shared guard as globalSetup`, () => {
        expect(globalSetupTargets(globalSetupConfig)).toEqual([guardModule]);
      });
    }

    it(`${project} declares a required-dist list`, () => {
      expect(() => requiredDistPackages(project)).not.toThrow();
    });
  }

  /**
   * The `tools` half of the wiring, asserted in two pieces so neither can rot unnoticed: the
   * project must NOT have a globalSetup (re-adding one re-breaks the build-free line-endings
   * job), and its one build-dependent file must carry the assert itself (deleting that call
   * turns this red, rather than silently downgrading the guard to a collection-time crash).
   */
  describe(`the tools project carries the guard per-file, not project-wide`, () => {
    const guardedSource = readFileSync(path.join(repoRoot, TOOLS_GUARDED_FILE), 'utf8');

    it(`${TOOLS_CONFIG} declares no globalSetup — line-endings.yml runs this project build-free`, () => {
      expect(globalSetupTargets(TOOLS_CONFIG)).toEqual([]);
    });

    it(`${TOOLS_GUARDED_FILE} imports the shared guard`, () => {
      expect(guardedSource).toMatch(/from '\.\/require-workspace-dist\.mjs'/);
    });

    it(`${TOOLS_GUARDED_FILE} calls assertWorkspaceDistBuilt('tools') at top level`, () => {
      expect(guardedSource).toMatch(/^assertWorkspaceDistBuilt\('tools'\);$/m);
    });

    /**
     * The hoisting hazard this arrangement exists to dodge: ESM `import` statements are hoisted,
     * so a static import of hero-advice.ts would resolve — and fail — BEFORE any top-level call
     * could run, handing back `Cannot find package '@bombfarm/domain/account-fidelity'` instead
     * of the guard's actionable message. It must arrive via a dynamic import placed after the
     * assert.
     */
    it('pulls hero-advice.ts in by dynamic import, after the assert — never by a hoisted static import', () => {
      expect(guardedSource).not.toMatch(/^import\b[^\n]*hero-advice\.ts/m);

      const assertIndex = guardedSource.indexOf("assertWorkspaceDistBuilt('tools');");
      const dynamicImportIndex = guardedSource.search(
        /await import\(\s*'\.\.\/apps\/desktop\/renderer\/lib\/planning\/hero-advice\.ts'\s*\)/,
      );
      expect(assertIndex).toBeGreaterThan(-1);
      expect(dynamicImportIndex).toBeGreaterThan(assertIndex);
    });
  });

  it('the desktop and game-api project names match their package manifests', () => {
    for (const [project, manifestPath] of [
      ['@bombfarm/desktop', 'apps/desktop/package.json'],
      ['@bombfarm/game-api', 'packages/game-api/package.json'],
    ]) {
      const manifest = JSON.parse(readFileSync(path.join(repoRoot, manifestPath), 'utf8'));
      expect(manifest.name).toBe(project);
    }
  });
});

describe('requiredDistPackages', () => {
  it('returns the measured list for a known project', () => {
    expect(requiredDistPackages('@bombfarm/game-api')).toEqual(['domain']);
  });

  it('throws for an unknown project rather than defaulting to an empty list', () => {
    expect(() => requiredDistPackages('@bombfarm/web')).toThrow(
      /no required-dist list is declared/,
    );
  });
});

describe('missingDistPackages', () => {
  it('reports every unbuilt package, in declaration order', () => {
    const root = makeRoot('none', []);
    expect(missingDistPackages('@bombfarm/desktop', root)).toEqual([
      'contracts',
      'domain',
      'game-api',
      'game-data',
      'tap-runtime',
    ]);
  });

  it('reports nothing when everything a project needs is built', () => {
    const root = makeRoot('all', REQUIRED_DIST_PACKAGES['@bombfarm/desktop']);
    expect(missingDistPackages('@bombfarm/desktop', root)).toEqual([]);
  });

  it('still reports the others when only domain is built (the false all-clear this closes)', () => {
    const root = makeRoot('domain-only', ['domain']);
    expect(missingDistPackages('@bombfarm/desktop', root)).toEqual([
      'contracts',
      'game-api',
      'game-data',
      'tap-runtime',
    ]);
    // Same root, different project: game-api and tools need domain alone and are satisfied.
    expect(missingDistPackages('@bombfarm/game-api', root)).toEqual([]);
    expect(missingDistPackages('tools', root)).toEqual([]);
  });

  it('reports domain for game-api and tools when only the others are built', () => {
    const root = makeRoot('no-domain', ['contracts', 'game-api', 'game-data', 'pricing', 'ui']);
    expect(missingDistPackages('@bombfarm/game-api', root)).toEqual(['domain']);
    expect(missingDistPackages('tools', root)).toEqual(['domain']);
  });
});

describe('assertWorkspaceDistBuilt', () => {
  it('throws when nothing is built, for every wired project', () => {
    const root = makeRoot('throw-none', []);
    for (const { project } of WIRED_PROJECTS) {
      expect(() => assertWorkspaceDistBuilt(project, root), project).toThrow(
        /require-workspace-dist/,
      );
    }
  });

  it('throws for desktop when only domain is built — a domain-only build is not enough', () => {
    const root = makeRoot('throw-domain-only', ['domain']);
    expect(() => assertWorkspaceDistBuilt('@bombfarm/desktop', root)).toThrow(
      /require-workspace-dist/,
    );
  });

  it('names every missing package, its full path, the build command, and the project', () => {
    const root = makeRoot('message', ['domain']);
    let message = '';
    try {
      assertWorkspaceDistBuilt('@bombfarm/desktop', root);
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

  it('names the failing project — three projects share this code and their lists differ', () => {
    const root = makeRoot('project-named', []);
    for (const { project } of WIRED_PROJECTS) {
      let message = '';
      try {
        assertWorkspaceDistBuilt(project, root);
      } catch (error) {
        message = error.message;
      }
      expect(message).toContain(project);
      expect(message).toContain('pnpm build');
      expect(message).toContain(path.join(root, 'domain', 'dist'));
    }
  });

  it('returns cleanly when everything the project needs is built', () => {
    const root = makeRoot('ok', REQUIRED_DIST_PACKAGES['@bombfarm/desktop']);
    for (const { project } of WIRED_PROJECTS) {
      expect(() => assertWorkspaceDistBuilt(project, root), project).not.toThrow();
      expect(assertWorkspaceDistBuilt(project, root)).toBeUndefined();
    }
  });
});

describe('projectNameOf', () => {
  it('reads the name off the vitest TestProject passed to globalSetup', () => {
    expect(projectNameOf({ name: 'tools' })).toBe('tools');
  });

  it('throws when the context carries no usable name, rather than skipping the check', () => {
    for (const context of [undefined, {}, { name: '' }, { name: 42 }]) {
      expect(() => projectNameOf(context), JSON.stringify(context ?? null)).toThrow(
        /carried no project name/,
      );
    }
  });
});

describe('setup (the globalSetup hook)', () => {
  afterEach(() => {
    vi.doUnmock('node:fs');
    vi.resetModules();
  });

  /**
   * Asserting `expect(() => setup(ctx)).not.toThrow()` against the real, built tree would pass
   * just as happily if `setup` were an empty function — and because a genuinely missing build
   * makes globalSetup throw, no test in this project ever runs to observe the other branch.
   * So the wiring is observed with the filesystem mocked out instead: gutting `setup` fails
   * these tests.
   */
  it('delegates to the assert against the real PACKAGES_ROOT, for every wired project', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ existsSync: () => false }));

    const fresh = await import('./require-workspace-dist.mjs');
    for (const { project } of WIRED_PROJECTS) {
      expect(() => fresh.setup({ name: project }), project).toThrow(/require-workspace-dist/);
    }
  });

  it('does not throw when the filesystem reports every dist present', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ existsSync: () => true }));

    const fresh = await import('./require-workspace-dist.mjs');
    for (const { project } of WIRED_PROJECTS) {
      expect(() => fresh.setup({ name: project }), project).not.toThrow();
    }
  });

  it('refuses a context with no project name even when everything is built', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ existsSync: () => true }));

    const fresh = await import('./require-workspace-dist.mjs');
    expect(() => fresh.setup({})).toThrow(/carried no project name/);
  });

  it('is the module export vitest calls (a named `setup` function of one argument)', () => {
    expect(typeof setup).toBe('function');
    expect(setup.length).toBe(1);
  });
});
