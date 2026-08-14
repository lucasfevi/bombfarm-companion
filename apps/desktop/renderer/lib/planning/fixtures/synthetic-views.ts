/**
 * Synthetic `AccountView` builders for the withhold matrix (T4) and for MPV-08's latent test
 * (`AD-037` — `degraded` never survives `mergeStoredIntoLive`, so this is the *only* path that
 * can exercise it; see `withhold-matrix.test.ts`'s dedicated `it` for that).
 *
 * The hero payload's `dmg_static` is `3624.70` — `mapAccountData`'s own header comment (design.md
 * §2.3) cites this as the measured real value the identity-tree fallback (`danoStatic: 1`)
 * replaces on a `skills`-unusable account. Using the same figure here means the matrix's absence
 * assertions are provably about *that* documented gap, not an arbitrary number.
 */
import type {
  AccountFidelity,
  AccountPayload,
  AccountSection,
  AccountStoreReason,
  AccountStoreStatus,
  AccountView,
  SectionStatus,
} from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';

const NOW = '2026-08-12T00:00:00.000Z';

export const REAL_DMG_STATIC = 3624.7;

function rawHero(id: string, name = 'Hero') {
  const birth = {
    dmg: 250,
    energia: 400,
    speed: 55,
    crit_chance: 12,
    crit_dmg: 70,
    penetration: 3,
    cooldown_reduction: 2,
    luck: 5,
  };
  return {
    id,
    name,
    level: 40,
    rarity: 3,
    stars: 2,
    birth_stats: birth,
    stats: birth,
    stat_points_available: 0,
  };
}

export function syntheticHeroesPayload(overrides: {
  heroId?: string;
  heroName?: string;
  blocked?: boolean;
}): unknown[] {
  const hero = rawHero(overrides.heroId ?? 'h1', overrides.heroName ?? 'Alpha');
  if (overrides.blocked) {
    // No `stats` block ⇒ `parseAccountPayload` blocks the hero (cannot infer spent points),
    // MPV-10's per-hero row — the hero still parses and renders, only its numbers withhold.
    const { stats: _stats, ...blockedHero } = hero;
    return [blockedHero];
  }
  return [hero];
}

function sectionFidelity(
  status: SectionStatus,
  missingKeys?: readonly string[],
  addedKeys?: readonly string[],
): AccountFidelity[AccountSection] {
  switch (status) {
    case 'missing':
      return { status: 'missing' };
    case 'degraded':
      return {
        status: 'degraded',
        capturedAt: NOW,
        missingKeys: missingKeys ?? ['totals.dmg_static'],
        // MP5 F4: required, not optional (SectionFidelity's degraded member). Defaults to empty —
        // every existing caller of this fixture builder keeps describing a missing-key-only drift
        // unless it opts into an added-key one via `addedKeysBySection`/the third parameter here.
        addedKeys: addedKeys ?? [],
      };
    case 'resolved':
    case 'stale':
      return { status, capturedAt: NOW };
  }
}

export function buildFidelity(
  statuses: Partial<Record<AccountSection, SectionStatus>> = {},
  missingKeysBySection: Partial<Record<AccountSection, readonly string[]>> = {},
  addedKeysBySection: Partial<Record<AccountSection, readonly string[]>> = {},
): AccountFidelity {
  const entries = ACCOUNT_SECTIONS.map((section) => {
    const status = statuses[section] ?? 'resolved';
    return [section, sectionFidelity(status, missingKeysBySection[section], addedKeysBySection[section])] as const;
  });
  return Object.fromEntries(entries) as AccountFidelity;
}

export type SyntheticViewOptions = {
  sectionStatuses?: Partial<Record<AccountSection, SectionStatus>>;
  missingKeysBySection?: Partial<Record<AccountSection, readonly string[]>>;
  /** MP5 F4: mirrors `missingKeysBySection` for the `addedKeys` half of a degraded section. */
  addedKeysBySection?: Partial<Record<AccountSection, readonly string[]>>;
  storeStatus?: AccountStoreStatus;
  storeReason?: AccountStoreReason | null;
  heroBlocked?: boolean;
  heroId?: string;
  /** Omit the given top-level payload keys entirely (distinct from a `missing` fidelity status). */
  omitSections?: readonly AccountSection[];
};

/** A full, realistic account payload — all five sections present, real (non-identity) tree data. */
export function syntheticAccountPayload(options: SyntheticViewOptions = {}): AccountPayload {
  const heroId = options.heroId ?? 'h1';
  const omit = new Set(options.omitSections ?? []);

  return {
    account: omit.has('account') ? undefined : { phase: 71 },
    heroes: omit.has('heroes') ? undefined : syntheticHeroesPayload({ heroId, blocked: options.heroBlocked }),
    skills: omit.has('skills')
      ? undefined
      // MP5 F4: post-patch skills.totals shape — no crit_dmg_mult (F2's stale-field trap; this
      // literal is never modelled downstream, so this was a dead key, not a load-bearing one).
      : { totals: { dmg_static: REAL_DMG_STATIC, vagas_campo: 0, bag_tabs_bonus: 0, crit_chance_add: 0.1 } },
    casa: omit.has('casa') ? undefined : { active_casa: 2, levels: [10, 16] },
    items: omit.has('items') ? undefined : [],
    fidelity: buildFidelity(options.sectionStatuses, options.missingKeysBySection, options.addedKeysBySection),
  };
}

export function syntheticAccountView(options: SyntheticViewOptions = {}): AccountView {
  return {
    payload: syntheticAccountPayload(options),
    gameRunning: false,
    store: {
      status: options.storeStatus ?? 'ok',
      reason: options.storeReason ?? null,
      binding: 'better-sqlite3',
    },
  };
}

// --- MP3 F3 additions (design.md §5, T3) — the transition-sequence and per-hero mutation
// building blocks for `recompute-sequences.test.ts`. F2's builders above are unmodified. ---

/** An N-hero roster, each hero a distinct id, for MAR-16's "only the changed hero recomputes"
 *  and "a shared-tree change recomputes every hero" tests. Bodies are otherwise identical to
 *  `rawHero`'s single-hero shape, just repeated under distinct ids/names. */
export function syntheticRosterAccountView(heroIds: readonly string[]): AccountView {
  const heroes = heroIds.map((id, index) => rawHero(id, `Hero-${String(index)}`));
  return {
    payload: {
      account: { phase: 71 },
      heroes,
      // MP5 F4: post-patch skills.totals shape, matching syntheticAccountPayload above.
      skills: { totals: { dmg_static: REAL_DMG_STATIC, vagas_campo: 0, bag_tabs_bonus: 0, crit_chance_add: 0.1 } },
      casa: { active_casa: 2, levels: [10, 16] },
      items: [],
      fidelity: buildFidelity(),
    },
    gameRunning: false,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
}

/**
 * A new `AccountView` with one hero's raw record patched (e.g. `{ level: 41 }`) — every other
 * hero's raw record is untouched. Used by MAR-16's "changing one hero recomputes exactly one
 * hero" test and by the per-field mutation half of T5's key-coverage guard.
 */
export function mutateHeroField(view: AccountView, heroId: string, patch: Record<string, unknown>): AccountView {
  const rawHeroes = (view.payload.heroes as unknown[] | undefined) ?? [];
  const heroes = rawHeroes.map((entry) => {
    const record = entry as Record<string, unknown>;
    return record.id === heroId ? { ...record, ...patch } : record;
  });
  return { ...view, payload: { ...view.payload, heroes } };
}

/**
 * A new `AccountView` with an extra field folded into the raw `account` body (e.g.
 * `{ gold: 999 }`). `import-save.ts`'s `mapAccountData` reads only `phase`/`houseIdx`/
 * `houseLevel`/`tree` (from `skills`)/`slots` from this section, so any other key is confined to
 * a field the advisor pipeline never reads — the MAR-03 "irrelevant field" building block.
 */
export function mutateAccountIrrelevantField(view: AccountView, patch: Record<string, unknown>): AccountView {
  const account = view.payload.account ?? {};
  return { ...view, payload: { ...view.payload, account: { ...account, ...patch } } };
}

/**
 * A new `AccountView` with `skills.totals` patched (e.g. `{ dmg_static: 9999 }`) — the
 * shared-tree mutation building block for MAR-16's "a shared-tree change recomputes every hero"
 * test and for the per-field mutation half of T5's key-coverage guard over `account.tree.*`.
 */
export function mutateSkillsTotals(view: AccountView, patch: Record<string, unknown>): AccountView {
  const skills = view.payload.skills ?? {};
  const totals = (skills.totals as Record<string, unknown> | undefined) ?? {};
  return {
    ...view,
    payload: {
      ...view.payload,
      skills: { ...skills, totals: { ...totals, ...patch } },
    },
  };
}

/**
 * A new `AccountView` with exactly one section's fidelity `status` flipped — the body and every
 * other section's fidelity are left untouched unless `bodyPatch` is supplied. The scripted
 * fidelity-transition building block (MAR-06/07/08/09/10, design.md §5): callers apply this
 * repeatedly to walk a sequence like `resolved → degraded → resolved`.
 */
export function withSectionStatus(
  view: AccountView,
  section: AccountSection,
  status: SectionStatus,
  missingKeys?: readonly string[],
  addedKeys?: readonly string[],
): AccountView {
  const fidelity = view.payload.fidelity ?? buildFidelity();
  return {
    ...view,
    payload: {
      ...view.payload,
      fidelity: { ...fidelity, [section]: sectionFidelity(status, missingKeys, addedKeys) },
    },
  };
}

/** A new `AccountView` with a section omitted from the payload entirely (distinct from a
 *  `missing`-status-but-present section) — used by the consent-revoked/all-missing sequences. */
export function withoutSection(view: AccountView, section: AccountSection): AccountView {
  const { [section]: _omitted, ...rest } = view.payload as unknown as Record<string, unknown>;
  const fidelity = view.payload.fidelity ?? buildFidelity();
  return {
    ...view,
    payload: { ...(rest as AccountPayload), fidelity: { ...fidelity, [section]: { status: 'missing' } } },
  };
}
