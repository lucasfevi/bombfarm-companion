import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBundleCache, nodeCacheFs, type BundleCache, type CacheFs } from './bundle-cache.js';
import { verifyBundle } from './bundle-verify.js';
import { createMetaDb, HOST_NOW, signedInput, VERIFY_CTX, verifiedFixture } from './host-test-support.js';

let root = '';
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'bfc-cache-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function errno(code: string): Error {
  return Object.assign(new Error(code), { code });
}

/** The real file system, with chosen operations failing on chosen paths. */
function faultyFs(fault: (op: string, path: string) => Error | null): CacheFs {
  const check = async (op: string, path: string): Promise<void> => {
    const failure = fault(op, path);
    if (failure !== null) throw failure;
    await Promise.resolve();
  };
  return {
    readdir: async (path) => {
      await check('readdir', path);
      return nodeCacheFs.readdir(path);
    },
    readFile: async (path) => {
      await check('readFile', path);
      return nodeCacheFs.readFile(path);
    },
    writeFile: async (path, data) => {
      await check('writeFile', path);
      return nodeCacheFs.writeFile(path, data);
    },
    mkdir: async (path) => {
      await check('mkdir', path);
      return nodeCacheFs.mkdir(path);
    },
    rename: async (from, to) => {
      await check('rename', from);
      return nodeCacheFs.rename(from, to);
    },
    rm: async (path) => {
      await check('rm', path);
      return nodeCacheFs.rm(path);
    },
  };
}

function cacheOver(fs?: CacheFs, now = (): number => HOST_NOW): { cache: BundleCache; db: ReturnType<typeof createMetaDb> } {
  const db = createMetaDb();
  return { cache: createBundleCache({ root, db, now, ...(fs ? { fs } : {}) }), db };
}

const names = async (dir: string): Promise<string[]> => (await readdir(dir)).sort();

describe('write, scan and read', () => {
  it('writes the manifest, the signature and every file, and reads them back byte for byte', async () => {
    const { cache } = cacheOver();
    const bundle = verifiedFixture({ sequence: 4 });
    await cache.write(bundle);

    expect(await cache.scan()).toEqual([4]);
    const read = await cache.read(4);
    expect(read).not.toBeNull();
    expect(Buffer.from(read?.manifestBytes ?? []).equals(Buffer.from(bundle.manifestBytes))).toBe(true);
    expect(Buffer.from(read?.sig ?? []).equals(Buffer.from(bundle.sig))).toBe(true);
    expect([...(read?.files.keys() ?? [])].sort()).toEqual([...bundle.files.keys()].sort());
    // What comes back verifies again, which is the boot check.
    expect(verifyBundle(read ?? signedInput(), VERIFY_CTX).ok).toBe(true);
    expect(await names(join(root, 'premium'))).toEqual(['4']);
  });

  it('lists newest first and ignores names that are not sequences', async () => {
    const { cache } = cacheOver();
    await cache.write(verifiedFixture({ sequence: 3 }));
    await cache.write(verifiedFixture({ sequence: 12 }));
    await mkdir(join(root, 'premium', 'notes'));
    await writeFile(join(root, 'premium', '9'), 'a file, not a folder');
    expect(await cache.scan()).toEqual([12, 3]);
  });

  it('reports an empty cache when there is no premium folder', async () => {
    const { cache } = cacheOver();
    expect(await cache.scan()).toEqual([]);
    expect(await cache.read(1)).toBeNull();
  });

  it('leaves no folder that scan reports when a crash comes between the write and the rename', async () => {
    const crash = faultyFs((op, path) => (op === 'rename' && path.includes('.incoming-5') ? errno('EIO') : null));
    const { cache } = cacheOver(crash);
    await expect(cache.write(verifiedFixture({ sequence: 5 }))).rejects.toThrow();
    expect(await cache.scan()).toEqual([]);
    expect(await names(join(root, 'premium'))).toEqual([]);
  });

  it('does not report a staging folder a real crash left behind, and sweeps it at start', async () => {
    const { cache } = cacheOver();
    await mkdir(join(root, 'premium', '.incoming-6'), { recursive: true });
    await writeFile(join(root, 'premium', '.incoming-6', 'manifest.json'), '{}');
    expect(await cache.scan()).toEqual([]);
    await cache.sweepTombstones();
    expect(await names(join(root, 'premium'))).toEqual([]);
  });

  it('replaces a folder of the same sequence', async () => {
    const { cache } = cacheOver();
    await cache.write(verifiedFixture({ sequence: 4, version: '1.0.0' }));
    await cache.write(verifiedFixture({ sequence: 4, version: '1.0.1' }));
    const read = await cache.read(4);
    const manifest = JSON.parse(Buffer.from(read?.manifestBytes ?? []).toString('utf8')) as { version: string };
    expect(manifest.version).toBe('1.0.1');
  });

  it('refuses a folder holding more files than any bundle may', async () => {
    const { cache } = cacheOver();
    await cache.write(verifiedFixture({ sequence: 4 }));
    for (let i = 0; i < 70; i += 1) await writeFile(join(root, 'premium', '4', `extra-${String(i)}.bin`), 'x');
    expect(await cache.read(4)).toBeNull();
  });
});

describe('prune, discard and drop', () => {
  it('prune keeps one sequence and removes the rest', async () => {
    const { cache } = cacheOver();
    for (const sequence of [2, 3, 4]) await cache.write(verifiedFixture({ sequence }));
    await cache.prune(3);
    expect(await cache.scan()).toEqual([3]);
  });

  it('a re-verify failure deletes only that sequence', async () => {
    const { cache } = cacheOver();
    for (const sequence of [3, 4]) await cache.write(verifiedFixture({ sequence }));
    await cache.discard(4);
    expect(await cache.scan()).toEqual([3]);
  });

  it('drop deletes every folder and leaves the record alone', async () => {
    const { cache } = cacheOver();
    await cache.write(verifiedFixture({ sequence: 3 }));
    cache.highest.set('user-a', 3);
    await cache.drop();
    expect(await cache.scan()).toEqual([]);
    expect(cache.highest.get('user-a')).toBe(3);
  });
});

describe('the highest accepted record', () => {
  it('stores one plain row of subject and sequence', () => {
    const { cache, db } = cacheOver();
    cache.highest.set('user-a', 7);
    expect(JSON.parse(db.rows.get('premium_bundle_seq_v1') ?? '')).toEqual({ subject: 'user-a', sequence: 7 });
    expect(cache.highest.get('user-a')).toBe(7);
    expect(cache.highest.owner()).toBe('user-a');
  });

  it('reads as absent for another subject', () => {
    const { cache } = cacheOver();
    cache.highest.set('user-a', 7);
    expect(cache.highest.get('user-b')).toBeNull();
    expect(cache.highest.owner()).toBe('user-a');
  });

  it('never lowers the stored sequence for the same subject, but a new subject replaces it', () => {
    const { cache } = cacheOver();
    cache.highest.set('user-a', 7);
    cache.highest.set('user-a', 5);
    expect(cache.highest.get('user-a')).toBe(7);
    cache.highest.set('user-b', 2);
    expect(cache.highest.get('user-b')).toBe(2);
    expect(cache.highest.get('user-a')).toBeNull();
  });

  it('works without a database, for this run only', () => {
    const cache = createBundleCache({ root, db: null, now: () => 1 });
    cache.highest.set('user-a', 3);
    expect(cache.highest.get('user-a')).toBe(3);
    cache.highest.clear();
    expect(cache.highest.get('user-a')).toBeNull();
  });

  it('treats an unreadable row as none', () => {
    const { cache, db } = cacheOver();
    db.rows.set('premium_bundle_seq_v1', 'not json');
    expect(cache.highest.owner()).toBeNull();
    expect(cache.highest.get('user-a')).toBeNull();
  });
});

describe('remove', () => {
  it('clears the record first, renames the tree to a tombstone, deletes it, and is done', async () => {
    const order: string[] = [];
    const fs = faultyFs((op, path) => {
      if (op === 'rename') order.push(`rename ${path.endsWith('premium') ? 'premium' : path}`);
      return null;
    });
    const { cache, db } = cacheOver(fs, () => 1_000);
    await cache.write(verifiedFixture({ sequence: 4 }));
    cache.highest.set('user-a', 4);
    const clearsFirst = db.rows.has('premium_bundle_seq_v1');
    expect(clearsFirst).toBe(true);

    const result = await cache.remove();
    expect(result).toEqual({ done: true });
    expect(db.rows.has('premium_bundle_seq_v1')).toBe(false);
    expect(order.some((line) => line === 'rename premium')).toBe(true);
    expect(await names(root)).toEqual([]);
  });

  it('keeps the tombstone name to the unix milliseconds', async () => {
    const seen: string[] = [];
    const fs = faultyFs((op, path) => {
      if (op === 'rm' && path.includes('premium.tombstone-')) seen.push(path);
      return null;
    });
    const { cache } = cacheOver(fs, () => 1_234_567);
    await cache.write(verifiedFixture({ sequence: 4 }));
    await cache.remove();
    expect(seen.some((path) => path.endsWith('premium.tombstone-1234567'))).toBe(true);
  });

  it('deletes in place when the rename is refused (EPERM, EBUSY)', async () => {
    for (const code of ['EPERM', 'EBUSY']) {
      const fs = faultyFs((op, path) => (op === 'rename' && path.endsWith('premium') ? errno(code) : null));
      const { cache } = cacheOver(fs);
      await cache.write(verifiedFixture({ sequence: 4 }));
      expect(await cache.remove()).toEqual({ done: true });
      expect(await names(root)).toEqual([]);
    }
  });

  it('is not done while a delete is refused, and finishes on a later call', async () => {
    let refusals = 2;
    const fs = faultyFs((op, path) => {
      if (op === 'rm' && path.includes('tombstone') && refusals > 0) {
        refusals -= 1;
        return errno('EBUSY');
      }
      return null;
    });
    const { cache } = cacheOver(fs, () => 5);
    await cache.write(verifiedFixture({ sequence: 4 }));

    expect(await cache.remove()).toEqual({ done: false });
    expect((await names(root)).some((n) => n.startsWith('premium.tombstone-'))).toBe(true);
    expect(await cache.remove()).toEqual({ done: false });
    expect(await cache.remove()).toEqual({ done: true });
    expect(await names(root)).toEqual([]);
  });

  it('is not done while the in-place delete after a refused rename is refused', async () => {
    let refusals = 1;
    const fs = faultyFs((op, path) => {
      if (op === 'rename' && path.endsWith('premium')) return errno('EPERM');
      if (op === 'rm' && path.endsWith('premium') && refusals > 0) {
        refusals -= 1;
        return errno('EBUSY');
      }
      return null;
    });
    const { cache } = cacheOver(fs);
    await cache.write(verifiedFixture({ sequence: 4 }));
    expect(await cache.remove()).toEqual({ done: false });
    expect(await cache.remove()).toEqual({ done: true });
  });

  it('is done at once when there is nothing to remove', async () => {
    const { cache } = cacheOver();
    expect(await cache.remove()).toEqual({ done: true });
  });
});

describe('sweepTombstones', () => {
  it('deletes every tombstone and counts none left', async () => {
    const { cache } = cacheOver();
    for (const n of ['premium.tombstone-1', 'premium.tombstone-2']) {
      await mkdir(join(root, n, 'nested'), { recursive: true });
    }
    await writeFile(join(root, 'unrelated.txt'), 'keep');
    expect(await cache.sweepTombstones()).toEqual({ left: 0 });
    expect(await names(root)).toEqual(['unrelated.txt']);
  });

  it('counts the tombstones it could not delete', async () => {
    const fs = faultyFs((op, path) => (op === 'rm' && path.endsWith('premium.tombstone-2') ? errno('EBUSY') : null));
    const { cache } = cacheOver(fs);
    for (const n of ['premium.tombstone-1', 'premium.tombstone-2']) await mkdir(join(root, n), { recursive: true });
    expect(await cache.sweepTombstones()).toEqual({ left: 1 });
    expect(await names(root)).toEqual(['premium.tombstone-2']);
  });
});
