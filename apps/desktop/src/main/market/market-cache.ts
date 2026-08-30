import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The last snapshot this process accepted, kept beside the flavor's other user data so a cold
 * start with no network still prices items.
 */
export interface MarketCacheRecord {
  readonly etag: string | null;
  readonly adoptedUtc: string;
  readonly snapshot: unknown;
}

export interface MarketCacheIo {
  read(path: string): string | null;
  write(path: string, contents: string): void;
}

export const nodeMarketCacheIo: MarketCacheIo = {
  read(path) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  },
  write(path, contents) {
    writeFileSync(path, contents, 'utf8');
  },
};

export function marketCachePath(userDataDir: string): string {
  return join(userDataDir, 'market-prices.json');
}

export function readMarketCache(io: MarketCacheIo, path: string): MarketCacheRecord | null {
  const contents = io.read(path);
  if (contents === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as { etag?: unknown; adoptedUtc?: unknown; snapshot?: unknown };
  if (typeof record.adoptedUtc !== 'string') return null;
  if (record.etag !== null && typeof record.etag !== 'string') return null;

  return { etag: record.etag ?? null, adoptedUtc: record.adoptedUtc, snapshot: record.snapshot };
}

/** Never throws: a cache that cannot be written must not take the app down with it. */
export function writeMarketCache(io: MarketCacheIo, path: string, record: MarketCacheRecord): boolean {
  try {
    io.write(path, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}
