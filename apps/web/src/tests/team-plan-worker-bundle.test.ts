import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

describe('team-plan worker build artifact', () => {
  it('documents the worker marker exported by the domain solver', () => {
    expect(TEAM_PLAN_WORKER_MARKER).toBe('runTeamPlan');
  });

  it('ships a chunk that references the team-plan worker marker', () => {
    if (!requireBuildOutput(outRoot, 'team-plan worker chunk is present in the export')) return;

    const chunks = walkJsFiles(staticRoot);
    expect(chunks, `no .js chunks under ${staticRoot} — is this a real export?`).not.toEqual([]);

    const matches = chunks.filter((file) => {
      const base = file.replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      return (
        base.includes('team-plan-worker') ||
        content.includes(TEAM_PLAN_WORKER_MARKER) ||
        (content.includes('forgeList') &&
          content.includes('moveList') &&
          content.includes('pointResets'))
      );
    });

    expect(
      matches,
      `no chunk under ${staticRoot} contained ${TEAM_PLAN_WORKER_MARKER} (searched ${chunks.length} files)`,
    ).not.toEqual([]);
  });
});
