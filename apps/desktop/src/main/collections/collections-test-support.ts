import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CollectionsSnapshot } from '@bombfarm/contracts';
import { parseCollectionsState } from '@bombfarm/game-api';
import type { SqliteDb } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb } from '../storage/test-support.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const FIXTURE_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'game-api',
  'src',
  '__fixtures__',
  'collections-state.json',
);

export function collectionsBody(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
}

export function collectionsSnapshot(): CollectionsSnapshot {
  const snapshot = parseCollectionsState(collectionsBody());
  if (snapshot === null) throw new Error('the committed Collections body does not parse');
  return snapshot;
}

export function openDb(): SqliteDb {
  const binding = detectAvailableBindings()[0];
  if (!binding) throw new Error('no SQLite binding available in this environment — cannot run this suite');
  const db = openTestAccountDb(binding).db;
  if (!db) throw new Error('the test account database did not open');
  return db;
}
