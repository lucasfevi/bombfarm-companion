import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { treeTotalsFromSave } from '@bombfarm/domain/save-units';
import type { GearPlanHeroInput, GearPlanInput } from '@bombfarm/domain/gear-plan/types';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../packages/domain/tests/fixtures/sheet-math',
);

function loadFixtureJson(filename: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, filename), 'utf8')) as Record<string, unknown>;
}

export function gearPlanInputFromFixture(file: string, forgeFloor = 10): GearPlanInput {
  const raw = loadFixtureJson(file);
  const { inventory, candidates, account } = parseSaveFile(raw, []);
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const treeSheet = treeTotalsFromSave(totals);
  const heroes: GearPlanHeroInput[] = candidates
    .filter((c) => !c.blocked)
    .map((c) => ({
      heroId: c.sourceId,
      name: c.name,
      level: c.level,
      stars: c.record.stars,
      rarity: c.rarity,
      birth: c.record.birth,
      abilities: c.record.abilities,
      pts: c.record.pts,
      loadout: c.record.loadout,
      battleAllowed: c.record.battleAllowed,
    }));
  const scopeByHeroId = Object.fromEntries(heroes.map((h) => [h.heroId, 'optimize' as const]));
  return {
    heroes,
    inventory,
    account: {
      treeSheet,
      treeGlassCannon: Boolean(account.tree?.glassCannon),
      treeTempoDobrado: Boolean(account.tree?.tempoDobrado),
      houseIdx: account.houseIdx ?? 0,
      houseLevel: account.houseLevel ?? 1,
      phase: 1,
      mitigationPct: 6.7,
      slots: account.slots ?? 9,
    },
    scopeByHeroId,
    forgeFloor,
  };
}
