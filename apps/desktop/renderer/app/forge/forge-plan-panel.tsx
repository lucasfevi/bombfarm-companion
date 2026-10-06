'use client';

import { useEffect, useState } from 'react';
import type { ForgeStartReason } from '@bombfarm/contracts';
import {
  FORGE_GUARANTEED,
  FORGE_MAX,
  forgeChance,
  forgeFailLevel,
  forgeProtectable,
  forgeScrollCost,
} from '@bombfarm/domain/forge';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { inventoryFieldClass } from '@bombfarm/game-art';
import { Bar, Button, Icon, InfoTip, Panel, PanelHeader, StatList, Stepper, Switch, cn, type StatListItem } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../../lib/copy';
import { stoneForTarget, stonePpForTarget, type ResolvedStoneRange } from '../../lib/forge/forge-stones';
import type { ForgePlan, ForgePlanForecast, ForgeStoneEdit } from '../../lib/forge/use-forge-plan';
import { ForgeGold } from './forge-gold';
import { ForgeQueueAdd } from './forge-queue-add';
import { StoneIcon, StoneTooltip } from './forge-stone-art';
import { ForgeStonesControl, ForgeStonesNotice, forgeStoneFacts } from './forge-stones-panel';
import {
  BLANK,
  forgeLevel,
  forgeReasonText,
  forgeStartRefusalText,
  type ForgeButtonReason,
  type ForgeLabels,
} from './forge-labels';

const GOOD_ODDS = 0.6;
const FAIR_ODDS = 0.4;
/** An armed button disarms itself if the second press does not come — long enough to read the
 *  new label, short enough that a stray press minutes later cannot spend gold. */
export const FORGE_ARM_MS = 5_000;

function oddsClass(chance: number): string {
  if (chance >= GOOD_ODDS) return 'text-up';
  if (chance >= FAIR_ODDS) return 'text-warn';
  return 'text-down';
}

/** The rungs a roll can miss on, from the first past the guaranteed ones up to the target; with a
 *  stone chosen on the certain ones too, so the ladder can show them refused. */
function ladderRungs(upgrade: number, target: number, withCertain: boolean): number[] {
  const first = withCertain ? upgrade + 1 : Math.max(upgrade + 1, FORGE_GUARANTEED + 1);
  return Array.from({ length: Math.max(0, target - first + 1) }, (_, index) => first + index);
}

function LimitField({
  id,
  label,
  placeholder,
  value,
  onChange,
  testId,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (text: string) => void;
  testId: string;
  disabled: boolean;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-muted">
      {label}
      <input
        id={id}
        data-testid={testId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value === null ? '' : String(value)}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => { onChange(event.target.value); }}
        className={cn(inventoryFieldClass, 'min-w-0', 'flex-1', 'font-mono', 'tabular-nums')}
      />
    </label>
  );
}

/** Armed by the first press, disarmed by the clock, by a change of piece or target, or by the
 *  second press — which is the one that forges. */
function useArmedButton(itemId: string, target: number): { armed: boolean; arm: () => void; disarm: () => void } {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
  }, [itemId, target]);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => {
      setArmed(false);
    }, FORGE_ARM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [armed]);
  return {
    armed,
    arm: () => {
      setArmed(true);
    },
    disarm: () => {
      setArmed(false);
    },
  };
}

/** Whether any rung of the climb is one the game offers the Protection Scroll on. */
export function climbOffersScroll(upgrade: number, target: number): boolean {
  for (let rung = upgrade + 1; rung <= target; rung += 1) {
    if (forgeProtectable(rung)) return true;
  }
  return false;
}

function scrollPrices(item: InventoryViewItem, target: number, labels: ForgeLabels, t: Copy): string {
  const prices: string[] = [];
  for (let rung = item.upgrade + 1; rung <= target; rung += 1) {
    if (!forgeProtectable(rung)) continue;
    prices.push(
      sub(t.forgeScrollPrice, { essence: labels.count(forgeScrollCost(item.level, item.rarityIdx, rung)), level: String(rung) }),
    );
  }
  return prices.join(' · ');
}

export function ForgePlanPanel({
  item,
  plan,
  stoneRanges,
  ownedStones,
  running,
  labels,
  onStepTarget,
  onStoneEdit,
  onMaxGoldChange,
  onAttemptsChange,
  onScrollChange,
}: {
  item: InventoryViewItem;
  plan: ForgePlan;
  stoneRanges: readonly ResolvedStoneRange[];
  /** Chance Stones held per rarity, 0…5. */
  ownedStones: readonly number[];
  /** A run is in flight: the controls freeze until it ends. */
  running: boolean;
  labels: ForgeLabels;
  onStepTarget: (delta: 1 | -1) => void;
  onStoneEdit: (edit: ForgeStoneEdit) => void;
  onMaxGoldChange: (text: string) => void;
  onAttemptsChange: (text: string) => void;
  onScrollChange: (on: boolean) => void;
}) {
  const t = useCopy();
  const maxed = item.upgrade >= FORGE_MAX;
  const target = plan.target;
  const offersScroll = !maxed && climbOffersScroll(item.upgrade, target);

  return (
    <Panel data-testid="forge-plan-panel" className="flex flex-col gap-2">
      <PanelHeader title={t.forgePlanTitle} />

      <fieldset disabled={running} data-testid="forge-plan-controls" className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t.forgeTargetLabel}</span>
          <Stepper
            valueClassName="text-sm"
            value={<span data-testid="forge-target">{forgeLevel(target)}</span>}
            onDecrement={() => { onStepTarget(-1); }}
            onIncrement={() => { onStepTarget(1); }}
            decrementLabel={t.forgeTargetLower}
            incrementLabel={t.forgeTargetRaise}
          />
        </div>

        <div className="flex gap-2">
          <LimitField
            id="forge-max-gold"
            testId="forge-max-gold"
            label={t.forgeMaxGoldLabel}
            placeholder={t.forgeMaxGoldPlaceholder}
            value={plan.maxGold}
            onChange={onMaxGoldChange}
            disabled={running}
          />
          <LimitField
            id="forge-attempts"
            testId="forge-attempts"
            label={t.forgeAttemptsLabel}
            placeholder={t.forgeAttemptsPlaceholder}
            value={plan.attempts}
            onChange={onAttemptsChange}
            disabled={running}
          />
        </div>

        {offersScroll ? (
          <div data-testid="forge-scroll" data-state={plan.scroll ? 'on' : 'off'} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-ink">{t.forgeScrollTitle}</span>
              <InfoTip
                label={t.forgeScrollTitle}
                tip={`${t.forgeScrollTip} ${sub(t.forgeScrollPrices, { prices: scrollPrices(item, target, labels, t) })}`}
              />
            </span>
            <div className="flex items-center gap-2">
              <Switch id="forge-scroll-switch" checked={plan.scroll} onCheckedChange={onScrollChange} disabled={running} />
              <label htmlFor="forge-scroll-switch" className="whitespace-nowrap text-xs text-ink">
                {t.forgeScrollLabel}
              </label>
            </div>
          </div>
        ) : null}

        <ForgeStonesControl ranges={stoneRanges} owned={ownedStones} labels={labels} onEdit={onStoneEdit} />
      </fieldset>
    </Panel>
  );
}

export function ForgeForecastPanel({
  item,
  plan,
  forecast,
  stoneRanges,
  ownedStones,
  walletGold,
  reason,
  startRefusal,
  labels,
  onForge,
  onCancel,
}: {
  item: InventoryViewItem;
  plan: ForgePlan;
  forecast: ForgePlanForecast | null;
  stoneRanges: readonly ResolvedStoneRange[];
  /** Chance Stones held per rarity, 0…5. */
  ownedStones: readonly number[];
  walletGold: number | null;
  reason: ForgeButtonReason;
  /** Why main refused the last start, until the next press or a change of piece. */
  startRefusal: ForgeStartReason | null;
  labels: ForgeLabels;
  onForge: () => void;
  onCancel: () => void;
}) {
  const t = useCopy();
  const maxed = item.upgrade >= FORGE_MAX;
  const target = plan.target;
  const anyStone = stoneRanges.some((range) => range.rarity !== null);
  const rungs = ladderRungs(item.upgrade, target, anyStone);
  const ladderColumns = anyStone
    ? 'grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_6.5rem_5rem]'
    : 'grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_5rem]';
  const cancelling = reason === 'cancelling';
  const running = reason === 'running' || cancelling;
  const { armed, arm, disarm } = useArmedButton(item.id, target);
  const scrolled = forecast?.scroll === true;
  const scrollTip = (rung: number) =>
    sub(t.forgeLadderScrollTip, { essence: labels.count(forgeScrollCost(item.level, item.rarityIdx, rung)) });

  const onPress = () => {
    if (running) {
      onCancel();
      return;
    }
    if (reason !== 'ready') return;
    if (!armed) {
      arm();
      return;
    }
    disarm();
    onForge();
  };

  let buttonLabel: string;
  if (cancelling) buttonLabel = t.forgeButtonCancelPending;
  else if (running) buttonLabel = t.forgeButtonCancel;
  else if (armed) buttonLabel = t.forgeButtonConfirm;
  else buttonLabel = sub(t.forgeButton, { target: forgeLevel(maxed ? FORGE_MAX : target) });
  const stoneFacts = forgeStoneFacts(forecast, ownedStones, labels, t);
  const reasonLine = startRefusal === null || armed ? forgeReasonText(reason, t) : forgeStartRefusalText(startRefusal, t);

  const facts: StatListItem[] = [
    { id: 'rolls', label: t.forgeFactRolls, value: <span data-testid="forge-fact-rolls">{forecast ? labels.rolls(forecast.rolls) : BLANK}</span> },
    {
      id: 'gold',
      label: t.forgeFactGold,
      value: <span data-testid="forge-fact-gold">{forecast ? <ForgeGold>{labels.gold(forecast.gold)}</ForgeGold> : BLANK}</span>,
    },
    {
      id: 'essence',
      label: t.forgeFactEssence,
      value: <span data-testid="forge-fact-essence">{forecast ? labels.count(Math.round(forecast.essence)) : BLANK}</span>,
    },
    {
      id: 'bad-run',
      label: t.forgeFactBadRun,
      value: (
        <span data-testid="forge-fact-bad-run">
          {forecast ? (
            <>
              <ForgeGold>{labels.gold(forecast.badRunGold)}</ForgeGold>
              {' · '}
              {sub(t.forgeEssenceAmount, { essence: labels.count(Math.round(forecast.badRunEssence)) })}
            </>
          ) : (
            BLANK
          )}
        </span>
      ),
    },
    {
      id: 'wallet',
      label: t.forgeFactWallet,
      value: <span data-testid="forge-fact-wallet">{walletGold === null ? BLANK : <ForgeGold>{labels.gold(walletGold)}</ForgeGold>}</span>,
    },
  ];
  if (forecast?.other) {
    facts.push({
      id: 'scroll-other',
      label: scrolled ? t.forgeScrollOtherOn : t.forgeScrollOtherOff,
      value: (
        <span data-testid="forge-scroll-other">
          <ForgeGold>{labels.gold(forecast.other.gold)}</ForgeGold>
          {' · '}
          {sub(t.forgeEssenceAmount, { essence: labels.count(Math.round(forecast.other.essence)) })}
        </span>
      ),
    });
  }

  return (
    <Panel data-testid="forge-forecast-panel" className="flex flex-col gap-2">
      <PanelHeader title={t.forgeForecastTitle} />

      {rungs.length > 0 ? (
        <>
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink">{t.forgeLadderTitle}</span>
            <InfoTip label={t.forgeLadderTitle} tip={labels.warning()} />
          </span>
          <ol data-testid="forge-ladder" aria-label={t.forgeLadderCaption} className="m-0 flex list-none flex-col gap-1 p-0">
            {rungs.map((rung) => {
              const base = forgeChance(rung, 0, 0);
              const stone = stoneForTarget(stoneRanges, rung);
              const refused = stone !== null && base >= 1;
              const chance = forgeChance(rung, 0, refused ? 0 : stonePpForTarget(stoneRanges, rung));
              const floor = forgeFailLevel(rung);
              const covered = scrolled && forgeProtectable(rung) && chance < 1;
              return (
                <li
                  key={rung}
                  data-testid="forge-ladder-rung"
                  data-scroll={covered ? 'on' : undefined}
                  className={cn('grid', 'items-center', 'gap-2', 'text-xs', ladderColumns)}
                >
                  <span className="font-mono font-semibold tabular-nums text-ink">{forgeLevel(rung)}</span>
                  <Bar percent={chance * 100} variant={chance >= GOOD_ODDS ? 'best' : 'fill'} />
                  <span className={cn('text-right', 'font-mono', 'tabular-nums', oddsClass(chance))}>{labels.chance(chance)}</span>
                  {anyStone ? (
                    stone === null ? (
                      <span aria-hidden="true" />
                    ) : (
                      <StoneTooltip
                        text={
                          refused
                            ? t.forgeLadderStoneRefused
                            : sub(t.forgeLadderStoneTip, {
                                base: labels.chance(base),
                                bonus: labels.signedPercent(chance - base),
                                final: labels.chance(chance),
                              })
                        }
                        trigger={
                          <span
                            data-testid="forge-ladder-stone"
                            data-state={refused ? 'refused' : 'used'}
                            data-rarity={stone}
                            tabIndex={0}
                            className={cn('flex', 'min-w-0', 'items-center', 'gap-1', 'text-[11px]', 'text-muted')}
                          >
                            <StoneIcon rarity={stone} dim={refused} small />
                            <span className="truncate">
                              {refused ? (
                                t.forgeLadderStoneUnused
                              ) : (
                                <>
                                  {labels.chance(base)} <span className="font-semibold text-ink">{labels.signedPercent(chance - base)}</span>
                                </>
                              )}
                            </span>
                          </span>
                        }
                      />
                    )
                  ) : null}
                  {covered ? (
                    <StoneTooltip
                      text={scrollTip(rung)}
                      trigger={
                        <span
                          data-testid="forge-ladder-scroll"
                          aria-label={scrollTip(rung)}
                          tabIndex={0}
                          className={cn('flex', 'items-center', 'justify-end', 'text-up')}
                        >
                          <Icon name="lock-closed" size="xs" />
                        </span>
                      }
                    />
                  ) : (
                    <span className={cn('truncate', 'text-right', 'font-mono', 'text-[11px]', 'tabular-nums', forgeProtectable(rung) ? 'text-down' : 'text-muted')}>
                      {sub(t.forgeLadderFailTo, { floor: forgeLevel(floor) })}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}

      <StatList items={facts} aria-label={t.forgeForecastTitle} />
      {stoneFacts.length > 0 ? (
        <>
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink">{t.forgeStonesTitle}</span>
            <InfoTip label={t.forgeStonesTitle} tip={t.forgeStoneNote} />
          </span>
          <StatList items={stoneFacts} aria-label={t.forgeStonesTitle} className="[&_>div]:items-center" />
        </>
      ) : null}
      <ForgeStonesNotice ranges={stoneRanges} forecast={forecast} owned={ownedStones} labels={labels} />

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant={running ? 'default' : 'primary'}
          className="w-full"
          disabled={cancelling || (reason !== 'ready' && !running)}
          data-testid="forge-button"
          data-armed={armed ? 'true' : undefined}
          data-pending={cancelling ? 'true' : undefined}
          onClick={onPress}
        >
          {buttonLabel}
        </Button>
        <ForgeQueueAdd itemId={item.id} target={target} itemName={labels.itemName(item)} disabled={maxed} className="w-full" />
        <span data-testid="forge-button-reason" className={cn('text-[11px]', startRefusal === null || armed ? 'text-muted' : 'text-warn')}>
          {reasonLine}
        </span>
      </div>
    </Panel>
  );
}
