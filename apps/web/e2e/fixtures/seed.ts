import { expect, type Page } from '@playwright/test';
import type { AccountShared, HeroRecord } from '../../src/shared/lib/storage';
import type { PhasesViewState } from '../../src/shared/lib/phases-view-storage';
import type { InventorySnapshot } from '@bombfarm/domain/inventory';

/** Keys mirror `src/shared/lib/storage.ts` + i18n/guide chrome — keep in sync. */
const HEROES_KEY = 'bf-hp-heroes-v1';
const ACTIVE_KEY = 'bf-hp-active-hero-v1';
const ACCOUNT_KEY = 'bf-hp-account-v1';
const INVENTORY_KEY = 'bf-hp-inventory-v1';
const PHASES_VIEW_KEY = 'bf-hp-phases-view-v1';
const LANG_KEY = 'bf_lang';
const GUIDE_HIDDEN_KEY = 'bf_guide_hidden';
const REFERRAL_NOTICE_HIDDEN_KEY = 'bf_referral_notice_hidden';

/**
 * One-shot storage-migration markers, seeded as already-done.
 *
 * Seeded heroes are authored in CURRENT units, so replaying a legacy conversion over them would
 * corrupt them. More importantly it breaks reload-stability: `seedLocalStorage` uses
 * `addInitScript`, which re-writes the heroes key on EVERY navigation, but the markers a
 * migration writes are not re-written by it. Without these, the first load migrates the seed and
 * saves the result, then a `page.reload()` restores the raw seed while the marker persists — so
 * the migration no longer runs and storage differs before/after. Any test asserting
 * "storage is byte-identical across a reload" then fails for a reason that has nothing to do with
 * what it is testing (`farm-ranking.spec.ts`, `team-plan-states.spec.ts`).
 *
 * Add the marker here whenever a new one-shot migration lands in `storage.ts`.
 */
const MIGRATION_MARKER_KEYS = [
  'bf-hp-critdmg-flat-migrated-v1',
  'bf-hp-critchance-flat-migrated-v1',
  'bf-hp-critcdr-repool-migrated-v1',
] as const;

export type SeededState = {
  heroes: HeroRecord[];
  activeHeroId?: string;
  account?: AccountShared;
  inventory?: InventorySnapshot;
  lang?: 'pt' | 'en';
  /** When true (default), suppress the first-run guide overlay. */
  guideHidden?: boolean;
  /** When true (default), suppress the first-run referral notice below the topbar. */
  referralNoticeHidden?: boolean;
  /** Seeds bf-hp-phases-view-v1 — phase, farmPool and farmReturnBonus. */
  phasesView?: PhasesViewState;
};

const emptySheet = () => ({
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
});

const emptyLoadout = () => ({
  arma: null,
  elmo: null,
  anel: null,
  amuleto: null,
  peito: null,
  calca: null,
  luva: null,
  bota: null,
});

const zeroPts = () => ({
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
});

function hero( partial: Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>): HeroRecord {
  const geared = partial.gearedOverride ?? {
    attack: 500,
    energy: 300,
    speed: 50,
    critChance: 0.1,
    critDmg: 1.5,
    penetration: 1,
    cdr: 0.02,
    luck: 0,
  };
  return {
    id: partial.id,
    name: partial.name,
    updatedAt: partial.updatedAt ?? 1,
    rarity: partial.rarity ?? 'Raro',
    level: partial.level ?? 20,
    stars: partial.stars ?? 1,
    naked: partial.naked ?? emptySheet(),
    loadout: partial.loadout ?? emptyLoadout(),
    altLoadout: partial.altLoadout ?? null,
    gearedOverride: geared,
    abilities: partial.abilities ?? { detonacao_dupla: 5 },
    pts: partial.pts ?? zeroPts(),
    sourceId: partial.sourceId,
    rank: partial.rank,
    power: partial.power,
    deployed: partial.deployed ?? false,
    battleAllowed: partial.battleAllowed,
    // Both stay ABSENT unless a caller supplies them, which is a valid record and the one every
    // seed written before the roster board used. Spelled `?? undefined` rather than omitted: a
    // hero the helper silently dropped these from reports no birth roll at all, and a roster of
    // those is a board of dashes that looks like a broken screen rather than an empty one.
    birth: partial.birth ?? undefined,
    statRanges: partial.statRanges ?? undefined,
  };
}

/** Canonical imported roster for visual baselines (1–3 heroes + active). */
export const importedRoster: SeededState = {
  heroes: [
    hero({
      id: 'seed-cora',
      name: 'Cora',
      level: 47,
      stars: 2,
      rank: 'S',
      rarity: 'Raro',
      sourceId: '1001',
      power: 13133,
      deployed: true,
      gearedOverride: {
        attack: 1470.4,
        energy: 836.4,
        speed: 50.3,
        critChance: 0.127,
        critDmg: 1.6236,
        penetration: 1.1,
        cdr: 0.0314,
        luck: 0,
      },
      abilities: { detonacao_dupla: 10, passagem_bastao: 10 },
    }),
    hero({
      id: 'seed-lorne',
      name: 'Lorne',
      level: 11,
      stars: 0,
      rank: 'C',
      rarity: 'Raro',
      sourceId: '1002',
      power: 996,
      gearedOverride: {
        attack: 150.5,
        energy: 202.3,
        speed: 49.7,
        critChance: 0.1005,
        critDmg: 1.547,
        penetration: 1.53,
        cdr: 0.0068,
        luck: 0,
      },
      abilities: { marcha_acelerada: 0, olho_clinico: 10 },
    }),
    hero({
      id: 'seed-brenna',
      name: 'Brenna',
      level: 30,
      stars: 0,
      rank: 'A',
      rarity: 'Épico',
      sourceId: '1004',
      power: 2500,
      gearedOverride: {
        attack: 420,
        energy: 310,
        speed: 48.5,
        critChance: 0.06,
        critDmg: 1.5,
        penetration: 65,
        cdr: 0.02,
        luck: 0,
      },
      abilities: { ponta_diamante: 10 },
    }),
  ],
  activeHeroId: 'seed-cora',
  lang: 'pt',
  guideHidden: true,
  account: {
    tree: {
      danoTotal: 1.96,
      critChance: 0.51,
      critDmg: 0.19,
      speed: 0.027,
      energy: 0.52,
      teamCoinPct: 0,
    },
    teamBuffs: {},
    context: {
      houseIdx: 2,
      houseLevel: 6,
      phase: 1,
      mitigationPct: 1,
      cycleModel: 'serial',
      walkDelay: 0.15,
      extraDmgPct: 0,
      rankMode: 'dps',
      targetProp: 'bush',
    },
  },
};

/**
 * Writes planner storage keys before app JS runs.
 * App truth: `bf_guide_hidden === '1'` hides the guide overlay (see client-app-shell.tsx).
 */
export async function seedLocalStorage(page: Page, state: SeededState): Promise<void> {
  const payload = {
    heroes: state.heroes,
    activeHeroId: state.activeHeroId ?? null,
    account: state.account ?? null,
    inventory: state.inventory ?? null,
    lang: state.lang ?? 'pt',
    // Default hide guide; only show when guideHidden is explicitly false.
    guideHidden: state.guideHidden !== false,
    // Same default as the guide: a first-run notice on top of every seeded page would
    // shift the layout every other spec measures.
    referralNoticeHidden: state.referralNoticeHidden !== false,
    phasesView: state.phasesView ?? null,
  };

  await page.addInitScript(
    ({
      heroes,
      activeHeroId,
      account,
      inventory,
      lang,
      guideHidden,
      referralNoticeHidden,
      phasesView,
      keys,
    }) => {
      localStorage.setItem(keys.heroes, JSON.stringify(heroes));
      if (activeHeroId) localStorage.setItem(keys.active, activeHeroId);
      else localStorage.removeItem(keys.active);
      if (account) localStorage.setItem(keys.account, JSON.stringify(account));
      else localStorage.removeItem(keys.account);
      if (inventory) localStorage.setItem(keys.inventory, JSON.stringify(inventory));
      else localStorage.removeItem(keys.inventory);
      localStorage.setItem(keys.lang, lang);
      localStorage.setItem(keys.guideHidden, guideHidden ? '1' : '0');
      localStorage.setItem(keys.referralNoticeHidden, referralNoticeHidden ? '1' : '0');
      if (phasesView) localStorage.setItem(keys.phasesView, JSON.stringify(phasesView));
      else localStorage.removeItem(keys.phasesView);
      // Re-asserted on every navigation, exactly like the heroes key above — see
      // MIGRATION_MARKER_KEYS for why these have to move together with it.
      for (const marker of keys.migrationMarkers) localStorage.setItem(marker, 'true');
    },
    {
      ...payload,
      keys: {
        heroes: HEROES_KEY,
        active: ACTIVE_KEY,
        account: ACCOUNT_KEY,
        inventory: INVENTORY_KEY,
        lang: LANG_KEY,
        guideHidden: GUIDE_HIDDEN_KEY,
        referralNoticeHidden: REFERRAL_NOTICE_HIDDEN_KEY,
        phasesView: PHASES_VIEW_KEY,
        migrationMarkers: [...MIGRATION_MARKER_KEYS],
      },
    },
  );
}

/**
 * The roster the board is for: birth rolls, ability pools and gear that actually differ.
 *
 * `importedRoster` cannot serve here and is deliberately left alone. Its heroes carry no `birth`
 * and no `statRanges`, so `rollQualityFor` places nothing on any of them — every roll bar is empty
 * and the roll sort has nothing to order by, which would make a green spec about a board that is
 * showing dashes. Every perf and visual baseline is expressed against that roster too.
 *
 * The eight windows are the game's own published ranks for a common hero, in planner units
 * (`saveSheetUnits`: crit chance, CDR and luck are percent, crit damage is percent ABOVE ×1).
 * The three heroes are placed high, middle and low inside them on purpose, so "best roll first"
 * has a visible answer and reversing the direction visibly reverses it.
 */
const COMMON_BIRTH_WINDOWS: NonNullable<HeroRecord['statRanges']> = {
  attack: { min: 150, max: 200 },
  energy: { min: 140, max: 240 },
  speed: { min: 48.5, max: 53.5 },
  penetration: { min: 1, max: 4 },
  critChance: { min: 4, max: 10 },
  critDmg: { min: 50, max: 80 },
  cdr: { min: 1, max: 4 },
  luck: { min: 2, max: 10 },
};

/** A birth roll placed at one fraction of every window — 1 is the top of each, 0 the floor. */
function birthAt(fraction: number): NonNullable<HeroRecord['birth']> {
  const at = (key: keyof typeof COMMON_BIRTH_WINDOWS) => {
    const band = COMMON_BIRTH_WINDOWS[key];
    if (band === undefined) throw new Error(`no window for ${key}`);
    return band.min + (band.max - band.min) * fraction;
  };
  return {
    attack: at('attack'),
    energy: at('energy'),
    speed: at('speed'),
    penetration: at('penetration'),
    critChance: at('critChance'),
    critDmg: at('critDmg'),
    cdr: at('cdr'),
    luck: at('luck'),
  };
}

function gear(defPrefix: string, level: number, upgrade: number) {
  const piece = (slot: string) => ({ defId: `${defPrefix}_${slot}`, rarityIdx: 3, level, upgrade });
  return {
    arma: piece('arma'),
    elmo: piece('elmo'),
    anel: piece('anel'),
    amuleto: null,
    peito: piece('peito'),
    calca: piece('calca'),
    luva: null,
    bota: piece('bota'),
  };
}

/**
 * Four heroes whose roll, power, level, rarity, grade and ability pool all order differently, one
 * of them out of the rotation — so a spec can tell each sort key apart from the others, and can
 * see that a shelved hero is drawn muted rather than dropped.
 */
export const rosterBoard: SeededState = {
  ...importedRoster,
  heroes: [
    hero({
      id: 'board-ayla',
      name: 'Ayla',
      level: 80,
      stars: 3,
      rank: 'S',
      rarity: 'Épico',
      sourceId: '3001',
      power: 91250,
      birth: birthAt(0.9),
      statRanges: COMMON_BIRTH_WINDOWS,
      loadout: gear('ember', 220, 8),
      abilities: { olho_clinico: 20, ponta_diamante: 12, misericordia: 6 },
    }),
    hero({
      id: 'board-doran',
      name: 'Doran',
      level: 62,
      stars: 1,
      rank: 'B',
      rarity: 'Raro',
      sourceId: '3002',
      power: 41800,
      birth: birthAt(0.5),
      statRanges: COMMON_BIRTH_WINDOWS,
      loadout: gear('gold', 150, 3),
      abilities: { detonacao_dupla: 15, marcha_acelerada: 4 },
    }),
    hero({
      id: 'board-nessa',
      name: 'Nessa',
      level: 95,
      stars: 0,
      rank: 'D',
      rarity: 'Comum',
      sourceId: '3003',
      power: 12400,
      birth: birthAt(0.15),
      statRanges: COMMON_BIRTH_WINDOWS,
      loadout: gear('coal', 90, 0),
      abilities: { contra_relogio: 8 },
    }),
    hero({
      id: 'board-shelved',
      name: 'Torvin',
      level: 40,
      stars: 2,
      rank: 'A',
      rarity: 'Raro',
      sourceId: '3004',
      power: 25600,
      battleAllowed: false,
      birth: birthAt(0.7),
      statRanges: COMMON_BIRTH_WINDOWS,
      loadout: gear('gold', 120, 5),
      abilities: { explosao_ampla: 10 },
    }),
  ],
  activeHeroId: 'board-doran',
};

/** Pick a seeded hero via the hero strip picker dialog. */
export async function selectSavedHero(page: Page, name: string) {
  const heroStrip = page.getByRole('region', { name: /herói atual|current hero/i });
  await expect(heroStrip).toBeVisible();
  await heroStrip.getByRole('button', { name: /trocar herói|switch hero/i }).click();
  const picker = page.getByRole('dialog', { name: /trocar herói|switch hero/i });
  await expect(picker).toBeVisible();
  // Heroes are clickable <tr> rows, not buttons. Click the avatar rather than
  // the row centre: that can land in the gear / ability columns, whose icon
  // buttons stopPropagation, so the row's own onClick never fires.
  const row = picker.getByRole('row', { name: new RegExp(name, 'i') });
  await row.getByRole('img', { name }).click();
  await expect(picker).toBeHidden();
  await expect(heroStrip.getByText(name)).toBeVisible();
}

/**
 * Navigate to the Account page through the site nav — the affordance a real user has, so a
 * broken nav link fails these specs rather than being routed around by a direct `goto`.
 */
export async function gotoAccountPage(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: /^account$|^conta$/i }).click();
  await expect(page).toHaveURL(/\/account/);
}

/**
 * Roster-scaling probe. Same active hero and account as `importedRoster`,
 * padded to 30 heroes so a perf capture can answer whether render counts scale with
 * roster size or are flat.
 *
 * `importedRoster` is deliberately left untouched — every existing baseline (W1, W5, W8,
 * and the `prod-profile` baseline) is expressed against it, and changing it would
 * invalidate all of them.
 */
export const largeRoster: SeededState = {
  ...importedRoster,
  heroes: [
    ...importedRoster.heroes,
    ...Array.from({ length: 27 }, (_, index) =>
      hero({
        id: `seed-bulk-${index}`,
        name: `Bulk ${String(index).padStart(2, '0')}`,
        level: 20 + (index % 40),
        stars: index % 4,
        rank: ['S', 'A', 'B', 'C', 'D'][index % 5],
        rarity: index % 2 === 0 ? 'Raro' : 'Épico',
        sourceId: `2${String(index).padStart(3, '0')}`,
        power: 1000 + index * 137,
      }),
    ),
  ],
};
