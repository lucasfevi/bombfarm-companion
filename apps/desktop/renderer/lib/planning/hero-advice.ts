/**
 * `PlanningModel` + a hero id → `HeroAdvice | Withheld` (design.md §4.3, §7.1). The **only**
 * caller of `pipelineForHero` in the desktop tree (MPV-21) — `computeAdvisorPipeline` is never
 * assembled here or anywhere else under `apps/desktop`.
 *
 * MP3 F3 (design.md §7, `AD-044`/`AD-046`) adds a value-keyed per-hero memo on top of F2's
 * withhold gate: `heroChangeKey`/`sharedChangeKey` are tier 1 of the two-tier change detection
 * (tier 0, `accountChangeKey`, lives in `@bombfarm/contracts` and gates whether a new
 * `AccountView` is even accepted at all — see `account-view-store.ts`). `adviceForHero`'s
 * signature is unchanged by design (TD-6), so no component under `apps/desktop/renderer/app` is
 * edited by this feature.
 */
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { isQuantityUsable, withheldSections } from './account-model';
import type { HeroAdvice, PlanningModel, Withheld } from './types';

/**
 * `CHANGE_KEY_INPUTS` — every root path `pipelineForHero` (`packages/domain/src/roster-dps.ts`)
 * reads, declared as data (`AD-041`'s genre) rather than left implicit in `heroChangeKey`'s and
 * `sharedChangeKey`'s bodies, so `tools/advice-change-key-coverage.test.mjs` (T5) can guard this
 * list against `roster-dps.ts`'s own source rather than trust that the two were kept in sync by
 * hand. Each entry is the literal right-hand-side expression `roster-dps.ts` passes (with any
 * `?? default` fallback stripped), so the guard's extraction and this table use one shared
 * vocabulary.
 */
export const CHANGE_KEY_INPUTS: readonly string[] = [
  'hero.naked',
  'hero.gearedOverride',
  'hero.loadout',
  'hero.altLoadout',
  'hero.pts',
  'hero.abilities',
  'hero.rarity',
  'hero.level',
  'hero.stars',
  'hero.birth',
  'account.tree.danoTotal',
  'account.tree.critChance',
  'account.tree.critDmg',
  'account.tree.speed',
  'account.tree.energy',
  'account.tree.luckFlatPct',
  'account.teamBuffs',
  'context.houseIdx',
  'context.houseLevel',
  'context.rankMode',
  'context.targetProp',
  'phase',
  'mitigationPct',
];

/**
 * Recursively sorts object keys so two structurally-identical values serialise identically
 * regardless of property insertion order — the same four-line technique
 * `@bombfarm/contracts`'s `accountChangeKey` uses, duplicated locally rather than imported: this
 * module has no reason to depend on `@bombfarm/contracts` for a private stringify helper, and
 * `accountChangeKey` is deliberately payload-shaped, not a general utility.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      out[key] = canonicalize(record[key]);
    }
    return out;
  }
  return value;
}

function canonicalKey(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Tier 1, per-hero. **By value, never by identity** — the spec's own edge case: "the same hero
 * appears twice across cycles with an identical record but a new object identity" would recompute
 * every cycle under an identity comparison (a `useMemo` on `candidate.record` would have made
 * exactly this mistake), silently passing MAR-01 while failing MAR-04. Covers exactly the
 * `hero.*` right-hand sides in `CHANGE_KEY_INPUTS`.
 */
export function heroChangeKey(hero: HeroRecord): string {
  return canonicalKey({
    naked: hero.naked,
    gearedOverride: hero.gearedOverride,
    loadout: hero.loadout,
    altLoadout: hero.altLoadout,
    pts: hero.pts,
    statPointsAvailable: hero.statPointsAvailable,
    abilities: hero.abilities,
    rarity: hero.rarity,
    level: hero.level,
    stars: hero.stars,
    birth: hero.birth,
  });
}

/**
 * Tier 1, shared across every hero. Covers exactly the `account.tree.*`/`teamBuffs`/`context.*`
 * right-hand sides in `CHANGE_KEY_INPUTS`, plus `phase` and `mitigationPct` — the two scalars
 * `pipelineForHero` also takes directly.
 */
export function sharedChangeKey(shared: AccountShared, phase: number, mitigationPct: number): string {
  return canonicalKey({
    tree: {
      danoTotal: shared.tree.danoTotal,
      critChance: shared.tree.critChance,
      critDmg: shared.tree.critDmg,
      speed: shared.tree.speed,
      energy: shared.tree.energy,
      luckFlatPct: shared.tree.luckFlatPct,
    },
    teamBuffs: shared.teamBuffs,
    context: {
      houseIdx: shared.context.houseIdx,
      houseLevel: shared.context.houseLevel,
      rankMode: shared.context.rankMode,
      targetProp: shared.context.targetProp,
    },
    phase,
    mitigationPct,
  });
}

type CacheEntry = { readonly heroKey: string; readonly advice: HeroAdvice };

/**
 * Module-level cache and counter — mirrors `apps/web/src/shared/stores/selectors/advisor-selectors.ts:7-10`
 * exactly, generalised from one entry to a roster (`TD-5`). Justified the same way the web
 * precedent is: valid because the desktop renderer is one `BrowserWindow` with one planning
 * surface (the web's justification is "client-only, exactly one store instance" — the desktop
 * equivalent). `resetAdviceComputeCount()` is the same test escape hatch; every test that reads
 * the counter must call it in `beforeEach`, or file execution order decides the result.
 */
const cache = new Map<string, CacheEntry>();
let lastSharedKey: string | null = null;
let lastUsabilityKey: string | null = null;
let adviceComputeCount = 0;

export function getAdviceComputeCount(): number {
  return adviceComputeCount;
}

/** Also clears the cache and both last-seen keys — the web precedent's own reset semantics. */
export function resetAdviceComputeCount(): void {
  adviceComputeCount = 0;
  cache.clear();
  lastSharedKey = null;
  lastUsabilityKey = null;
}

/** The five sections' `usable` booleans, in `ACCOUNT_SECTIONS` order — `AD-046`'s clear key. */
function usabilityKeyOf(model: PlanningModel): string {
  return ACCOUNT_SECTIONS.map((section) => {
    const found = model.sections.find((candidate) => candidate.section === section);
    return `${section}:${String(found?.usable ?? false)}`;
  }).join('|');
}

/**
 * `dps`, `nextPointRanking` and `resetAdvice` share one requirement set (`ADVICE_REQUIRES`) and
 * come from a single `pipelineForHero` call, so they are gated and computed together here. A
 * caller rendering a `nextPointRanking`- or `resetAdvice`-specific notice supplies its own
 * `quantity` to `withheldSections`/`ADVICE_REQUIRES` for that testid — the underlying gate is
 * identical, so this never disagrees with it.
 */
export function adviceForHero(model: PlanningModel, heroId: string): HeroAdvice | Withheld {
  const entry = model.heroes.find((candidate) => candidate.hero.id === heroId);
  if (!entry) {
    // A caller asking for a hero not in this model's own roster is a wiring bug, not an
    // account-data problem — fail loudly rather than fabricate a Withheld that looks legitimate
    // (design §10: no try/catch around pipelineForHero for the same reason).
    throw new Error(`adviceForHero: heroId "${heroId}" is not in this PlanningModel's roster`);
  }

  const withhold = (): Withheld => ({
    withheld: true,
    quantity: 'dps',
    sections: withheldSections(model.sections, 'dps'),
  });

  // AD-046: any change to any section's usability — in EITHER direction — drops the whole cache,
  // not just the affected hero's entry. This is what makes MAR-08 ("recomputed from the new data
  // rather than the pre-degradation cache") literally true instead of argued, and it is what the
  // consent-revoked edge case ("SHALL NOT be recomputed from the last good account") needs.
  const usabilityKey = usabilityKeyOf(model);
  if (usabilityKey !== lastUsabilityKey) {
    cache.clear();
    lastUsabilityKey = usabilityKey;
  }

  // A hero no longer present in this model's roster has its cache entry pruned, so its advice
  // disappears rather than persisting as a stale row (spec.md edge case).
  const currentIds = new Set(model.heroes.map((candidate) => candidate.hero.id));
  for (const cachedId of cache.keys()) {
    if (!currentIds.has(cachedId)) {
      cache.delete(cachedId);
    }
  }

  if (!isQuantityUsable(model.sections, 'dps') || entry.blocked) {
    return withhold();
  }

  const { shared, phase, mitigationPct } = model;
  if (shared === null || phase === null || mitigationPct === null) {
    return withhold();
  }

  // A shared-tree/context/phase/mitigation change affects every hero's advice, so it also drops
  // the whole cache (not only this hero's entry) — the correct answer for a shared change is
  // that every hero recomputes on its next read, not that this one hero's stale entry survives
  // because its own heroKey happened not to move.
  const sharedKey = sharedChangeKey(shared, phase, mitigationPct);
  if (sharedKey !== lastSharedKey) {
    cache.clear();
    lastSharedKey = sharedKey;
  }

  const heroKey = heroChangeKey(entry.hero);
  const cached = cache.get(heroId);
  if (cached && cached.heroKey === heroKey) {
    return cached.advice;
  }

  adviceComputeCount += 1;
  const result = pipelineForHero(entry.hero, shared, phase, mitigationPct);
  const advice: HeroAdvice = {
    withheld: false,
    dps: result.dps,
    ranking: result.ranking,
    best: result.best,
    resetAdvice: result.resetAdvice,
  };
  cache.set(heroId, { heroKey, advice });
  return advice;
}
