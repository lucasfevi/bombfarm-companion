import { CapabilityError, type CapabilityHandler } from '../capability-channel.js';
import type { SealedRows } from '../../licence/licence-store.js';

/** The row a user's store lives in; one per signed-in user. */
export const STORE_ROW_PREFIX = 'premium_store_v1';
export const STORE_KEY_PATTERN = /^[a-z0-9._-]{1,64}$/;
export const STORE_VALUE_MAX_BYTES = 64 * 1024;
export const STORE_TOTAL_MAX_BYTES = 1024 * 1024;

export interface StoreCapabilityDeps {
  /** The signed-in user's id; null while signed out. */
  subject(): string | null;
  readonly rows: SealedRows;
}

export function storeRowKey(subject: string): string {
  return `${STORE_ROW_PREFIX}:${subject}`;
}

type Row = Record<string, unknown>;

const bytes = (json: string): number => Buffer.byteLength(json, 'utf8');

/** The value as JSON text, or `bad_args` when it has none. */
function encode(value: unknown): string {
  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value);
  } catch {
    encoded = undefined;
  }
  if (encoded === undefined) throw new CapabilityError('bad_args');
  return encoded;
}

/**
 * `store`: `get`, `set`, `delete` and `keys` over one sealed row per user. The row is read, changed
 * and written inside one synchronous call, so calls on a subject cannot interleave: the last write
 * wins and none is lost. A write that would break a limit writes nothing.
 */
export function createStoreCapability(deps: StoreCapabilityDeps): CapabilityHandler {
  const { rows } = deps;

  function readRow(rowKey: string): Row {
    return rows.read<Row>(rowKey, (value) => value) ?? {};
  }

  function key(candidate: unknown): string {
    if (typeof candidate !== 'string' || !STORE_KEY_PATTERN.test(candidate)) throw new CapabilityError('bad_args');
    return candidate;
  }

  function save(rowKey: string, next: Row): void {
    if (Object.keys(next).length === 0) {
      if (!rows.delete(rowKey)) throw new CapabilityError('unavailable');
      return;
    }
    if (rows.write(rowKey, () => JSON.stringify(next)) !== 'written') throw new CapabilityError('unavailable');
  }

  return (args) => {
    if (typeof args !== 'object' || args === null) throw new CapabilityError('bad_args');
    const { op, key: rawKey, value } = args as Record<string, unknown>;
    if (op !== 'get' && op !== 'set' && op !== 'delete' && op !== 'keys') throw new CapabilityError('bad_args');
    const name = op === 'keys' ? null : key(rawKey);
    let encoded = '';
    if (op === 'set') {
      encoded = encode(value);
      if (bytes(encoded) > STORE_VALUE_MAX_BYTES) throw new CapabilityError('too_large');
    }

    const subject = deps.subject();
    if (subject === null || !rows.available()) throw new CapabilityError('unavailable');
    const rowKey = storeRowKey(subject);
    const row = readRow(rowKey);

    switch (op) {
      case 'keys':
        return Object.keys(row).sort();
      case 'get':
        return name !== null && Object.hasOwn(row, name) ? row[name] : null;
      case 'delete': {
        if (name !== null && Object.hasOwn(row, name)) {
          save(rowKey, Object.fromEntries(Object.entries(row).filter(([existing]) => existing !== name)));
        }
        return null;
      }
      case 'set': {
        const next: Row = { ...row, [name as string]: JSON.parse(encoded) as unknown };
        if (bytes(JSON.stringify(next)) > STORE_TOTAL_MAX_BYTES) throw new CapabilityError('too_large');
        save(rowKey, next);
        return null;
      }
    }
  };
}
