import { expect, type Page } from '@playwright/test';
import type { AccountShared, HeroRecord } from '../../src/shared/lib/storage';

/** Keys mirror `src/shared/lib/storage.ts` + i18n/guide chrome — keep in sync. */
const HEROES_KEY = 'bf-hp-heroes-v1';
const ACTIVE_KEY = 'bf-hp-active-hero-v1';
const ACCOUNT_KEY = 'bf-hp-account-v1';
const LANG_KEY = 'bf_lang';
const GUIDE_HIDDEN_KEY = 'bf_guide_hidden';

export type SeededState = {
  heroes: HeroRecord[];
  activeHeroId?: string;
  account?: AccountShared;
  lang?: 'pt' | 'en';
  /** When true (default), suppress the first-run guide overlay. */
  guideHidden?: boolean;
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
      glassCannon: false,
      tempoDobrado: false,
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
    lang: state.lang ?? 'pt',
    // Default hide guide; only show when guideHidden is explicitly false.
    guideHidden: state.guideHidden !== false,
  };

  await page.addInitScript(
    ({ heroes, activeHeroId, account, lang, guideHidden, keys }) => {
      localStorage.setItem(keys.heroes, JSON.stringify(heroes));
      if (activeHeroId) localStorage.setItem(keys.active, activeHeroId);
      else localStorage.removeItem(keys.active);
      if (account) localStorage.setItem(keys.account, JSON.stringify(account));
      else localStorage.removeItem(keys.account);
      localStorage.setItem(keys.lang, lang);
      localStorage.setItem(keys.guideHidden, guideHidden ? '1' : '0');
    },
    {
      ...payload,
      keys: {
        heroes: HEROES_KEY,
        active: ACTIVE_KEY,
        account: ACCOUNT_KEY,
        lang: LANG_KEY,
        guideHidden: GUIDE_HIDDEN_KEY,
      },
    },
  );
}

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
 * Roster-scaling probe for `RES-06`. Same active hero and account as `importedRoster`,
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
