import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WEB_MANIFEST_PATH = join(root, 'apps/web/package.json');
const E2E_WEB_PATH = join(root, '.github/workflows/e2e-web.yml');
const CI_WEB_PATH = join(root, '.github/workflows/ci-web.yml');

/**
 * `e2e-web.yml` and `ci-web.yml` each keep two path-filter lists (`on.push.paths` and the
 * `dorny/paths-filter` filter). A workspace package the web app depends on but the lists omit
 * means a PR touching only that package merges with the browser suite reporting "no
 * e2e-relevant file changes" — the lists once named domain and ui alone, while the app also
 * depends on account, farm, game-art, hero, pricing and team-plan.
 *
 * The lists are derived here, not hand-maintained: the `packages/<dir>/**` entries of each
 * list must equal, exactly, the transitive `@bombfarm/*` dependency closure of
 * `apps/web/package.json`, resolved through every workspace package's manifest. A new workspace
 * dependency fails this guard until both workflows name it; a stale entry fails it until it is
 * removed or listed in {@link ALLOWED_EXTRA_PACKAGE_GLOBS}.
 */

/** Package globs a list may carry beyond the closure, allowed by name rather than by loosening. */
const ALLOWED_EXTRA_PACKAGE_GLOBS = [];

const ROOT_MANIFEST_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];
const TRANSITIVE_MANIFEST_FIELDS = ['dependencies', 'peerDependencies'];

function declaredWorkspaceDeps(manifest, fields) {
  const names = fields.flatMap((field) => Object.keys(manifest[field] ?? {}));
  return [...new Set(names.filter((name) => name.startsWith('@bombfarm/')))];
}

/** Every `<dir>/package.json` under a workspace folder, keyed by the manifest's `name` field. */
function manifestsUnder(folder) {
  const index = new Map();
  for (const dir of readdirSync(join(root, folder))) {
    const manifestPath = join(root, folder, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    index.set(manifest.name, { dir, manifest });
  }
  return index;
}

/**
 * The transitive workspace closure of a root manifest, as `Map<name, packages dir>`. Throws on a
 * name that no `packages/*` manifest declares: a dependency that cannot be mapped to a glob must
 * fail the guard, never drop out of the comparison.
 */
function workspaceClosure(rootManifest, packageIndex, appNames) {
  const closure = new Map();
  const queue = declaredWorkspaceDeps(rootManifest, ROOT_MANIFEST_FIELDS);
  while (queue.length > 0) {
    const name = queue.shift();
    if (closure.has(name) || appNames.has(name)) continue;
    const entry = packageIndex.get(name);
    if (!entry) {
      throw new Error(`${name} is not declared by any packages/*/package.json — cannot map it to a path glob`);
    }
    closure.set(name, entry.dir);
    queue.push(...declaredWorkspaceDeps(entry.manifest, TRANSITIVE_MANIFEST_FIELDS));
  }
  return closure;
}

function closureGlobs(closure) {
  return [...closure.values()].map((dir) => `packages/${dir}/**`).sort();
}

function extractQuotedListAfter(text, anchorLine) {
  const lines = text.split('\n');
  const anchorIndex = lines.findIndex((line) => line.trim() === anchorLine);
  if (anchorIndex === -1) return null;

  const items = [];
  for (let i = anchorIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s*-\s*'([^']+)'\s*$/);
    if (!match) break;
    items.push(match[1]);
  }
  return items;
}

const PACKAGE_GLOB = /^packages\/[^/]+\/\*\*$/;

/** Which closure globs a list lacks, and which package globs it carries that the closure does not. */
function packageGlobDrift(listItems, expectedGlobs) {
  const listed = new Set(listItems.filter((item) => PACKAGE_GLOB.test(item)));
  const expected = new Set(expectedGlobs);
  const missing = [...expected].filter((glob) => !listed.has(glob)).sort();
  const extras = [...listed]
    .filter((glob) => !expected.has(glob) && !ALLOWED_EXTRA_PACKAGE_GLOBS.includes(glob))
    .sort();
  return { missing, extras };
}

function mutate(text, search, replacement, fileLabel) {
  const mutated = text.replace(search, replacement);
  if (mutated === text) {
    throw new Error(
      `mutation did not apply — the anchor ${String(search)} is no longer in ${fileLabel}, ` +
        'so this red-state case was about to pass without demonstrating anything.',
    );
  }
  return mutated;
}

const packageIndex = manifestsUnder('packages');
const appNames = new Set(manifestsUnder('apps').keys());
const webManifestText = readFileSync(WEB_MANIFEST_PATH, 'utf8');
const closure = workspaceClosure(JSON.parse(webManifestText), packageIndex, appNames);
const expectedGlobs = closureGlobs(closure);

describe('apps/web workspace dependency closure', () => {
  it('resolves every package through its manifest name, and follows edges transitively', () => {
    expect(closure.size).toBeGreaterThanOrEqual(9);
    for (const name of ['@bombfarm/domain', '@bombfarm/ui', '@bombfarm/team-plan']) {
      expect([...closure.keys()]).toContain(name);
    }
    expect([...closure.keys()], 'contracts arrives only transitively').toContain('@bombfarm/contracts');
    expect(declaredWorkspaceDeps(JSON.parse(webManifestText), ROOT_MANIFEST_FIELDS)).not.toContain(
      '@bombfarm/contracts',
    );
  });

  it('never includes an app', () => {
    for (const name of closure.keys()) expect(appNames.has(name), name).toBe(false);
  });
});

const WORKFLOWS = [
  { file: 'e2e-web.yml', path: E2E_WEB_PATH, filterAnchor: 'e2e:' },
  { file: 'ci-web.yml', path: CI_WEB_PATH, filterAnchor: 'web:' },
];

for (const { file, path, filterAnchor } of WORKFLOWS) {
  describe(`${file} — both path-filter lists name exactly the packages the web app depends on`, () => {
    const workflowText = readFileSync(path, 'utf8');
    const lists = [
      { label: 'on.push.paths', items: extractQuotedListAfter(workflowText, 'paths:') },
      { label: `dorny ${filterAnchor} filter`, items: extractQuotedListAfter(workflowText, filterAnchor) },
    ];

    for (const { label, items } of lists) {
      it(`finds a non-empty ${label} list`, () => {
        expect(items).not.toBeNull();
        expect(items.length).toBeGreaterThan(0);
      });

      it(`${label} lacks none of the closure's packages`, () => {
        expect(packageGlobDrift(items, expectedGlobs).missing).toEqual([]);
      });

      it(`${label} carries no package outside the closure (or the allowed extras)`, () => {
        expect(packageGlobDrift(items, expectedGlobs).extras).toEqual([]);
      });
    }
  });
}

describe('red state — the comparison names the offender on a mutation of the real files', () => {
  const e2eText = readFileSync(E2E_WEB_PATH, 'utf8');

  it('packages/team-plan/** removed from the push list ⇒ named as missing', () => {
    const mutated = mutate(e2eText, "      - 'packages/team-plan/**'\n", '', 'e2e-web.yml');
    const pushPaths = extractQuotedListAfter(mutated, 'paths:');
    expect(packageGlobDrift(pushPaths, expectedGlobs).missing).toEqual(['packages/team-plan/**']);
  });

  it('packages/game-data/** added to the filter list ⇒ named as an extra', () => {
    const mutated = mutate(
      e2eText,
      "              - 'packages/domain/**'\n",
      "              - 'packages/domain/**'\n              - 'packages/game-data/**'\n",
      'e2e-web.yml',
    );
    const filterPaths = extractQuotedListAfter(mutated, 'e2e:');
    expect(packageGlobDrift(filterPaths, expectedGlobs).extras).toEqual(['packages/game-data/**']);
  });

  it('a dependency no packages/* manifest declares ⇒ the closure throws, naming it', () => {
    const mutated = mutate(
      webManifestText,
      '"@bombfarm/account": "workspace:*",',
      '"@bombfarm/account": "workspace:*",\n    "@bombfarm/nonexistent": "workspace:*",',
      'apps/web/package.json',
    );
    expect(() => workspaceClosure(JSON.parse(mutated), packageIndex, appNames)).toThrow(
      /@bombfarm\/nonexistent/,
    );
  });
});
