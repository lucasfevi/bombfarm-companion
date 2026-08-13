import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { importHeroes } from '../../src/shared/lib/storage';
import type { SeededState } from './seed';

const fixturePath = path.join(
  process.cwd(),
  '../../packages/domain/tests/fixtures/sheet-math/save-20260813-5heroes.json',
);

/** Full roster + inventory from the 5-hero post-wipe export fixture (includes two Perrins). */
export function teamPlanFixtureSeed(lang: 'en' | 'pt' = 'en'): SeededState {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
  const { inventory, candidates, account } = parseSaveFile(raw, []);
  const records = candidates
    .filter((candidate) => !candidate.blocked)
    .map((candidate) => ({ ...candidate.record, sourceId: candidate.sourceId }));
  const saveSourceIds = new Set(candidates.map((candidate) => candidate.sourceId));
  const heroes = importHeroes([], records, saveSourceIds).heroes;

  return {
    heroes,
    activeHeroId: heroes[0]?.id ?? null,
    account: {
      tree: {
        danoTotal: account.tree?.danoTotal ?? 1,
        critChance: account.tree?.critChance ?? 0,
        critDmg: account.tree?.critDmg ?? 0,
        speed: account.tree?.speed ?? 0,
        energy: account.tree?.energy ?? 0,
        teamCoinPct: account.tree?.teamCoinPct ?? 0,
        glassCannon: account.tree?.glassCannon ?? false,
        tempoDobrado: account.tree?.tempoDobrado ?? false,
      },
      teamBuffs: {},
      context: {
        houseIdx: account.houseIdx ?? 1,
        houseLevel: account.houseLevel ?? 6,
        phase: 1,
        mitigationPct: 6.7,
        rankMode: 'dps',
        targetProp: 'stone',
      },
      slots: account.slots ?? 6,
      forgeFloor: 10,
    },
    inventory: { version: 1, importedAt: Date.now(), items: inventory },
    lang,
    guideHidden: true,
  };
}
