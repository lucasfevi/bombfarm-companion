/**
 * The feature's correctness core (design.md §5, §11 hazard 1). Exhaustive by construction over
 * `AdviceQuantity` × `SectionStatus` × `AccountSection` (derived from `ADVICE_REQUIRES` and
 * `ACCOUNT_SECTIONS`, never a hand-written list) — a new section or quantity adds rows
 * automatically (`AD-041`'s payoff).
 */
import { describe, expect, it } from 'vitest';
import type { SectionStatus } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { ADVICE_REQUIRES, buildPlanningModel, isUsable, isQuantityUsable } from './account-model';
import { adviceForHero } from './hero-advice';
import type { AdviceQuantity, PlanningModel } from './types';
import { REAL_DMG_STATIC, syntheticAccountPayload, syntheticAccountView } from './fixtures/synthetic-views';

const ADVICE_QUANTITIES = Object.keys(ADVICE_REQUIRES) as AdviceQuantity[];
// `SectionStatus`'s 4 members — hand-listed once here because it is a pure type with no runtime
// source; `AccountSection` and `AdviceQuantity` above both come from a real exported value.
const SECTION_STATUSES: readonly SectionStatus[] = ['resolved', 'stale', 'missing', 'degraded'];

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

function firstHero(model: PlanningModel) {
  return required(model.heroes[0], 'expected at least one candidate in this fixture');
}

/** What `pipelineForHero` would return if `skills` had silently defaulted to the identity tree
 *  (`import-save.ts`'s zero-tree fallback: `danoStatic: 1`, everything else 0/false) — the exact
 *  number MPV-09 says must never reach the screen labelled as advice. */
function identityTreeResult(hero: HeroRecord, phase: number, mitigationPct: number) {
  return computeAdvisorPipeline({
    naked: hero.naked,
    geared: hero.gearedOverride,
    loadout: hero.loadout,
    altLoadout: hero.altLoadout,
    pts: hero.pts,
    abilities: hero.abilities,
    rarity: hero.rarity,
    level: hero.level,
    stars: hero.stars,
    treeDanoTotal: 1,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeSpeed: 0,
    treeEnergy: 0,
    treeLuckFlatPct: 0,
    teamBuffs: zeroTeamBuffs(),
    houseIdx: 0,
    houseLevel: 1,
    phase,
    mitigationPct,
    rankMode: 'dps',
    targetProp: DEFAULT_TARGET_PROP,
    birth: hero.birth,
  });
}

describe('withhold matrix — exhaustive by construction (AdviceQuantity × AccountSection × SectionStatus)', () => {
  let caseCount = 0;

  for (const quantity of ADVICE_QUANTITIES) {
    for (const section of ACCOUNT_SECTIONS) {
      for (const status of SECTION_STATUSES) {
        caseCount++;
        const requiredSections = ADVICE_REQUIRES[quantity];
        const sectionMatters = requiredSections.includes(section);
        const expectUsable = !sectionMatters || isUsable(status);

        it(`quantity="${quantity}", varying section="${section}" to status="${status}" ⇒ usable=${String(expectUsable)}`, () => {
          const view = syntheticAccountView({ sectionStatuses: { [section]: status } });
          const model = buildPlanningModel(view);
          expect(isQuantityUsable(model.sections, quantity)).toBe(expectUsable);
        });
      }
    }
  }

  it('recorded case count (evidence, not itself an assertion of a specific number)', () => {
    expect(caseCount).toBe(ADVICE_QUANTITIES.length * ACCOUNT_SECTIONS.length * SECTION_STATUSES.length);
    expect(caseCount).toBeGreaterThanOrEqual(20);
  });
});

describe('MPV-09/MPV-10 — the absence assertion: the identity-tree fallback DPS never reaches HeroAdvice', () => {
  it('skills: missing ⇒ advice withheld, and the identity-tree DPS is structurally unreachable (no `dps` field on Withheld)', () => {
    const view = syntheticAccountView({ sectionStatuses: { skills: 'missing' } });
    const model = buildPlanningModel(view);
    const hero = firstHero(model);
    const advice = adviceForHero(model, hero.hero.id);

    expect(advice.withheld).toBe(true);
    // Not a hardcoded string — computed in-test from the real fixture, so this keeps
    // discriminating even if the engine's arithmetic changes.
    const wrong = identityTreeResult(hero.hero, required(model.phase ?? 71, 'phase'), model.mitigationPct ?? 0);
    expect(wrong.dps).toBeGreaterThan(0);
    expect('dps' in advice).toBe(false);
    expect(JSON.stringify(advice)).not.toContain(wrong.dps.toFixed(2));
  });

  it('skills: degraded ⇒ the same absence assertion (spec.md Independent Test names this explicitly)', () => {
    const view = syntheticAccountView({
      sectionStatuses: { skills: 'degraded' },
      missingKeysBySection: { skills: ['totals.dmg_static'] },
    });
    const model = buildPlanningModel(view);
    const hero = firstHero(model);
    const advice = adviceForHero(model, hero.hero.id);

    expect(advice.withheld).toBe(true);
    expect('dps' in advice).toBe(false);
  });

  it('the real dmg_static on this fixture (3624.70) is the value the identity tree would replace with 1× — sanity that the fixture is realistic', () => {
    const payload = syntheticAccountPayload();
    const totals = (payload.skills as { totals?: { dmg_static?: number } } | undefined)?.totals;
    expect(totals?.dmg_static).toBe(REAL_DMG_STATIC);
  });

  it('MPV-10: heroes not usable withholds rosterRow (and therefore everything else) — the affected rows rule', () => {
    const view = syntheticAccountView({ sectionStatuses: { heroes: 'missing' } });
    const model = buildPlanningModel(view);
    expect(isQuantityUsable(model.sections, 'rosterRow')).toBe(false);
  });

  it('MPV-10: items not usable withholds gearSummary and the dps-bundle quantities, but not rosterRow', () => {
    const view = syntheticAccountView({ sectionStatuses: { items: 'missing' } });
    const model = buildPlanningModel(view);
    expect(isQuantityUsable(model.sections, 'rosterRow')).toBe(true);
    expect(isQuantityUsable(model.sections, 'gearSummary')).toBe(false);
    expect(isQuantityUsable(model.sections, 'dps')).toBe(false);
  });

  it('MPV-10: a per-hero candidate.blocked withholds that hero only, and the row is still rendered', () => {
    const view = syntheticAccountView({ heroBlocked: true });
    const model = buildPlanningModel(view);
    const hero = firstHero(model);
    expect(hero.blocked).toBe(true);
    // The row still exists (MPV-10: "the row is still rendered and marked") — the model does
    // not drop the hero, it only marks its numbers withheld.
    const advice = adviceForHero(model, hero.hero.id);
    expect(advice.withheld).toBe(true);
  });
});

describe('MPV-06 — full resolution shows no degradation', () => {
  it('all five sections resolved ⇒ grade "full", every quantity usable, no hero withheld', () => {
    const view = syntheticAccountView();
    const model = buildPlanningModel(view);
    expect(model.report.grade).toBe('full');
    expect(model.report.degradedSections).toEqual([]);
    for (const quantity of ADVICE_QUANTITIES) {
      expect(isQuantityUsable(model.sections, quantity)).toBe(true);
    }
    const hero = firstHero(model);
    const advice = adviceForHero(model, hero.hero.id);
    expect(advice.withheld).toBe(false);
    // Design §3 AD-036 consequence: on the desktop this is only reachable while the game runs
    // and all five routes resolved. That is correct, not a defect — recorded here, not asserted.
  });
});

describe('MPV-07 — degraded sections named in report order', () => {
  it('report.degradedSections lists every non-resolved section, in ACCOUNT_SECTIONS order', () => {
    const view = syntheticAccountView({
      sectionStatuses: { skills: 'missing', items: 'degraded' },
      missingKeysBySection: { items: ['stats'] },
    });
    const model = buildPlanningModel(view);
    // ACCOUNT_SECTIONS order is ['account', 'heroes', 'skills', 'casa', 'items'].
    expect(model.report.degradedSections).toEqual(['skills', 'items']);
  });
});

describe("MPV-08 — degraded surfaces missingKeys distinctly from missing — LATENT, see AD-037", () => {
  it('a synthetic AccountView carrying {status: "degraded", missingKeys: [...]} is distinguishable in the model from a "missing" section', () => {
    // AD-037: `mergeStoredIntoLive` (apps/desktop/src/main/storage/merge-account.ts:29-43) never
    // writes `degraded` into the merged fidelity block and never carries `missingKeys` — every
    // route into the renderer (account:get) goes through that merge, so no end-to-end path can
    // reach this state today. This test is the correct and complete evidence under AD-037: a
    // synthetic AccountView built directly (bypassing the merge, since `buildPlanningModel`
    // takes an `AccountView` as its own input) proves the view-model branch is implemented and
    // distinguishable, without changing `merge-account.ts` to force reachability.
    const degradedView = syntheticAccountView({
      sectionStatuses: { skills: 'degraded' },
      missingKeysBySection: { skills: ['totals.dmg_static', 'totals.crit_dmg_mult'] },
    });
    const missingView = syntheticAccountView({ sectionStatuses: { skills: 'missing' } });

    const degradedModel = buildPlanningModel(degradedView);
    const missingModel = buildPlanningModel(missingView);

    const degradedSection = required(
      degradedModel.sections.find((s) => s.section === 'skills'),
      'expected a skills section',
    );
    const missingSection = required(
      missingModel.sections.find((s) => s.section === 'skills'),
      'expected a skills section',
    );

    expect(degradedSection.status).toBe('degraded');
    expect(degradedSection.missingKeys).toEqual(['totals.dmg_static', 'totals.crit_dmg_mult']);
    expect(missingSection.status).toBe('missing');
    expect(missingSection.missingKeys).toEqual([]);
    // Both withhold identically (neither is usable) — the distinction is diagnostic, not a
    // different withhold outcome.
    expect(degradedSection.usable).toBe(false);
    expect(missingSection.usable).toBe(false);
  });
});

describe("MPV-11 — a restored all-stale account renders advice, and only no-roster renders zero numbers (AD-036)", () => {
  it('availability "no-roster" gives zero numeric nodes (no heroes to compute from)', () => {
    const view = syntheticAccountView({ sectionStatuses: { heroes: 'missing' } });
    const model = buildPlanningModel(view);
    expect(model.availability).toBe('no-roster');
    expect(model.heroes).toEqual([]);
  });

  it('availability "store-unavailable" renders store.reason plus any live-resolved section\'s advice (spec.md edge case)', () => {
    const view = syntheticAccountView({ storeStatus: 'unavailable', storeReason: 'no_sqlite_binding' });
    const model = buildPlanningModel(view);
    expect(model.availability).toBe('store-unavailable');
    expect(model.store.reason).toBe('no_sqlite_binding');
    // The store being unavailable does not itself withhold advice — the same per-section rule
    // applies underneath; here every section is resolved, so advice still computes.
    const hero = firstHero(model);
    const advice = adviceForHero(model, hero.hero.id);
    expect(advice.withheld).toBe(false);
  });
});

describe('MPV-03 layer 3 — the model renders what pipelineForHero computed, for the same fixture', () => {
  it("adviceForHero's ranking equals pipelineForHero's own output when called directly with the model's own shared/phase/mitigationPct", () => {
    const view = syntheticAccountView();
    const model = buildPlanningModel(view);
    const hero = firstHero(model);
    const advice = adviceForHero(model, hero.hero.id);
    expect(advice.withheld).toBe(false);
    if (advice.withheld) throw new Error('expected computed advice for this fully-resolved fixture');

    const direct = pipelineForHero(
      hero.hero,
      required(model.shared, 'expected shared'),
      required(model.phase, 'expected phase'),
      required(model.mitigationPct, 'expected mitigationPct'),
    );
    expect(advice.ranking).toEqual(direct.ranking);
    expect(advice.dps).toBe(direct.dps);
  });
});

describe('discrimination: the matrix goes red when the withhold rule is loosened', () => {
  it('demonstrated here (not a permanent mutation): forcing isUsable-equivalent behaviour to accept "missing" breaks a large number of the matrix rows above', () => {
    // `isUsable` itself is not mutated (it is imported, not reassigned) — instead this
    // reproduces the exact discrimination locally: recompute `expectUsable` under a loosened
    // rule that treats "missing" as usable, and confirm it disagrees with the real
    // `isQuantityUsable` on a large number of cases, proving the matrix's rows are not
    // vacuously true.
    const loosenedIsUsable = (status: SectionStatus): boolean => status !== 'degraded'; // accepts "missing"
    let disagreements = 0;
    for (const quantity of ADVICE_QUANTITIES) {
      for (const section of ACCOUNT_SECTIONS) {
        if (!ADVICE_REQUIRES[quantity].includes(section)) continue;
        const view = syntheticAccountView({ sectionStatuses: { [section]: 'missing' } });
        const model = buildPlanningModel(view);
        const real = isQuantityUsable(model.sections, quantity);
        const loosened = ADVICE_REQUIRES[quantity].every((s) => {
          const entry = required(
            model.sections.find((candidate) => candidate.section === s),
            'section',
          );
          return loosenedIsUsable(entry.status);
        });
        if (real !== loosened) disagreements++;
      }
    }
    expect(disagreements).toBeGreaterThan(10);
  });
});
