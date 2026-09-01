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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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
 * those two builds the workspace packages first, so a project-wide throw never fires in a job that
 * did not need a build. That the workflows really do build first is no longer asserted only in
 * this comment — the CI-coverage block below reads them.
 *
 * `tools` carries it per-file instead (`globalSetupConfig: null`), with one key per FILE rather
 * than one key for the whole project. `globalSetup` runs once per PROJECT before collection
 * regardless of any filename filter, and `.github/workflows/line-endings.yml` runs `pnpm vitest
 * run --project tools line-endings` build-free by design — a project-wide guard there failed a job
 * that needed no build. Per-file is also what keeps the demand honest now that the files diverge:
 * `derived-fixture-drift.test.mjs` needs `domain` AND `game-api`, `market-item-linking.test.mjs`
 * needs `pricing`, and a shared `tools` list would under-demand for one and over-demand for the
 * other.
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
    requiredDistKeys: [
      'tools/derived-fixture-drift.test.mjs',
      'tools/market-item-linking.test.mjs',
    ],
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

/** The `tools` project's per-file wiring — the config that must NOT carry it, and the file that must. */
const TOOLS_CONFIG = 'tools/vitest.config.ts';
const TOOLS_GUARDED_FILES = [
  {
    file: 'tools/derived-fixture-drift.test.mjs',
    requiredPackages: ['domain', 'game-api'],
    dynamicImports: [
      {
        target: "'../packages/game-api/scripts/generate-domain-fixtures.mjs'",
        dynamicPattern: /await import\(\s*'\.\.\/packages\/game-api\/scripts\/generate-domain-fixtures\.mjs'\s*\)/,
        staticPattern: /^import\b[^\n]*generate-domain-fixtures\.mjs/m,
      },
    ],
  },
  {
    file: 'tools/market-item-linking.test.mjs',
    requiredPackages: ['pricing'],
    dynamicImports: [
      {
        // Through a variable, because Vite's import analysis resolves a literal package specifier
        // while transforming the file — before the top-level assert can run — and replaces the
        // guard's message with its own.
        target: "'@bombfarm/pricing'",
        dynamicPattern: /const PRICING_PACKAGE = '@bombfarm\/pricing';[\s\S]{0,200}?await import\([^)]*PRICING_PACKAGE\)/,
        staticPattern: /^import\b[^\n]*'@bombfarm\/pricing'/m,
      },
      {
        // The builder imports @bombfarm/pricing itself, so a hoisted static import of it would
        // fail before the assert just as surely as importing the package directly.
        target: "'./market-snapshot/build.mjs'",
        dynamicPattern: /await import\(\s*'\.\/market-snapshot\/build\.mjs'\s*\)/,
        staticPattern: /^import\b[^\n]*market-snapshot\/build\.mjs/m,
      },
    ],
  },
];

/**
 * The union of every guarded file's required packages: what a CI job has to have built before it
 * runs the `tools` project with no filename filter, since then every file in it collects.
 */
const TOOLS_REQUIRED_PACKAGES = [
  ...new Set(TOOLS_GUARDED_FILES.flatMap(({ requiredPackages }) => requiredPackages)),
].sort();

const WORKFLOWS_DIR = path.join(repoRoot, '.github/workflows');

/** Drops whole-line `#` comments, so prose quoting a command is never mistaken for one. */
function stripComments(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/**
 * Every top-level `jobs.<name>:` block of a workflow, as `{ job, body }`. Text slicing rather than
 * a YAML parse, matching what the other workflow guards in this directory already do.
 */
function workflowJobs(workflowText) {
  const text = stripComments(workflowText);
  const jobsIndex = text.search(/^jobs:\s*$/m);
  if (jobsIndex === -1) return [];

  const jobs = [];
  let current = null;
  for (const line of text.slice(jobsIndex).split('\n')) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) {
      if (current) jobs.push(current);
      current = { job: header[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) jobs.push(current);
  return jobs.map(({ job, lines }) => ({ job, body: lines.join('\n') }));
}

/**
 * Every step's `run:` command in a job body, in order, each with the offset it starts at. Folded
 * (`>`) and literal (`|`) block scalars are joined back onto one line: step keys sit at eight
 * spaces, so a scalar's content is whatever is indented deeper.
 */
function runCommands(jobBody) {
  const lines = jobBody.split('\n');
  const commands = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const lineStart = offset;
    offset += lines[i].length + 1;

    const match = /^ {8}run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;

    const head = match[1] === '>' || match[1] === '|' ? '' : match[1];
    const parts = head ? [head] : [];
    for (let j = i + 1; j < lines.length && !/^ {0,8}\S/.test(lines[j]); j += 1) {
      if (lines[j].trim()) parts.push(lines[j].trim());
    }
    commands.push({ command: parts.join(' ').trim(), index: lineStart });
  }
  return commands;
}

/**
 * How a `pnpm vitest run` command relates to the `tools` project, or `null` when it never reaches
 * it. A `--project` list can select it by name, exclude something else (`'!@bombfarm/web'` still
 * runs it), or be absent entirely (every project runs). A trailing positional is vitest's filename
 * filter — with one, only the named files collect, which is how line-endings.yml runs this project
 * build-free on purpose.
 */
function toolsProjectRun(command) {
  if (!/\bvitest run\b/.test(command)) return null;

  const tokens = command.trim().split(/\s+/);
  const args = tokens.slice(tokens.indexOf('run') + 1);
  const projects = [];
  const positionals = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--project') {
      projects.push((args[i + 1] ?? '').replace(/^'|'$/g, ''));
      i += 1;
    } else if (!args[i].startsWith('--')) {
      positionals.push(args[i]);
    }
  }

  const runsTools =
    projects.length === 0 ||
    projects.some((name) => (name.startsWith('!') ? name.slice(1) !== 'tools' : name === 'tools'));
  return runsTools ? { filtered: positionals.length > 0 } : null;
}

/**
 * The `packages/<name>` short names a command builds: `[]` when it is not a package build at all,
 * and `null` for an unfiltered one, which builds the whole workspace and so covers everything.
 */
function packagesBuiltBy(command) {
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== 'pnpm' || tokens[tokens.length - 1] !== 'build') return [];

  const filters = [...command.matchAll(/--filter\s+@bombfarm\/([A-Za-z0-9-]+)/g)].map(([, name]) => name);
  return filters.length > 0 ? filters : null;
}

/** Which of `required` a job has NOT built by the time it reaches `index`, in declaration order. */
function unbuiltBefore(jobBody, index, required) {
  const built = new Set();
  for (const { command, index: commandIndex } of runCommands(jobBody)) {
    if (commandIndex >= index) break;
    const names = packagesBuiltBy(command);
    if (names === null) return [];
    for (const name of names) built.add(name);
  }
  return required.filter((name) => !built.has(name));
}

/** Every unfiltered `tools`-project run in the given workflows, with what it leaves unbuilt. */
function unfilteredToolsRuns(workflows) {
  const runs = [];
  for (const { workflow, text } of workflows) {
    for (const { job, body } of workflowJobs(text)) {
      for (const { command, index } of runCommands(body)) {
        const run = toolsProjectRun(command);
        if (!run || run.filtered) continue;
        runs.push({
          workflow,
          job,
          command,
          unbuilt: unbuiltBefore(body, index, TOOLS_REQUIRED_PACKAGES),
        });
      }
    }
  }
  return runs;
}

/** Every workflow file on disk, read once. */
function allWorkflows() {
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()
    .map((workflow) => ({ workflow, text: readFileSync(path.join(WORKFLOWS_DIR, workflow), 'utf8') }));
}

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
      '@bombfarm/desktop': ['contracts', 'domain', 'game-api', 'game-data', 'pricing', 'tap-runtime'],
      '@bombfarm/game-api': ['domain'],
      'tools/derived-fixture-drift.test.mjs': ['domain', 'game-api'],
      'tools/market-item-linking.test.mjs': ['pricing'],
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

    for (const { file, requiredPackages, dynamicImports } of TOOLS_GUARDED_FILES) {
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
        for (const { target, dynamicPattern, staticPattern } of dynamicImports) {
          it(`pulls ${target} in by dynamic import, after the assert — never by a hoisted static import`, () => {
            expect(guardedSource).not.toMatch(staticPattern);

            const assertIndex = guardedSource.indexOf(ownCallText);
            const dynamicImportIndex = guardedSource.search(dynamicPattern);
            expect(assertIndex).toBeGreaterThan(-1);
            expect(dynamicImportIndex).toBeGreaterThan(assertIndex);
          });
        }
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

/**
 * The half of the arrangement the guard itself cannot enforce. `assertWorkspaceDistBuilt` makes an
 * unbuilt package fail loudly instead of quietly not running — but it cannot make CI build it, and
 * a job that never builds fails on every run rather than testing anything. That gap is not
 * theoretical: `market-item-linking.test.mjs` reached `develop` while the one job that runs this
 * project unfiltered built domain and game-api and not pricing, and it surfaced days later on a
 * release branch, because the workflow's own path filter had kept the job from ever running on the
 * pull request that added the file.
 *
 * Stated over the workflows rather than over one named job, so a new place that runs the project
 * is held to the same bar as the two that exist today.
 */
describe('CI jobs that run the tools project build what its guarded files need', () => {
  const runs = unfilteredToolsRuns(allWorkflows());

  it('finds the unfiltered tools runs — an empty scan would pass every assertion below', () => {
    expect(runs.map(({ workflow, job }) => `${workflow}:${job}`)).toEqual([
      'ci-desktop.yml:quality',
      'ci-fidelity.yml:fidelity-gate',
    ]);
  });

  it('demands the union of the guarded files, not one file\'s share of it', () => {
    expect(TOOLS_REQUIRED_PACKAGES).toEqual(['domain', 'game-api', 'pricing']);
  });

  for (const { workflow, job, unbuilt } of runs) {
    it(`${workflow}:${job} builds every required package before running the project`, () => {
      expect(unbuilt).toEqual([]);
    });
  }

  it('exempts a run that carries a filename filter — line-endings.yml runs this project build-free', () => {
    const lineEndings = readFileSync(path.join(WORKFLOWS_DIR, 'line-endings.yml'), 'utf8');
    const filtered = workflowJobs(lineEndings)
      .flatMap(({ body }) => runCommands(body))
      .map(({ command }) => toolsProjectRun(command))
      .filter(Boolean);

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(({ filtered: hasFilter }) => hasFilter)).toBe(true);
  });

  /**
   * Red state on the real workflow rather than a hand-written fixture: delete the step that builds
   * one required package and the scan must name it. Without this, every assertion above still
   * passes if the reader silently stops finding build steps.
   */
  it('names the package when its build step is deleted from the workflow', () => {
    const workflow = 'ci-fidelity.yml';
    const text = readFileSync(path.join(WORKFLOWS_DIR, workflow), 'utf8');
    const withoutPricingBuild = text.replace(/^ {8}run: pnpm --filter @bombfarm\/pricing build$/m, '');

    expect(withoutPricingBuild).not.toBe(text);
    expect(unfilteredToolsRuns([{ workflow, text: withoutPricingBuild }])).toEqual([
      expect.objectContaining({ job: 'fidelity-gate', unbuilt: ['pricing'] }),
    ]);
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
      'pricing',
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
      'pricing',
      'tap-runtime',
    ]);
    // Same root, different key: game-api needs domain alone and is satisfied;
    // derived-fixture-drift.test.mjs needs domain AND game-api, so it is still short one.
    expect(missingDistPackages('@bombfarm/game-api', root)).toEqual([]);
    expect(missingDistPackages('tools/derived-fixture-drift.test.mjs', root)).toEqual(['game-api']);
  });

  it('reports domain for game-api, and domain+game-api in declaration order for derived-fixture-drift, when only the others are built', () => {
    const root = makeRoot('no-domain', ['contracts', 'game-data', 'pricing', 'ui']);
    expect(missingDistPackages('@bombfarm/game-api', root)).toEqual(['domain']);
    expect(missingDistPackages('tools/derived-fixture-drift.test.mjs', root)).toEqual(['domain', 'game-api']);
  });

  it('game-api is satisfied by domain alone even when every other package is entirely absent (the false positive this closes)', () => {
    const root = makeRoot('only-domain', ['domain']);
    expect(missingDistPackages('@bombfarm/game-api', root)).toEqual([]);
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
      for (const name of requiredDistPackages(key)) {
        expect(message, key).toContain(path.join(root, name, 'dist'));
      }
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
