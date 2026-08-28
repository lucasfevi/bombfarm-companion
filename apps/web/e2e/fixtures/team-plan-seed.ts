import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { importHeroes } from '../../src/shared/lib/storage';
import type { SeededState } from './seed';

const CORPUS = path.join(process.cwd(), '../../packages/domain/tests/fixtures/sheet-math');

/**
 * The STRUCTURAL seed: the 5-hero post-wipe export, whose distinguishing property is two heroes
 * called Perrin — the duplicate-name case the accessible-label and scope specs are built around,
 * and one no other committed capture has. Out of regime for sheet math, which is fine here: no
 * spec reading this seed asserts a number off it.
 *
 * Its limitation is why {@link teamPlanRichSeed} exists. Under the importer's stat-point budget
 * refusal this capture yields 3 heroes of 5, and all three arrive with an EMPTY loadout — so a
 * plan built on it has no worn item to keep, move or forge, and the specs about those had to be
 * disabled (issue #206).
 */
const fixturePath = path.join(CORPUS, 'save-20260813-5heroes.json');

/**
 * The RICH seed: 7 heroes of 7 accepted, 40 items worn across five of them, 54 in the bag. This is
 * what the forge, kept-item, saturation and search-budget specs need — a plan with real gear to
 * move around, and enough search space that a tight evaluation cap actually truncates.
 *
 * Kept separate from {@link teamPlanFixtureSeed} rather than replacing it: this roster has seven
 * distinct hero names, so it cannot carry the duplicate-name case, and swapping it in wholesale
 * would trade one set of disabled specs for another.
 */
const richFixturePath = path.join(CORPUS, 'save-20260819-11882-7heroes.json');

/** Full roster + inventory from the 5-hero post-wipe export fixture (includes two Perrins). */
export function teamPlanFixtureSeed(lang: 'en' | 'pt' = 'en'): SeededState {
  return seedFromCapture(fixturePath, lang);
}

/** Full roster + inventory from the 7-hero in-regime capture — geared, and House-bound. */
export function teamPlanRichSeed(lang: 'en' | 'pt' = 'en'): SeededState {
  return seedFromCapture(richFixturePath, lang);
}

function seedFromCapture(capturePath: string, lang: 'en' | 'pt'): SeededState {
  const raw = JSON.parse(readFileSync(capturePath, 'utf8')) as Record<string, unknown>;
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
