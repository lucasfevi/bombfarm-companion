import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AccountPayload } from '@bombfarm/contracts';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { commitVectorToPoints, pointsToCommitVector } from '@bombfarm/domain/team-plan';
import { describe, expect, it } from 'vitest';

const payload = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'api', 'assembled-payload-before.json'), 'utf8'),
) as AccountPayload;

const imported = parseAccountPayload(payload, []).candidates.find((candidate) => !candidate.blocked)!;
const placed = Object.values(imported.record.pts).reduce((sum, value) => sum + value, 0);

function withAlloc(alloc: readonly number[]) {
  const heroes = payload.heroes!.map((hero) =>
    (hero as { id?: unknown }).id === imported.sourceId ? { ...(hero as object), alloc } : hero,
  );
  return parseAccountPayload({ ...payload, heroes }, []).candidates.find((c) => c.sourceId === imported.sourceId)!;
}

describe('a hero carrying the server allocation', () => {
  it('imports those points instead of inverting its sheet, with no inference issue', () => {
    const server = { luck: placed };
    const candidate = withAlloc(pointsToCommitVector(server));

    expect(candidate.record.pts).toEqual(commitVectorToPoints(pointsToCommitVector(server)));
    expect(candidate.pointIssues).toEqual([]);
    expect(candidate.blocked).toBe(false);
  });

  it('is still blocked when the allocation spends more points than the hero owns', () => {
    const candidate = withAlloc(pointsToCommitVector({ ...imported.record.pts, luck: imported.level + 1 }));

    expect(candidate.blocked).toBe(true);
  });

  it('falls back to inverting the sheet when the allocation is not an eight-value vector', () => {
    expect(withAlloc([1, 2, 3]).record.pts).toEqual(imported.record.pts);
  });
});
