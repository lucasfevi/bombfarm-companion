import React from 'react';
import { DropIcon, GoldIcon, rarityTextClass as rarityTextClassFor } from '@/shared/game-art';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import type { DropChanceRow, PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { phaseMapDisplayName, rarityLabel } from '@bombfarm/domain/phase-wiki';
import { TipLabel } from '@bombfarm/ui/stat-list-tip-label';
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
): {
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
  tip?: string;
  icon?: React.ReactNode;
}[] {
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
        singleBoostTerm(intel.xpPerPropWiki, intel.xpPerPropActual),
        strings.phasesXpActualHint,
        formatNumber,
      ),
    },
    {
      id: 'gold',
      label: strings.phasesGoldComum,
      icon: <GoldIcon />,
      value: boostedValue(
        formatNumber(intel.goldComumActual, 0),
        formatNumber(intel.goldComumWiki, 0),
        singleBoostTerm(intel.goldComumWiki, intel.goldComumActual),
        strings.phasesGoldActualHint,
        formatNumber,
      ),
    },
    {
      id: 'avgGold',
      label: strings.phasesAvgGold,
      icon: <GoldIcon />,
      value: boostedValue(
        formatNumber(intel.weightedAvgGoldActual, 0),
        formatNumber(intel.weightedAvgGoldWiki, 0),
        singleBoostTerm(intel.weightedAvgGoldWiki, intel.weightedAvgGoldActual),
        strings.phasesGoldActualHint,
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
        singleBoostTerm(intel.totalMapGoldWiki, intel.totalMapGoldActual),
        strings.phasesGoldActualHint,
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
 * One row's value for a figure the account boosts: the boosted total on the value line, with a
 * base + boost-term breakdown as muted subtext under it, and that breakdown's own explanation as
 * a tooltip trigger on the subtext — not the label. The label used to carry the tooltip, but with
 * the numbers already inline underneath it there was nothing left for hovering the plain word
 * ("Item chest") to explain; the arithmetic is the natural hover target now that it is visible.
 *
 * Replaces the wiki/yours ROW PAIR these panels used to print. The pair stated both numbers but
 * left the reader to divide one by the other to see the boost at all, and it cost two rows per
 * figure — eight of them on a gate phase's Drops panel, differing only by a parenthesised word.
 *
 * `terms` is the ordered list of boost components in PERCENTAGE POINTS, already matching the
 * sequence `tip` explains them in — e.g. `[20, 5]` for a drop chance's skill-tree luck then
 * squad luck, or `[56]` for a figure (gold, XP) this model tracks only one contributing source
 * for. Collapses to the bare total when `terms` is empty: with no save imported every multiplier
 * is 1, and a subtext repeating the total with a "+0%" term would say nothing the total does not.
 * A zero-valued term is expected to already be filtered out by the caller (`dropBoostTerms`,
 * `singleBoostTerm`) before it reaches here, so this function does not filter again.
 */
function boostedValue(
  total: string,
  base: string,
  terms: readonly number[],
  tip: string,
  formatNumber: (n: number, d?: number) => string,
): React.ReactNode {
  if (terms.length === 0) return total;
  const subtext = [base, ...terms.map((term) => `${formatNumber(term, 0)}%`)].join(' + ');
  return (
    <span className="flex flex-col items-end gap-0.5 leading-tight">
      <span>{total}</span>
      <span className="text-[10px] leading-snug">
        <TipLabel label={subtext} tip={tip} />
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
 * `boostedValue`'s `terms` for a figure this model tracks only ONE contributing source for — gold
 * (`teamCoinPct`) and XP (`xpMult`) are both a single skill-tree value with no separate squad
 * share (see the account-facts investigation this feature shipped with: `farm-rate.ts`'s
 * `teamCoinMult`/`xpMult` read straight off `account.tree`, never averaged over heroes). Empty
 * when unboosted, so `boostedValue` collapses to the bare total instead of printing "+0%".
 */
function singleBoostTerm(base: number, total: number): number[] {
  const pct = boostFraction(base, total) * 100;
  return pct > 0 ? [pct] : [];
}

/**
 * `boostedValue`'s `terms` for one drop-chance row: skill-tree luck, then squad luck, matching
 * the order `phasesDropActualHint` explains them in. A term that is exactly zero is dropped
 * rather than printed as "+0%" — if only the tree or only the squad contributes, the row shows
 * that one term alone.
 *
 * Falls back to a SINGLE combined term, derived from `row.wiki`/`row.actual` rather than from the
 * split, when `intel` does not carry one (`treeLuckFlatPct` and `squadLuckPct` both `0`) — e.g. a
 * caller that only ever computed the combined `luckFraction` (see `PhaseIntelGlobalOptions`'s own
 * doc comment). This still shows the real boost, just undivided, instead of inventing a two-way
 * split the caller never gave `computePhaseIntelGlobal`.
 */
function dropBoostTerms(row: DropChanceRow, intel: PhaseIntelGlobal): number[] {
  const tree = intel.treeLuckFlatPct;
  const squad = intel.squadLuckPct;
  if (tree > 0 || squad > 0) return [tree, squad].filter((term) => term > 0);
  return singleBoostTerm(row.wiki, row.actual);
}

/**
 * A drop-chance row's value when it cannot roll on the phase being viewed: a dash, not a
 * percentage — showing a live-looking number next to a drop that cannot land here would read as
 * "this can happen" when it cannot. The note under the dash names the phase type the drop IS
 * specific to (`dropAppliesOnPhase`): every id but the ready key is gate-only, so it is the one
 * exception this checks for by id rather than re-deriving from `applies` a second time.
 */
function inapplicableDropValue(dropId: DropChanceRow['id'], strings: Strings): React.ReactNode {
  const note = dropId === 'key' ? strings.phasesDropNonGateOnly : strings.phasesDropGateOnly;
  return (
    <span className="flex flex-col items-end gap-0.5 leading-tight">
      <span>—</span>
      <span className="text-[10px] leading-snug">{note}</span>
    </span>
  );
}

/**
 * One row per drop type, always all five — a row that cannot roll on this phase (gate vs.
 * non-gate — see `dropAppliesOnPhase`) is dimmed and shows a dash rather than being skipped, so
 * the panel keeps the same shape on every phase and a drop that cannot apply here never looks
 * like it can. Three-decimal percentages on the rows that do apply: at wiki-base rates as low as
 * 0.005% (gem/stone), two decimals would collapse every rare-chest row to the same "0.01%".
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
    muted?: boolean;
  }[] = [];
  for (const row of intel.dropChances) {
    items.push({
      id: row.id,
      label: dropLabel(row.id, strings),
      value: row.applies
        ? boostedValue(
            `${formatNumber(row.actual * 100, 3)}%`,
            `${formatNumber(row.wiki * 100, 3)}%`,
            dropBoostTerms(row, intel),
            strings.phasesDropActualHint,
            formatNumber,
          )
        : inapplicableDropValue(row.id, strings),
      icon: <DropIcon id={row.id} ato={intel.ato} />,
      muted: !row.applies,
    });
  }
  return items;
}
