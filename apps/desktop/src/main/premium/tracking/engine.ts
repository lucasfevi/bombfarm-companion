import { TRACKING_DB_LOCK, TRACKING_DB_OPEN_CONFIG } from '@bombfarm/contracts';
import type { LogPort } from '../../storage/index.js';

export type EngineProbe =
  | { ok: true; version: string }
  | { ok: false; reason: 'binding_missing' | 'extension_missing' | 'probe_failed' };

/** The part of the DuckDB binding the engine uses; no other module names the package. */
export interface DuckConnection {
  run(sql: string, values?: unknown[]): Promise<unknown>;
  runAndReadAll(sql: string, values?: unknown[]): Promise<{ getRowObjectsJS(): Record<string, unknown>[] }>;
  closeSync(): void;
}
export interface DuckInstance {
  connect(): Promise<DuckConnection>;
  closeSync(): void;
}
export interface DuckBinding {
  DuckDBInstance: { create(path: string, options: Record<string, string>): Promise<DuckInstance> };
}

/** An open, locked database: the first statement a caller runs is already under the lock. */
export interface LockedDb {
  run(sql: string, params?: readonly unknown[]): Promise<void>;
  query(sql: string, params?: readonly unknown[]): Promise<Record<string, unknown>[]>;
  /** Idempotent. */
  close(): void;
}

export type EngineOpenReason =
  | 'binding_missing'
  | 'bad_key'
  | 'extension_failed'
  | 'attach_failed'
  | 'lock_failed'
  | 'settings_unexpected';

export class EngineOpenError extends Error {
  constructor(
    readonly reason: EngineOpenReason,
    cause?: unknown,
  ) {
    super(reason, cause === undefined ? undefined : { cause });
    this.name = 'EngineOpenError';
  }
}

export interface TrackingEngine {
  /** The one start-up probe. Runs on the first call, answers the same value afterwards; never throws. */
  probe(): Promise<EngineProbe>;
  /** Throws `EngineOpenError`; on any failure the instance is already closed. */
  open(file: string, keyHex: string): Promise<LockedDb>;
}

export interface TrackingEngineDeps {
  /** Where the signed extension is shipped; never a path premium code supplies. */
  extensionPath: string;
  log: LogPort;
  /** Test seam: how the binding is loaded. Defaults to a lazy `require`. */
  loadBinding?: () => DuckBinding;
}

/** What the four settings must read back as once the lock is on, in this order. */
const LOCKED_SETTINGS = [
  ['enable_external_access', 'false'],
  ['lock_configuration', 'true'],
  ['autoload_known_extensions', 'false'],
  ['allow_unsigned_extensions', 'false'],
] as const;

/** The name the tracking file is attached under. */
const ALIAS = 'track';
const KEY_HEX = /^[0-9a-f]{64}$/;

function lit(value: string): string {
  return `'${value.split('\\').join('/').replace(/'/g, "''")}'`;
}

function lazyBinding(): DuckBinding {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@duckdb/node-api') as DuckBinding;
}

function closeQuietly(instance: DuckInstance, connection: DuckConnection | null): void {
  try {
    connection?.closeSync();
  } catch {
    // best-effort: the instance close below releases it anyway
  }
  try {
    instance.closeSync();
  } catch {
    // best-effort close of an instance that already failed
  }
}

export function createTrackingEngine(deps: TrackingEngineDeps): TrackingEngine {
  const loadBinding = deps.loadBinding ?? lazyBinding;
  let probed: Promise<EngineProbe> | null = null;

  async function runProbe(): Promise<EngineProbe> {
    let binding: DuckBinding;
    try {
      binding = loadBinding();
    } catch {
      return { ok: false, reason: 'binding_missing' };
    }
    let instance: DuckInstance | null = null;
    let connection: DuckConnection | null = null;
    try {
      instance = await binding.DuckDBInstance.create(':memory:', { ...TRACKING_DB_OPEN_CONFIG });
      connection = await instance.connect();
      try {
        await connection.run(`LOAD ${lit(deps.extensionPath)}`);
      } catch {
        return { ok: false, reason: 'extension_missing' };
      }
      const [row] = (await connection.runAndReadAll('SELECT version() AS v, 40 + 2 AS answer')).getRowObjectsJS();
      if (row === undefined || Number(row['answer']) !== 42 || typeof row['v'] !== 'string') {
        return { ok: false, reason: 'probe_failed' };
      }
      return { ok: true, version: row['v'] };
    } catch {
      return { ok: false, reason: 'probe_failed' };
    } finally {
      if (instance !== null) closeQuietly(instance, connection);
    }
  }

  function probe(): Promise<EngineProbe> {
    probed ??= runProbe().then(
      (result) => {
        report(result);
        return result;
      },
      () => {
        const result: EngineProbe = { ok: false, reason: 'probe_failed' };
        report(result);
        return result;
      },
    );
    return probed;
  }

  function report(result: EngineProbe): void {
    const record = result.ok
      ? { scope: 'premium', event: 'premium.tracking_probe', outcome: 'ok', version: result.version }
      : { scope: 'premium', event: 'premium.tracking_probe', outcome: result.reason };
    try {
      if (result.ok) deps.log.info(record);
      else deps.log.warn(record);
    } catch {
      // a failing log must not turn the probe into a throw
    }
  }

  async function open(file: string, keyHex: string): Promise<LockedDb> {
    if (!KEY_HEX.test(keyHex)) throw new EngineOpenError('bad_key');
    let binding: DuckBinding;
    try {
      binding = loadBinding();
    } catch (error) {
      throw new EngineOpenError('binding_missing', error);
    }

    let instance: DuckInstance | null = null;
    let connection: DuckConnection | null = null;
    let step: EngineOpenReason = 'extension_failed';
    try {
      instance = await binding.DuckDBInstance.create(':memory:', { ...TRACKING_DB_OPEN_CONFIG });
      connection = await instance.connect();
      await connection.run(`LOAD ${lit(deps.extensionPath)}`);
      step = 'attach_failed';
      await connection.run(`ATTACH ${lit(file)} AS ${ALIAS} (ENCRYPTION_KEY '${keyHex}')`);
      await connection.run(`USE ${ALIAS}`);
      step = 'lock_failed';
      for (const [name, value] of TRACKING_DB_LOCK) {
        await connection.run(`SET ${name} = ${value}`);
      }
      step = 'settings_unexpected';
      for (const [name, expected] of LOCKED_SETTINGS) {
        const [row] = (await connection.runAndReadAll(`SELECT current_setting('${name}') AS v`)).getRowObjectsJS();
        if (row === undefined || String(row['v']) !== expected) throw new Error(`${name} did not read back`);
      }
    } catch (error) {
      if (instance !== null) closeQuietly(instance, connection);
      throw error instanceof EngineOpenError ? error : new EngineOpenError(step, error);
    }

    const db = connection;
    const owner = instance;
    let closed = false;
    return {
      async run(sql, params) {
        await db.run(sql, params === undefined ? undefined : [...params]);
      },
      async query(sql, params) {
        const reader = await db.runAndReadAll(sql, params === undefined ? undefined : [...params]);
        return reader.getRowObjectsJS();
      },
      close() {
        if (closed) return;
        closed = true;
        closeQuietly(owner, db);
      },
    };
  }

  return { probe, open };
}
