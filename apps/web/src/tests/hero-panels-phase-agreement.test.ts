/**
 * The hero workspace and the phases explorer describe one hero at one stage, and they used to
 * read two different stored phases to do it — so the same hero printed two sets of combat numbers
 * and picking any phase made them disagree.
 *
 * Both sides below are derived through the selectors the two screens actually call, and compared
 * to EACH OTHER rather than to pinned constants: two hardcoded numbers that happen to match would
 * keep passing if both surfaces drifted together, and would need rewriting on every balance patch.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import { normalizeHero } from '@/shared/lib/storage';
import {
  resetPlannerStoreForTests,
  selectAccountSharedForCombat,
  selectAdvisorPipeline,
  selectEffectiveTeamBuffs,
  selectCombatPhase,
  selectPhasesViewPhase,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const ACCOUNT_FARM_PHASE = 300;

function hydrateOneHero(): void {
  const hero = normalizeHero({
    id: 'h1',
    name: 'Hero',
    sourceId: 'src-1',
    updatedAt: 1,
    rarity: 'Raro',
    level: 40,
    stars: 3,
    naked: {
      attack: 900,
      energy: 120,
      speed: 60,
      critChance: 12,
      critDmg: 80,
      penetration: 5,
      cdr: 10,
      luck: 0,
    },
    gearedOverride: {
      attack: 900,
      energy: 120,
      speed: 60,
      critChance: 12,
      critDmg: 80,
      penetration: 5,
      cdr: 10,
      luck: 0,
    },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
  });
  usePlannerStore.getState().hydrateRoster([hero], 'h1');
  usePlannerStore.getState().applyHero(hero);
  usePlannerStore.getState().applyAccountImport({
    tree: null,
    houseIdx: 0,
    houseLevel: 5,
    phase: ACCOUNT_FARM_PHASE,
  });
}

/**
 * The phases explorer's per-hero panel, assembled exactly as its connector and the shared view
 * assemble it: the phases-view phase, through `computePhaseIntelGlobal`, into `pipelineForHero`.
 */
function explorerCombat(state: PlannerStore): AdvisorPipelineResult {
  const account = selectAccountSharedForCombat(state);
  const intel = computePhaseIntelGlobal(selectPhasesViewPhase(state), {
    teamCoinPct: account.tree.teamCoinPct ?? 0,
    xpMult: account.tree.xpMult ?? 1,
  });
  if (!intel) throw new Error('the explorer has no phase intel to draw');
  const hero = state.heroes.find((candidate) => candidate.id === state.activeHeroId);
  if (!hero) throw new Error('the explorer has no hero to draw');
  return pipelineForHero(hero, account, intel.phase, intel.mitigationPct);
}

function figures(combat: AdvisorPipelineResult) {
  return { normalHit: combat.predHit, uptime: combat.uptime, dps: combat.dps };
}

/**
 * A roster whose deployed hero carries a team aura and whose override was never set — the state a
 * real account is in before anyone finds the auto-fill control. The aura total is DERIVED from the
 * deployed roster, so a surface reading the stored override alone prices the hero with no auras at
 * all and answers differently from one that derives.
 */
function hydrateDeployedAuraCarrier(): void {
  const state = usePlannerStore.getState();
  const carrier = normalizeHero({
    ...state.heroes[0],
    id: 'h1',
    deployed: true,
    abilities: { grito_guerra: 12 },
  });
  state.hydrateRoster([carrier], 'h1');
  state.applyHero(carrier);
}

describe('the two surfaces agree on team auras, not only on the phase', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    hydrateOneHero();
    hydrateDeployedAuraCarrier();
  });

  it('non-vacuity: the deployed carrier really does produce a non-zero aura total', () => {
    const derived = selectEffectiveTeamBuffs(usePlannerStore.getState());

    expect(usePlannerStore.getState().teamBuffsOverride ?? null).toBeNull();
    expect(derived.grito_guerra).toBeGreaterThan(0);
  });

  it('agrees with no override set, which is the state a real account is in', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    const state = usePlannerStore.getState();

    expect(figures(selectAdvisorPipeline(state))).toEqual(figures(explorerCombat(state)));
  });

  it('the aura is actually priced in, so the agreement is not two zeros matching', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    const state = usePlannerStore.getState();
    const withAura = figures(explorerCombat(state));

    const withoutAura = figures(
      pipelineForHero(
        state.heroes[0],
        { ...selectAccountSharedForCombat(state), teamBuffs: {} },
        selectCombatPhase(state),
        state.mitigationPct,
      ),
    );

    expect(withAura.normalHit).not.toBe(withoutAura.normalHit);
  });
});

describe('the hero workspace and the phases explorer read one phase', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    hydrateOneHero();
  });

  it('agrees on normal hit, uptime and DPS at the phase the player picked', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    const state = usePlannerStore.getState();

    expect(figures(selectAdvisorPipeline(state))).toEqual(figures(explorerCombat(state)));
  });

  it('still agrees after a second pick, and the figures actually moved with it', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    const atFirstPick = figures(selectAdvisorPipeline(usePlannerStore.getState()));

    usePlannerStore.getState().setPhasesViewPhase(42);
    const state = usePlannerStore.getState();
    const atSecondPick = figures(selectAdvisorPipeline(state));

    expect(atSecondPick).toEqual(figures(explorerCombat(state)));
    expect(atSecondPick.normalHit).not.toBe(atFirstPick.normalHit);
  });

  it('answers for the account’s own farm phase until the player picks one', () => {
    const state = usePlannerStore.getState();

    expect(state.phasesViewPhaseChosen).toBe(false);
    expect(selectCombatPhase(state)).toBe(ACCOUNT_FARM_PHASE);
    expect(selectAdvisorPipeline(state)).toEqual(
      pipelineForHero(
        state.heroes[0],
        selectAccountSharedForCombat(state),
        ACCOUNT_FARM_PHASE,
        state.mitigationPct,
      ),
    );
  });
});

/**
 * `state.phase` is the farm phase the imported save reported. Nothing in the app moves it, so a
 * surface reading it directly is frozen at whatever the import said — the shape of the defect
 * this file exists to keep closed. The one place allowed to read it is the selector that resolves
 * which phase to use.
 */
const FROZEN_PHASE_READ_RE = /\bstate\.(phase|mitigationPct)\b/;

/**
 * The workspace's components, the explorer's components, and the two selectors that feed them
 * their combat figures. `account-selectors.ts` is deliberately absent: the account store is where
 * the imported farm phase legitimately lives, persisted and shown on the Account page — the defect
 * was never that the field exists, only that combat surfaces computed from it.
 */
const SCANNED_DIRECTORIES = ['src/features/planner/components', 'src/features/phases/components'];
const SCANNED_FILES = [
  'src/shared/stores/selectors/advisor-selectors.ts',
  'src/shared/stores/selectors/hero-panel-selectors.ts',
];

function scannedSources(): { name: string; source: string }[] {
  const fromDirectories = SCANNED_DIRECTORIES.flatMap((directory) => {
    const absolute = join(WEB_PACKAGE_ROOT, directory);
    return readdirSync(absolute)
      .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
      .map((name) => ({
        name: `${directory}/${name}`,
        source: readFileSync(join(absolute, name), 'utf8'),
      }));
  });
  return [
    ...fromDirectories,
    ...SCANNED_FILES.map((name) => ({
      name,
      source: readFileSync(join(WEB_PACKAGE_ROOT, name), 'utf8'),
    })),
  ];
}

describe('no surface the hero panels draw reads the frozen import-time phase', () => {
  const sources = scannedSources();

  it('the scan reaches the files it claims to, and can fail', () => {
    expect(sources.length).toBeGreaterThanOrEqual(15);
    for (const required of [
      'src/features/planner/components/hero-tab.tsx',
      'src/features/planner/components/planner-tabs.tsx',
      'src/features/phases/components/phases-explorer.tsx',
      ...SCANNED_FILES,
    ]) {
      expect(sources.map((file) => file.name)).toContain(required);
    }
    expect(FROZEN_PHASE_READ_RE.test('    phase: state.phase,')).toBe(true);
    expect(FROZEN_PHASE_READ_RE.test('  mitigationPct: state.mitigationPct,')).toBe(true);
    // The phases-view pair is a different field and must not be mistaken for the frozen one.
    expect(FROZEN_PHASE_READ_RE.test('const p = state.phasesViewPhase;')).toBe(false);
  });

  it('reads the resolved phase instead', () => {
    const offenders = sources.filter((file) => FROZEN_PHASE_READ_RE.test(file.source));
    expect(
      offenders.map((file) => file.name),
      'these read the import-time phase directly instead of the resolved one',
    ).toEqual([]);
  });
});
