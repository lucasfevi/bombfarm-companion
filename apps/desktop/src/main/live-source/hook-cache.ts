/**
 * A build-stamp-keyed cache for the discovered hook address, so a running game does not repeat
 * the `.text`/`.rdata` scan on every launch. The file lives under the caller-supplied directory —
 * in production that is Electron's `userData`, kept out of this module so it stays importable and
 * testable with no running app.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface HookRecord {
  readonly rva: number;
  readonly anchors: readonly string[];
  readonly validatedAt: number;
}

export interface HookCacheFile {
  readonly version: 1;
  readonly builds: Readonly<Record<string, HookRecord>>;
}

export interface LogPort {
  warn(record: Record<string, unknown>): void;
}

const NOOP_LOG_PORT: LogPort = { warn: () => undefined };

const CACHE_FILE_NAME = 'hook-cache.json';
const CACHE_VERSION = 1;

export function emptyHookCache(): HookCacheFile {
  return { version: CACHE_VERSION, builds: {} };
}

function isHookRecord(value: unknown): value is HookRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.rva === 'number' &&
    Array.isArray(record.anchors) &&
    record.anchors.every((anchor) => typeof anchor === 'string') &&
    typeof record.validatedAt === 'number'
  );
}

function isHookCacheFile(value: unknown): value is HookCacheFile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== CACHE_VERSION) return false;
  if (typeof candidate.builds !== 'object' || candidate.builds === null) return false;
  return Object.values(candidate.builds).every(isHookRecord);
}

/** Reads the cache file, never throwing. A missing file is the normal first-run case and starts
 * fresh silently; a file that fails to parse, or whose `version` this module does not recognise,
 * also starts fresh but logs once — recovering by reinterpreting an old shape is how a stale
 * cache entry ends up pinning a hook address to the wrong build. */
export function readHookCacheFile(dir: string, log: LogPort = NOOP_LOG_PORT): HookCacheFile {
  const filePath = path.join(dir, CACHE_FILE_NAME);

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return emptyHookCache();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.warn({ scope: 'live-source', event: 'hook_cache.unreadable', dir });
    return emptyHookCache();
  }

  if (!isHookCacheFile(parsed)) {
    log.warn({ scope: 'live-source', event: 'hook_cache.version_mismatch', dir });
    return emptyHookCache();
  }

  return parsed;
}

/** Writes tmp-file-then-rename, so a process killed mid-write leaves either the previous cache
 * file or the complete new one — never a truncated file that would still parse as JSON and pin a
 * wrong address. */
export function writeHookCacheFile(dir: string, cache: HookCacheFile): void {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, CACHE_FILE_NAME);
  const tmpPath = path.join(
    dir,
    `.${CACHE_FILE_NAME}.${String(process.pid)}-${String(Date.now())}-${Math.random().toString(36).slice(2)}.tmp`,
  );
  fs.writeFileSync(tmpPath, JSON.stringify(cache), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/** Sets one build's record without touching any other build's — so alternating between a current
 * and a rolled-back build does not make each start rescan the other. */
export function storeHook(cache: HookCacheFile, buildId: string, record: HookRecord): HookCacheFile {
  return { version: CACHE_VERSION, builds: { ...cache.builds, [buildId]: record } };
}

function isSubset(subset: readonly string[], superset: readonly string[]): boolean {
  const supersetSet = new Set(superset);
  return subset.every((item) => supersetSet.has(item));
}

/**
 * Returns the cached record for `buildId`, or `null` when nothing in the cache can be trusted for
 * a fresh discovery right now. That covers three cases: no `buildId` at all (an unreadable PE
 * image must never fall back to a stale entry keyed on a different build), no entry for this
 * build, or an entry whose anchors no longer cover what discovery would search for today — a
 * changed anchor set invalidates even a build-stamp hit, since the record was never validated
 * against the anchors currently in use.
 */
export function lookupHook(cache: HookCacheFile, buildId: string | null, currentAnchors: readonly string[]): HookRecord | null {
  if (buildId === null) return null;
  const record = cache.builds[buildId];
  if (!record) return null;
  return isSubset(record.anchors, currentAnchors) ? record : null;
}
