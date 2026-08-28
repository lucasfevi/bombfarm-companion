/**
 * design.md §5, §8, T3 — the scripted sequences the milestone is judged on: the spec's
 * own Independent Test verbatim (MAR-01/03/04), per-hero recompute counting (MAR-16), and the
 * fidelity-transition suite (MAR-06…10). Every test here calls `resetAdviceComputeCount()` in
 * `beforeEach` — the cache and counter are module-level state (`hero-advice.ts`'s own doc
 * comment): skipping the reset lets file execution order decide the result.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { AccountView } from '@bombfarm/contracts';
import { buildPlanningModel } from './account-model';
import { adviceForHero, getAdviceComputeCount, resetAdviceComputeCount } from './hero-advice';
import type { PlanningModel } from './types';
import {
  REAL_DMG_STATIC,
  mutateAccountIrrelevantField,
  mutateHeroField,
  mutateSkillsTotals,
  syntheticAccountView,
  syntheticRosterAccountView,
  withSectionStatus,
} from './fixtures/synthetic-views';

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

function firstHero(model: PlanningModel) {
  return required(model.heroes[0], 'expected at least one hero in this fixture');
}

/**
 * What `pipelineForHero` would return under the identity-tree fallback (`danoStatic: 1`,
 * everything else 0/false) — F2's own absence-proving technique
 * (`withhold-matrix.test.ts`'s `identityTreeResult`), duplicated here rather than imported so
 * this suite carries no dependency on that file's internals (it is explicitly not edited by F3,
 * tasks.md T3). Computed in-test from the real fixture, not hardcoded — a hardcoded number stops
 * discriminating the moment the engine's arithmetic changes.
 */
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

beforeEach(() => {
  resetAdviceComputeCount();
});

describe("the spec's Independent Test, verbatim (MAR-01/03/04): identical, relevant change, irrelevant change, identical ⇒ 1, 2, 2, 2", () => {
  it('counts exactly 1, 2, 2, 2 across the four steps — the value-changed half and the reference-stable half both asserted', () => {
    const base = syntheticAccountView();
    const heroId = firstHero(buildPlanningModel(base)).hero.id;

    // Step 1 — first read ⇒ 1 compute.
    const modelA = buildPlanningModel(base);
    const adviceA = adviceForHero(modelA, heroId);
    expect(getAdviceComputeCount()).toBe(1);
    if (adviceA.withheld) throw new Error('expected computed advice on this fully-resolved fixture');

    // Step 2 — a planning-relevant change (level) ⇒ 2 computes, AND the value actually changed.
    // A mutant that never recomputes would still pass "count reaches 2" without this second half.
    const relevant = mutateHeroField(base, heroId, { level: 41 });
    const modelB = buildPlanningModel(relevant);
    const adviceB = adviceForHero(modelB, heroId);
    expect(getAdviceComputeCount()).toBe(2);
    if (adviceB.withheld) throw new Error('expected computed advice on this fully-resolved fixture');
    expect(adviceB.dps).not.toBe(adviceA.dps);

    // Step 3 — an irrelevant-field change (a raw `account` field the pipeline never reads) ⇒
    // still 2 computes, AND the SAME HeroAdvice object reference is returned. A mutant that
    // always recomputes would still pass "count stays at 2" without this second half.
    const irrelevant = mutateAccountIrrelevantField(relevant, { gold: 999 });
    const modelC = buildPlanningModel(irrelevant);
    const adviceC = adviceForHero(modelC, heroId);
    expect(getAdviceComputeCount()).toBe(2);
    expect(adviceC).toBe(adviceB);

    // Step 4 — identical again ⇒ still 2 computes, same reference.
    const modelD = buildPlanningModel(irrelevant);
    const adviceD = adviceForHero(modelD, heroId);
    expect(getAdviceComputeCount()).toBe(2);
    expect(adviceD).toBe(adviceC);
  });
});

describe('MAR-16 — only the heroes whose inputs actually changed are recomputed', () => {
  const heroIds = Array.from({ length: 11 }, (_, index) => `hero-${String(index)}`);

  it("one hero's level change ⇒ exactly 1 additional compute across an 11-hero roster", () => {
    const before = syntheticRosterAccountView(heroIds);
    const modelBefore = buildPlanningModel(before);
    for (const id of heroIds) adviceForHero(modelBefore, id);
    expect(getAdviceComputeCount()).toBe(11);

    const after = mutateHeroField(before, 'hero-3', { level: 99 });
    const modelAfter = buildPlanningModel(after);
    for (const id of heroIds) adviceForHero(modelAfter, id);
    expect(getAdviceComputeCount()).toBe(12);
  });

  it('a shared-tree change ⇒ every hero recomputes (11 more) — the correct answer, not a failure: every hero\'s inputs did change', () => {
    const before = syntheticRosterAccountView(heroIds);
    const modelBefore = buildPlanningModel(before);
    for (const id of heroIds) adviceForHero(modelBefore, id);
    expect(getAdviceComputeCount()).toBe(11);

    const after = mutateSkillsTotals(before, { dmg_static: REAL_DMG_STATIC * 2 });
    const modelAfter = buildPlanningModel(after);
    for (const id of heroIds) adviceForHero(modelAfter, id);
    expect(getAdviceComputeCount()).toBe(22);
  });
});

describe('the fidelity-transition suite (design.md §5) — scripted sequences, not a static matrix (F2 owns that)', () => {
  it('resolved → stale on skills (MAR-06): the status and the withhold decision are read from the SAME model — structurally, never one cycle behind', () => {
    const view = syntheticAccountView();
    const model1 = buildPlanningModel(view);
    const hero = firstHero(model1);
    const advice1 = adviceForHero(model1, hero.hero.id);
    expect(advice1.withheld).toBe(false);
    expect(getAdviceComputeCount()).toBe(1);

    const staleView = withSectionStatus(view, 'skills', 'stale');
    const model2 = buildPlanningModel(staleView);
    const skillsSection = required(
      model2.sections.find((s) => s.section === 'skills'),
      'expected a skills section',
    );
    const advice2 = adviceForHero(model2, hero.hero.id);
    // `stale` is still usable (isUsable = resolved || stale), so the advice is not withheld —
    // both the status and the withhold flag come from model2, the one model this render reads,
    // so they cannot be out of sync by construction. Body is byte-identical, so this is also a
    // cache hit (the advice cache clears only on a USABILITY transition, and stale/resolved share the same
    // usable=true — MAR-09's "counts as a change" claim is proven at tier 0 and the render, not
    // by forcing a numeric recompute here; see T1's probe and the render reading `skillsSection`).
    expect(skillsSection.status).toBe('stale');
    expect(advice2.withheld).toBe(false);
    expect(getAdviceComputeCount()).toBe(1);
  });

  it('resolved → missing on skills (MAR-07): every tree-dependent number withdrawn, and the identity-tree fallback value is absent too', () => {
    const view = syntheticAccountView();
    const model1 = buildPlanningModel(view);
    const hero = firstHero(model1);
    const advice1 = adviceForHero(model1, hero.hero.id);
    if (advice1.withheld) throw new Error('expected computed advice on this fully-resolved fixture');

    const missingView = withSectionStatus(view, 'skills', 'missing');
    const model2 = buildPlanningModel(missingView);
    const advice2 = adviceForHero(model2, hero.hero.id);
    expect(advice2.withheld).toBe(true);
    expect('dps' in advice2).toBe(false);

    const wrong = identityTreeResult(
      hero.hero,
      required(model2.phase, 'expected phase to survive a skills-only drop'),
      required(model2.mitigationPct, 'expected mitigationPct to survive a skills-only drop'),
    );
    expect(wrong.dps).toBeGreaterThan(0);
    expect(JSON.stringify(advice2)).not.toContain(wrong.dps.toFixed(2));
  });

  it('resolved → degraded → resolved over a byte-identical body (MAR-08): the counter increments on the return leg', () => {
    const view = syntheticAccountView();
    const model1 = buildPlanningModel(view);
    const hero = firstHero(model1);
    adviceForHero(model1, hero.hero.id);
    expect(getAdviceComputeCount()).toBe(1);

    const degraded = withSectionStatus(view, 'skills', 'degraded', ['totals.dmg_static']);
    const model2 = buildPlanningModel(degraded);
    const advice2 = adviceForHero(model2, hero.hero.id);
    expect(advice2.withheld).toBe(true);
    expect(getAdviceComputeCount()).toBe(1); // withheld never increments the counter

    // Byte-identical body — the SAME skills.totals as the original `view`, only the status moved
    // back to resolved. Without the advice cache's usability-key clear, this would be a cache hit (the
    // hero/shared keys never actually changed value). WITH it, the cache was dropped on the
    // unusable→usable transition, forcing a genuine recompute — the case this whole-cache-drop rule exists for.
    const resolvedAgain = withSectionStatus(view, 'skills', 'resolved');
    const model3 = buildPlanningModel(resolvedAgain);
    const advice3 = adviceForHero(model3, hero.hero.id);
    expect(advice3.withheld).toBe(false);
    expect(getAdviceComputeCount()).toBe(2);
  });

  it('all five sections → missing (MAR-10): the roster itself disappears, so no numeric node is reachable at all', () => {
    const view = syntheticAccountView();
    const model1 = buildPlanningModel(view);
    const hero = firstHero(model1);
    const advice1 = adviceForHero(model1, hero.hero.id);
    if (advice1.withheld) throw new Error('expected computed advice on this fully-resolved fixture');
    expect(getAdviceComputeCount()).toBe(1);

    let allMissing: AccountView = view;
    for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as const) {
      allMissing = withSectionStatus(allMissing, section, 'missing');
    }
    const model2 = buildPlanningModel(allMissing);
    expect(model2.availability).toBe('no-roster');
    // `heroes: []` IS the "zero residual numbers" proof: with no roster there is no hero id left
    // to call adviceForHero on, so nothing — not even the pre-drop value — is reachable through
    // this model. (`adviceForHero` is never invoked while heroes is empty in real usage either:
    // PlanningView returns the no-roster EmptyState before HeroDetail/NextPointPanel ever run.)
    expect(model2.heroes).toEqual([]);
    expect(getAdviceComputeCount()).toBe(1); // nothing new computed for the missing state

    // Once real (different) data returns, the value is freshly computed, never the pre-drop one.
    // (The recovery-with-UNCHANGED-data case — byte-identical body, cache legitimately reused
    // because the answer would be identical either way — is MAR-08's dedicated test above, over
    // a transition where heroes stays usable throughout so the cache-clear check actually runs.)
    const changed = mutateHeroField(view, hero.hero.id, { level: hero.hero.level + 5 });
    const model3 = buildPlanningModel(changed);
    const advice3 = adviceForHero(model3, hero.hero.id);
    if (advice3.withheld) throw new Error('expected computed advice on this fully-resolved fixture');
    expect(advice3.dps).not.toBe(advice1.dps);
  });

  it('consent revoked mid-session: an all-missing placeholder withholds advice and is never recomputed from the last good account', () => {
    const view = syntheticAccountView();
    const model1 = buildPlanningModel(view);
    const hero = firstHero(model1);
    adviceForHero(model1, hero.hero.id);
    expect(getAdviceComputeCount()).toBe(1);

    // Same shape as account-refresh.ts's not-consented branch (allSectionsFailed()): every
    // section reported missing, regardless of whatever the last good account looked like.
    let revoked: AccountView = view;
    for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as const) {
      revoked = withSectionStatus(revoked, section, 'missing');
    }
    const model2 = buildPlanningModel(revoked);
    // No heroes survive into this model at all — there is nothing left for a caller to query,
    // so the previous hero's advice is unreachable through this model, not merely withheld on
    // request.
    expect(model2.heroes).toEqual([]);
    expect(getAdviceComputeCount()).toBe(1);
  });

  it('payload rejected (missingBirthStats): zero pipeline calls — the roster is empty, not partially withheld', () => {
    const view = syntheticAccountView();
    const model1 = buildPlanningModel(view);
    const hero = firstHero(model1);
    adviceForHero(model1, hero.hero.id);
    expect(getAdviceComputeCount()).toBe(1);

    // No `stats` AND no `birth_stats` on the only hero ⇒ parseAccountPayload rejects the WHOLE
    // file (missingBirthStats) — same shape planning-advice.spec.mjs Scenario B exercises end to
    // end.
    const rejectedHeroes = [{ id: 'h1', name: 'Alpha', level: 20, rarity: 2, stars: 1 }];
    const rejectedView: AccountView = { ...view, payload: { ...view.payload, heroes: rejectedHeroes } };
    const model2 = buildPlanningModel(rejectedView);
    expect(model2.availability).toBe('rejected');
    expect(model2.rejected?.reason).toBe('missingBirthStats');
    expect(model2.heroes).toEqual([]);
    // No hero left in the model to query — zero pipeline calls is structural here, the same way
    // MAR-10's zero numeric nodes is: an empty roster, not a withheld query.
    expect(getAdviceComputeCount()).toBe(1);
  });
});
