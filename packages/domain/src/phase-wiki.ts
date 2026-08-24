import wiki from './data/phase-wiki.json';
import phaseMapNamesEn from './data/phase-map-names-en.json';

export type WikiPhaseLine = (typeof wiki.lines)[number];
export type WikiProp = (typeof wiki.props)[number];
export type ItemLevelBand = (typeof wiki.itemPorFase)[number];

export const WIKI_PHASE_LINES: WikiPhaseLine[] = wiki.lines;
export const WIKI_PROPS: WikiProp[] = wiki.props;
export const PROPS_POR_ATO: number[] = wiki.propsPorAto;
export const BOSS_HP_MULT_WIKI = wiki.bossHpMult;
export const REP_HP_MULT = wiki.repHpMult;

/**
 * `JAULA`'s shape is **breaking** as of the re-emitted wiki bundle: the wiki no longer reports a
 * per-phase early-arrival ramp (`adiantaProbIni`/`adiantaProbMax`) or a per-difficulty window
 * array (`janelaSecsPorAto`). It now reports a flat per-difficulty early-arrival probability and
 * a single (non-VIP / VIP) guaranteed window. `jaulaEarlyCap()` below keeps its name and
 * signature; its body is now a difficulty lookup instead of a per-phase interpolation.
 */
export type WikiJaula = {
  /** [ato-1] early-arrival probability. Live [0.05,0.1,0.15,0.2,0.25]. Replaces the removed
   *  adiantaProbIni/adiantaProbMax per-phase ramp. */
  adiantaProbPorAto: readonly number[];
  /** Guaranteed window, seconds. Live 12600. Replaces janelaSecsPorAto. */
  janelaSecs: number;
  /** VIP guaranteed window, seconds. Live 10800. */
  janelaSecsVip: number;
  hpMult: number;
};
export const JAULA: WikiJaula = wiki.jaula;

export const HERO_CHEST_RARITY_BY_ATO = wiki.heroChestRarityByAto;
export const CHEST_RARITY_DIST = wiki.chestRarityDist;
/**
 * Item-level drop bands — which item levels can roll on a given phase.
 *
 * ← `herois.item_por_fase` (`fase_min`/`fase_max`/`item` → `min`/`max`/`itemLevel`). The section
 * is the surprise here and worth stating once: this table lives under **`herois`, not `itens`** —
 * `itens` carries the item catalog. Looking for it under `itens` finds nothing and invites the
 * wrong conclusion that the key is unsourced. Drift coverage is intact; it rides `data.herois`.
 *
 * **Re-cut by the 2026-08-15 game update**, from 9 bands topping out at item level 90 to 30 bands
 * running 10…300 in steps of 10 — the same ladder that patch gave `itens.niveis`. The committed
 * bundle predated the patch and kept answering the old table, which is the defect this data fixes:
 * it under-reported the drop level from the mid-20s of the phase range onward.
 *
 * Closed form, worth pinning because it makes a partial hand-edit obvious: `min = 20k − 19`,
 * `max = min(600, 20k + 10)`, `itemLevel = 10k` for k = 1…30. Only the last row is clamped — k=30
 * would otherwise run to 610, past the game's phase-600 ceiling.
 *
 * Bands OVERLAP by ten phases, which is the mechanic and not an emit error: on a phase inside an
 * overlap either of two tiers can roll. {@link itemLevelsForPhase} returns both.
 *
 * `tests/item-por-fase.test.ts` pins all thirty rows against that closed form, plus two in-game
 * stage tooltips captured 2026-08-18 (a capture held out of band, not in this repo) reading
 * "Stage item: Level 30" on phases 51 and 60.
 */
export const ITEM_POR_FASE: ItemLevelBand[] = wiki.itemPorFase;
export const XP_FASE_INI = wiki.xpFaseIni;
export const XP_FASE_FIM = wiki.xpFaseFim;
export const GATE_SECS_POR_ATO = wiki.gateSecsPorAto;
export const ATO_LABELS: string[] = wiki.atoLabels;
export const PHASE_NAMES: string[] = wiki.phaseNames;
export const PHASE_MAP_NAMES_EN: string[] = phaseMapNamesEn;
/** fases-nomes suffix per ato (ato 1 has none). Full in-game names append these in PT. */
export const PHASE_NAME_SUFFIXES = ['', ' (Nightmare)', ' (Hell)', ' (Torment)', ' (Inferno)'] as const;
export const WIKI_SYNCED_AT = wiki.syncedAt;
/** ISO timestamp of the wiki pull the bundle was emitted from (`manifest.json.synced_at`). */
export const WIKI_SOURCE_PULLED_AT: string = wiki.sourcePulledAt;
/** `YYYY-MM-DD` — the date the emitter ran. May be later than the pull date (stale-input emit). */
export const WIKI_EMITTED_AT: string = wiki.emittedAt;

/** Per-prop drop fractions, all five in one object because FR-3 reads them together.
 *  Sourced from the bundle's `drops` block:
 *    chest ← `drops.chestDropRate`       0.001    — item/hero chest, ANY phase
 *    key   ← `drops.keyDropRate`         0.001    — ready key, NON-gate phases only
 *    gem   ← `drops.gemChestDropRate`    0.00005  — gem chest, GATE phases only
 *    time  ← `drops.timechestDropRate`   0.001    — time chest, GATE phases only
 *                                                   (api source is `rotacao`, not `drops`)
 *    stone ← `drops.stoneChestDropRate`  0.0005   — stone chest, GATE phases only
 *                                                   (live wiki key `pedra.drop_rate`; raised
 *                                                   tenfold from 0.00005 by the 2026-08-23
 *                                                   patch, so it is no longer the gem rate) */
export type DropRates = { chest: number; key: number; gem: number; time: number; stone: number };
export const DROP_RATES: DropRates = {
  chest: wiki.drops.chestDropRate,
  key: wiki.drops.keyDropRate,
  gem: wiki.drops.gemChestDropRate,
  time: wiki.drops.timechestDropRate,
  stone: wiki.drops.stoneChestDropRate,
};

/** Stable id for one drop-rate row — shared by {@link DROP_RATES}, {@link dropAppliesOnPhase},
 *  and `phase-intel.ts`'s `DropChanceRow`. Order here is the display order (chest, key, time,
 *  gem, stone), not `DropRates`' declaration order. */
export type DropRateId = 'chest' | 'key' | 'time' | 'gem' | 'stone';

/**
 * Whether this drop applies on a gate vs. non-gate phase. Item chest rolls on every phase; the
 * ready key only rolls on non-gate phases; time chest, gem chest, and stone chest only roll on
 * gate phases. One definition so the domain and its tests (and, downstream, the UI) agree on the
 * gate/non-gate split instead of each re-deriving it.
 */
export function dropAppliesOnPhase(id: DropRateId, gate: boolean): boolean {
  switch (id) {
    case 'chest':
      return true;
    case 'key':
      return !gate;
    case 'time':
    case 'gem':
    case 'stone':
      return gate;
    default:
      return true;
  }
}

/** Keys spent to enter one gate. Live 1. ← `drops.keyGateCost` */
export const KEY_GATE_COST: number = wiki.drops.keyGateCost;
/** Return Bonus, non-VIP. Live 0.4. ← `drops.bonusAdd` */
export const RETURN_BONUS_ADD: number = wiki.drops.bonusAdd;
/** Return Bonus, VIP. Live 0.8. ← `drops.bonusAddVip` */
export const RETURN_BONUS_ADD_VIP: number = wiki.drops.bonusAddVip;
/** Banked offline seconds cap. Live 28800. ← `drops.bonusCapSecs` */
export const RETURN_BONUS_CAP_SECS: number = wiki.drops.bonusCapSecs;

/** [ato-1][rarityIndex 0..5] — time-chest rarity. 5 rows × 6 columns, each row sums to 1. */
export const TIMECHEST_RARITY_BY_ATO: readonly (readonly number[])[] = wiki.timechestRarityByAto;

export type WikiGem = {
  /** e.g. `gem_emerald` — joins wiki art and the save's gem ids. */
  defId: string;
  /** English display name as the API ships it, e.g. `Emerald`. */
  name: string;
  /** 1..3 */
  rank: number;
  /** rarity index 0..5 (rank 1 → 2 Raro, rank 2 → 3 Épico, rank 3 → 4 Lendária). */
  rarity: number;
};

export type WikiGems = {
  /** Second witness of `DROP_RATES.gem`; guard asserts equality. */
  chestDropRate: number;
  /** Stones per rank. Live 3. P(one stone | rank) = 1 / perRank — UNIFORM. */
  perRank: number;
  rankDistByAto: readonly (readonly number[])[];
  list: readonly WikiGem[];
};
export const WIKI_GEMS: WikiGems = wiki.gems;

/** [ato-1][rank-1] — P(rank | gem chest), per difficulty. 5 rows × 3 columns, each row sums to 1.
 *  Alias of `WIKI_GEMS.rankDistByAto`, exported flat because it is the term FR-3 reads. */
export const GEM_RANK_DIST_BY_ATO: readonly (readonly number[])[] = WIKI_GEMS.rankDistByAto;

/** Alias of `WIKI_GEMS.list`. */
export const GEM_LIST: readonly WikiGem[] = WIKI_GEMS.list;

export type LootAbilityCode = 'veia_ouro' | 'fortuna' | 'olho_lapidador';

export type LootAbilityValue = {
  /** Wiki effect kind verbatim: `gold_self` | `team_gold` | `chest_upgrade`. */
  kind: string;
  /** Fraction per level. 0.02 = +2%/level. */
  perLevel: number;
  /**
   * `max` is the **LEVEL cap**, not the effect cap — it is the API's own key name
   * (`habilidades[].max`), kept verbatim so the export and the payload agree.
   * At-max effect = `perLevel * max`:
   *   veia_ouro 0.02 × 20 = +40%   ·   fortuna 0.005 × 20 = +10%
   * Both reproduce the PRD's independently-stated at-max values, and a domain test asserts
   * the products so a future `max` semantics change cannot pass silently.
   */
  max: number;
};

/** Keyed by the wiki `code`, which is the same id `model/abilities.ts` uses, so a hero's
 *  ability level joins without a mapping table. `code` is the key, not a field. The bundle JSON
 *  keeps calling the cap `maxLevel` — this is the one translation point between the two
 *  vocabularies; do not add a second one. */
export const LOOT_ABILITY_VALUES: Readonly<Record<LootAbilityCode, LootAbilityValue>> = {
  veia_ouro: {
    kind: wiki.lootAbilities.veia_ouro.kind,
    perLevel: wiki.lootAbilities.veia_ouro.perLevel,
    max: wiki.lootAbilities.veia_ouro.maxLevel,
  },
  fortuna: {
    kind: wiki.lootAbilities.fortuna.kind,
    perLevel: wiki.lootAbilities.fortuna.perLevel,
    max: wiki.lootAbilities.fortuna.maxLevel,
  },
  olho_lapidador: {
    kind: wiki.lootAbilities.olho_lapidador.kind,
    perLevel: wiki.lootAbilities.olho_lapidador.perLevel,
    max: wiki.lootAbilities.olho_lapidador.maxLevel,
  },
};

const MAX_PHASE = 600;

export function wikiPhaseLine(phase: number): WikiPhaseLine | undefined {
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  return WIKI_PHASE_LINES[clampedPhase - 1];
}

/** Game UI difficulty labels (ato 1–5) — not fases-nomes suffix names. */
export const GAME_DIFFICULTY_EN = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Inferno'] as const;
export const GAME_DIFFICULTY_PT = ['Fácil', 'Normal', 'Difícil', 'Muito Difícil', 'Inferno'] as const;

export type PhaseMapOption = {
  phase: number;
  mundo: number;
  subIndex: number;
  /** In-game map coordinate within the difficulty, e.g. `2-1`. */
  coord: string;
  /** Flavor name — base name only (difficulty is a separate picker). */
  name: string;
};

const PHASE_NAME_COUNT = PHASE_NAMES.length;

/** Base map flavor name for UI (no difficulty suffix). EN names are provisional. */
export function phaseMapDisplayName(phase: number, lang: 'en' | 'pt'): string {
  const baseIdx = (Math.max(1, Math.min(MAX_PHASE, Math.round(phase))) - 1) % PHASE_NAME_COUNT;
  if (lang === 'pt') return PHASE_NAMES[baseIdx] ?? `Fase ${phase}`;
  return PHASE_MAP_NAMES_EN[baseIdx] ?? PHASE_NAMES[baseIdx] ?? `Phase ${phase}`;
}

/** Full in-game flavor name including fases-nomes difficulty suffix. */
export function phaseMapFullName(phase: number, lang: 'en' | 'pt'): string {
  const line = wikiPhaseLine(phase);
  const base = phaseMapDisplayName(phase, lang);
  if (!line || line.ato <= 1) return base;
  const suffix = PHASE_NAME_SUFFIXES[line.ato - 1] ?? '';
  return `${base}${suffix}`;
}

export function formatMapOptionLabel(row: PhaseMapOption): string {
  return `${row.coord} · ${row.name}`;
}

export function gameDifficultyLabel(ato: number, lang: 'en' | 'pt'): string {
  const labels = lang === 'pt' ? GAME_DIFFICULTY_PT : GAME_DIFFICULTY_EN;
  return labels[Math.max(0, Math.min(4, Math.round(ato) - 1))] ?? String(ato);
}

/** All wiki phases for one difficulty band (ato 1–5), in phase order. */
export function listMapsForAto(ato: number, lang: 'en' | 'pt' = 'en'): PhaseMapOption[] {
  const band = Math.max(1, Math.min(5, Math.round(ato)));
  const options: PhaseMapOption[] = [];
  // MOD-36: loop counter — scans every wiki phase line to collect this ato's maps.
  for (let phaseCursor = 1; phaseCursor <= MAX_PHASE; phaseCursor++) {
    const line = wikiPhaseLine(phaseCursor);
    if (!line || line.ato !== band) continue;
    const subIndex = phaseSubIndex(phaseCursor);
    options.push({
      phase: line.phase,
      mundo: line.mundo,
      subIndex,
      coord: `${line.mundo}-${subIndex}`,
      name: phaseMapDisplayName(line.phase, lang),
    });
  }
  return options;
}

export function firstPhaseForAto(ato: number): number {
  return listMapsForAto(ato)[0]?.phase ?? 1;
}

/** Resolve wiki phase from difficulty + in-game map coordinate. */
export function phaseForMapCoord(ato: number, mundo: number, subIndex: number): number | null {
  const match = listMapsForAto(ato).find(
    (row) => row.mundo === mundo && row.subIndex === subIndex,
  );
  return match?.phase ?? null;
}

export function phaseMapCoord(phase: number): { ato: number; mundo: number; subIndex: number } | null {
  const line = wikiPhaseLine(phase);
  if (!line) return null;
  return { ato: line.ato, mundo: line.mundo, subIndex: phaseSubIndex(phase) };
}

/** 1-based index of this phase within its (ato, mundo) band — e.g. 65 → 15, 151 → 1. */
export function phaseSubIndex(phase: number): number {
  const line = wikiPhaseLine(phase);
  if (!line) return phase;
  // MOD-36: genuine accumulator — counts prior phases sharing this (ato, mundo) band.
  let index = 0;
  for (let phaseCursor = 1; phaseCursor <= phase; phaseCursor++) {
    const row = wikiPhaseLine(phaseCursor);
    if (row && row.ato === line.ato && row.mundo === line.mundo) index++;
  }
  return index;
}

/** Coordinate only, e.g. `Hard 1-1`. */
export function formatPhaseCoord(phase: number, lang: 'en' | 'pt'): string {
  const line = wikiPhaseLine(phase);
  if (!line) return String(phase);
  const labels = lang === 'pt' ? GAME_DIFFICULTY_PT : GAME_DIFFICULTY_EN;
  const diff = labels[line.ato - 1] ?? String(line.ato);
  return `${diff} ${line.mundo}-${phaseSubIndex(phase)}`;
}

/** Display label aligned with in-game coordinates, e.g. `Hard 1-1 (151)`. */
export function formatPhaseLabel(phase: number, lang: 'en' | 'pt'): string {
  return `${formatPhaseCoord(phase, lang)} (${phase})`;
}

/** @deprecated Wiki flavor name — prefer {@link phaseMapDisplayName} for UI. */
export function phaseName(phase: number): string {
  return phaseMapFullName(phase, 'pt');
}

export function propCountForAto(ato: number): number {
  const index = Math.max(1, Math.min(5, Math.round(ato))) - 1;
  return PROPS_POR_ATO[index] ?? PROPS_POR_ATO[0];
}

/**
 * XP per prop kill. Every one of the 600 wiki phase lines carries its own exact integer
 * `xpProp` — that is what the game actually awards, so it is returned verbatim here. The linear
 * `XP_FASE_INI`(phase 1) → `XP_FASE_FIM`(phase 600) interpolation below is now only a fallback
 * for a phase with no line (out of the wiki's 1..600 range); it is a documented approximation
 * (worst deviation ~0.5 XP at phase 21) and must not shadow the exact per-line value.
 */
export function xpPerProp(phase: number): number {
  const line = wikiPhaseLine(phase);
  if (line) return line.xpProp;
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  const progress = (clampedPhase - 1) / (MAX_PHASE - 1);
  return XP_FASE_INI + progress * (XP_FASE_FIM - XP_FASE_INI);
}

/** Item level tiers that can roll on this phase (overlapping bands). */
export function itemLevelsForPhase(phase: number): number[] {
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  const levels = ITEM_POR_FASE.filter((band) => clampedPhase >= band.min && clampedPhase <= band.max).map((band) => band.itemLevel);
  return [...new Set(levels)].sort((left, right) => left - right);
}

/** Human label e.g. "level 40–60" or "level 60" when single tier. */
export function itemLevelDropLabel(levels: number[]): string {
  if (levels.length === 0) return '';
  if (levels.length === 1) return String(levels[0]);
  return `${levels[0]}–${levels[levels.length - 1]}`;
}

/**
 * Jaula early-arrival cap at this phase (0..1).
 *
 * The wiki removed the per-phase ramp (`adiantaProbIni`/`adiantaProbMax`) this used to
 * interpolate across — `entidades.jaula` now reports one flat value per difficulty (`ato`)
 * instead. The name and signature are unchanged; the body is now a difficulty lookup, clamped
 * exactly as `propCountForAto` clamps its `ato` index so an out-of-range phase still returns a
 * finite number rather than `NaN`/`undefined`.
 */
export function jaulaEarlyCap(phase: number): number {
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  const line = wikiPhaseLine(clampedPhase);
  const ato = line?.ato ?? 1;
  const atoIndex = Math.max(0, Math.min(JAULA.adiantaProbPorAto.length - 1, ato - 1));
  return JAULA.adiantaProbPorAto[atoIndex] ?? JAULA.adiantaProbPorAto[0];
}

/** Gold multiplier vs Comum for prop rarity index (live-validated formula). */
export function goldRarityMult(rarityIndex: number): number {
  return 1 + 0.4 * rarityIndex;
}

const RARITY_LABELS_EN = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
const RARITY_LABELS_PT = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'] as const;

export function rarityLabel(index: number, lang: 'en' | 'pt'): string {
  const labels = lang === 'pt' ? RARITY_LABELS_PT : RARITY_LABELS_EN;
  return labels[Math.max(0, Math.min(5, index))] ?? labels[0];
}
