import { mitigationFactor, critFactor } from '@/shared/domain/model';
import { propHp, weightedAvgPropHp, hitsToKill, PROPS } from '@/shared/domain/phases';
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
  type WikiProp,
} from '@/shared/domain/phase-wiki';

export type PropSpawnRow = WikiProp & {
  hp: number;
  weightShare: number;
  goldWiki: number;
  goldActual: number;
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
  xpPerProp: number;
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

export function computePhaseIntelGlobal(
  phase: number,
  teamCoinPct: number,
): PhaseIntelGlobal | null {
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
    xpPerProp: xpPerProp(phase),
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
    jaulaWindowSecs: JAULA.janelaSecsPorAto[atoIdx] ?? JAULA.janelaSecsPorAto[0],
    heroChestRarity: HERO_CHEST_RARITY_BY_ATO[atoIdx] ?? HERO_CHEST_RARITY_BY_ATO[0],
    propRows,
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
