import { mitigationFactor, critFactor } from './model';
import { propHp, weightedAvgPropHp, hitsToKill, PROPS } from './phases';
import {
  wikiPhaseLine,
  WIKI_PROPS,
  propCountForAto,
  xpPerProp,
  itemLevelsForPhase,
  itemLevelDropLabel,
  jaulaEarlyCap,
  goldRarityMult,
  GATE_SECS_POR_ATO,
  ATO_LABELS,
  BOSS_HP_MULT_WIKI,
  HERO_CHEST_RARITY_BY_ATO,
  JAULA,
  DROP_RATES,
  dropAppliesOnPhase,
  type WikiProp,
  type DropRateId,
} from './phase-wiki';

export type PropSpawnRow = WikiProp & {
  hp: number;
  weightShare: number;
  goldWiki: number;
  goldActual: number;
};

/** One drop-rate row: wiki base fraction, the luck-scaled actual fraction, and whether it rolls
 *  on this phase (gate vs. non-gate — see {@link dropAppliesOnPhase}). Emitted in a fixed order
 *  (chest, key, time, gem, stone) regardless of `applies`, so the UI owns presentation/filtering. */
export type DropChanceRow = {
  id: DropRateId;
  wiki: number;
  actual: number;
  applies: boolean;
};

/** Options for {@link computePhaseIntelGlobal}, all defaulting to the identity (no boost). */
export type PhaseIntelGlobalOptions = {
  /** Team Coin %, e.g. `82.52` for `coin_add: 0.8252083332`. Default 0. */
  teamCoinPct?: number;
  /** `skills.totals.xp_mult`, e.g. `1.56`. Default 1 (no XP boost). */
  xpMult?: number;
  /** Average of on-field heroes' final `luck` stat, e.g. `0.1723005`. Default 0 (no luck boost).
   *  Stays the SOLE input to `dropChances[].actual` — {@link treeLuckFlatPct} and
   *  {@link squadLuckPct} below are display-only echoes and never feed this math, so a caller
   *  that only ever knew the combined figure keeps working unchanged. */
  luckFraction?: number;
  /**
   * `account.tree.luckFlatPct`, PERCENTAGE POINTS, e.g. `20` for the skill tree's flat Sorte
   * add — `farm-rate.ts`'s `treeLuckFlatPct` idea, echoed here purely so the Drops panel can show
   * WHERE a boost came from. Default 0. Does not affect `dropChances[].actual`; see
   * {@link luckFraction}. Together with {@link squadLuckPct} it is expected to sum to
   * `luckFraction * 100` when a caller supplies both — the caller owns keeping that consistent
   * (see `phases-explorer.tsx`), this module only echoes what it is given.
   */
  treeLuckFlatPct?: number;
  /**
   * Uptime/DPS-weighted average of on-field heroes' OWN Sorte, PERCENTAGE POINTS, with the tree's
   * flat share already peeled out — `farm-rate.ts`'s `heroLuckPct` idea, applied to whatever squad
   * the caller ranked. Echoed alongside {@link treeLuckFlatPct} for the same display-only reason.
   * Default 0.
   */
  squadLuckPct?: number;
};

export type PhaseIntelGlobal = {
  phase: number;
  stoneHp: number;
  mitigationPct: number;
  penToZero: number;
  gate: boolean;
  ato: number;
  atoLabel: string;
  propCount: number;
  goldComumWiki: number;
  goldComumActual: number;
  /** @deprecated alias of {@link xpPerPropWiki} — kept so existing readers keep their current
   *  (unboosted) meaning. New code should pick `xpPerPropWiki` or `xpPerPropActual` explicitly. */
  xpPerProp: number;
  xpPerPropWiki: number;
  xpPerPropActual: number;
  itemLevels: number[];
  itemLevelLabel: string;
  weightedAvgHp: number;
  totalMapHp: number;
  weightedAvgGoldWiki: number;
  weightedAvgGoldActual: number;
  totalMapGoldWiki: number;
  totalMapGoldActual: number;
  bossHp: number;
  jaulaHp: number;
  gateTimerSecs: number | null;
  jaulaEarlyCapPct: number;
  jaulaWindowSecs: number;
  heroChestRarity: number[];
  propRows: PropSpawnRow[];
  dropChances: DropChanceRow[];
  /** Echo of {@link PhaseIntelGlobalOptions.treeLuckFlatPct} — display-only, see there. */
  treeLuckFlatPct: number;
  /** Echo of {@link PhaseIntelGlobalOptions.squadLuckPct} — display-only, see there. */
  squadLuckPct: number;
};

export function penGap(mitigationPct: number, penetrationPct: number): number {
  return Math.max(0, mitigationPct - penetrationPct);
}

export function computePropSpawnRows(
  stoneHp: number,
  goldComumWiki: number,
  teamCoinMult: number,
): PropSpawnRow[] {
  const totalWeight = WIKI_PROPS.reduce((sum, prop) => sum + prop.weight, 0);
  return WIKI_PROPS.map((prop) => {
    const share = prop.weight / totalWeight;
    const goldWiki = goldComumWiki * goldRarityMult(prop.rarity);
    const goldActual = goldWiki * teamCoinMult;
    return {
      ...prop,
      hp: propHp(stoneHp, prop.hpMult),
      weightShare: share,
      goldWiki,
      goldActual,
    };
  });
}

export function weightedAvgGold(
  rows: PropSpawnRow[],
  field: 'goldWiki' | 'goldActual',
): number {
  return rows.reduce((sum, row) => sum + row[field] * row.weightShare, 0);
}

const DROP_CHANCE_ORDER: DropRateId[] = ['chest', 'key', 'time', 'gem', 'stone'];

function computeDropChances(gate: boolean, luckFraction: number): DropChanceRow[] {
  const luckMult = 1 + Math.max(0, luckFraction);
  return DROP_CHANCE_ORDER.map((id) => {
    const wiki = DROP_RATES[id];
    return {
      id,
      wiki,
      actual: wiki * luckMult,
      applies: dropAppliesOnPhase(id, gate),
    };
  });
}

export function computePhaseIntelGlobal(
  phase: number,
  options: PhaseIntelGlobalOptions = {},
): PhaseIntelGlobal | null {
  const {
    teamCoinPct = 0,
    xpMult = 1,
    luckFraction = 0,
    treeLuckFlatPct = 0,
    squadLuckPct = 0,
  } = options;
  const line = wikiPhaseLine(phase);
  if (!line) return null;

  const stoneHp = line.hp;
  const mitigationPct = line.mitig * 100;
  const teamCoinMult = 1 + Math.max(0, teamCoinPct) / 100;
  const goldComumWiki = line.goldComum;
  const goldComumActual = goldComumWiki * teamCoinMult;
  const propCount = propCountForAto(line.ato);
  const weightedAvgHp = weightedAvgPropHp(stoneHp);
  const propRows = computePropSpawnRows(stoneHp, goldComumWiki, teamCoinMult);
  const weightedAvgGoldWiki = weightedAvgGold(propRows, 'goldWiki');
  const weightedAvgGoldActual = weightedAvgGold(propRows, 'goldActual');
  const itemLevels = itemLevelsForPhase(phase);
  const atoIdx = Math.max(0, Math.min(4, line.ato - 1));
  const xpPerPropWiki = xpPerProp(phase);
  const xpPerPropActual = xpPerPropWiki * xpMult;

  return {
    phase: line.phase,
    stoneHp,
    mitigationPct,
    penToZero: mitigationPct,
    gate: line.gate,
    ato: line.ato,
    atoLabel: ATO_LABELS[atoIdx] ?? `Ato ${line.ato}`,
    propCount,
    goldComumWiki,
    goldComumActual,
    xpPerProp: xpPerPropWiki,
    xpPerPropWiki,
    xpPerPropActual,
    itemLevels,
    itemLevelLabel: itemLevelDropLabel(itemLevels),
    weightedAvgHp,
    totalMapHp: propCount * weightedAvgHp,
    weightedAvgGoldWiki,
    weightedAvgGoldActual,
    totalMapGoldWiki: propCount * weightedAvgGoldWiki,
    totalMapGoldActual: propCount * weightedAvgGoldActual,
    bossHp: propHp(stoneHp, BOSS_HP_MULT_WIKI),
    jaulaHp: propHp(stoneHp, BOSS_HP_MULT_WIKI),
    gateTimerSecs: line.gate ? GATE_SECS_POR_ATO[atoIdx] ?? null : null,
    jaulaEarlyCapPct: jaulaEarlyCap(phase) * 100,
    // `JAULA.janelaSecs` is the non-VIP guaranteed window — no longer per-difficulty (the wiki
    // dropped `janelaSecsPorAto`). `JAULA.janelaSecsVip` exists but is intentionally not wired
    // in here; the VIP toggle is a UI concern (item C).
    jaulaWindowSecs: JAULA.janelaSecs,
    heroChestRarity: HERO_CHEST_RARITY_BY_ATO[atoIdx] ?? HERO_CHEST_RARITY_BY_ATO[0],
    propRows,
    dropChances: computeDropChances(line.gate, luckFraction),
    treeLuckFlatPct,
    squadLuckPct,
  };
}

export type HeroPhaseFit = {
  heroId: string;
  heroName: string;
  penetration: number;
  penGap: number;
  penOk: boolean;
  avgHit: number;
  propHits: { name: string; hp: number; hits: number }[];
};

export function computeHeroPhaseFit(
  heroId: string,
  heroName: string,
  stoneHp: number,
  mitigationPct: number,
  penetration: number,
  avgHit: number,
): HeroPhaseFit {
  const penGapVal = penGap(mitigationPct, penetration);
  const propHits = PROPS.map((prop) => {
    const hitPoints = propHp(stoneHp, prop.hpMult);
    return { name: prop.name, hp: hitPoints, hits: hitsToKill(avgHit, hitPoints) };
  });
  return {
    heroId,
    heroName,
    penetration,
    penGap: penGapVal,
    penOk: penGapVal <= 0,
    avgHit,
    propHits,
  };
}

/** Estimate map clear seconds from squad sustained DPS (mid-map model). */
export function estimateClearSeconds(totalMapHp: number, squadDps: number): number | null {
  if (squadDps <= 0 || !Number.isFinite(squadDps)) return null;
  return totalMapHp / squadDps;
}

export { critFactor, mitigationFactor, hitsToKill, propHp };
