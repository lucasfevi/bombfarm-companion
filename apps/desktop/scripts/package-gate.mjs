import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  return walkRelativeFiles(dir).filter((file) => file.endsWith('.node'));
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
 *
 * Kept alongside `assertNoNativeBinariesInAsar` rather than replaced by it: this is the only check
 * that catches a declared native dependency producing no packaged binary at all (missing from both
 * app.asar and app.asar.unpacked); its known blind spot is a native module that arrives only
 * through a hoisted dependency outside this manifest's own closure.
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
 * `listPackage`'s plain (non-`isPack`) output can't tell an actually-sealed file from one that
 * `asarUnpack` redirected to `app.asar.unpacked` — both still get a header entry, since asar keeps
 * the full tree so `require()`/`fs.stat` can resolve paths for unpacked files too. The `isPack`
 * option prefixes each line with its real pack state (`"pack   : <path>"` / `"unpack : <path>"`),
 * which is what distinguishes "sealed inside the archive" from "unpacked alongside it".
 */
export function listAsarEntries(asarPath) {
  let raw;
  try {
    raw = listPackage(asarPath, { isPack: true });
  } catch (error) {
    throw new PackagingGateError(
      `Packaging gate: could not list "${asarPath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return raw.map((line) => {
    const separatorIndex = line.indexOf(' : ');
    const packState = line.slice(0, separatorIndex).trim();
    const entryPath = line.slice(separatorIndex + 3).replace(/\\/g, '/');
    return { path: entryPath, packed: packState === 'pack' };
  });
}

/**
 * The non-dev boot path resolves its window content relative to the bundled main as
 * `renderer/out/index.html`. If that file isn't in the archive, the packaged app has nothing to
 * load into its window.
 */
export function assertRendererEntryPresent(entries) {
  const hasIndexHtml = entries.some((entry) => entry.path.endsWith('/renderer/out/index.html'));
  if (!hasIndexHtml) {
    throw new PackagingGateError(
      'Packaging gate: "renderer/out/index.html" is missing from app.asar. The non-dev boot path loads this file relative to the bundled main — without it the packaged window has nothing to load.',
    );
  }
}

/**
 * A `.node` file is machine code the OS loader maps directly off disk; it cannot be dlopen'd from
 * inside an asar archive. So a `.node` entry still sealed inside app.asar (`packed: true` — as
 * opposed to redirected out to app.asar.unpacked) is unloadable at runtime no matter which package
 * put it there, declared or transitive, in apps/desktop's own manifest or hoisted in from
 * elsewhere — unlike the closure walk below, this needs no source-tree reconstruction to know that.
 */
export function assertNoNativeBinariesInAsar(entries) {
  const offenders = entries.filter((entry) => entry.packed && entry.path.endsWith('.node'));
  if (offenders.length > 0) {
    throw new PackagingGateError(
      `Packaging gate: native binaries sealed inside app.asar, unloadable at runtime:\n${offenders
        .map((entry) => `  - ${entry.path}`)
        .join('\n')}`,
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
    let entries;
    record(() => {
      entries = listAsarEntries(asarPath);
    });
    if (entries) {
      record(() => assertRendererEntryPresent(entries));
      record(() => assertNoNativeBinariesInAsar(entries));
    }
  }

  if (failures.length > 0) {
    throw new PackagingGateError(
      `Packaging gate failed with ${failures.length} issue(s):\n\n${failures.join('\n\n')}`,
    );
  }
}

const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

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
