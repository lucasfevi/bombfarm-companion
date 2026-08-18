import React from 'react';
import { DropIcon, GoldIcon, rarityTextClass as rarityTextClassFor } from '@/shared/game-art';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import type { DropChanceRow, PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { phaseMapDisplayName, rarityLabel } from '@bombfarm/domain/phase-wiki';
import { formatDurationShort, GATE_KEY_RARITY_INDEX } from './phases-page';

function rarityTextClass(index: number): string {
  const clamped = Math.max(0, Math.min(5, index));
  return rarityTextClassFor(clamped) ?? rarityTextClassFor(0)!;
}

export function jaulaChestOdds(
  probs: number[],
  formatNumber: (n: number, d?: number) => string,
  lang: Lang,
) {
  const parts: { rarityIndex: number; label: string; percent: string }[] = [];
  for (let index = 0; index < probs.length; index++) {
    const prob = probs[index] ?? 0;
    if (prob <= 0) continue;
    parts.push({
      rarityIndex: index,
      label: rarityLabel(index, lang),
      percent: `${formatNumber(prob * 100, 1)}%`,
    });
  }
  if (parts.length === 0) return '—';
  return (
    <span className="flex flex-col items-end gap-0.5 whitespace-normal font-mono text-[11px] leading-snug">
      {parts.map((part) => (
        <span key={part.rarityIndex} className={rarityTextClass(part.rarityIndex)}>
          {part.label} {part.percent}
        </span>
      ))}
    </span>
  );
}

export function mapFactItems(
  intel: PhaseIntelGlobal,
  strings: Strings,
  formatNumber: (n: number, d?: number) => string,
  lang: Lang,
) {
  const keyIdx = GATE_KEY_RARITY_INDEX[Math.max(0, intel.ato - 1)] ?? 1;
  const mapName = `${phaseMapDisplayName(intel.phase, lang)} · #${intel.phase}`;
  return [
    {
      id: 'mapName',
      label: strings.phasesMapName,
      value: (
        <span className="inline-block min-w-[28ch] whitespace-nowrap" title={mapName}>
          {mapName}
        </span>
      ),
    },
    { id: 'stone', label: strings.phasesStoneHp, value: formatNumber(intel.stoneHp, 0) },
    {
      id: 'mit',
      label: strings.phasesMitigation,
      value: `${formatNumber(intel.mitigationPct, 1)}%`,
      tip: sub(strings.phasesPenNeedHint, { pct: formatNumber(intel.penToZero, 1) }),
    },
    { id: 'props', label: strings.phasesPropCount, value: formatNumber(intel.propCount, 0) },
    {
      id: 'avgHp',
      label: strings.phasesAvgPropHp,
      value: formatNumber(intel.weightedAvgHp, 0),
    },
    {
      id: 'mapHp',
      label: strings.phasesTotalMapHp,
      value: formatNumber(intel.totalMapHp, 0),
    },
    {
      id: 'boss',
      label: strings.phasesBossHp,
      value: formatNumber(intel.bossHp, 0),
      tip: intel.gate ? strings.phasesBossGateHint : strings.phasesBossHint,
    },
    {
      id: 'gateTimer',
      label: strings.phasesGateTimer,
      value:
        intel.gate && intel.gateTimerSecs != null
          ? formatDurationShort(intel.gateTimerSecs)
          : '—',
    },
    {
      id: 'gateKey',
      label: strings.phasesGateKey,
      value: intel.gate ? (
        <span className={rarityTextClass(keyIdx)}>{rarityLabel(keyIdx, lang)}</span>
      ) : (
        '—'
      ),
    },
  ];
}

export function economyItems(
  intel: PhaseIntelGlobal,
  strings: Strings,
  formatNumber: (n: number, d?: number) => string,
) {
  return [
    {
      id: 'drops',
      label: strings.phasesItemDrops,
      value: (
        <span className="whitespace-nowrap">
          {sub(strings.phasesItemDropsValue, { range: intel.itemLevelLabel })}
        </span>
      ),
    },
    {
      id: 'xp',
      label: strings.phasesXpPerProp,
      value: boostedValue(
        formatNumber(intel.xpPerPropActual, 0),
        formatNumber(intel.xpPerPropWiki, 0),
        boostFraction(intel.xpPerPropWiki, intel.xpPerPropActual),
        strings.phasesBoostXp,
        formatNumber,
      ),
      tip: strings.phasesXpActualHint,
    },
    {
      id: 'gold',
      label: strings.phasesGoldComum,
      icon: <GoldIcon />,
      value: boostedValue(
        formatNumber(intel.goldComumActual, 0),
        formatNumber(intel.goldComumWiki, 0),
        boostFraction(intel.goldComumWiki, intel.goldComumActual),
        strings.phasesBoostGold,
        formatNumber,
      ),
      tip: strings.phasesGoldActualHint,
    },
    {
      id: 'avgGold',
      label: strings.phasesAvgGold,
      icon: <GoldIcon />,
      value: boostedValue(
        formatNumber(intel.weightedAvgGoldActual, 0),
        formatNumber(intel.weightedAvgGoldWiki, 0),
        boostFraction(intel.weightedAvgGoldWiki, intel.weightedAvgGoldActual),
        strings.phasesBoostGold,
        formatNumber,
      ),
    },
    {
      id: 'mapGold',
      label: strings.phasesMapGold,
      icon: <GoldIcon />,
      value: boostedValue(
        formatNumber(intel.totalMapGoldActual, 0),
        formatNumber(intel.totalMapGoldWiki, 0),
        boostFraction(intel.totalMapGoldWiki, intel.totalMapGoldActual),
        strings.phasesBoostGold,
        formatNumber,
      ),
    },
  ];
}

export function jaulaItems(
  intel: PhaseIntelGlobal,
  strings: Strings,
  formatNumber: (n: number, d?: number) => string,
  lang: Lang,
) {
  return [
    {
      id: 'early',
      label: strings.phasesJaulaEarly,
      value: `${formatNumber(intel.jaulaEarlyCapPct, 1)}%`,
      tip: strings.phasesJaulaEarlyHint,
    },
    {
      id: 'window',
      label: strings.phasesJaulaWindow,
      value: formatDurationShort(intel.jaulaWindowSecs),
    },
    {
      id: 'hp',
      label: strings.phasesJaulaHp,
      value: formatNumber(intel.jaulaHp, 0),
    },
    {
      id: 'chest',
      label: strings.phasesJaulaChest,
      value: jaulaChestOdds(intel.heroChestRarity, formatNumber, lang),
    },
  ];
}

/**
 * `DropChanceRow.id` -> its label string. A `switch` (not an indexed lookup table) so each arm
 * reads `strings.phasesDropXxx` directly — a plain property access TypeScript can narrow to
 * `string`, unlike `strings[someKeyofStrings]`, which widens to the union of every value type
 * across `Strings` (some of which, e.g. `explainSections`, are not `ReactNode`).
 */
function dropLabel(dropId: DropChanceRow['id'], strings: Strings): string {
  switch (dropId) {
    case 'chest':
      return strings.phasesDropChest;
    case 'key':
      return strings.phasesDropKey;
    case 'time':
      return strings.phasesDropTime;
    case 'gem':
      return strings.phasesDropGem;
    case 'stone':
      return strings.phasesDropStone;
  }
}

/**
 * One row's value for a figure the account boosts: the boosted total on the value line, with the
 * wiki base and the boost that produced it as muted subtext under it.
 *
 * Replaces the wiki/yours ROW PAIR these panels used to print. The pair stated both numbers but
 * left the reader to divide one by the other to see the boost at all, and it cost two rows per
 * figure — eight of them on a gate phase's Drops panel, differing only by a parenthesised word.
 *
 * Collapses to the bare total when there is no boost. With no save imported every multiplier is
 * 1, and a subtext reading "0.100% +0% luck" is noise that says nothing the total does not.
 */
function boostedValue(
  total: string,
  base: string,
  boost: number,
  sourceLabel: string,
  formatNumber: (n: number, d?: number) => string,
): React.ReactNode {
  if (!Number.isFinite(boost) || boost <= 0) return total;
  return (
    <span className="flex flex-col items-end gap-0.5 leading-tight">
      <span>{total}</span>
      <span className="text-[10px] font-normal text-muted">
        {base} +{formatNumber(boost * 100, 0)}% {sourceLabel}
      </span>
    </span>
  );
}

/** Boost fraction that took `base` to `total` — `0` when the base is absent or unboosted. */
function boostFraction(base: number, total: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(total) || base <= 0) return 0;
  return total / base - 1;
}

/**
 * Wiki/yours row pair per drop type that `applies` on this phase (gate vs. non-gate — see
 * `dropAppliesOnPhase`), skipping the rest. Three-decimal percentages: at wiki-base rates as low
 * as 0.005% (gem/stone), two decimals would collapse every rare-chest row to the same "0.01%".
 */
export function dropItems(
  intel: PhaseIntelGlobal,
  strings: Strings,
  formatNumber: (n: number, d?: number) => string,
) {
  const items: {
    id: string;
    label: React.ReactNode;
    value: React.ReactNode;
    tip?: string;
    icon?: React.ReactNode;
  }[] = [];
  for (const row of intel.dropChances) {
    if (!row.applies) continue;
    items.push({
      id: row.id,
      label: dropLabel(row.id, strings),
      value: boostedValue(
        `${formatNumber(row.actual * 100, 3)}%`,
        `${formatNumber(row.wiki * 100, 3)}%`,
        boostFraction(row.wiki, row.actual),
        strings.phasesBoostLuck,
        formatNumber,
      ),
      tip: strings.phasesDropActualHint,
      icon: <DropIcon id={row.id} ato={intel.ato} />,
    });
  }
  return items;
}
