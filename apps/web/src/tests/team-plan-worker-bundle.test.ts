import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { TEAM_PLAN_WORKER_MARKER } from '@bombfarm/domain/team-plan';
import { requireBuildOutput } from './support/build-output';

const root = resolve(__dirname, '../..');
const outRoot = resolve(root, 'out');
const staticRoot = join(outRoot, '_next/static');

function walkJsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

type ChunkEntry = { path: string; content: string };

/**
 * The discriminator the T1 spike found: on the chosen worker path, webpack keeps the magic chunk
 * name (`webpackChunkName: "team-plan-worker"`) on the emitted file, so a real worker chunk's
 * basename matches this — the main bundle's basename never does. A marker-string-only check
 * cannot tell the two apart: the main bundle imports the solver for the main-thread fallback, so
 * it carries `TEAM_PLAN_WORKER_MARKER` too, and a build with no worker split at all stayed green
 * under the old check.
 */
const WORKER_CHUNK_NAME = /^team-plan-worker\..*\.js$/;

/**
 * The Next.js app-runtime chunk pushes React Server Component payloads through
 * `self.__next_f.push(...)` — present in the main bundle and its siblings, never in a Web Worker
 * chunk (workers have no `self.__next_f`). Kept as the documented fallback discriminator if a
 * future webpack version ever drops the magic chunk name on this path; unused while
 * `WORKER_CHUNK_NAME` finds a match.
 */
function isAppRuntimeChunk(content: string): boolean {
  return content.includes('self.__next_f');
}

function findWorkerChunks(entries: readonly ChunkEntry[]): ChunkEntry[] {
  const named = entries.filter((entry) => WORKER_CHUNK_NAME.test(basename(entry.path)));
  if (named.length > 0) return named;
  return entries.filter(
    (entry) => entry.content.includes(TEAM_PLAN_WORKER_MARKER) && !isAppRuntimeChunk(entry.content),
  );
}

describe('team-plan worker build artifact', () => {
  it('documents the worker marker exported by the domain solver', () => {
    expect(TEAM_PLAN_WORKER_MARKER).toBe('runTeamPlan');
  });

  it('ships a chunk whose name (or, failing that, its content minus the app runtime) is the worker', () => {
    if (!requireBuildOutput(outRoot, 'team-plan worker chunk is present in the export')) return;

    const chunks = walkJsFiles(staticRoot);
    expect(chunks, `no .js chunks under ${staticRoot} — is this a real export?`).not.toEqual([]);

    const entries: ChunkEntry[] = chunks.map((file) => ({
      path: file,
      content: readFileSync(file, 'utf8'),
    }));

    const matches = findWorkerChunks(entries);

    expect(
      matches,
      `no chunk under ${staticRoot} matched the worker discriminator (searched ${chunks.length} files)`,
    ).not.toEqual([]);
  });

  it('red state: the matcher reports none when every worker file is removed from the chunk list', () => {
    if (!requireBuildOutput(outRoot, 'team-plan worker chunk is present in the export')) return;

    const chunks = walkJsFiles(staticRoot);
    const entries: ChunkEntry[] = chunks
      .filter((file) => !WORKER_CHUNK_NAME.test(basename(file)))
      .map((file) => ({ path: file, content: readFileSync(file, 'utf8') }));

    expect(findWorkerChunks(entries)).toEqual([]);
  });
});
