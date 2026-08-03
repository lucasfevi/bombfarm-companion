import React from 'react';
import { GoldValue, rarityTextClass as rarityTextClassFor } from '@/shared/game-art';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
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
      value: formatNumber(intel.xpPerProp, 1),
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
