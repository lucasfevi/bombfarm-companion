/**
 * Every string and formatter the shared skill-tree screen asks for, built from this app's own copy
 * layer. `@bombfarm/account/skill-tree` takes a label bag and never sees a language, so this module
 * is the whole of the translation — the screen beside it is wiring.
 */
import type { SkillTreeLabels } from '@bombfarm/account/skill-tree';
import type { SkillArm, SkillEffectKind, SkillTier, SkillTotals } from '@bombfarm/domain/skill-tree';
import { formatPhaseLabel } from '@bombfarm/farm';
import { formatCompactNumber, formatNumber, formatSignificantCompact } from '@bombfarm/ui';
import type { DomainLang } from '@bombfarm/contracts';
import { sub, type Copy, type CopyKey } from '../../lib/copy';

const MINUS_SIGN = '−';

function signed(magnitude: string, value: number): string {
  return `${value < 0 ? MINUS_SIGN : '+'}${magnitude}`;
}

/** A fraction as a signed percentage, two decimals: `0.005` → `+0.50%`. */
function signedPercent(fraction: number, lang: DomainLang): string {
  return signed(`${formatNumber(Math.abs(fraction) * 100, lang, 2)}%`, fraction);
}

function signedCount(count: number): string {
  return signed(String(Math.abs(count)), count);
}

/** A signed rate with the Farm board's own unit, `+12.3k/h`; a value with no figure is an em dash. */
function signedRatePerHour(value: number, lang: DomainLang): string {
  if (!Number.isFinite(value)) return '—';
  return `${signed(formatCompactNumber(Math.abs(value), lang, 1), value)}/h`;
}

function signedCompact(value: number, lang: DomainLang): string {
  if (!Number.isFinite(value)) return '—';
  return signed(formatCompactNumber(Math.abs(value), lang, 1), value);
}

/** `×1.234`, three decimals with the redundant zeros dropped: `1.2` stays `×1.2`, `1` is `×1`. */
function multiplier(value: number, lang: DomainLang): string {
  return `×${formatNumber(value, lang, 3).replace(/([.,]\d*?)0+$/, '$1').replace(/[.,]$/, '')}`;
}

function armNames(t: Copy): Record<SkillArm, string> {
  return {
    hub: t.skillsArmHub,
    dano: t.skillsArmDano,
    crit: t.skillsArmCrit,
    velocidade: t.skillsArmVelocidade,
    ouro: t.skillsArmOuro,
    drop: t.skillsArmDrop,
    energia: t.skillsArmEnergia,
    geo: t.skillsArmGeo,
    neutro: t.skillsArmNeutro,
  };
}

function tierNames(t: Copy): Record<SkillTier, string> {
  return {
    start: t.skillsTierStart,
    small: t.skillsTierSmall,
    notavel: t.skillsTierNotavel,
    unlock: t.skillsTierUnlock,
  };
}

function kindNames(t: Copy): Record<SkillEffectKind, string> {
  return {
    team_dmg: t.skillsKindTeamDmg,
    g_crit_chance: t.skillsKindCritChance,
    g_crit_dmg: t.skillsKindCritDmg,
    g_speed: t.skillsKindSpeed,
    team_coin: t.skillsKindCoin,
    g_luck: t.skillsKindLuck,
    team_energia: t.skillsKindEnergia,
    team_xp: t.skillsKindXp,
    team_geo: t.skillsKindGeo,
    vagas_campo: t.skillsKindFieldSlot,
    bag_tab: t.skillsKindBagTab,
  };
}

function effectTemplates(t: Copy): Record<SkillEffectKind, string> {
  return {
    team_dmg: t.skillsEffectTeamDmg,
    g_crit_chance: t.skillsEffectCritChance,
    g_crit_dmg: t.skillsEffectCritDmg,
    g_speed: t.skillsEffectSpeed,
    team_coin: t.skillsEffectCoin,
    g_luck: t.skillsEffectLuck,
    team_energia: t.skillsEffectEnergia,
    team_xp: t.skillsEffectXp,
    team_geo: t.skillsEffectGeo,
    vagas_campo: t.skillsEffectFieldSlot,
    bag_tab: t.skillsEffectBagTab,
  };
}

/** The two kinds whose effect is a count of things, not a fraction of a stat. */
const COUNT_KINDS: ReadonlySet<SkillEffectKind> = new Set(['vagas_campo', 'bag_tab']);

function totalRowNames(t: Copy): Record<keyof SkillTotals, string> {
  return {
    team_dmg_add: t.skillsTotalTeamDmg,
    crit_chance_add: t.skillsTotalCritChance,
    crit_dmg_add: t.skillsTotalCritDmg,
    speed_add: t.skillsTotalSpeed,
    coin_add: t.skillsTotalCoin,
    luck_add: t.skillsTotalLuck,
    energia_add: t.skillsTotalEnergia,
    dmg_static: t.skillsTotalDmgStatic,
    geo_mult: t.skillsTotalGeo,
    xp_mult: t.skillsTotalXp,
    vagas_campo: t.skillsTotalFieldSlots,
    bag_tabs_bonus: t.skillsTotalBagTabs,
  };
}

export function formatSkillTotal(key: keyof SkillTotals, value: number, lang: DomainLang): string {
  if (key === 'vagas_campo' || key === 'bag_tabs_bonus') return signedCount(value);
  if (key.endsWith('_add')) return signedPercent(value, lang);
  return multiplier(value, lang);
}

/** Where the phase the figures are priced on came from — the Farm tab's pick, or the account's own. */
export type SkillsPhaseSource = 'farm' | 'account';

function nodeTitle(t: Copy, id: string): string | null {
  const key = `skillsNodeTitle${id}`;
  return key in t ? t[key as CopyKey] : null;
}

export function skillTreeLabels(t: Copy, lang: DomainLang, phaseSource: SkillsPhaseSource = 'farm'): SkillTreeLabels {
  const arms = armNames(t);
  const tiers = tierNames(t);
  const kinds = kindNames(t);
  const effects = effectTemplates(t);
  const effect = (kind: SkillEffectKind, amount: number) =>
    COUNT_KINDS.has(kind)
      ? sub(effects[kind], { n: signedCount(amount) })
      : sub(effects[kind], { v: signedPercent(amount, lang) });

  return {
    title: t.skillsTitle,
    tip: t.skillsTip,
    kindName: (kind) => kinds[kind],
    effectPerLevel: effect,
    effectAtLevel: effect,
    effectValue: (kind, amount) => (COUNT_KINDS.has(kind) ? signedCount(amount) : signedPercent(amount, lang)),
    armName: (arm) => arms[arm],
    tierName: (tier) => tiers[tier],
    level: (level, max) => sub(t.skillsLevel, { level, max }),
    hubName: t.skillsHubName,
    hubNote: t.skillsHubNote,
    nodeName: (id) => nodeTitle(t, id),

    stateOwned: t.skillsStateOwned,
    stateMaxed: t.skillsStateMaxed,
    stateBuyable: t.skillsStateBuyable,
    stateUnaffordable: t.skillsStateUnaffordable,
    stateLockedPrerequisite: (parentName, need, have) =>
      sub(t.skillsStateLockedPrerequisite, { parent: parentName, need, have }),
    stateLockedPhase: (phase) => sub(t.skillsStateLockedPhase, { phase }),
    alwaysLit: t.skillsAlwaysLit,

    nextLevelCost: t.skillsNextLevelCost,
    costToMax: t.skillsCostToMax,
    refund: t.skillsRefund,
    refundTip: t.skillsRefundTip,
    refundBlocked: (childNames) => sub(t.skillsRefundBlocked, { children: childNames }),
    wallet: t.skillsWallet,
    gold: (gold) => sub(t.skillsGoldAmount, { gold: formatNumber(gold, lang, 0) }),
    goldCompact: (gold) => formatCompactNumber(gold, lang, 1),
    compactNumber: (value) => formatSignificantCompact(value, lang),

    nextToBuy: t.skillsNextToBuy,
    nextToBuyTip: t.skillsNextToBuyTip,
    objectiveGold: t.skillsObjectiveGold,
    objectiveGate: t.skillsObjectiveGate,
    objectivePvp: t.skillsObjectivePvp,
    colNode: t.skillsColNode,
    colCost: t.skillsColCost,
    colGain: t.skillsColGain,
    colPerMillion: t.skillsColPerMillion,
    gainGold: (delta) => signedRatePerHour(delta, lang),
    gainDps: (delta) => sub(t.skillsGainDps, { v: signedCompact(delta, lang) }),
    perMillionGold: (value) => sub(t.skillsPerMillionGold, { v: signedRatePerHour(value, lang) }),
    perMillionDps: (value) => sub(t.skillsPerMillionDps, { v: signedCompact(value, lang) }),
    gainOutsideObjectives: t.skillsGainOutsideObjectives,
    nothingToRecommend: t.skillsNothingToRecommend,
    pvpEmpty: t.skillsPvpEmpty,
    pricingUnavailable: t.skillsPricingUnavailable,
    pricedAtPhase: (phase) =>
      sub(phaseSource === 'farm' ? t.skillsPricedAtPhase : t.skillsPricedAtAccountPhase, { phase }),
    pricedAtGate: (phase, windowSecs) => sub(t.skillsPricedAtGate, { phase, secs: windowSecs }),
    pricedAtPvp: (phase, windowSecs) => sub(t.skillsPricedAtPvp, { phase, secs: windowSecs }),
    gatePhaseSelect: t.skillsGatePhaseSelect,
    gatePhaseOption: (phase) => formatPhaseLabel(phase, lang),
    gatePhaseSearchPlaceholder: t.skillsGatePhaseSearchPlaceholder,
    gatePhaseNoMatch: t.skillsGatePhaseNoMatch,
    gatePhaseMoreMatches: (shown, matched) =>
      sub(t.skillsGatePhaseMoreMatches, { shown: formatNumber(shown, lang, 0), matched: formatNumber(matched, lang, 0) }),
    dpsLeftOut: (names) => sub(t.skillsDpsLeftOut, { names }),
    affordableNow: t.skillsAffordableNow,

    closeNode: t.skillsCloseNode,
    preview: t.skillsPreview,
    previewTip: t.skillsPreviewTip,
    previewGold: t.skillsPreviewGold,
    previewGate: (phase) => sub(t.skillsPreviewGate, { phase }),
    previewPvp: (phase) => sub(t.skillsPreviewPvp, { phase }),
    goldPerHour: (value) => `${formatSignificantCompact(value, lang, 3)}/h`,
    teamDps: (value) => formatNumber(Math.round(value), lang, 0),
    totalNowNext: (now, next) => sub(t.skillsTotalNowNext, { now, next }),
    requires: t.skillsRequires,
    gate: t.skillsGate,
    arm: t.skillsArm,
    tier: t.skillsTier,
    effects: t.skillsEffects,

    totals: t.skillsTotals,
    totalsTip: t.skillsTotalsTip,
    totalRows: totalRowNames(t),
    formatTotal: (key, value) => formatSkillTotal(key, value, lang),
    levelsBought: t.skillsLevelsBought,
    countOf: (part, whole) => sub(t.skillsCountOf, { part: formatNumber(part, lang, 0), whole: formatNumber(whole, lang, 0) }),
    share: (fraction) => `${formatNumber(fraction * 100, lang, 1)}%`,
    goldSpent: t.skillsGoldSpent,
    goldToMax: t.skillsGoldToMax,

    fitToView: t.skillsFitToView,
    zoomIn: t.skillsZoomIn,
    zoomOut: t.skillsZoomOut,
    legend: t.skillsLegend,
    legendOwned: t.skillsLegendOwned,
    legendBuyable: t.skillsLegendBuyable,
    legendUnaffordable: t.skillsLegendUnaffordable,
    legendLocked: t.skillsLegendLocked,
    legendRecommended: t.skillsLegendRecommended,
    canvasAria: t.skillsCanvasAria,
    nodeAria: (name, level, max) => sub(t.skillsNodeAria, { name, level, max }),
  };
}
