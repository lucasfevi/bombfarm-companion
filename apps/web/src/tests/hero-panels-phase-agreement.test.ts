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
import { WIKI_PHASE_LINES, wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { TEAM_BUFF_PER_LEVEL } from '@bombfarm/domain/team-buffs';
import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import { normalizeHero } from '@/shared/lib/storage';
import {
  resetPlannerStoreForTests,
  selectActiveHeroAccount,
  selectActiveHeroTeamBuffs,
  selectAdvisorPipeline,
  selectRosterAccount,
  selectRosterTeamBuffs,
  selectCombatPhase,
  selectCombatPhaseSelection,
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
  const account = selectRosterAccount(state);
  const intel = computePhaseIntelGlobal(selectPhasesViewPhase(state), {
    teamCoinPct: account.tree.teamCoinPct ?? 0,
    xpMult: account.tree.xpMult ?? 1,
  });
  if (!intel) throw new Error('the explorer has no phase intel to draw');
  const hero = state.heroes.find((candidate) => candidate.id === state.activeHeroId);
  if (!hero) throw new Error('the explorer has no hero to draw');
  return pipelineForHero(hero, account, intel.phase, intel.mitigationPct);
}

/**
 * The three figures the requirement names, plus one that actually moves with the phase.
 *
 * `predHit`, `uptime` and `dps` are phase-INVARIANT at a fixed mitigation — the phase reaches them
 * only through the mitigation derived from it. Comparing those three alone therefore cannot see
 * two surfaces reading different phases, only two surfaces reading different mitigations. Adding
 * the target's hit points, which is read straight off the phase, is what makes this a phase
 * comparison rather than a mitigation one.
 */
function figures(combat: AdvisorPipelineResult) {
  return {
    normalHit: combat.predHit,
    uptime: combat.uptime,
    dps: combat.dps,
    targetHp: combat.targetHp,
  };
}

/**
 * The active hero carries a team aura, and a second, benched hero carries the same one — the
 * roster on which the two surfaces answer two different questions. The Combat tab prices the
 * hero's own seat: its own aura in full, the other carrier only through its switch and then at
 * full presence. The explorer beside the Farm board prices the rotation: every fielded carrier
 * weighted by its predicted uptime, whoever happened to be deployed.
 */
function hydrateTwoAuraCarriers(): void {
  const state = usePlannerStore.getState();
  const own = normalizeHero({ ...state.heroes[0], id: 'h1', deployed: true, abilities: { grito_guerra: 12 } });
  const other = normalizeHero({ ...state.heroes[0], id: 'h2', deployed: false, abilities: { grito_guerra: 20 } });
  state.hydrateRoster([own, other], 'h1');
  state.applyHero(own);
}

describe('the two surfaces price team auras for their own question', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    hydrateOneHero();
    hydrateTwoAuraCarriers();
    usePlannerStore.getState().setPhasesViewPhase(137);
  });

  it('the Combat tab counts the active hero’s own aura in full, and nobody else’s while the switches are off', () => {
    const tab = selectActiveHeroTeamBuffs(usePlannerStore.getState());
    expect(tab.grito_guerra).toBe(12 * TEAM_BUFF_PER_LEVEL.grito_guerra);
  });

  it('the explorer weights every fielded carrier by its uptime, so its total sits between nothing and the pool’s at-best sum', () => {
    const roster = selectRosterTeamBuffs(usePlannerStore.getState());
    expect(roster.grito_guerra).toBeGreaterThan(0);
    expect(roster.grito_guerra).toBeLessThan((12 + 20) * TEAM_BUFF_PER_LEVEL.grito_guerra);
  });

  it('the two therefore print different figures for the same hero at the same phase, by design', () => {
    const state = usePlannerStore.getState();
    expect(figures(selectAdvisorPipeline(state)).normalHit).not.toBe(figures(explorerCombat(state)).normalHit);
    expect(figures(selectAdvisorPipeline(state)).targetHp).toBe(figures(explorerCombat(state)).targetHp);
  });

  it('a switch lets the other carrier onto the Combat tab at full presence, and moves the figures', () => {
    const before = figures(selectAdvisorPipeline(usePlannerStore.getState()));
    usePlannerStore.getState().setTeamAuraSwitch('grito_guerra', true);
    const state = usePlannerStore.getState();

    expect(selectActiveHeroTeamBuffs(state).grito_guerra).toBe((12 + 20) * TEAM_BUFF_PER_LEVEL.grito_guerra);
    expect(figures(selectAdvisorPipeline(state)).normalHit).toBeGreaterThan(before.normalHit);
    expect(figures(explorerCombat(state))).toEqual(figures(explorerCombat(state)));
  });

  it('the switch reaches nothing the explorer prints', () => {
    const before = figures(explorerCombat(usePlannerStore.getState()));
    usePlannerStore.getState().setTeamAuraSwitch('grito_guerra', true);
    expect(figures(explorerCombat(usePlannerStore.getState()))).toEqual(before);
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

  it('resolves to the very phase the explorer is showing, not merely to matching figures', () => {
    usePlannerStore.getState().setPhasesViewPhase(137);
    const state = usePlannerStore.getState();

    expect(selectCombatPhase(state)).toBe(selectPhasesViewPhase(state));
  });

  it('answers for the account’s own farm phase until the player picks one', () => {
    const state = usePlannerStore.getState();

    expect(state.phasesViewPhaseChosen).toBe(false);
    expect(selectCombatPhase(state)).toBe(ACCOUNT_FARM_PHASE);
    expect(selectAdvisorPipeline(state)).toEqual(
      pipelineForHero(
        state.heroes[0],
        selectActiveHeroAccount(state),
        ACCOUNT_FARM_PHASE,
        state.mitigationPct,
      ),
    );
  });
});

/**
 * The planner's Combat tab may ask about a phase of its own. That pick moves every figure the
 * planner prints, and nothing the explorer prints: the two are one player's two questions about
 * the same account, and answering one must not re-answer the other.
 */
describe('a phase picked on the planner’s Combat tab', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    hydrateOneHero();
    usePlannerStore.getState().setPhasesViewPhase(137);
  });

  it('moves the planner onto that phase, with the wiki line’s own mitigation', () => {
    usePlannerStore.getState().setPlannerPhaseOverride(42);
    const state = usePlannerStore.getState();

    expect(selectCombatPhase(state)).toBe(42);
    expect(selectCombatPhaseSelection(state)).toEqual({ kind: 'override', phase: 42 });
    expect(selectAdvisorPipeline(state)).toEqual(
      pipelineForHero(
        state.heroes[0],
        selectActiveHeroAccount(state),
        42,
        wikiPhaseLine(42)!.mitig * 100,
      ),
    );
  });

  it('leaves the explorer on the phase it was showing', () => {
    usePlannerStore.getState().setPlannerPhaseOverride(42);
    const state = usePlannerStore.getState();

    expect(selectPhasesViewPhase(state)).toBe(137);
    expect(figures(explorerCombat(state))).not.toEqual(figures(selectAdvisorPipeline(state)));
  });

  it('clearing it hands the planner back to the explorer’s phase, and the two agree again', () => {
    usePlannerStore.getState().setPlannerPhaseOverride(42);
    usePlannerStore.getState().setPlannerPhaseOverride(null);
    const state = usePlannerStore.getState();

    expect(selectCombatPhase(state)).toBe(137);
    expect(selectCombatPhaseSelection(state)).toEqual({ kind: 'farmScreen', phase: 137 });
    expect(figures(selectAdvisorPipeline(state))).toEqual(figures(explorerCombat(state)));
  });

  it('a phase past the wiki’s last row lands on the last phase, as every lookup beneath does', () => {
    usePlannerStore.getState().setPlannerPhaseOverride(9_000);
    const state = usePlannerStore.getState();

    expect(selectCombatPhase(state)).toBe(WIKI_PHASE_LINES.length);
    expect(selectCombatPhaseSelection(state)).toEqual({
      kind: 'override',
      phase: WIKI_PHASE_LINES.length,
    });
  });

  it('picking the phase the app already answers for is not a pick, and reads as none', () => {
    usePlannerStore.getState().setPlannerPhaseOverride(137);
    const state = usePlannerStore.getState();

    expect(selectCombatPhaseSelection(state)).toEqual({ kind: 'farmScreen', phase: 137 });
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
