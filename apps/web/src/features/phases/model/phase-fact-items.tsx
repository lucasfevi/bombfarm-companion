import React from 'react';
import { DropIcon, GoldValue, rarityTextClass as rarityTextClassFor } from '@/shared/game-art';
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
      id: 'xpWiki',
      label: strings.phasesXpPerPropWiki,
      value: formatNumber(intel.xpPerPropWiki, 0),
    },
    {
      id: 'xpActual',
      label: strings.phasesXpPerPropActual,
      value: formatNumber(intel.xpPerPropActual, 0),
      tip: strings.phasesXpActualHint,
    },
    {
      id: 'goldWiki',
      label: strings.phasesGoldComumWiki,
      value: <GoldValue>{formatNumber(intel.goldComumWiki, 0)}</GoldValue>,
    },
    {
      id: 'goldActual',
      label: strings.phasesGoldComumActual,
      value: <GoldValue>{formatNumber(intel.goldComumActual, 0)}</GoldValue>,
      tip: strings.phasesGoldActualHint,
    },
    {
      id: 'avgGoldWiki',
      label: strings.phasesAvgGoldWiki,
      value: <GoldValue>{formatNumber(intel.weightedAvgGoldWiki, 0)}</GoldValue>,
    },
    {
      id: 'avgGoldActual',
      label: strings.phasesAvgGoldActual,
      value: <GoldValue>{formatNumber(intel.weightedAvgGoldActual, 0)}</GoldValue>,
    },
    {
      id: 'mapGoldWiki',
      label: strings.phasesMapGoldWiki,
      value: <GoldValue>{formatNumber(intel.totalMapGoldWiki, 0)}</GoldValue>,
    },
    {
      id: 'mapGoldActual',
      label: strings.phasesMapGoldActual,
      value: <GoldValue>{formatNumber(intel.totalMapGoldActual, 0)}</GoldValue>,
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
 * `DropChanceRow.id` -> its wiki/yours label strings. A `switch` (not an indexed lookup table)
 * so each arm reads `strings.phasesDropXxxYyy` directly — a plain property access TypeScript can
 * narrow to `string`, unlike `strings[someKeyofStrings]`, which widens to the union of every
 * value type across `Strings` (some of which, e.g. `explainSections`, are not `ReactNode`).
 */
function dropLabels(dropId: DropChanceRow['id'], strings: Strings): { wiki: string; actual: string } {
  switch (dropId) {
    case 'chest':
      return { wiki: strings.phasesDropChestWiki, actual: strings.phasesDropChestActual };
    case 'key':
      return { wiki: strings.phasesDropKeyWiki, actual: strings.phasesDropKeyActual };
    case 'time':
      return { wiki: strings.phasesDropTimeWiki, actual: strings.phasesDropTimeActual };
    case 'gem':
      return { wiki: strings.phasesDropGemWiki, actual: strings.phasesDropGemActual };
    case 'stone':
      return { wiki: strings.phasesDropStoneWiki, actual: strings.phasesDropStoneActual };
  }
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
    const labels = dropLabels(row.id, strings);
    // Art on BOTH rows of the wiki/yours pair, not just the first: each `dt` is an independent
    // cell in the panel's `dl` grid, so icon-on-one would leave the pair's two labels starting
    // at different x positions.
    items.push({
      id: `${row.id}Wiki`,
      label: labels.wiki,
      value: `${formatNumber(row.wiki * 100, 3)}%`,
      icon: <DropIcon id={row.id} ato={intel.ato} />,
    });
    items.push({
      id: `${row.id}Actual`,
      label: labels.actual,
      value: `${formatNumber(row.actual * 100, 3)}%`,
      tip: strings.phasesDropActualHint,
      icon: <DropIcon id={row.id} ato={intel.ato} />,
    });
  }
  return items;
}
