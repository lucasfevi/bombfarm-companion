/**
 * The committed synthetic Collections body — the shape the game serves, with invented progress —
 * parsed the way main parses it. Test support: only `*.test.*` files import this.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CollectionsSnapshot } from '@bombfarm/contracts';
import { parseCollectionsState } from '@bombfarm/game-api';

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

export function collectionsSnapshotFixture(): CollectionsSnapshot {
  const snapshot = parseCollectionsState(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')));
  if (snapshot === null) throw new Error('the committed Collections body does not parse');
  return snapshot;
}

export function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to exist`);
  return value;
}
