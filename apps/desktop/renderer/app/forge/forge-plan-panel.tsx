'use client';

import { useEffect, useState } from 'react';
import type { ForgeStartReason } from '@bombfarm/contracts';
import { FORGE_MAX, FORGE_SAFE, forgeChance, forgeFailFloor } from '@bombfarm/domain/forge';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { inventoryFieldClass } from '@bombfarm/game-art';
import { Bar, Button, cn, Panel, PanelHeader, StatList, Stepper, type StatListItem } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import type { ForgePlan, ForgePlanForecast } from '../../lib/forge/use-forge-plan';
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

/** The rungs a roll can miss on, from the first past the safe floor up to the target. */
function riskyRungs(upgrade: number, target: number): number[] {
  const first = Math.max(upgrade + 1, FORGE_SAFE + 1);
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
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted">
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
        className={cn(inventoryFieldClass, 'w-full', 'font-mono', 'tabular-nums')}
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

export function ForgePlanPanel({
  item,
  plan,
  forecast,
  walletGold,
  reason,
  startRefusal,
  labels,
  onStepTarget,
  onMaxGoldChange,
  onAttemptsChange,
  onForge,
  onCancel,
}: {
  item: InventoryViewItem;
  plan: ForgePlan;
  forecast: ForgePlanForecast | null;
  walletGold: number | null;
  reason: ForgeButtonReason;
  /** Why main refused the last start, until the next press or a change of piece. */
  startRefusal: ForgeStartReason | null;
  labels: ForgeLabels;
  onStepTarget: (delta: 1 | -1) => void;
  onMaxGoldChange: (text: string) => void;
  onAttemptsChange: (text: string) => void;
  onForge: () => void;
  onCancel: () => void;
}) {
  const t = useCopy();
  const maxed = item.upgrade >= FORGE_MAX;
  const target = plan.target;
  const rungs = riskyRungs(item.upgrade, target);
  const cancelling = reason === 'cancelling';
  const running = reason === 'running' || cancelling;
  const { armed, arm, disarm } = useArmedButton(item.id, target);

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
  const reasonLine = startRefusal === null || armed ? forgeReasonText(reason, t) : forgeStartRefusalText(startRefusal, t);

  const facts: StatListItem[] = [
    { id: 'rolls', label: t.forgeFactRolls, value: <span data-testid="forge-fact-rolls">{forecast ? labels.rolls(forecast.rolls) : BLANK}</span> },
    { id: 'gold', label: t.forgeFactGold, value: <span data-testid="forge-fact-gold">{forecast ? labels.gold(forecast.gold) : BLANK}</span> },
    { id: 'bad-run', label: t.forgeFactBadRun, value: <span data-testid="forge-fact-bad-run">{forecast ? labels.gold(forecast.badRunGold) : BLANK}</span> },
    { id: 'wallet', label: t.forgeFactWallet, value: <span data-testid="forge-fact-wallet">{walletGold === null ? BLANK : labels.gold(walletGold)}</span> },
  ];

  return (
    <Panel data-testid="forge-plan-panel" className="flex flex-col gap-3">
      <PanelHeader title={t.forgePlanTitle} />

      <fieldset disabled={running} data-testid="forge-plan-controls" className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted">{t.forgeTargetLabel}</span>
          <Stepper
            value={<span data-testid="forge-target">{forgeLevel(target)}</span>}
            onDecrement={() => { onStepTarget(-1); }}
            onIncrement={() => { onStepTarget(1); }}
            decrementLabel={t.forgeTargetLower}
            incrementLabel={t.forgeTargetRaise}
          />
          <span data-testid="forge-span" className="text-xs text-muted">
            {maxed ? '' : labels.span(target)}
          </span>
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
      </fieldset>

      {rungs.length > 0 ? (
        <ol data-testid="forge-ladder" aria-label={t.forgeLadderCaption} className="m-0 flex list-none flex-col gap-1 p-0">
          {rungs.map((rung) => {
            const chance = forgeChance(rung);
            const floor = forgeFailFloor(rung);
            return (
              <li key={rung} data-testid="forge-ladder-rung" className="grid grid-cols-[2.5rem_minmax(0,1fr)_3rem_auto] items-center gap-2 text-xs">
                <span className="font-mono font-semibold tabular-nums text-ink">{forgeLevel(rung)}</span>
                <Bar percent={chance * 100} variant={chance >= GOOD_ODDS ? 'best' : 'fill'} />
                <span className={cn('text-right', 'font-mono', 'tabular-nums', oddsClass(chance))}>{labels.chance(chance)}</span>
                <span className={cn('font-mono', 'text-[11px]', 'tabular-nums', floor === 0 ? 'text-down' : 'text-muted')}>
                  {sub(t.forgeLadderFailTo, { floor: forgeLevel(floor) })}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <StatList items={facts} aria-label={t.forgePlanTitle} />

      {maxed ? null : (
        <p data-testid="forge-warning" className="m-0 text-xs text-muted">
          {labels.warning(target, forecast?.safeJumps ?? null)}
        </p>
      )}

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
        <span data-testid="forge-button-reason" className={cn('text-[11px]', startRefusal === null || armed ? 'text-muted' : 'text-warn')}>
          {reasonLine}
        </span>
      </div>
    </Panel>
  );
}
