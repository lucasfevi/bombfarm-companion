import { createPackage } from '@electron/asar';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertAsarExists,
  assertAsarUnpackPatternsMatch,
  assertNativeBinariesUnpacked,
  assertRendererEntryPresent,
  collectNativeDependencyClosure,
  findMissingNativeBinaries,
  findNodeBinaries,
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
    expect(() => assertAsarExists(unpackedDir)).toThrow(PackagingGateError);
    try {
      assertAsarExists(unpackedDir);
      expect.fail('expected assertAsarExists to throw');
    } catch (error) {
      expect(error.message).toContain('resources/app.asar');
      expect(error.message).toContain(unpackedDir);
    }
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
    try {
      assertAsarUnpackPatternsMatch(config, unpackedDir);
      expect.fail('expected assertAsarUnpackPatternsMatch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PackagingGateError);
      expect(error.message).toContain('node_modules/never-installed/**/*');
      expect(error.message).not.toContain('"node_modules/foo/**/*.node"');
    }
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

    try {
      assertNativeBinariesUnpacked(path.join(root, 'package.json'), unpackedDir);
      expect.fail('expected assertNativeBinariesUnpacked to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PackagingGateError);
      expect(error.message).toContain('node_modules/native-pkg/native.node');
    }
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

describe('assertRendererEntryPresent', () => {
  it('passes when renderer/out/index.html is in the archive', async () => {
    const srcDir = makeTempDir('asar-src-with-index');
    writeFile(path.join(srcDir, 'renderer', 'out', 'index.html'), '<html></html>');
    writeFile(path.join(srcDir, 'dist', 'main', 'index.cjs'), 'console.log(1);');
    const asarPath = path.join(makeTempDir('asar-out-with-index'), 'app.asar');
    await createPackage(srcDir, asarPath);

    expect(() => assertRendererEntryPresent(asarPath)).not.toThrow();
  });

  it('throws PackagingGateError when renderer/out/index.html is missing', async () => {
    const srcDir = makeTempDir('asar-src-without-index');
    writeFile(path.join(srcDir, 'dist', 'main', 'index.cjs'), 'console.log(1);');
    const asarPath = path.join(makeTempDir('asar-out-without-index'), 'app.asar');
    await createPackage(srcDir, asarPath);

    try {
      assertRendererEntryPresent(asarPath);
      expect.fail('expected assertRendererEntryPresent to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PackagingGateError);
      expect(error.message).toContain('renderer/out/index.html');
    }
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
    await createPackage(asarSrcDir, path.join(unpackedDir, 'resources', 'app.asar'));

    return desktopRootDir;
  }

  it('passes for a packaged tree with a matching native binary and a renderer entry', async () => {
    const desktopRootDir = await buildFakePackagedApp();
    expect(() => runPackagingGateChecks('dev', { desktopRootDir })).not.toThrow();
  });

  it('aggregates every failing check into one PackagingGateError', async () => {
    const desktopRootDir = await buildFakePackagedApp();
    rmSync(path.join(desktopRootDir, 'release', 'dev', 'win-unpacked', 'resources', 'app.asar'));

    try {
      runPackagingGateChecks('dev', { desktopRootDir });
      expect.fail('expected runPackagingGateChecks to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PackagingGateError);
      expect(error.message).toContain('resources/app.asar');
    }
  });

  it('throws when the flavor output directory does not exist at all', () => {
    const desktopRootDir = makeTempDir('gate-run-no-output');
    writeJson(path.join(desktopRootDir, 'package.json'), { name: '@bombfarm/desktop' });
    expect(() => runPackagingGateChecks('dev', { desktopRootDir })).toThrow(PackagingGateError);
    expect(existsSync(path.join(desktopRootDir, 'release'))).toBe(false);
  });
});
