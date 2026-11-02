import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SqliteDb } from '../../storage/index.js';
import type { BundleInput, VerifiedBundle } from './bundle-verify.js';
import { checkBundlePath } from './bundle-paths.js';

/**
 * The verified bundles kept under `<userData>/premium/<sequence>/`, and the one record of the
 * highest sequence ever accepted. Nothing here judges a bundle: it stores bytes, hands them back
 * once, and deletes. A bundle is written to a staging folder and renamed into place, so a crash
 * never leaves a folder that `scan` would report half-written.
 */

export const PREMIUM_DIR = 'premium';
export const TOMBSTONE_PREFIX = 'premium.tombstone-';
const INCOMING_PREFIX = '.incoming-';
const MANIFEST_FILE = 'manifest.json';
const SIGNATURE_FILE = 'manifest.sig';
const HIGHEST_KEY = 'premium_bundle_seq_v1';
/** More files than any bundle may hold; a folder past it is not read. */
const READ_FILE_LIMIT = 64;
const SEQUENCE_DIR = /^[1-9][0-9]*$/;

export interface CacheEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
}

/** The file operations the cache needs, so tests can fail any of them. */
export interface CacheFs {
  readonly readdir: (path: string) => Promise<readonly CacheEntry[]>;
  readonly readFile: (path: string) => Promise<Uint8Array>;
  readonly writeFile: (path: string, data: Uint8Array) => Promise<void>;
  readonly mkdir: (path: string) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  /** Recursive; a missing path is not an error. */
  readonly rm: (path: string) => Promise<void>;
}

export const nodeCacheFs: CacheFs = {
  async readdir(path) {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }));
  },
  readFile: (path) => readFile(path),
  writeFile: (path, data) => writeFile(path, data),
  async mkdir(path) {
    await mkdir(path, { recursive: true });
  },
  rename,
  rm: (path) => rm(path, { recursive: true, force: true }),
};

export interface HighestRecord {
  /** The subject the record belongs to; null when there is none. */
  owner(): string | null;
  /** The highest accepted sequence for this subject; a record for anyone else reads as absent. */
  get(subject: string): number | null;
  /** Records a sequence; it never lowers what is stored for the same subject. */
  set(subject: string, sequence: number): void;
  clear(): void;
}

export interface BundleCache {
  /** Deletes every tombstone and stale staging folder. `left` counts what could not be deleted. */
  sweepTombstones(): Promise<{ left: number }>;
  /** The sequences present, newest first. A staging folder is never one of them. */
  scan(): Promise<number[]>;
  /** Every file of one sequence, read once; null when its manifest or signature is missing. */
  read(sequence: number): Promise<BundleInput | null>;
  write(bundle: VerifiedBundle): Promise<void>;
  /** Deletes every folder but this sequence. */
  prune(keep: number): Promise<void>;
  /** Deletes one sequence's folder and no other. */
  discard(sequence: number): Promise<void>;
  /** Deletes every folder. */
  drop(): Promise<void>;
  /** Clears the record, renames the tree to a tombstone and deletes it. */
  remove(): Promise<{ done: boolean }>;
  readonly highest: HighestRecord;
}

export interface BundleCacheDeps {
  /** The app's data folder; the cache lives in `premium/` beside the tombstones. */
  readonly root: string;
  readonly db: SqliteDb | null;
  readonly now: () => number;
  readonly fs?: CacheFs;
}

function errorCode(error: unknown): string | undefined {
  return (error as { code?: unknown } | null)?.code as string | undefined;
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === 'ENOENT';
}

export function createHighestRecord(db: SqliteDb | null): HighestRecord {
  let memory: { subject: string; sequence: number } | null = null;

  function load(): { subject: string; sequence: number } | null {
    if (db === null) return memory;
    try {
      const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(HIGHEST_KEY) as
        | { value: string }
        | undefined;
      if (row === undefined) return null;
      const parsed = JSON.parse(row.value) as { subject?: unknown; sequence?: unknown } | null;
      if (typeof parsed?.subject === 'string' && Number.isSafeInteger(parsed.sequence)) {
        return { subject: parsed.subject, sequence: parsed.sequence as number };
      }
    } catch {
      // An unreadable record is the same as none.
    }
    return null;
  }

  return {
    owner: () => load()?.subject ?? null,
    get(subject) {
      const held = load();
      return held !== null && held.subject === subject ? held.sequence : null;
    },
    set(subject, sequence) {
      const held = load();
      const next = held !== null && held.subject === subject ? Math.max(held.sequence, sequence) : sequence;
      memory = { subject, sequence: next };
      if (db === null) return;
      try {
        db.prepare(
          'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
        ).run(HIGHEST_KEY, JSON.stringify(memory));
      } catch {
        // Kept for this run; the next accepted bundle writes it again.
      }
    },
    clear() {
      memory = null;
      if (db === null) return;
      try {
        db.prepare('DELETE FROM account_meta WHERE key = ?').run(HIGHEST_KEY);
      } catch {
        // A row that cannot be deleted is read as absent for another subject and overwritten for this one.
      }
    },
  };
}

export function createBundleCache(deps: BundleCacheDeps): BundleCache {
  const fs = deps.fs ?? nodeCacheFs;
  const premiumDir = join(deps.root, PREMIUM_DIR);
  const highest = createHighestRecord(deps.db);

  async function listing(path: string): Promise<readonly CacheEntry[]> {
    try {
      return await fs.readdir(path);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  async function tombstones(): Promise<string[]> {
    return (await listing(deps.root)).filter((e) => e.name.startsWith(TOMBSTONE_PREFIX)).map((e) => join(deps.root, e.name));
  }

  /** Deletes a path; reports whether it could. */
  async function tryRm(path: string): Promise<boolean> {
    try {
      await fs.rm(path);
      return true;
    } catch {
      return false;
    }
  }

  async function sequenceFiles(dir: string, prefix: string, out: Map<string, Uint8Array>): Promise<boolean> {
    for (const entry of await fs.readdir(dir)) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory) {
        if (!(await sequenceFiles(join(dir, entry.name), rel, out))) return false;
      } else if (entry.isFile) {
        if (prefix === '' && (entry.name === MANIFEST_FILE || entry.name === SIGNATURE_FILE)) continue;
        if (out.size >= READ_FILE_LIMIT) return false;
        out.set(rel, await fs.readFile(join(dir, entry.name)));
      }
    }
    return true;
  }

  async function writeFiles(dir: string, bundle: VerifiedBundle): Promise<void> {
    await fs.mkdir(dir);
    await fs.writeFile(join(dir, MANIFEST_FILE), bundle.manifestBytes);
    await fs.writeFile(join(dir, SIGNATURE_FILE), bundle.sig);
    for (const [path, bytes] of bundle.files) {
      // Manifest paths were checked before the bundle was verified; check again before joining.
      if (checkBundlePath(path) !== 'ok') throw new Error('premium_bundle_path_invalid');
      const target = join(dir, ...path.split('/'));
      await fs.mkdir(dirname(target));
      await fs.writeFile(target, bytes);
    }
  }

  async function removeWhere(keep: (name: string) => boolean): Promise<void> {
    for (const entry of await listing(premiumDir)) {
      if (!keep(entry.name)) await fs.rm(join(premiumDir, entry.name));
    }
  }

  return {
    highest,

    async sweepTombstones() {
      let left = 0;
      for (const path of await tombstones()) {
        if (!(await tryRm(path))) left += 1;
      }
      try {
        await removeWhere((name) => !name.startsWith(INCOMING_PREFIX));
      } catch {
        // A staging folder that stays is ignored by `scan` and replaced by the next write.
      }
      return { left };
    },

    async scan() {
      return (await listing(premiumDir))
        .filter((e) => e.isDirectory && SEQUENCE_DIR.test(e.name))
        .map((e) => Number(e.name))
        .filter((n) => Number.isSafeInteger(n))
        .sort((a, b) => b - a);
    },

    async read(sequence) {
      const dir = join(premiumDir, String(sequence));
      try {
        const manifestBytes = await fs.readFile(join(dir, MANIFEST_FILE));
        const sig = await fs.readFile(join(dir, SIGNATURE_FILE));
        const files = new Map<string, Uint8Array>();
        if (!(await sequenceFiles(dir, '', files))) return null;
        return { manifestBytes, sig, files };
      } catch {
        return null;
      }
    },

    async write(bundle) {
      const { sequence } = bundle.manifest;
      const staging = join(premiumDir, `${INCOMING_PREFIX}${String(sequence)}`);
      const final = join(premiumDir, String(sequence));
      await fs.rm(staging);
      try {
        await writeFiles(staging, bundle);
        await fs.rm(final);
        await fs.rename(staging, final);
      } catch (error) {
        await tryRm(staging);
        throw error;
      }
    },

    async prune(keep) {
      await removeWhere((name) => name === String(keep) || name.startsWith(INCOMING_PREFIX));
    },

    async discard(sequence) {
      await fs.rm(join(premiumDir, String(sequence)));
    },

    async drop() {
      await fs.rm(premiumDir);
    },

    async remove() {
      highest.clear();
      let present = (await listing(deps.root)).some((e) => e.name === PREMIUM_DIR);
      if (present) {
        try {
          await fs.rename(premiumDir, join(deps.root, `${TOMBSTONE_PREFIX}${String(deps.now())}`));
          present = false;
        } catch {
          // A handle held across the rename (EPERM, EBUSY) is not a reason to keep the code:
          // delete where it stands, and let the retries finish what is left.
          present = !(await tryRm(premiumDir));
        }
      }
      for (const path of await tombstones()) await tryRm(path);
      const stillThere = present || (await tombstones()).length > 0 || (await listing(deps.root)).some((e) => e.name === PREMIUM_DIR);
      return { done: !stillThere };
    },
  };
}
