import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { DbUnavailableReason, TrackingHistoryView } from '@bombfarm/contracts';
import type { KeepingSealedRows, Parse } from '../licence/licence-store.js';
import { EngineOpenError, type EngineProbe, type LockedDb, type TrackingEngine } from './engine.js';

/**
 * One sealed DuckDB file and one key per subject. The folder sits beside the bundle cache's
 * `premium/` folder and does not start with its tombstone prefix, so no cache sweep reaches it.
 * Nothing here deletes a file except `clear`.
 */

export const TRACKING_DIR = 'premium-tracking';
const HASH_SALT = 'bfc-premium-tracking-v1\0';
const KEY_ROW_PREFIX = 'premium_trackdb_key_v1:';
const KEY_HEX = /^[0-9a-f]{64}$/;
/** How long `close` waits for the call in flight before it closes the handle anyway. */
const CLOSE_WAIT_MS = 10_000;
/** The waits between tries at attaching a file that exists: three seconds in all. */
const REOPEN_DELAYS_MS = [250, 750, 2_000];

/** The first 32 hex characters of `sha256('bfc-premium-tracking-v1\0' + subject)`. */
export function subjectHash(subject: string): string {
  return createHash('sha256').update(`${HASH_SALT}${subject}`).digest('hex').slice(0, 32);
}

export function trackingKeyRow(subject: string): string {
  return `${KEY_ROW_PREFIX}${subject}`;
}

/** Every refusal the store makes: the reason is the whole message. */
export class TrackingUnavailableError extends Error {
  constructor(readonly reason: DbUnavailableReason) {
    super(reason);
    this.name = 'TrackingUnavailableError';
  }
}

/** The file operation `clear` is allowed; a missing file is not an error. */
export interface TrackingFs {
  removeFile(path: string): Promise<void>;
}

const nodeFs: TrackingFs = { removeFile: (path) => unlink(path) };

export interface TrackingStoreDeps {
  /** The flavour's user-data folder. */
  root: string;
  rows: KeepingSealedRows;
  engine: TrackingEngine;
  fs?: TrackingFs;
  /** Test seam for the 10 s a closing handle waits on the call in flight. */
  closeWaitMs?: number;
  /** Test seam for the waits between tries at attaching a file that exists. */
  reopenDelaysMs?: readonly number[];
}

export type ClearOutcome = 'cleared' | 'busy' | 'failed';

export interface TrackingStore {
  /** The Settings row: file plus WAL sizes, and whether the engine can read them. No open needed. */
  status(subject: string): TrackingHistoryView;
  /**
   * The subject's database, opened on first use. Its calls run one after the other. Rejects with
   * `TrackingUnavailableError`. The handle belongs to the store: its `close` does nothing.
   */
  db(subject: string): Promise<LockedDb>;
  /** Stops taking calls (later ones are `unavailable`), waits for the call in flight, closes every handle. */
  close(): Promise<void>;
  /** Closes the subject's handle, deletes the file, its WAL and the key. Idempotent. */
  clear(subject: string): Promise<ClearOutcome>;
}

interface Handle {
  raw: LockedDb;
  tail: Promise<unknown>;
  closing: boolean;
  view: LockedDb;
}

const parseKey: Parse<string> = ({ key }) => (typeof key === 'string' && KEY_HEX.test(key) ? key : null);

function isMissing(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'ENOENT';
}

function sizeOf(path: string): number | null {
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
}

export function createTrackingStore(deps: TrackingStoreDeps): TrackingStore {
  const fs = deps.fs ?? nodeFs;
  const dir = join(deps.root, TRACKING_DIR);
  const closeWaitMs = deps.closeWaitMs ?? CLOSE_WAIT_MS;
  const reopenDelaysMs = deps.reopenDelaysMs ?? REOPEN_DELAYS_MS;
  const handles = new Map<string, Handle>();
  const opening = new Map<string, Promise<Handle>>();
  const clearing = new Set<string>();
  let closed = false;
  let probed: EngineProbe | null = null;
  const probing = deps.engine.probe().then((result) => {
    probed = result;
    return result;
  });

  const fileOf = (subject: string): string => join(dir, `${subjectHash(subject)}.duckdb`);
  const walOf = (subject: string): string => `${fileOf(subject)}.wal`;

  function refusal(subject: string): TrackingUnavailableError | null {
    if (closed) return new TrackingUnavailableError('engine_unavailable');
    if (clearing.has(subject)) return new TrackingUnavailableError('clearing');
    return null;
  }

  function guarded(subject: string, handle: Handle): LockedDb {
    const call = <T>(fn: () => Promise<T>): Promise<T> => {
      const refused = refusal(subject);
      if (refused !== null) return Promise.reject(refused);
      if (handle.closing) return Promise.reject(new TrackingUnavailableError('engine_unavailable'));
      const result = handle.tail.then(fn);
      handle.tail = result.catch(() => undefined);
      return result;
    };
    return {
      run: (sql, params) => call(() => handle.raw.run(sql, params)),
      query: (sql, params) => call(() => handle.raw.query(sql, params)),
      session: (fn) => call(() => handle.raw.session(fn)),
      close: () => undefined,
    };
  }

  async function closeHandle(subject: string): Promise<void> {
    const pending = opening.get(subject);
    if (pending !== undefined) await pending.catch(() => undefined);
    const handle = handles.get(subject);
    if (handle === undefined) return;
    handle.closing = true;
    handles.delete(subject);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, closeWaitMs);
    });
    await Promise.race([handle.tail, limit]);
    clearTimeout(timer);
    handle.raw.close();
  }

  /** A file that is there can be held for a moment, so its attach gets a few more tries before it counts as unreadable. */
  async function openExisting(file: string, key: string, fileExists: boolean): Promise<LockedDb> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await deps.engine.open(file, key);
      } catch (error) {
        const delay = reopenDelaysMs[attempt];
        const held = fileExists && error instanceof EngineOpenError && error.reason === 'attach_failed';
        if (!held || delay === undefined) throw error;
        await new Promise((resolve) => {
          setTimeout(resolve, delay).unref();
        });
        if (closed) throw error;
      }
    }
  }

  async function openHandle(subject: string): Promise<Handle> {
    if (subject === '') throw new TrackingUnavailableError('no_subject');
    const probe = await probing;
    if (!probe.ok) throw new TrackingUnavailableError('engine_unavailable');
    const file = fileOf(subject);
    const fileExists = existsSync(file);
    const kept = deps.rows.readKept(trackingKeyRow(subject), parseKey);
    let key: string;
    if (kept.ok) {
      key = kept.value;
    } else if (kept.reason === 'unavailable') {
      throw new TrackingUnavailableError('no_secure_storage');
    } else if (kept.reason === 'unreadable' || fileExists) {
      // A file without a key it can be opened with is never given a new key: that would orphan its history.
      throw new TrackingUnavailableError('db_unreadable');
    } else {
      key = randomBytes(32).toString('hex');
      if (deps.rows.write(trackingKeyRow(subject), () => JSON.stringify({ key })) !== 'written') {
        throw new TrackingUnavailableError('no_secure_storage');
      }
    }
    mkdirSync(dir, { recursive: true });
    let raw: LockedDb;
    try {
      raw = await openExisting(file, key, fileExists);
    } catch (error) {
      const reason = error instanceof EngineOpenError ? error.reason : null;
      const unreadable = fileExists && (reason === 'bad_key' || reason === 'attach_failed');
      throw new TrackingUnavailableError(unreadable ? 'db_unreadable' : 'engine_unavailable');
    }
    const handle: Handle = { raw, tail: Promise.resolve(), closing: false, view: raw };
    handle.view = guarded(subject, handle);
    return handle;
  }

  async function db(subject: string): Promise<LockedDb> {
    const refused = refusal(subject);
    if (refused !== null) throw refused;
    const existing = handles.get(subject);
    if (existing !== undefined && !existing.closing) return existing.view;
    let pending = opening.get(subject);
    if (pending === undefined) {
      pending = openHandle(subject).then((handle) => {
        handles.set(subject, handle);
        return handle;
      });
      const started = pending;
      opening.set(subject, started);
      const settle = (): void => {
        if (opening.get(subject) === started) opening.delete(subject);
      };
      started.then(settle, settle);
    }
    const handle = await pending;
    const late = refusal(subject);
    if (late !== null) throw late;
    return handle.view;
  }

  function status(subject: string): TrackingHistoryView {
    const main = sizeOf(fileOf(subject));
    const wal = sizeOf(walOf(subject));
    const bytes = main === null && wal === null ? null : (main ?? 0) + (wal ?? 0);
    const probe = probed;
    if (probe !== null && !probe.ok) return { state: 'engine_unavailable', bytes, reason: probe.reason };
    return bytes === null ? { state: 'none' } : { state: 'present', bytes };
  }

  async function close(): Promise<void> {
    closed = true;
    await Promise.all([...handles.keys()].map((subject) => closeHandle(subject)));
  }

  async function clear(subject: string): Promise<ClearOutcome> {
    if (clearing.has(subject)) return 'busy';
    clearing.add(subject);
    try {
      await closeHandle(subject);
      for (const path of [fileOf(subject), walOf(subject)]) {
        try {
          await fs.removeFile(path);
        } catch (error) {
          if (!isMissing(error)) return 'failed';
        }
      }
      return deps.rows.delete(trackingKeyRow(subject)) ? 'cleared' : 'failed';
    } finally {
      clearing.delete(subject);
    }
  }

  return { status, db, close, clear };
}
