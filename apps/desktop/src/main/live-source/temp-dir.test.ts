import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { LogPort } from './runtime.js';
import { canCreateDirectoryIn, effectiveTempDir, ensureWritableTempDir } from './temp-dir.js';

function createLogSpy(): { log: LogPort; infos: Record<string, unknown>[] } {
  const infos: Record<string, unknown>[] = [];
  return { log: { info: (record) => infos.push(record) }, infos };
}

const UNWRITABLE = 'C:\\PROGRA~1\\Cracker\\temp';
const FALLBACK = 'C:\\Users\\player\\AppData\\Roaming\\App\\tmp';

describe('effectiveTempDir', () => {
  it('reads TMPDIR, then TMP, then TEMP — the first one set wins, an empty value does not count', () => {
    expect(effectiveTempDir({ TMPDIR: 'a', TMP: 'b', TEMP: 'c' })).toBe('a');
    expect(effectiveTempDir({ TMP: 'b', TEMP: 'c' })).toBe('b');
    expect(effectiveTempDir({ TMPDIR: '', TEMP: 'c' })).toBe('c');
    expect(effectiveTempDir({})).toBeUndefined();
  });
});

describe('ensureWritableTempDir', () => {
  it('leaves the environment alone and logs nothing when the current temp folder is writable', () => {
    const { log, infos } = createLogSpy();
    const env = { TMP: 'C:\\Users\\player\\AppData\\Local\\Temp', TEMP: 'C:\\Users\\player\\AppData\\Local\\Temp' };

    const outcome = ensureWritableTempDir({ env, fallbackDir: FALLBACK, log, isWritable: () => true });

    expect(outcome).toEqual({ kind: 'kept', dir: 'C:\\Users\\player\\AppData\\Local\\Temp' });
    expect(env).toEqual({ TMP: 'C:\\Users\\player\\AppData\\Local\\Temp', TEMP: 'C:\\Users\\player\\AppData\\Local\\Temp' });
    expect(infos).toHaveLength(0);
  });

  it('points all three variables at the fallback when the current temp folder is not writable', () => {
    const { log, infos } = createLogSpy();
    const env: Record<string, string | undefined> = { TMP: UNWRITABLE, TEMP: UNWRITABLE };

    const outcome = ensureWritableTempDir({ env, fallbackDir: FALLBACK, log, isWritable: (dir) => dir === FALLBACK });

    expect(outcome).toEqual({ kind: 'redirected', from: UNWRITABLE, to: FALLBACK });
    expect(env).toEqual({ TMPDIR: FALLBACK, TMP: FALLBACK, TEMP: FALLBACK });
    expect(infos).toEqual([{ scope: 'live-source', event: 'temp.redirected', from: UNWRITABLE, to: FALLBACK }]);
  });

  it('redirects when no temp variable is set at all', () => {
    const { log } = createLogSpy();
    const env: Record<string, string | undefined> = {};

    const outcome = ensureWritableTempDir({ env, fallbackDir: FALLBACK, log, isWritable: (dir) => dir === FALLBACK });

    expect(outcome).toEqual({ kind: 'redirected', from: undefined, to: FALLBACK });
    expect(env.TEMP).toBe(FALLBACK);
  });

  it('changes nothing and says so when the fallback is not writable either', () => {
    const { log, infos } = createLogSpy();
    const env: Record<string, string | undefined> = { TEMP: UNWRITABLE };

    const outcome = ensureWritableTempDir({ env, fallbackDir: FALLBACK, log, isWritable: () => false });

    expect(outcome).toEqual({ kind: 'unwritable', from: UNWRITABLE, fallback: FALLBACK });
    expect(env).toEqual({ TEMP: UNWRITABLE });
    expect(infos).toEqual([{ scope: 'live-source', event: 'temp.unwritable', from: UNWRITABLE, fallback: FALLBACK }]);
  });
});

describe('canCreateDirectoryIn', () => {
  const created: string[] = [];
  afterEach(() => {
    for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is true for a real writable folder and leaves no probe directory behind', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-temp-dir-test-'));
    created.push(dir);

    expect(canCreateDirectoryIn(dir)).toBe(true);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('creates a missing folder on the way, since the fallback does not exist on a first run', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-temp-dir-test-'));
    created.push(parent);
    const dir = path.join(parent, 'nested', 'tmp');

    expect(canCreateDirectoryIn(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('is false when the path is taken by a file, so no folder can be created there', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-temp-dir-test-'));
    created.push(parent);
    const file = path.join(parent, 'not-a-folder');
    fs.writeFileSync(file, '');

    expect(canCreateDirectoryIn(file)).toBe(false);
  });
});
