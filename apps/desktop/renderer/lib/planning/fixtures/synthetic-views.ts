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

function sectionFidelity(status: SectionStatus, missingKeys?: readonly string[]): AccountFidelity[AccountSection] {
  switch (status) {
    case 'missing':
      return { status: 'missing' };
    case 'degraded':
      return { status: 'degraded', capturedAt: NOW, missingKeys: missingKeys ?? ['totals.dmg_static'] };
    case 'resolved':
    case 'stale':
      return { status, capturedAt: NOW };
  }
}

export function buildFidelity(
  statuses: Partial<Record<AccountSection, SectionStatus>> = {},
  missingKeysBySection: Partial<Record<AccountSection, readonly string[]>> = {},
): AccountFidelity {
  const entries = ACCOUNT_SECTIONS.map((section) => {
    const status = statuses[section] ?? 'resolved';
    return [section, sectionFidelity(status, missingKeysBySection[section])] as const;
  });
  return Object.fromEntries(entries) as AccountFidelity;
}

export type SyntheticViewOptions = {
  sectionStatuses?: Partial<Record<AccountSection, SectionStatus>>;
  missingKeysBySection?: Partial<Record<AccountSection, readonly string[]>>;
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
      : { totals: { dmg_static: REAL_DMG_STATIC, crit_dmg_mult: 1, crit_chance_add: 0.1 } },
    casa: omit.has('casa') ? undefined : { active_casa: 2, levels: [10, 16] },
    items: omit.has('items') ? undefined : [],
    fidelity: buildFidelity(options.sectionStatuses, options.missingKeysBySection),
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
