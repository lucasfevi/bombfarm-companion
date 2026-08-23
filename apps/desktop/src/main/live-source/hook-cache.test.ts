import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { HookRecord, LogPort } from './hook-cache.js';
import { emptyHookCache, lookupHook, readHookCacheFile, storeHook, writeHookCacheFile } from './hook-cache.js';

const tempDirs: string[] = [];

function tempCacheDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-hook-cache-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createLogSpy(): { log: LogPort; warnings: Record<string, unknown>[] } {
  const warnings: Record<string, unknown>[] = [];
  return { log: { warn: (record) => warnings.push(record) }, warnings };
}

function hookRecord(overrides: Partial<HookRecord> = {}): HookRecord {
  return { rva: 0x1000, anchors: ['=> read', '<= read'], validatedAt: Date.now(), ...overrides };
}

describe('storeHook / lookupHook', () => {
  it('keeps entries per build and never overwrites another build\'s record', () => {
    let cache = emptyHookCache();
    cache = storeHook(cache, 'build-a', hookRecord({ rva: 0x1000 }));
    cache = storeHook(cache, 'build-b', hookRecord({ rva: 0x2000 }));

    expect(lookupHook(cache, 'build-a', ['=> read', '<= read'])?.rva).toBe(0x1000);
    expect(lookupHook(cache, 'build-b', ['=> read', '<= read'])?.rva).toBe(0x2000);
  });

  it('returns null when the stored anchors are not a subset of the anchors discovery would use today', () => {
    const cache = storeHook(
      emptyHookCache(),
      'build-a',
      hookRecord({ anchors: ['=> read', 'bad application data message'] }),
    );

    expect(lookupHook(cache, 'build-a', ['=> read'])).toBeNull();
    expect(lookupHook(cache, 'build-a', ['=> read', 'bad application data message', '<= read'])).not.toBeNull();
  });

  it('treats a missing build stamp as uncached, regardless of what the cache holds', () => {
    const cache = storeHook(emptyHookCache(), 'build-a', hookRecord());

    expect(lookupHook(cache, null, ['=> read'])).toBeNull();
  });

  it('returns null for a build with no stored record', () => {
    expect(lookupHook(emptyHookCache(), 'build-a', ['=> read'])).toBeNull();
  });
});

describe('readHookCacheFile / writeHookCacheFile', () => {
  it('starts fresh with no error when the file is absent', () => {
    const dir = tempCacheDir();

    expect(readHookCacheFile(dir)).toEqual(emptyHookCache());
  });

  it('round-trips a cache written to disk', () => {
    const dir = tempCacheDir();
    const cache = storeHook(emptyHookCache(), 'build-a', hookRecord());

    writeHookCacheFile(dir, cache);

    expect(readHookCacheFile(dir)).toEqual(cache);
  });

  it('drops a file whose version does not match, rather than migrating it, and logs once', () => {
    const dir = tempCacheDir();
    fs.writeFileSync(
      path.join(dir, 'hook-cache.json'),
      JSON.stringify({ version: 2, builds: { 'build-a': hookRecord() } }),
      'utf8',
    );
    const { log, warnings } = createLogSpy();

    const result = readHookCacheFile(dir, log);

    expect(result).toEqual(emptyHookCache());
    expect(warnings).toHaveLength(1);
  });

  it('starts fresh and logs once when the file does not parse as JSON', () => {
    const dir = tempCacheDir();
    fs.writeFileSync(path.join(dir, 'hook-cache.json'), '{ not json', 'utf8');
    const { log, warnings } = createLogSpy();

    const result = readHookCacheFile(dir, log);

    expect(result).toEqual(emptyHookCache());
    expect(warnings).toHaveLength(1);
  });

  it('survives a simulated mid-write kill: a leftover tmp file never corrupts what readers see', () => {
    const dir = tempCacheDir();
    const cacheA = storeHook(emptyHookCache(), 'build-a', hookRecord({ rva: 0x1000 }));
    writeHookCacheFile(dir, cacheA);

    // The process dies after a tmp file is written but before the rename that publishes it.
    // readHookCacheFile only ever reads the real path, so a half-written tmp file beside it must
    // not be able to affect what a reader sees — that is the whole point of tmp-then-rename.
    fs.writeFileSync(path.join(dir, 'hook-cache.json.tmp-simulated-crash'), '{ "version": 1, "buil', 'utf8');

    expect(readHookCacheFile(dir)).toEqual(cacheA);

    const cacheB = storeHook(emptyHookCache(), 'build-b', hookRecord({ rva: 0x2000 }));
    writeHookCacheFile(dir, cacheB);

    expect(readHookCacheFile(dir)).toEqual(cacheB);
  });
});
