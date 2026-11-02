import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLUGIN_API_VERSION } from '@bombfarm/contracts';
import type { FixtureOptions } from '../../../../tests/fixtures/premium/sign-fixture.mjs';
import { guardScanner } from '../../guard-scan';
import { readLocalBundle, type LocalBundleContext } from './dev-bundle';
import type { loadLocalBundle } from './dev-loader';
import { signedInput } from './host-test-support';
import { createBundleCache } from './bundle-cache';

const { readAll } = guardScanner(__filename);
const CTX: LocalBundleContext = { hostApi: PLUGIN_API_VERSION, appVersion: '1.0.0', flavor: 'dev' };

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bfc-local-bundle-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** What the local build writes: the fixture's files and an unsigned manifest for sequence 0. */
async function writeLocal(options: FixtureOptions = {}, withSig = false): Promise<void> {
  const signed = signedInput({
    ...options,
    edit: (draft) => {
      draft.manifest['sequence'] = 0;
      draft.manifest['keyId'] = null;
      draft.manifest['flavors'] = ['dev'];
      options.edit?.(draft);
    },
  });
  await writeFile(join(dir, 'manifest.json'), signed.manifestBytes);
  if (withSig) await writeFile(join(dir, 'manifest.sig'), signed.sig);
  for (const [path, bytes] of signed.files) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), bytes);
  }
}

async function listing(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'));
  }
  return out.sort();
}

describe('an unsigned local bundle', () => {
  it('loads with no signature file, sequence 0 and a null key id', async () => {
    await writeLocal();
    const result = await readLocalBundle(dir, CTX);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.manifest.sequence).toBe(0);
      expect([...result.bundle.files.keys()].sort()).toEqual(['ui/index.css', 'ui/index.js', 'worker/index.cjs']);
      expect(result.bundle.manifest.flavors).toEqual(['dev']);
    }
  });

  it('does not read a signature file, and one beside it is no extra file', async () => {
    await writeLocal({}, true);
    expect((await readLocalBundle(dir, CTX)).ok).toBe(true);
  });

  it('is read through the dev-only loader in a dev build, and not at all in a prod one', async () => {
    await writeLocal();
    const built = await mkdtemp(join(tmpdir(), 'bfc-local-loader-'));
    for (const dev of [true, false]) {
      const file = join(built, `loader-${String(dev)}.cjs`);
      await build({
        entryPoints: [join(__dirname, 'dev-loader.ts')],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: file,
        logLevel: 'silent',
        define: { __BFC_PREMIUM_DEV__: String(dev), __BFC_BUILD_FLAVOR__: JSON.stringify(dev ? 'dev' : 'prod') },
      });
      const loader = createRequire(__filename)(file) as { loadLocalBundle: typeof loadLocalBundle };
      const result = await loader.loadLocalBundle(dir, CTX);
      if (dev) expect(result?.ok).toBe(true);
      else expect(result).toBeNull();
    }
    await rm(built, { recursive: true, force: true });
  });
});

describe('what a local bundle is still checked for', () => {
  it('refuses a missing folder or manifest as unreadable', async () => {
    expect(await readLocalBundle(join(dir, 'nope'), CTX)).toEqual({ ok: false, reason: 'unreadable' });
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses a manifest that is not valid or whose sequence is not 0', async () => {
    await writeFile(join(dir, 'manifest.json'), 'not json');
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'bad_manifest' });
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await writeLocal({ edit: ({ manifest }) => void (manifest['sequence'] = 3) });
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'bad_manifest' });
  });

  it('refuses an unsafe path before reading anything for it', async () => {
    await writeLocal({
      edit: ({ manifest }) => {
        const [first] = manifest['files'] as Array<{ path: string }>;
        if (first) first.path = '../outside.js';
      },
    });
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'bad_path' });
  });

  it('refuses a layout fault', async () => {
    await writeLocal({
      edit: ({ manifest }) => {
        const [first] = manifest['files'] as Array<{ path: string }>;
        if (first) first.path = 'ui/native.node';
      },
    });
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'bad_layout' });
  });

  it('refuses a file the manifest does not list', async () => {
    await writeLocal();
    await writeFile(join(dir, 'ui', 'extra.js'), 'x');
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'extra_file' });
  });

  it('refuses a file whose hash differs, and a listed file that is missing', async () => {
    await writeLocal();
    await writeFile(join(dir, 'ui', 'index.js'), 'export default 1;\n');
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'file_mismatch' });
    await rm(join(dir, 'ui', 'index.js'));
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason: 'file_mismatch' });
  });

  it.each([
    ['a host API range this app does not offer', { hostApi: '^9.0.0' }, 'host_range'],
    ['a minimum app version above this app', { minAppVersion: '99.0.0' }, 'app_too_old'],
  ] as const)('refuses %s', async (_name, options, reason) => {
    await writeLocal(options);
    expect(await readLocalBundle(dir, CTX)).toEqual({ ok: false, reason });
  });

  it('refuses a bundle that is not for this flavour', async () => {
    await writeLocal();
    expect(await readLocalBundle(dir, { ...CTX, flavor: 'beta' })).toEqual({ ok: false, reason: 'wrong_flavour' });
  });

  it('does not check freshness: an expired local build still loads', async () => {
    await writeLocal({ createdAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-02-01T00:00:00.000Z' });
    expect((await readLocalBundle(dir, CTX)).ok).toBe(true);
  });
});

describe('what a local bundle never touches', () => {
  it('writes nothing under the data folder and leaves the highest record alone', async () => {
    const data = await mkdtemp(join(tmpdir(), 'bfc-local-data-'));
    try {
      const cache = createBundleCache({ root: data, db: null, now: () => 1 });
      cache.highest.set('user-a', 9);
      await writeLocal();
      await readLocalBundle(dir, CTX);
      expect(await listing(data)).toEqual([]);
      expect(cache.highest.get('user-a')).toBe(9);
    } finally {
      await rm(data, { recursive: true, force: true });
    }
  });

  it('leaves the folder it read as it was', async () => {
    await writeLocal();
    const before = await listing(dir);
    await readLocalBundle(dir, CTX);
    expect(await listing(dir)).toEqual(before);
  });
});

describe('reaching the local bundle reader', () => {
  const SRC = join(__dirname, '..', '..', '..');

  async function bundled(dev: boolean): Promise<string> {
    const result = await build({
      entryPoints: [join(__dirname, 'dev-loader.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
      define: { __BFC_PREMIUM_DEV__: String(dev), __BFC_BUILD_FLAVOR__: JSON.stringify(dev ? 'dev' : 'prod') },
    });
    return result.outputFiles[0]?.text ?? '';
  }

  it('is in a dev bundle and absent from a prod one', async () => {
    const dev = await bundled(true);
    expect(dev).toContain('dev-bundle');
    expect(dev).toContain('unreadable');
    const prod = await bundled(false);
    expect(prod).not.toContain('dev-bundle');
    expect(prod).not.toContain('unreadable');
  });

  it('is imported by the dev-only loader and nothing else', () => {
    const importers = readAll(SRC, ['.ts', '.tsx'], { includeTests: false }).filter((file) =>
      /['"]\.{1,2}\/(?:[\w./-]*\/)?dev-bundle(?:\.js)?['"]/.test(file.source),
    );
    expect(importers.map((file) => relative(SRC, file.path).split(sep).join('/')).sort()).toEqual([
      'main/premium/host/dev-loader.ts',
    ]);
  });
});
