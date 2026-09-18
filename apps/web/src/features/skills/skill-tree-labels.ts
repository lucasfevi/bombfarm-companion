/**
 * Every string and formatter the shared skill-tree screen asks for, built from this app's own copy
 * layer. `@bombfarm/account/skill-tree` takes a label bag and never sees a language, so this module
 * is the whole of the translation — the screen beside it is wiring.
 */
import type { SkillTreeLabels } from '@bombfarm/account/skill-tree';
import type { SkillArm, SkillEffectKind, SkillTier, SkillTotals } from '@bombfarm/domain/skill-tree';
import { formatCompactNumber, formatNumber, formatSignificantCompact } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { formatPhaseLabel } from '@/shared/lib/phase-label';

const MINUS_SIGN = '−';

function signed(magnitude: string, value: number): string {
  return `${value < 0 ? MINUS_SIGN : '+'}${magnitude}`;
}

function signedPercent(fraction: number, lang: Lang): string {
  return signed(`${formatNumber(Math.abs(fraction) * 100, lang, 2)}%`, fraction);
}

function signedCount(count: number): string {
  return signed(String(Math.abs(count)), count);
}

function signedRatePerHour(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  return `${signed(formatCompactNumber(Math.abs(value), lang, 1), value)}/h`;
}

function signedCompact(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  return signed(formatCompactNumber(Math.abs(value), lang, 1), value);
}

function multiplier(value: number, lang: Lang): string {
  return `×${formatNumber(value, lang, 3).replace(/([.,]\d*?)0+$/, '$1').replace(/[.,]$/, '')}`;
}

function armNames(copy: Strings): Record<SkillArm, string> {
  return {
    hub: copy.skillsArmHub,
    dano: copy.skillsArmDano,
    crit: copy.skillsArmCrit,
    velocidade: copy.skillsArmVelocidade,
    ouro: copy.skillsArmOuro,
    drop: copy.skillsArmDrop,
    energia: copy.skillsArmEnergia,
    geo: copy.skillsArmGeo,
    neutro: copy.skillsArmNeutro,
  };
}

function tierNames(copy: Strings): Record<SkillTier, string> {
  return {
    start: copy.skillsTierStart,
    small: copy.skillsTierSmall,
    notavel: copy.skillsTierNotavel,
    unlock: copy.skillsTierUnlock,
  };
}

function kindNames(copy: Strings): Record<SkillEffectKind, string> {
  return {
    team_dmg: copy.skillsKindTeamDmg,
    g_crit_chance: copy.skillsKindCritChance,
    g_crit_dmg: copy.skillsKindCritDmg,
    g_speed: copy.skillsKindSpeed,
    team_coin: copy.skillsKindCoin,
    g_luck: copy.skillsKindLuck,
    team_energia: copy.skillsKindEnergia,
    team_xp: copy.skillsKindXp,
    team_geo: copy.skillsKindGeo,
    vagas_campo: copy.skillsKindFieldSlot,
    bag_tab: copy.skillsKindBagTab,
  };
}

function effectTemplates(copy: Strings): Record<SkillEffectKind, string> {
  return {
    team_dmg: copy.skillsEffectTeamDmg,
    g_crit_chance: copy.skillsEffectCritChance,
    g_crit_dmg: copy.skillsEffectCritDmg,
    g_speed: copy.skillsEffectSpeed,
    team_coin: copy.skillsEffectCoin,
    g_luck: copy.skillsEffectLuck,
    team_energia: copy.skillsEffectEnergia,
    team_xp: copy.skillsEffectXp,
    team_geo: copy.skillsEffectGeo,
    vagas_campo: copy.skillsEffectFieldSlot,
    bag_tab: copy.skillsEffectBagTab,
  };
}

const COUNT_KINDS: ReadonlySet<SkillEffectKind> = new Set(['vagas_campo', 'bag_tab']);

function totalRowNames(copy: Strings): Record<keyof SkillTotals, string> {
  return {
    team_dmg_add: copy.skillsTotalTeamDmg,
    crit_chance_add: copy.skillsTotalCritChance,
    crit_dmg_add: copy.skillsTotalCritDmg,
    speed_add: copy.skillsTotalSpeed,
    coin_add: copy.skillsTotalCoin,
    luck_add: copy.skillsTotalLuck,
    energia_add: copy.skillsTotalEnergia,
    dmg_static: copy.skillsTotalDmgStatic,
    geo_mult: copy.skillsTotalGeo,
    xp_mult: copy.skillsTotalXp,
    vagas_campo: copy.skillsTotalFieldSlots,
    bag_tabs_bonus: copy.skillsTotalBagTabs,
  };
}

export function formatSkillTotal(key: keyof SkillTotals, value: number, lang: Lang): string {
  if (key === 'vagas_campo' || key === 'bag_tabs_bonus') return signedCount(value);
  if (key.endsWith('_add')) return signedPercent(value, lang);
  return multiplier(value, lang);
}

export type SkillsPhaseSource = 'farm' | 'account';

function nodeTitle(copy: Strings, nodeId: string): string | null {
  const key = `skillsNodeTitle${nodeId}`;
  if (!(key in copy)) return null;
  const value = copy[key as keyof Strings];
  return typeof value === 'string' ? value : null;
}

export function skillTreeLabels(copy: Strings, lang: Lang, phaseSource: SkillsPhaseSource = 'farm'): SkillTreeLabels {
  const arms = armNames(copy);
  const tiers = tierNames(copy);
  const kinds = kindNames(copy);
  const effects = effectTemplates(copy);
  const effect = (kind: SkillEffectKind, amount: number) =>
    COUNT_KINDS.has(kind)
      ? sub(effects[kind], { n: signedCount(amount) })
      : sub(effects[kind], { v: signedPercent(amount, lang) });

  return {
    title: copy.skillsTitle,
    tip: copy.skillsTip,
    kindName: (kind) => kinds[kind],
    effectPerLevel: effect,
    effectAtLevel: effect,
    effectValue: (kind, amount) => (COUNT_KINDS.has(kind) ? signedCount(amount) : signedPercent(amount, lang)),
    armName: (arm) => arms[arm],
    tierName: (tier) => tiers[tier],
    level: (level, max) => sub(copy.skillsLevel, { level, max }),
    hubName: copy.skillsHubName,
    hubNote: copy.skillsHubNote,
    nodeName: (nodeId) => nodeTitle(copy, nodeId),

    stateOwned: copy.skillsStateOwned,
    stateMaxed: copy.skillsStateMaxed,
    stateBuyable: copy.skillsStateBuyable,
    stateUnaffordable: copy.skillsStateUnaffordable,
    stateLockedPrerequisite: (parentName, need, have) =>
      sub(copy.skillsStateLockedPrerequisite, { parent: parentName, need, have }),
    stateLockedPhase: (phase) => sub(copy.skillsStateLockedPhase, { phase }),
    alwaysLit: copy.skillsAlwaysLit,

    nextLevelCost: copy.skillsNextLevelCost,
    costToMax: copy.skillsCostToMax,
    refund: copy.skillsRefund,
    refundTip: copy.skillsRefundTip,
    refundBlocked: (childNames) => sub(copy.skillsRefundBlocked, { children: childNames }),
    wallet: copy.skillsWallet,
    gold: (gold) => sub(copy.skillsGoldAmount, { gold: formatNumber(gold, lang, 0) }),
    goldCompact: (gold) => formatCompactNumber(gold, lang, 1),
    compactNumber: (value) => formatSignificantCompact(value, lang),

    nextToBuy: copy.skillsNextToBuy,
    nextToBuyTip: copy.skillsNextToBuyTip,
    objectiveGold: copy.skillsObjectiveGold,
    objectiveGate: copy.skillsObjectiveGate,
    objectivePvp: copy.skillsObjectivePvp,
    colNode: copy.skillsColNode,
    colCost: copy.skillsColCost,
    colGain: copy.skillsColGain,
    colPerMillion: copy.skillsColPerMillion,
    gainGold: (delta) => signedRatePerHour(delta, lang),
    gainDps: (delta) => sub(copy.skillsGainDps, { v: signedCompact(delta, lang) }),
    perMillionGold: (value) => sub(copy.skillsPerMillionGold, { v: signedRatePerHour(value, lang) }),
    perMillionDps: (value) => sub(copy.skillsPerMillionDps, { v: signedCompact(value, lang) }),
    gainOutsideObjectives: copy.skillsGainOutsideObjectives,
    nothingToRecommend: copy.skillsNothingToRecommend,
    pvpEmpty: copy.skillsPvpEmpty,
    pricingUnavailable: copy.skillsPricingUnavailable,
    pricedAtPhase: (phase) =>
      sub(phaseSource === 'farm' ? copy.skillsPricedAtPhase : copy.skillsPricedAtAccountPhase, { phase }),
    pricedAtGate: (phase, windowSecs) => sub(copy.skillsPricedAtGate, { phase, secs: windowSecs }),
    pricedAtPvp: (phase, windowSecs) => sub(copy.skillsPricedAtPvp, { phase, secs: windowSecs }),
    gatePhaseSelect: copy.skillsGatePhaseSelect,
    gatePhaseOption: (phase) => formatPhaseLabel(phase, lang),
    gatePhaseSearchPlaceholder: copy.skillsGatePhaseSearchPlaceholder,
    gatePhaseNoMatch: copy.skillsGatePhaseNoMatch,
    gatePhaseMoreMatches: (shown, matched) =>
      sub(copy.skillsGatePhaseMoreMatches, { shown: formatNumber(shown, lang, 0), matched: formatNumber(matched, lang, 0) }),
    dpsLeftOut: (names) => sub(copy.skillsDpsLeftOut, { names }),
    affordableNow: copy.skillsAffordableNow,

    closeNode: copy.skillsCloseNode,
    preview: copy.skillsPreview,
    previewTip: copy.skillsPreviewTip,
    previewGold: copy.skillsPreviewGold,
    previewGoldAtRoster: copy.skillsPreviewGoldAtRoster,
    previewGate: copy.skillsPreviewGate,
    previewPvp: copy.skillsPreviewPvp,
    goldPerHour: (value) => `${formatSignificantCompact(value, lang, 3)}/h`,
    teamDps: (value) => formatNumber(Math.round(value), lang, 0),
    totalNowNext: (now, next) => sub(copy.skillsTotalNowNext, { now, next }),
    requires: copy.skillsRequires,
    gate: copy.skillsGate,
    arm: copy.skillsArm,
    tier: copy.skillsTier,
    effects: copy.skillsEffects,

    totals: copy.skillsTotals,
    totalsTip: copy.skillsTotalsTip,
    totalRows: totalRowNames(copy),
    formatTotal: (key, value) => formatSkillTotal(key, value, lang),
    levelsBought: copy.skillsLevelsBought,
    countOf: (part, whole) => sub(copy.skillsCountOf, { part: formatNumber(part, lang, 0), whole: formatNumber(whole, lang, 0) }),
    share: (fraction) => `${formatNumber(fraction * 100, lang, 1)}%`,
    goldSpent: copy.skillsGoldSpent,
    goldToMax: copy.skillsGoldToMax,

    fitToView: copy.skillsFitToView,
    zoomIn: copy.skillsZoomIn,
    zoomOut: copy.skillsZoomOut,
    legend: copy.skillsLegend,
    legendOwned: copy.skillsLegendOwned,
    legendBuyable: copy.skillsLegendBuyable,
    legendLocked: copy.skillsLegendLocked,
    legendRecommended: copy.skillsLegendRecommended,
    canvasAria: copy.skillsCanvasAria,
    nodeAria: (name, level, max) => sub(copy.skillsNodeAria, { name, level, max }),
  };
}
