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
 * Every vitest project that wires the guard up, and HOW, plus the `REQUIRED_DIST_PACKAGES` key(s)
 * that consumer resolves. Kept as data so the wiring assertions below and the required-list table
 * can be checked against each other: a key listed here but missing from REQUIRED_DIST_PACKAGES (or
 * the reverse) is a drift bug.
 *
 * Two projects run it project-wide as `globalSetup`, one key per project; every CI invocation of
 * those two builds the workspace packages first (`ci-desktop.yml` builds before `pnpm vitest run
 * --project '!@bombfarm/web'`, `ci-fidelity.yml` builds before `pnpm vitest run --project tools`),
 * so a project-wide throw never fires in a job that did not need a build.
 *
 * `tools` carries it per-file instead (`globalSetupConfig: null`), with one key per FILE rather
 * than one key for the whole project. `globalSetup` runs once per PROJECT before collection
 * regardless of any filename filter, and `.github/workflows/line-endings.yml` runs `pnpm vitest
 * run --project tools line-endings` build-free by design — a project-wide guard there failed a job
 * that needed no build. But per-file keys are not just about that job: the project's two
 * build-dependent files need DIFFERENT packages (`advice-change-key-coverage.test.mjs` needs only
 * `domain`; `derived-fixture-drift.test.mjs` needs `domain` AND `game-api`), so a single shared
 * `tools` list would either under-demand for one file or over-demand for the other. Each file calls
 * the assert on its own key.
 */
const WIRED_PROJECTS = [
  {
    project: '@bombfarm/desktop',
    globalSetupConfig: 'apps/desktop/vitest.config.ts',
    requiredDistKeys: ['@bombfarm/desktop'],
  },
  {
    project: '@bombfarm/game-api',
    globalSetupConfig: 'packages/game-api/vitest.config.ts',
    requiredDistKeys: ['@bombfarm/game-api'],
  },
  {
    project: 'tools',
    globalSetupConfig: null,
    requiredDistKeys: ['tools/advice-change-key-coverage.test.mjs', 'tools/derived-fixture-drift.test.mjs'],
  },
];

/** Every `REQUIRED_DIST_PACKAGES` key, across every consumer, project-wide or per-file. */
const ALL_REQUIRED_DIST_KEYS = WIRED_PROJECTS.flatMap(({ requiredDistKeys }) => requiredDistKeys);

/**
 * The subset of `WIRED_PROJECTS` that actually wires `setup` up as `globalSetup` — `tools` is
 * deliberately excluded: it calls {@link assertWorkspaceDistBuilt} per-file instead (see above), so
 * `setup({ name: 'tools' })` is never a real call vitest makes, and `'tools'` is not even a key
 * `requiredDistPackages` recognizes any more (its two files are).
 */
const GLOBAL_SETUP_PROJECTS = WIRED_PROJECTS.filter(({ globalSetupConfig }) => globalSetupConfig);

/** The `tools` project's per-file wiring — the config that must NOT carry it, and the files that must. */
const TOOLS_CONFIG = 'tools/vitest.config.ts';
const TOOLS_GUARDED_FILES = [
  {
    file: 'tools/advice-change-key-coverage.test.mjs',
    requiredPackages: ['domain'],
    dynamicImportTarget: "'../apps/desktop/renderer/lib/planning/hero-advice.ts'",
    dynamicImportPattern: /await import\(\s*'\.\.\/apps\/desktop\/renderer\/lib\/planning\/hero-advice\.ts'\s*\)/,
    staticImportPattern: /^import\b[^\n]*hero-advice\.ts/m,
  },
  {
    file: 'tools/derived-fixture-drift.test.mjs',
    requiredPackages: ['domain', 'game-api'],
    dynamicImportTarget: "'../packages/game-api/scripts/generate-domain-fixtures.mjs'",
    dynamicImportPattern: /await import\(\s*'\.\.\/packages\/game-api\/scripts\/generate-domain-fixtures\.mjs'\s*\)/,
    staticImportPattern: /^import\b[^\n]*generate-domain-fixtures\.mjs/m,
  },
];

/** Escapes a literal string for use inside a `new RegExp(...)`. */
function escapeForRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  it('is the measured set each consumer needs built', () => {
    expect(REQUIRED_DIST_PACKAGES).toEqual({
      '@bombfarm/desktop': ['contracts', 'domain', 'game-api', 'game-data', 'tap-runtime'],
      '@bombfarm/game-api': ['domain'],
      'tools/advice-change-key-coverage.test.mjs': ['domain'],
      'tools/derived-fixture-drift.test.mjs': ['domain', 'game-api'],
    });
  });

  it('covers exactly the keys that wire the guard up — no more, no fewer', () => {
    expect(Object.keys(REQUIRED_DIST_PACKAGES).sort()).toEqual([...ALL_REQUIRED_DIST_KEYS].sort());
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
  for (const { project, globalSetupConfig, requiredDistKeys } of WIRED_PROJECTS) {
    if (globalSetupConfig) {
      it(`${globalSetupConfig} runs the shared guard as globalSetup`, () => {
        expect(globalSetupTargets(globalSetupConfig)).toEqual([guardModule]);
      });
    }

    it(`${project} declares a required-dist list for every one of its keys`, () => {
      for (const key of requiredDistKeys) {
        expect(() => requiredDistPackages(key), key).not.toThrow();
      }
    });
  }

  /**
   * The `tools` half of the wiring, asserted in two pieces per file so neither can rot unnoticed:
   * the project must NOT have a globalSetup (re-adding one re-breaks the build-free line-endings
   * job), and each build-dependent file must carry the assert itself (deleting that call turns
   * this red, rather than silently downgrading the guard to a collection-time crash).
   */
  describe(`the tools project carries the guard per-file, not project-wide`, () => {
    it(`${TOOLS_CONFIG} declares no globalSetup — line-endings.yml runs this project build-free`, () => {
      expect(globalSetupTargets(TOOLS_CONFIG)).toEqual([]);
    });

    for (const {
      file,
      requiredPackages,
      dynamicImportTarget,
      dynamicImportPattern,
      staticImportPattern,
    } of TOOLS_GUARDED_FILES) {
      describe(file, () => {
        const guardedSource = readFileSync(path.join(repoRoot, file), 'utf8');
        const ownCallText = `assertWorkspaceDistBuilt('${file}');`;
        const ownCallPattern = new RegExp(`^${escapeForRegExp(ownCallText)}$`, 'm');

        it('imports the shared guard', () => {
          expect(guardedSource).toMatch(/from '\.\/require-workspace-dist\.mjs'/);
        });

        it(`calls assertWorkspaceDistBuilt('${file}') at top level — its OWN key, not a shared 'tools' key`, () => {
          expect(guardedSource).toMatch(ownCallPattern);
        });

        it('requires exactly its own measured packages, not the whole tools project\'s union', () => {
          expect(requiredDistPackages(file)).toEqual(requiredPackages);
        });

        /**
         * The hoisting hazard this arrangement exists to dodge: ESM `import` statements are
         * hoisted, so a static import of the build-dependent module would resolve — and fail —
         * BEFORE any top-level call could run, handing back a bare `Cannot find module`/`Cannot
         * find package` error instead of the guard's actionable message. It must arrive via a
         * dynamic import placed after the assert.
         */
        it(`pulls ${dynamicImportTarget} in by dynamic import, after the assert — never by a hoisted static import`, () => {
          expect(guardedSource).not.toMatch(staticImportPattern);

          const assertIndex = guardedSource.indexOf(ownCallText);
          const dynamicImportIndex = guardedSource.search(dynamicImportPattern);
          expect(assertIndex).toBeGreaterThan(-1);
          expect(dynamicImportIndex).toBeGreaterThan(assertIndex);
        });
      });
    }
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
    // Same root, different key: game-api needs domain alone and is satisfied, and so does
    // advice-change-key-coverage.test.mjs; derived-fixture-drift.test.mjs needs domain AND
    // game-api, so it is still short one.
    expect(missingDistPackages('@bombfarm/game-api', root)).toEqual([]);
    expect(missingDistPackages('tools/advice-change-key-coverage.test.mjs', root)).toEqual([]);
    expect(missingDistPackages('tools/derived-fixture-drift.test.mjs', root)).toEqual(['game-api']);
  });

  it('reports domain for game-api and for advice-change-key-coverage, and domain+game-api in declaration order for derived-fixture-drift, when only the others are built', () => {
    const root = makeRoot('no-domain', ['contracts', 'game-data', 'pricing', 'ui']);
    expect(missingDistPackages('@bombfarm/game-api', root)).toEqual(['domain']);
    expect(missingDistPackages('tools/advice-change-key-coverage.test.mjs', root)).toEqual(['domain']);
    expect(missingDistPackages('tools/derived-fixture-drift.test.mjs', root)).toEqual(['domain', 'game-api']);
  });

  it('advice-change-key-coverage.test.mjs is satisfied by domain alone even when game-api is entirely absent (the false positive this closes)', () => {
    const root = makeRoot('game-api-absent', ['domain']);
    expect(missingDistPackages('tools/advice-change-key-coverage.test.mjs', root)).toEqual([]);
  });
});

describe('assertWorkspaceDistBuilt', () => {
  it('throws when nothing is built, for every wired key', () => {
    const root = makeRoot('throw-none', []);
    for (const key of ALL_REQUIRED_DIST_KEYS) {
      expect(() => assertWorkspaceDistBuilt(key, root), key).toThrow(/require-workspace-dist/);
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

  it('names the failing key — four keys share this code and their lists differ', () => {
    const root = makeRoot('project-named', []);
    for (const key of ALL_REQUIRED_DIST_KEYS) {
      let message = '';
      try {
        assertWorkspaceDistBuilt(key, root);
      } catch (error) {
        message = error.message;
      }
      expect(message).toContain(key);
      expect(message).toContain('pnpm build');
      expect(message).toContain(path.join(root, 'domain', 'dist'));
    }
  });

  it('returns cleanly when everything a key needs is built', () => {
    const root = makeRoot('ok', REQUIRED_DIST_PACKAGES['@bombfarm/desktop']);
    for (const key of ALL_REQUIRED_DIST_KEYS) {
      expect(() => assertWorkspaceDistBuilt(key, root), key).not.toThrow();
      expect(assertWorkspaceDistBuilt(key, root)).toBeUndefined();
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
  it('delegates to the assert against the real PACKAGES_ROOT, for every globalSetup-wired project', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ existsSync: () => false }));

    const fresh = await import('./require-workspace-dist.mjs');
    for (const { project } of GLOBAL_SETUP_PROJECTS) {
      expect(() => fresh.setup({ name: project }), project).toThrow(/require-workspace-dist/);
    }
  });

  it('does not throw when the filesystem reports every dist present', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ existsSync: () => true }));

    const fresh = await import('./require-workspace-dist.mjs');
    for (const { project } of GLOBAL_SETUP_PROJECTS) {
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
