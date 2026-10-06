'use client';

import { FORGE_GUARANTEED, FORGE_STONE_RARITIES } from '@bombfarm/domain/forge';
import { Button, Icon, Select, Stepper, cn, type StatListItem } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../../lib/copy';
import { MAX_STONE_RANGES, type ResolvedStoneRange } from '../../lib/forge/forge-stones';
import type { ForgePlanForecast, ForgeStoneEdit } from '../../lib/forge/use-forge-plan';
import { forgeLevel, type ForgeLabels } from './forge-labels';

const NONE = 'none';
const RARITIES = Array.from({ length: FORGE_STONE_RARITIES }, (_, rarity) => rarity);
const SHOWN_AT_LEAST = 0.005;

function certainUpTo(range: ResolvedStoneRange): number | null {
  if (range.rarity === null || range.from > FORGE_GUARANTEED) return null;
  return Math.min(range.to, FORGE_GUARANTEED);
}

export function ForgeStonesControl({
  ranges,
  labels,
  onEdit,
}: {
  ranges: readonly ResolvedStoneRange[];
  labels: ForgeLabels;
  onEdit: (edit: ForgeStoneEdit) => void;
}) {
  const t = useCopy();
  const last = ranges.length - 1;
  const lastRange = ranges.at(-1);
  const canAdd = ranges.length < MAX_STONE_RANGES && lastRange !== undefined && lastRange.to > lastRange.from;

  return (
    <div data-testid="forge-stones" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{t.forgeStonesTitle}</span>
        <Button
          type="button"
          className="text-[11px]"
          data-testid="forge-stones-add"
          disabled={!canAdd}
          onClick={() => {
            onEdit({ kind: 'stoneAdd' });
          }}
        >
          {t.forgeStonesAdd}
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {ranges.map((range, index) => {
          const refusedTo = certainUpTo(range);
          return (
            <li key={range.from} data-testid="forge-stone-range" className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">{t.forgeStonesUpTo}</span>
              {index < last ? (
                <Stepper
                  valueClassName="text-xs"
                  value={<span data-testid="forge-stone-end">{forgeLevel(range.to)}</span>}
                  onDecrement={() => {
                    onEdit({ kind: 'stoneEnd', index, upTo: range.to - 1 });
                  }}
                  onIncrement={() => {
                    onEdit({ kind: 'stoneEnd', index, upTo: range.to + 1 });
                  }}
                  decrementLabel={t.forgeStonesEndLower}
                  incrementLabel={t.forgeStonesEndRaise}
                />
              ) : (
                <span data-testid="forge-stone-end" className="font-mono text-xs font-semibold tabular-nums text-ink">
                  {forgeLevel(range.to)}
                </span>
              )}
              <Select
                size="compact"
                value={range.rarity === null ? NONE : String(range.rarity)}
                onChange={(event) => {
                  const picked = event.target.value;
                  onEdit({ kind: 'stoneRarity', index, rarity: picked === NONE ? null : Number(picked) });
                }}
                aria-label={sub(t.forgeStonesPick, { from: forgeLevel(range.from), to: forgeLevel(range.to) })}
                data-testid="forge-stone-pick"
                className="w-28 shrink-0"
              >
                <option value={NONE}>{t.forgeStonesNone}</option>
                {RARITIES.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {labels.rarityName(rarity)}
                  </option>
                ))}
              </Select>
              {ranges.length > 1 ? (
                <Button
                  type="button"
                  variant="icon"
                  aria-label={t.forgeStonesRemove}
                  data-testid="forge-stone-remove"
                  onClick={() => {
                    onEdit({ kind: 'stoneRemove', index });
                  }}
                >
                  <Icon name="x-mark" size="sm" />
                </Button>
              ) : null}
              {refusedTo === null ? null : (
                <span data-testid="forge-stone-refused" className={cn('text-[11px]', 'text-muted')}>
                  {sub(t.forgeStonesRefused, { level: forgeLevel(refusedTo) })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function shortOf(expected: number, owned: number): boolean {
  return expected > owned + 1e-9;
}

export function forgeStoneFacts(
  forecast: ForgePlanForecast | null,
  owned: readonly number[],
  labels: ForgeLabels,
  t: Copy,
): StatListItem[] {
  if (forecast === null) return [];
  const rows = (
    stones: readonly number[],
    id: string,
    label: string,
  ): StatListItem[] =>
    RARITIES.filter((rarity) => (stones[rarity] ?? 0) > SHOWN_AT_LEAST).map((rarity) => {
      const expected = stones[rarity] ?? 0;
      const held = owned[rarity] ?? 0;
      return {
        id: `${id}-${String(rarity)}`,
        label: sub(label, { rarity: labels.rarityName(rarity) }),
        value: (
          <span data-testid={`forge-fact-${id}-${String(rarity)}`} className={shortOf(expected, held) ? 'text-warn' : undefined}>
            {sub(t.forgeStonesHeld, { expected: labels.rolls(expected), owned: labels.count(held) })}
          </span>
        ),
      };
    });
  return [
    ...rows(forecast.stones, 'stones', t.forgeFactStones),
    ...(forecast.protected ? rows(forecast.protected.stones, 'stones-protected', t.forgeFactStonesProtected) : []),
  ];
}

export function ForgeStonesShortage({
  forecast,
  owned,
  labels,
}: {
  forecast: ForgePlanForecast | null;
  owned: readonly number[];
  labels: ForgeLabels;
}) {
  const t = useCopy();
  if (forecast === null) return null;
  const short = RARITIES.filter((rarity) => shortOf(forecast.stones[rarity] ?? 0, owned[rarity] ?? 0));
  return (
    <>
      {short.map((rarity) => (
        <p key={rarity} data-testid="forge-stones-short" className="m-0 text-xs text-warn">
          {sub(t.forgeStonesShort, {
            expected: labels.rolls(forecast.stones[rarity] ?? 0),
            rarity: labels.rarityName(rarity),
            owned: labels.count(owned[rarity] ?? 0),
          })}
        </p>
      ))}
    </>
  );
}
