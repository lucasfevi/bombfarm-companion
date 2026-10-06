'use client';

import { FORGE_GUARANTEED, FORGE_STONE_RARITIES, forgeStonePp } from '@bombfarm/domain/forge';
import { Button, Icon, Menu, Stepper, buttonRecipe, cn, type StatListItem } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../../lib/copy';
import { MAX_STONE_RANGES, type ResolvedStoneRange } from '../../lib/forge/forge-stones';
import type { ForgePlanForecast, ForgeStoneEdit } from '../../lib/forge/use-forge-plan';
import { forgeLevel, type ForgeLabels } from './forge-labels';
import { StoneIcon } from './forge-stone-art';

const NONE = 'none';
const RARITIES = Array.from({ length: FORGE_STONE_RARITIES }, (_, rarity) => rarity);
const SHOWN_AT_LEAST = 0.005;

function certainUpTo(range: ResolvedStoneRange): number | null {
  if (range.rarity === null || range.from > FORGE_GUARANTEED) return null;
  return Math.min(range.to, FORGE_GUARANTEED);
}

function stoneBonus(rarity: number, labels: ForgeLabels): string {
  return labels.signedPercent(forgeStonePp(rarity));
}

function StoneFace({ rarity, owned, labels }: { rarity: number | null; owned: number; labels: ForgeLabels }) {
  const t = useCopy();
  if (rarity === null) return <span data-testid="forge-stone-face">{t.forgeStonesNone}</span>;
  return (
    <span data-testid="forge-stone-face" data-rarity={rarity} className={cn('flex', 'min-w-0', 'flex-1', 'items-center', 'gap-2')}>
      <StoneIcon rarity={rarity} dim={owned === 0} />
      <span className="font-mono font-semibold tabular-nums">{stoneBonus(rarity, labels)}</span>
      <span className="truncate">{labels.rarityName(rarity)}</span>
      <span className={cn('ml-auto', 'shrink-0', 'text-[11px]', owned === 0 ? 'text-down' : 'text-muted')}>
        {sub(t.forgeStonesOwned, { count: labels.count(owned) })}
      </span>
    </span>
  );
}

function StonePicker({
  rarity,
  owned,
  labels,
  ariaLabel,
  onPick,
}: {
  rarity: number | null;
  owned: readonly number[];
  labels: ForgeLabels;
  ariaLabel: string;
  onPick: (rarity: number | null) => void;
}) {
  const t = useCopy();
  return (
    <Menu.Root>
      <Menu.Trigger
        data-testid="forge-stone-pick"
        aria-label={ariaLabel}
        className={cn(buttonRecipe({ variant: 'default' }), 'flex', 'w-full', 'items-center', 'gap-2', 'text-left', 'text-xs')}
      >
        <StoneFace rarity={rarity} owned={rarity === null ? 0 : (owned[rarity] ?? 0)} labels={labels} />
        <Icon name="chevron-down" size="sm" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={4}>
          <Menu.Popup data-testid="forge-stone-menu" className="min-w-64">
            <Menu.RadioGroup
              value={rarity === null ? NONE : String(rarity)}
              onValueChange={(next) => {
                onPick(next === NONE ? null : Number(next));
              }}
            >
              {[null, ...RARITIES].map((option) => (
                <Menu.RadioItem
                  key={option ?? NONE}
                  value={option === null ? NONE : String(option)}
                  data-testid="forge-stone-option"
                  closeOnClick
                  aria-label={
                    option === null
                      ? t.forgeStonesNone
                      : sub(t.forgeStonesOption, {
                          rarity: labels.rarityName(option),
                          bonus: stoneBonus(option, labels),
                          owned: sub(t.forgeStonesOwned, { count: labels.count(owned[option] ?? 0) }),
                        })
                  }
                >
                  <Menu.RadioItemIndicator>
                    <Icon name="check" size="xs" />
                  </Menu.RadioItemIndicator>
                  <StoneFace rarity={option} owned={option === null ? 0 : (owned[option] ?? 0)} labels={labels} />
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function ForgeStonesControl({
  ranges,
  owned,
  labels,
  onEdit,
}: {
  ranges: readonly ResolvedStoneRange[];
  owned: readonly number[];
  labels: ForgeLabels;
  onEdit: (edit: ForgeStoneEdit) => void;
}) {
  const t = useCopy();
  const last = ranges.length - 1;
  const lastRange = ranges.at(-1);
  const canSplit = ranges.length < MAX_STONE_RANGES && lastRange !== undefined && lastRange.to > lastRange.from;

  return (
    <div data-testid="forge-stones" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">{t.forgeStonesTitle}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {ranges.length > 1 ? (
            <Button
              type="button"
              className="text-[11px]"
              data-testid="forge-stones-join"
              onClick={() => {
                onEdit({ kind: 'stoneJoin' });
              }}
            >
              {t.forgeStonesJoin}
            </Button>
          ) : null}
          <Button
            type="button"
            className="text-[11px]"
            data-testid="forge-stones-add"
            disabled={!canSplit}
            onClick={() => {
              onEdit({ kind: 'stoneAdd' });
            }}
          >
            {t.forgeStonesSplit}
          </Button>
        </div>
      </div>
      <p data-testid="forge-stones-help" className="m-0 text-[11px] text-muted">
        {t.forgeStonesHelp}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {ranges.map((range, index) => {
          const refusedTo = certainUpTo(range);
          return (
            <li
              key={range.from}
              data-testid="forge-stone-range"
              className={cn('flex', 'flex-col', 'gap-1.5', 'rounded-sm', 'border', 'border-line', 'p-2')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{sub(t.forgeStonesFrom, { from: forgeLevel(range.from) })}</span>
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
                {ranges.length > 1 ? (
                  <Button
                    type="button"
                    variant="icon"
                    className="ml-auto"
                    aria-label={t.forgeStonesRemove}
                    data-testid="forge-stone-remove"
                    onClick={() => {
                      onEdit({ kind: 'stoneRemove', index });
                    }}
                  >
                    <Icon name="x-mark" size="sm" />
                  </Button>
                ) : null}
              </div>
              <StonePicker
                rarity={range.rarity}
                owned={owned}
                labels={labels}
                ariaLabel={sub(t.forgeStonesPick, { from: forgeLevel(range.from), to: forgeLevel(range.to) })}
                onPick={(rarity) => {
                  onEdit({ kind: 'stoneRarity', index, rarity });
                }}
              />
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
  const rows = (stones: readonly number[], id: string, label: string): StatListItem[] =>
    RARITIES.filter((rarity) => (stones[rarity] ?? 0) > SHOWN_AT_LEAST).map((rarity) => {
      const expected = stones[rarity] ?? 0;
      const held = owned[rarity] ?? 0;
      return {
        id: `${id}-${String(rarity)}`,
        label: sub(label, { rarity: labels.rarityName(rarity) }),
        icon: <StoneIcon rarity={rarity} small />,
        value: (
          <span data-testid={`forge-fact-${id}-${String(rarity)}`} className={shortOf(expected, held) ? 'text-warn' : undefined}>
            {sub(t.forgeStonesUse, { expected: labels.rolls(expected), owned: labels.count(held) })}
          </span>
        ),
      };
    });
  return rows(forecast.stones, 'stones', t.forgeFactStones);
}

/** What the run will do with the stones before the button is pressed, one line for each kind it may
 *  spend: none held, fewer held than the climb expects, or enough. */
export function ForgeStonesNotice({
  ranges,
  forecast,
  owned,
  labels,
}: {
  ranges: readonly ResolvedStoneRange[];
  forecast: ForgePlanForecast | null;
  owned: readonly number[];
  labels: ForgeLabels;
}) {
  const t = useCopy();
  const kinds = RARITIES.filter((rarity) =>
    ranges.some((range) => range.rarity === rarity && range.to > FORGE_GUARANTEED),
  );
  return (
    <>
      {kinds.map((rarity) => {
        const held = owned[rarity] ?? 0;
        const expected = forecast?.stones[rarity] ?? 0;
        const short = held > 0 && shortOf(expected, held);
        const values = {
          rarity: labels.rarityName(rarity),
          owned: labels.count(held),
          expected: labels.rolls(expected),
        };
        let text = t.forgeStonesNotice;
        if (held === 0) text = t.forgeStonesNoticeNone;
        else if (short) text = t.forgeStonesShort;
        return (
          <p
            key={rarity}
            data-testid="forge-stones-notice"
            data-rarity={rarity}
            data-state={held === 0 ? 'none' : short ? 'short' : 'enough'}
            className={cn('m-0', 'flex', 'items-center', 'gap-1.5', 'text-xs', held === 0 || short ? 'text-warn' : 'text-ink')}
          >
            <StoneIcon rarity={rarity} small dim={held === 0} />
            <span>{sub(text, values)}</span>
          </p>
        );
      })}
    </>
  );
}

/** The stones a run has used up, by kind — an icon and a count each, nothing when none. */
export function ForgeStonesUsed({ used, labels }: { used: readonly number[]; labels: ForgeLabels }) {
  const t = useCopy();
  const kinds = RARITIES.filter((rarity) => (used[rarity] ?? 0) > 0);
  if (kinds.length === 0) return null;
  return (
    <span data-testid="forge-stones-used" role="group" aria-label={t.forgeResultStonesUsed} className="flex items-center gap-2">
      {kinds.map((rarity) => (
        <span key={rarity} data-testid="forge-stones-used-kind" data-rarity={rarity} className="flex items-center gap-0.5 tabular-nums">
          <StoneIcon rarity={rarity} small />
          <span className="font-mono">{`×${labels.count(used[rarity] ?? 0)}`}</span>
        </span>
      ))}
    </span>
  );
}
