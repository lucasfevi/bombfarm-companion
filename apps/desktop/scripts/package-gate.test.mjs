import { createPackage, createPackageWithOptions, getRawHeader } from '@electron/asar';
import { FuseV1Options } from '@electron/fuses';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NtExecutable, NtExecutableResource } from 'resedit';
import { afterEach, describe, expect, it } from 'vitest';
import { createBuilderConfig } from './builder-config.mjs';
import {
  assertAsarExists,
  assertAsarIntegrityMatches,
  assertAsarUnpackPatternsMatch,
  assertElectronFuses,
  assertNativeBinariesUnpacked,
  assertNoNativeBinariesInAsar,
  assertRendererEntryPresent,
  collectNativeDependencyClosure,
  findMissingNativeBinaries,
  findNodeBinaries,
  findPackagedExecutable,
  listAsarEntries,
  normalizeAsarUnpack,
  PackagingGateError,
  resolveUnpackedDir,
  runPackagingGateChecks,
} from './package-gate.mjs';

const tempDirs = [];

function makeTempDir(prefix) {
  const dir = mkdtempSync(path.join(os.tmpdir(), `bfc-package-gate-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

function writeJson(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data));
}

function writeFile(filePath, content = '') {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function expectPackagingGateError(fn, ...substrings) {
  try {
    fn();
    expect.fail('expected function to throw PackagingGateError');
  } catch (error) {
    expect(error).toBeInstanceOf(PackagingGateError);
    for (const substring of substrings) {
      expect(error.message).toContain(substring);
    }
    return error;
  }
}

async function expectPackagingGateRejection(promise, ...substrings) {
  try {
    await promise;
    expect.fail('expected promise to reject with PackagingGateError');
  } catch (error) {
    expect(error).toBeInstanceOf(PackagingGateError);
    for (const substring of substrings) {
      expect(error.message).toContain(substring);
    }
    return error;
  }
}

const FUSE_SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX';
const lowerFirst = (name) => name.charAt(0).toLowerCase() + name.slice(1);
const fuseNamesInWireOrder = Object.keys(FuseV1Options)
  .filter((name) => Number.isNaN(Number(name)))
  .sort((a, b) => FuseV1Options[a] - FuseV1Options[b]);

function integrityOf(asarPath) {
  return [
    {
      file: 'resources\\app.asar',
      alg: 'SHA256',
      value: createHash('sha256').update(getRawHeader(asarPath).headerString).digest('hex'),
    },
  ];
}

/** A PE image that carries what the gate reads from the real executable: the integrity resource
 *  and the fuse wire (sentinel, wire version, length, one state byte per fuse). */
function writePackagedExecutable(filePath, { fuses = createBuilderConfig('dev').electronFuses, integrity } = {}) {
  const image = NtExecutable.createEmpty(false, false);
  const resources = NtExecutableResource.from(image);
  if (integrity) {
    resources.entries.push({
      type: 'INTEGRITY',
      id: 'ELECTRONASAR',
      lang: 1033,
      codepage: 1200,
      bin: Buffer.from(JSON.stringify(integrity)),
    });
  }
  resources.outputResource(image);
  const states = fuseNamesInWireOrder.map((name) => (fuses[lowerFirst(name)] ? 0x31 : 0x30));
  writeFile(
    filePath,
    Buffer.concat([
      Buffer.from(image.generate()),
      Buffer.from(FUSE_SENTINEL),
      Buffer.from([1, states.length, ...states]),
    ]),
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveUnpackedDir', () => {
  it('joins directories.output with win-unpacked, under the given desktop root', () => {
    const config = { directories: { output: 'release/dev' } };
    expect(resolveUnpackedDir(config, 'C:/repo/apps/desktop')).toBe(
      path.join('C:/repo/apps/desktop', 'release/dev', 'win-unpacked'),
    );
  });

  it('throws PackagingGateError when directories.output is missing', () => {
    expect(() => resolveUnpackedDir({ directories: {} }, 'C:/repo/apps/desktop')).toThrow(
      PackagingGateError,
    );
  });
});

describe('normalizeAsarUnpack', () => {
  it('returns an empty array when asarUnpack is unset', () => {
    expect(normalizeAsarUnpack(undefined)).toEqual([]);
  });

  it('wraps a single string pattern in an array', () => {
    expect(normalizeAsarUnpack('node_modules/foo/**/*')).toEqual(['node_modules/foo/**/*']);
  });

  it('passes an array of patterns through unchanged', () => {
    const patterns = ['a/**/*', 'b/**/*'];
    expect(normalizeAsarUnpack(patterns)).toEqual(patterns);
  });
});

describe('assertAsarExists', () => {
  it('returns the asar path when resources/app.asar exists', () => {
    const unpackedDir = makeTempDir('asar-exists');
    writeFile(path.join(unpackedDir, 'resources', 'app.asar'));
    expect(assertAsarExists(unpackedDir)).toBe(path.join(unpackedDir, 'resources', 'app.asar'));
  });

  it('throws PackagingGateError naming the missing path when app.asar is absent', () => {
    const unpackedDir = makeTempDir('asar-missing');
    expectPackagingGateError(() => assertAsarExists(unpackedDir), 'resources/app.asar', unpackedDir);
  });
});

describe('assertAsarUnpackPatternsMatch', () => {
  it('does nothing when no asarUnpack patterns are configured', () => {
    const unpackedDir = makeTempDir('unpack-empty-config');
    expect(() => assertAsarUnpackPatternsMatch({}, unpackedDir)).not.toThrow();
  });

  it('passes when every configured pattern matches at least one real file', () => {
    const unpackedDir = makeTempDir('unpack-match');
    writeFile(
      path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules', 'foo', 'build', 'foo.node'),
    );
    const config = { asarUnpack: ['node_modules/foo/**/*.node'] };
    expect(() => assertAsarUnpackPatternsMatch(config, unpackedDir)).not.toThrow();
  });

  it('names the offending pattern when a glob matches nothing', () => {
    const unpackedDir = makeTempDir('unpack-mismatch');
    writeFile(
      path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules', 'foo', 'build', 'foo.node'),
    );
    const config = {
      asarUnpack: ['node_modules/foo/**/*.node', 'node_modules/never-installed/**/*'],
    };
    const error = expectPackagingGateError(
      () => assertAsarUnpackPatternsMatch(config, unpackedDir),
      'node_modules/never-installed/**/*',
    );
    expect(error.message).not.toContain('"node_modules/foo/**/*.node"');
  });

  it('treats a wholly missing app.asar.unpacked directory as zero matches', () => {
    const unpackedDir = makeTempDir('unpack-dir-missing');
    const config = { asarUnpack: ['node_modules/foo/**/*'] };
    expect(() => assertAsarUnpackPatternsMatch(config, unpackedDir)).toThrow(PackagingGateError);
  });
});

describe('collectNativeDependencyClosure', () => {
  it('walks dependencies and optionalDependencies transitively, skips devDependencies and unresolvable optional deps', () => {
    const root = makeTempDir('closure');
    writeJson(path.join(root, 'package.json'), {
      name: 'fake-desktop',
      dependencies: { 'pkg-a': '1.0.0' },
      optionalDependencies: {
        'pkg-b': '1.0.0',
        'pkg-optional-missing': '1.0.0',
      },
      devDependencies: { 'pkg-dev-only': '1.0.0' },
    });
    writeJson(path.join(root, 'node_modules', 'pkg-a', 'package.json'), {
      name: 'pkg-a',
      dependencies: { 'pkg-c': '1.0.0' },
    });
    // Nested (non-hoisted) to prove resolution follows each package's own node_modules.
    writeJson(path.join(root, 'node_modules', 'pkg-a', 'node_modules', 'pkg-c', 'package.json'), {
      name: 'pkg-c',
    });
    writeJson(path.join(root, 'node_modules', 'pkg-b', 'package.json'), { name: 'pkg-b' });
    writeJson(path.join(root, 'node_modules', 'pkg-dev-only', 'package.json'), {
      name: 'pkg-dev-only',
    });

    const closure = collectNativeDependencyClosure(path.join(root, 'package.json'));

    expect([...closure.keys()].sort()).toEqual(['pkg-a', 'pkg-b', 'pkg-c']);
    expect(closure.get('pkg-c')).toBe(
      path.resolve(path.join(root, 'node_modules', 'pkg-a', 'node_modules', 'pkg-c')),
    );
  });

  it('resolves a scoped package name to its scoped directory', () => {
    const root = makeTempDir('closure-scoped');
    writeJson(path.join(root, 'package.json'), {
      dependencies: { '@scope/pkg': '1.0.0' },
    });
    writeJson(path.join(root, 'node_modules', '@scope', 'pkg', 'package.json'), {
      name: '@scope/pkg',
    });

    const closure = collectNativeDependencyClosure(path.join(root, 'package.json'));
    expect(closure.get('@scope/pkg')).toBe(
      path.resolve(path.join(root, 'node_modules', '@scope', 'pkg')),
    );
  });
});

describe('findNodeBinaries', () => {
  it('finds .node files at any depth, relative to the given directory', () => {
    const dir = makeTempDir('find-node-binaries');
    writeFile(path.join(dir, 'build', 'Release', 'thing.node'));
    writeFile(path.join(dir, 'readme.md'));

    expect(findNodeBinaries(dir)).toEqual(['build/Release/thing.node']);
  });

  it('returns an empty array for a directory with no .node files', () => {
    const dir = makeTempDir('find-node-binaries-empty');
    writeFile(path.join(dir, 'index.js'));
    expect(findNodeBinaries(dir)).toEqual([]);
  });
});

describe('findMissingNativeBinaries', () => {
  it('reports a binary as missing when it has no counterpart under the unpack root', () => {
    const pkgDir = makeTempDir('missing-binaries-pkg');
    writeFile(path.join(pkgDir, 'build', 'thing.node'));
    const unpackRoot = makeTempDir('missing-binaries-unpack-root');

    const closure = new Map([['thing-pkg', pkgDir]]);
    expect(findMissingNativeBinaries(closure, unpackRoot)).toEqual(['node_modules/thing-pkg/build/thing.node']);
  });

  it('reports nothing missing once the counterpart exists', () => {
    const pkgDir = makeTempDir('present-binaries-pkg');
    writeFile(path.join(pkgDir, 'build', 'thing.node'));
    const unpackRoot = makeTempDir('present-binaries-unpack-root');
    writeFile(path.join(unpackRoot, 'node_modules', 'thing-pkg', 'build', 'thing.node'));

    const closure = new Map([['thing-pkg', pkgDir]]);
    expect(findMissingNativeBinaries(closure, unpackRoot)).toEqual([]);
  });
});

describe('assertNativeBinariesUnpacked', () => {
  it('throws PackagingGateError naming every missing binary', () => {
    const root = makeTempDir('assert-native-root');
    writeJson(path.join(root, 'package.json'), { dependencies: { 'native-pkg': '1.0.0' } });
    writeJson(path.join(root, 'node_modules', 'native-pkg', 'package.json'), { name: 'native-pkg' });
    writeFile(path.join(root, 'node_modules', 'native-pkg', 'native.node'));

    const unpackedDir = makeTempDir('assert-native-unpacked');

    expectPackagingGateError(
      () => assertNativeBinariesUnpacked(path.join(root, 'package.json'), unpackedDir),
      'node_modules/native-pkg/native.node',
    );
  });

  it('passes once every closure binary is present under app.asar.unpacked', () => {
    const root = makeTempDir('assert-native-ok-root');
    writeJson(path.join(root, 'package.json'), { dependencies: { 'native-pkg': '1.0.0' } });
    writeJson(path.join(root, 'node_modules', 'native-pkg', 'package.json'), { name: 'native-pkg' });
    writeFile(path.join(root, 'node_modules', 'native-pkg', 'native.node'));

    const unpackedDir = makeTempDir('assert-native-ok-unpacked');
    writeFile(
      path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules', 'native-pkg', 'native.node'),
    );

    expect(() => assertNativeBinariesUnpacked(path.join(root, 'package.json'), unpackedDir)).not.toThrow();
  });
});

describe('listAsarEntries', () => {
  it('returns each entry as its normalized path with a packed flag', async () => {
    const srcDir = makeTempDir('asar-src-listing');
    writeFile(path.join(srcDir, 'dist', 'main', 'index.cjs'), 'console.log(1);');
    const asarPath = path.join(makeTempDir('asar-out-listing'), 'app.asar');
    await createPackage(srcDir, asarPath);

    const entries = listAsarEntries(asarPath);
    expect(entries).toContainEqual({ path: '/dist/main/index.cjs', packed: true });
  });

  it('marks an asarUnpack-matched file as packed:false, distinct from a sealed one', async () => {
    const srcDir = makeTempDir('asar-src-unpack-flag');
    writeFile(path.join(srcDir, 'build', 'sealed.node'));
    writeFile(path.join(srcDir, 'unpacked', 'redirected.node'));
    const asarPath = path.join(makeTempDir('asar-out-unpack-flag'), 'app.asar');
    await createPackageWithOptions(srcDir, asarPath, { unpackDir: 'unpacked' });

    const entries = listAsarEntries(asarPath);
    expect(entries).toContainEqual({ path: '/build/sealed.node', packed: true });
    expect(entries).toContainEqual({ path: '/unpacked/redirected.node', packed: false });
  });

  it('throws PackagingGateError naming the archive when it cannot be listed', () => {
    const asarPath = path.join(makeTempDir('asar-missing-for-listing'), 'does-not-exist.asar');
    expectPackagingGateError(() => listAsarEntries(asarPath), asarPath);
  });
});

describe('assertRendererEntryPresent', () => {
  it('passes when renderer/out/index.html is in the archive', async () => {
    const srcDir = makeTempDir('asar-src-with-index');
    writeFile(path.join(srcDir, 'renderer', 'out', 'index.html'), '<html></html>');
    writeFile(path.join(srcDir, 'dist', 'main', 'index.cjs'), 'console.log(1);');
    const asarPath = path.join(makeTempDir('asar-out-with-index'), 'app.asar');
    await createPackage(srcDir, asarPath);

    expect(() => assertRendererEntryPresent(listAsarEntries(asarPath))).not.toThrow();
  });

  it('throws PackagingGateError when renderer/out/index.html is missing', async () => {
    const srcDir = makeTempDir('asar-src-without-index');
    writeFile(path.join(srcDir, 'dist', 'main', 'index.cjs'), 'console.log(1);');
    const asarPath = path.join(makeTempDir('asar-out-without-index'), 'app.asar');
    await createPackage(srcDir, asarPath);

    expectPackagingGateError(
      () => assertRendererEntryPresent(listAsarEntries(asarPath)),
      'renderer/out/index.html',
    );
  });
});

describe('assertNoNativeBinariesInAsar', () => {
  it('does nothing when the archive has no .node entries', () => {
    expect(() =>
      assertNoNativeBinariesInAsar([
        { path: '/dist/main/index.cjs', packed: true },
        { path: '/renderer/out/index.html', packed: true },
      ]),
    ).not.toThrow();
  });

  it('does nothing when the only .node entries were redirected to app.asar.unpacked', () => {
    // This is the shape electron-builder produces for every native module its asarUnpack config
    // covers: a header entry still exists (so require() can resolve the path), but packed:false
    // means the bytes live outside the archive and can load fine.
    expect(() =>
      assertNoNativeBinariesInAsar([
        { path: '/node_modules/better-sqlite3/build/Release/better_sqlite3.node', packed: false },
      ]),
    ).not.toThrow();
  });

  it('throws PackagingGateError naming every .node entry sealed inside the archive, ignoring unpacked ones', () => {
    const entries = [
      { path: '/dist/main/index.cjs', packed: true },
      { path: '/node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64.node', packed: true },
      { path: '/node_modules/better-sqlite3/build/Release/better_sqlite3.node', packed: false },
    ];
    const error = expectPackagingGateError(
      () => assertNoNativeBinariesInAsar(entries),
      '@img/sharp-win32-x64/lib/sharp-win32-x64.node',
    );
    expect(error.message).not.toContain('better-sqlite3');
  });

  it('catches a native binary that reached the package through a hoisted transitive dependency outside the closure walk', () => {
    // The real defect this assertion exists for: a module like sharp reaches the package via a
    // dependency of a sibling workspace package, so apps/desktop's own manifest never names it and
    // the closure-based check never visits it — but a `.node` entry sealed inside app.asar is a
    // defect no matter which manifest pulled the module in.
    const entries = [{ path: '/node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64.node', packed: true }];
    expectPackagingGateError(() => assertNoNativeBinariesInAsar(entries), 'sharp-win32-x64.node');
  });
});

describe('runPackagingGateChecks', () => {
  async function buildFakePackagedApp() {
    const desktopRootDir = makeTempDir('gate-run-root');
    writeJson(path.join(desktopRootDir, 'package.json'), {
      name: '@bombfarm/desktop',
      dependencies: { 'native-pkg': '1.0.0' },
    });
    writeJson(path.join(desktopRootDir, 'node_modules', 'native-pkg', 'package.json'), {
      name: 'native-pkg',
    });
    writeFile(path.join(desktopRootDir, 'node_modules', 'native-pkg', 'native.node'));

    const unpackedDir = path.join(desktopRootDir, 'release', 'dev', 'win-unpacked');
    writeFile(
      path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules', 'native-pkg', 'native.node'),
    );

    const asarSrcDir = makeTempDir('gate-run-asar-src');
    writeFile(path.join(asarSrcDir, 'renderer', 'out', 'index.html'), '<html></html>');
    const asarPath = path.join(unpackedDir, 'resources', 'app.asar');
    await createPackage(asarSrcDir, asarPath);
    writePackagedExecutable(path.join(unpackedDir, 'Bomb Farm Companion (Dev).exe'), {
      integrity: integrityOf(asarPath),
    });

    return desktopRootDir;
  }

  /** The real config minus its `asarUnpack` patterns: a fabricated tree was never built to
   *  satisfy them, and `assertAsarUnpackPatternsMatch` has its own dedicated tests above. */
  const configForFakeTree = () => ({ ...createBuilderConfig('dev'), asarUnpack: [] });

  it('passes for a packaged tree with a matching native binary, a renderer entry and a locked-down executable', async () => {
    const desktopRootDir = await buildFakePackagedApp();
    await expect(
      runPackagingGateChecks('dev', { desktopRootDir, config: configForFakeTree() }),
    ).resolves.toBeUndefined();
  });

  it('aggregates every failing check into one PackagingGateError', async () => {
    const desktopRootDir = await buildFakePackagedApp();
    rmSync(path.join(desktopRootDir, 'release', 'dev', 'win-unpacked', 'resources', 'app.asar'));

    await expectPackagingGateRejection(
      runPackagingGateChecks('dev', { desktopRootDir, config: configForFakeTree() }),
      'resources/app.asar',
    );
  });

  it('fails when the packaged executable still has a fuse the config turned off', async () => {
    const desktopRootDir = await buildFakePackagedApp();
    const unpackedDir = path.join(desktopRootDir, 'release', 'dev', 'win-unpacked');
    writePackagedExecutable(path.join(unpackedDir, 'Bomb Farm Companion (Dev).exe'), {
      fuses: { ...createBuilderConfig('dev').electronFuses, runAsNode: true },
      integrity: integrityOf(path.join(unpackedDir, 'resources', 'app.asar')),
    });

    await expectPackagingGateRejection(
      runPackagingGateChecks('dev', { desktopRootDir, config: configForFakeTree() }),
      'RunAsNode',
    );
  });

  it('fails when the packaged tree has no executable to read fuses from', async () => {
    const desktopRootDir = await buildFakePackagedApp();
    rmSync(path.join(desktopRootDir, 'release', 'dev', 'win-unpacked', 'Bomb Farm Companion (Dev).exe'));

    await expectPackagingGateRejection(
      runPackagingGateChecks('dev', { desktopRootDir, config: configForFakeTree() }),
      'expected exactly one .exe',
    );
  });

  it('fails when the digest embedded in the executable is for a different archive', async () => {
    const desktopRootDir = await buildFakePackagedApp();
    const unpackedDir = path.join(desktopRootDir, 'release', 'dev', 'win-unpacked');
    const [entry] = integrityOf(path.join(unpackedDir, 'resources', 'app.asar'));
    writePackagedExecutable(path.join(unpackedDir, 'Bomb Farm Companion (Dev).exe'), {
      integrity: [{ ...entry, value: '0'.repeat(64) }],
    });

    await expectPackagingGateRejection(
      runPackagingGateChecks('dev', { desktopRootDir, config: configForFakeTree() }),
      'does not match',
    );
  });

  it('fails when a .node binary is sealed inside app.asar, even when it belongs to no dependency in apps/desktop\'s own manifest', async () => {
    const desktopRootDir = makeTempDir('gate-run-hoisted-native');
    writeJson(path.join(desktopRootDir, 'package.json'), { name: '@bombfarm/desktop' });

    const unpackedDir = path.join(desktopRootDir, 'release', 'dev', 'win-unpacked');
    const asarSrcDir = makeTempDir('gate-run-hoisted-native-asar-src');
    writeFile(path.join(asarSrcDir, 'renderer', 'out', 'index.html'), '<html></html>');
    writeFile(
      path.join(asarSrcDir, 'node_modules', '@img', 'sharp-win32-x64', 'lib', 'sharp-win32-x64.node'),
    );
    await createPackage(asarSrcDir, path.join(unpackedDir, 'resources', 'app.asar'));

    await expectPackagingGateRejection(
      runPackagingGateChecks('dev', { desktopRootDir, config: configForFakeTree() }),
      'sharp-win32-x64.node',
    );
  });

  it('throws when the flavor output directory does not exist at all', async () => {
    const desktopRootDir = makeTempDir('gate-run-no-output');
    writeJson(path.join(desktopRootDir, 'package.json'), { name: '@bombfarm/desktop' });
    await expectPackagingGateRejection(
      runPackagingGateChecks('dev', { desktopRootDir, config: configForFakeTree() }),
      'does not exist',
    );
    expect(existsSync(path.join(desktopRootDir, 'release'))).toBe(false);
  });
});

describe('findPackagedExecutable', () => {
  it('returns the one .exe at the top of the unpacked directory, ignoring nested ones', () => {
    const unpackedDir = makeTempDir('exe-one');
    writeFile(path.join(unpackedDir, 'App.exe'));
    writeFile(path.join(unpackedDir, 'resources', 'elevate.exe'));
    expect(findPackagedExecutable(unpackedDir)).toBe(path.join(unpackedDir, 'App.exe'));
  });

  it('throws when there is none', () => {
    expectPackagingGateError(() => findPackagedExecutable(makeTempDir('exe-none')), 'found 0');
  });

  it('throws naming every candidate when there are several', () => {
    const unpackedDir = makeTempDir('exe-many');
    writeFile(path.join(unpackedDir, 'A.exe'));
    writeFile(path.join(unpackedDir, 'B.exe'));
    expectPackagingGateError(() => findPackagedExecutable(unpackedDir), 'A.exe', 'B.exe');
  });
});

describe('assertElectronFuses', () => {
  const config = createBuilderConfig('dev');

  it('passes when every fuse reads back as configured', async () => {
    const exe = path.join(makeTempDir('fuses-ok'), 'App.exe');
    writePackagedExecutable(exe);
    await expect(assertElectronFuses(config, exe)).resolves.toBeUndefined();
  });

  for (const [key, configured] of Object.entries(config.electronFuses)) {
    it(`fails when ${key} reads back the opposite of ${configured}`, async () => {
      const exe = path.join(makeTempDir('fuses-flipped'), 'App.exe');
      writePackagedExecutable(exe, { fuses: { ...config.electronFuses, [key]: !configured } });
      await expectPackagingGateRejection(
        assertElectronFuses(config, exe),
        key.charAt(0).toUpperCase() + key.slice(1),
      );
    });
  }

  it('fails when the config declares no fuses', async () => {
    const exe = path.join(makeTempDir('fuses-none'), 'App.exe');
    writePackagedExecutable(exe);
    await expectPackagingGateRejection(assertElectronFuses({ ...config, electronFuses: undefined }, exe), 'no electronFuses');
  });

  it('fails on a fuse the binary carries and the config never mentions', async () => {
    const exe = path.join(makeTempDir('fuses-unmentioned'), 'App.exe');
    writePackagedExecutable(exe);
    const { grantFileProtocolExtraPrivileges: _dropped, ...partial } = config.electronFuses;
    await expectPackagingGateRejection(
      assertElectronFuses({ ...config, electronFuses: partial }, exe),
      'GrantFileProtocolExtraPrivileges: present in the binary but not configured',
    );
  });

  it('fails on a file with no fuse wire at all', async () => {
    const exe = path.join(makeTempDir('fuses-no-wire'), 'App.exe');
    writeFile(exe, 'MZ not an electron binary');
    await expectPackagingGateRejection(assertElectronFuses(config, exe), 'could not read the Electron fuse wire');
  });
});

describe('assertAsarIntegrityMatches', () => {
  async function makeArchive() {
    const dir = makeTempDir('integrity');
    const srcDir = makeTempDir('integrity-src');
    writeFile(path.join(srcDir, 'index.js'), 'console.log(1)');
    const asarPath = path.join(dir, 'app.asar');
    await createPackage(srcDir, asarPath);
    return { dir, asarPath };
  }

  it('passes when the embedded digest is the archive header digest', async () => {
    const { dir, asarPath } = await makeArchive();
    const exe = path.join(dir, 'App.exe');
    writePackagedExecutable(exe, { integrity: integrityOf(asarPath) });
    await expect(assertAsarIntegrityMatches(exe, asarPath)).resolves.toBeUndefined();
  });

  it('fails when the executable embeds no integrity resource', async () => {
    const { dir, asarPath } = await makeArchive();
    const exe = path.join(dir, 'App.exe');
    writePackagedExecutable(exe);
    await expectPackagingGateRejection(assertAsarIntegrityMatches(exe, asarPath), 'embeds no asar integrity digest');
  });

  it('fails when the archive changed after the digest was embedded', async () => {
    const { dir, asarPath } = await makeArchive();
    const exe = path.join(dir, 'App.exe');
    writePackagedExecutable(exe, { integrity: integrityOf(asarPath) });
    const changedSrc = makeTempDir('integrity-changed-src');
    writeFile(path.join(changedSrc, 'index.js'), 'console.log(2); // tampered');
    await createPackage(changedSrc, asarPath);
    await expectPackagingGateRejection(assertAsarIntegrityMatches(exe, asarPath), 'does not match');
  });

  it('fails when the digest is for a different file than resources/app.asar', async () => {
    const { dir, asarPath } = await makeArchive();
    const exe = path.join(dir, 'App.exe');
    const [entry] = integrityOf(asarPath);
    writePackagedExecutable(exe, { integrity: [{ ...entry, file: 'resources\\other.asar' }] });
    await expectPackagingGateRejection(assertAsarIntegrityMatches(exe, asarPath), 'does not match');
  });
});
