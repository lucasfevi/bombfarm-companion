import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import minimatch from 'minimatch';
import { listPackage } from '@electron/asar';
import { resolveBuildFlavor } from '@bombfarm/contracts';
import { createBuilderConfig } from './builder-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const desktopRoot = path.join(__dirname, '..');

export class PackagingGateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PackagingGateError';
  }
}

/**
 * @param {import('electron-builder').Configuration} config
 * @param {string} desktopRootDir
 * @returns {string}
 */
export function resolveUnpackedDir(config, desktopRootDir) {
  const outputDir = config.directories?.output;
  if (!outputDir) {
    throw new PackagingGateError(
      'Packaging gate: the builder config has no directories.output to resolve the packaged app from.',
    );
  }
  // Single win/x64/nsis target — electron-builder only suffixes this with an arch when
  // packaging more than one arch in the same run, which this config never does.
  return path.join(desktopRootDir, outputDir, 'win-unpacked');
}

function walkRelativeFiles(root) {
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        results.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  }
  return results;
}

export function assertAsarExists(unpackedDir) {
  const asarPath = path.join(unpackedDir, 'resources', 'app.asar');
  if (!existsSync(asarPath)) {
    throw new PackagingGateError(
      `Packaging gate: "resources/app.asar" is missing under "${unpackedDir}". electron-builder did not produce a packaged archive.`,
    );
  }
  return asarPath;
}

export function normalizeAsarUnpack(asarUnpack) {
  if (!asarUnpack) return [];
  return Array.isArray(asarUnpack) ? asarUnpack : [asarUnpack];
}

/**
 * Defect (3), generalised: an `asarUnpack` glob that matches nothing fails silently — the
 * native module it was meant to unpack stays sealed inside app.asar and can't load. Since the
 * unpacked output mirrors the packaged files' relative layout 1:1, matching each configured
 * pattern straight against `app.asar.unpacked`'s real file list is equivalent to matching it
 * against the packaged tree, without needing to touch the source tree at all.
 */
export function assertAsarUnpackPatternsMatch(config, unpackedDir) {
  const patterns = normalizeAsarUnpack(config.asarUnpack);
  if (patterns.length === 0) return;

  const unpackRoot = path.join(unpackedDir, 'resources', 'app.asar.unpacked');
  const files = existsSync(unpackRoot) ? walkRelativeFiles(unpackRoot) : [];
  const unmatched = patterns.filter(
    (pattern) => !files.some((file) => minimatch(file, pattern, { dot: true })),
  );
  if (unmatched.length > 0) {
    throw new PackagingGateError(
      `Packaging gate: asarUnpack pattern(s) matched no files under app.asar.unpacked: ${unmatched
        .map((pattern) => `"${pattern}"`)
        .join(', ')}. A pattern that matches nothing means the module it targets never left the asar and can't load at runtime.`,
    );
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Walks the production dependency graph reachable from `rootPackageJsonPath` — its
 * `dependencies` and `optionalDependencies`, recursively, through the *same* fields on each
 * dependency in turn (never `devDependencies`, which electron-builder does not package) — using
 * Node's own module resolution (`createRequire(...).resolve`) so it follows however pnpm has
 * actually laid the tree out, rather than re-implementing that resolution. A name that fails to
 * resolve is treated as an optional/platform-specific dependency that isn't installed for this
 * platform, not an error.
 *
 * @param {string} rootPackageJsonPath
 * @returns {Map<string, string>} dependency name -> resolved absolute directory
 */
export function collectNativeDependencyClosure(rootPackageJsonPath) {
  const rootPkg = readJsonSafe(rootPackageJsonPath);
  if (!rootPkg) {
    throw new PackagingGateError(`Packaging gate: could not read "${rootPackageJsonPath}".`);
  }

  const closure = new Map();
  const visitedDirs = new Set();
  const queue = [
    ...Object.keys(rootPkg.dependencies ?? {}),
    ...Object.keys(rootPkg.optionalDependencies ?? {}),
  ].map((name) => ({ name, fromPackageJsonPath: rootPackageJsonPath }));

  while (queue.length > 0) {
    const { name, fromPackageJsonPath } = queue.shift();
    const scopedRequire = createRequire(fromPackageJsonPath);

    let resolvedPackageJsonPath;
    try {
      resolvedPackageJsonPath = scopedRequire.resolve(`${name}/package.json`);
    } catch {
      continue;
    }

    const real = path.resolve(path.dirname(resolvedPackageJsonPath));
    if (visitedDirs.has(real)) continue;
    visitedDirs.add(real);
    closure.set(name, real);

    const depPkg = readJsonSafe(resolvedPackageJsonPath);
    if (!depPkg) continue;
    const nextNames = [
      ...Object.keys(depPkg.dependencies ?? {}),
      ...Object.keys(depPkg.optionalDependencies ?? {}),
    ];
    for (const nextName of nextNames) {
      queue.push({ name: nextName, fromPackageJsonPath: resolvedPackageJsonPath });
    }
  }

  return closure;
}

export function findNodeBinaries(dir) {
  const results = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.node')) {
        results.push(path.relative(dir, full).split(path.sep).join('/'));
      }
    }
  }
  return results;
}

export function findMissingNativeBinaries(closure, unpackRoot) {
  const missing = [];
  for (const [name, dir] of closure) {
    for (const relPath of findNodeBinaries(dir)) {
      const expected = path.join(unpackRoot, 'node_modules', ...name.split('/'), ...relPath.split('/'));
      if (!existsSync(expected)) {
        missing.push(path.posix.join('node_modules', name, relPath));
      }
    }
  }
  return missing;
}

/**
 * Defect (3)'s specific shape: a native dependency's `.node` binary that isn't actually reachable
 * from `app.asar.unpacked`, whether because no `asarUnpack` pattern covers it or because
 * electron-builder's own automatic native-module detection missed it. Derived from
 * `apps/desktop`'s installed dependency tree, not a hardcoded package list, so a dependency added
 * later (a native module arriving in a future change, for one) is covered without editing this
 * file.
 */
export function assertNativeBinariesUnpacked(rootPackageJsonPath, unpackedDir) {
  const closure = collectNativeDependencyClosure(rootPackageJsonPath);
  const unpackRoot = path.join(unpackedDir, 'resources', 'app.asar.unpacked');
  const missing = findMissingNativeBinaries(closure, unpackRoot);
  if (missing.length > 0) {
    throw new PackagingGateError(
      `Packaging gate: native binaries missing from app.asar.unpacked:\n${missing
        .map((entry) => `  - ${entry}`)
        .join('\n')}\nEach ships a .node binary in apps/desktop's dependency tree; none of them can load from inside app.asar.`,
    );
  }
}

/**
 * The non-dev boot path resolves its window content relative to the bundled main as
 * `renderer/out/index.html`. If that file isn't in the archive, the packaged app has nothing to
 * load into its window.
 */
export function assertRendererEntryPresent(asarPath) {
  let entries;
  try {
    entries = listPackage(asarPath);
  } catch (error) {
    throw new PackagingGateError(
      `Packaging gate: could not list "${asarPath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const hasIndexHtml = entries.some((entry) =>
    entry.replace(/\\/g, '/').endsWith('/renderer/out/index.html'),
  );
  if (!hasIndexHtml) {
    throw new PackagingGateError(
      'Packaging gate: "renderer/out/index.html" is missing from app.asar. The non-dev boot path loads this file relative to the bundled main — without it the packaged window has nothing to load.',
    );
  }
}

/**
 * Runs every assertion against a real `win-unpacked` output and throws one aggregated
 * `PackagingGateError` naming every failing check, rather than stopping at the first one.
 *
 * @param {import('@bombfarm/contracts').AppFlavor} flavor
 * @param {{ desktopRootDir?: string }} [options]
 */
export function runPackagingGateChecks(flavor, { desktopRootDir = desktopRoot } = {}) {
  const config = createBuilderConfig(flavor);
  const unpackedDir = resolveUnpackedDir(config, desktopRootDir);

  if (!existsSync(unpackedDir)) {
    throw new PackagingGateError(
      `Packaging gate: expected packaged output at "${unpackedDir}" but it does not exist.`,
    );
  }

  const failures = [];
  const record = (fn) => {
    try {
      fn();
    } catch (error) {
      if (error instanceof PackagingGateError) {
        failures.push(error.message);
        return;
      }
      throw error;
    }
  };

  let asarPath;
  record(() => {
    asarPath = assertAsarExists(unpackedDir);
  });
  record(() => assertAsarUnpackPatternsMatch(config, unpackedDir));
  record(() => assertNativeBinariesUnpacked(path.join(desktopRootDir, 'package.json'), unpackedDir));
  if (asarPath) {
    record(() => assertRendererEntryPresent(asarPath));
  }

  if (failures.length > 0) {
    throw new PackagingGateError(
      `Packaging gate failed with ${failures.length} issue(s):\n\n${failures.join('\n\n')}`,
    );
  }
}

const isMainModule = process.argv[1] !== undefined
  && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMainModule) {
  const flavor = resolveBuildFlavor(process.env.BFC_FLAVOR);
  try {
    runPackagingGateChecks(flavor);
    console.log(`Packaging gate passed for flavor "${flavor}".`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
