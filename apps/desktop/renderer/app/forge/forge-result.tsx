'use client';

import type { ForgeRunResult } from '@bombfarm/contracts';
import { FORGE_MAX, forgeChance } from '@bombfarm/domain/forge';
import { Bar, Button, cn, StatList, type StatListItem } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatAge } from '../../lib/format';
import type { ForgeRunPlan } from '../../lib/forge/forge-run-reducer';
import { BLANK, forgeLevel, forgeResultHeading, type ForgeLabels, type ForgeResultTone } from './forge-labels';

const TONE_CLASS: Record<ForgeResultTone, string> = { up: 'text-up', warn: 'text-warn', down: 'text-down' };

/** The three figures share one scale, with a little headroom so the largest marker is not flush
 *  with the track's end. */
const BAR_HEADROOM = 1.05;

function AgainstPlan({ spent, plan, gold }: { spent: number; plan: ForgeRunPlan | null; gold: (amount: number) => string }) {
  const t = useCopy();
  const forecast = plan?.forecast ?? null;
  if (forecast === null) {
    return (
      <p data-testid="forge-against-plan" data-state="none" className="m-0 text-xs text-muted">
        {t.forgeAgainstNoPlan}
      </p>
    );
  }
  const scale = Math.max(spent, forecast.gold, forecast.badRunGold, 1) * BAR_HEADROOM;
  const percent = (amount: number) => (100 * amount) / scale;
  return (
    <div data-testid="forge-against-plan" data-state="plan" className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-x-3 text-xs">
        <span data-testid="forge-against-spent" className="font-semibold text-ink">
          {sub(t.forgeAgainstSpent, { gold: gold(spent) })}
        </span>
        <span className="text-muted">{sub(t.forgeAgainstExpected, { gold: gold(forecast.gold) })}</span>
        <span className="text-muted">{sub(t.forgeAgainstBadRun, { gold: gold(forecast.badRunGold) })}</span>
      </div>
      <div className="relative">
        <Bar percent={percent(spent)} variant={spent <= forecast.gold ? 'best' : 'fill'} />
        <span aria-hidden className="absolute inset-y-0 w-px bg-ink" style={{ left: `${String(percent(forecast.gold))}%` }} />
        <span aria-hidden className="absolute inset-y-0 w-px bg-down" style={{ left: `${String(percent(forecast.badRunGold))}%` }} />
      </div>
    </div>
  );
}

function Bought({
  result,
  plan,
  labels,
  wearerName,
  realisedDelta,
}: {
  result: ForgeRunResult;
  plan: ForgeRunPlan | null;
  labels: ForgeLabels;
  wearerName: string | null;
  realisedDelta: number | null;
}) {
  const t = useCopy();
  const wiped = result.to === 0 && result.from > 0;
  const realised = realisedDelta === null ? BLANK : labels.gain(realisedDelta);
  const promised = plan?.deltaToTarget == null ? BLANK : labels.gain(plan.deltaToTarget);

  let line: string;
  if (wearerName === null) line = t.forgeBoughtNobody;
  else if (wiped) line = sub(t.forgeBoughtWiped, { loss: realised });
  else line = sub(t.forgeBoughtRealised, { delta: realised, hero: wearerName, promised });

  const next =
    result.to >= FORGE_MAX
      ? sub(t.forgeBoughtTop, { level: forgeLevel(result.to) })
      : sub(t.forgeBoughtNext, {
          level: forgeLevel(result.to),
          next: forgeLevel(result.to + 1),
          chance: labels.chance(forgeChance(result.to + 1)),
        });

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span data-testid="forge-bought" className={cn(wiped ? 'text-down' : 'text-ink')}>
        {line}
      </span>
      <span data-testid="forge-bought-next" className="text-muted">
        {next}
      </span>
    </div>
  );
}

export function ForgeResult({
  result,
  plan,
  labels,
  wearerName,
  realisedDelta,
  onDone,
}: {
  result: ForgeRunResult;
  plan: ForgeRunPlan | null;
  labels: ForgeLabels;
  wearerName: string | null;
  realisedDelta: number | null;
  onDone: () => void;
}) {
  const t = useCopy();
  const heading = forgeResultHeading(result, t);

  const facts: StatListItem[] = [
    {
      id: 'climb',
      label: t.forgeResultClimb,
      value: <span data-testid="forge-result-climb">{`${forgeLevel(result.from)} → ${forgeLevel(result.to)}`}</span>,
    },
    {
      id: 'rolls',
      label: t.forgeResultRolls,
      value: (
        <span data-testid="forge-result-rolls">{`${labels.count(result.rolls)} · ${labels.count(result.fails)} · ${labels.count(result.crits)}`}</span>
      ),
    },
    {
      id: 'wallet',
      label: t.forgeResultWalletAfter,
      value: <span data-testid="forge-result-wallet">{result.walletAfter === null ? BLANK : labels.gold(result.walletAfter)}</span>,
    },
    { id: 'duration', label: t.forgeResultDuration, value: <span data-testid="forge-result-duration">{formatAge(result.durationMs, t)}</span> },
  ];

  return (
    <div data-testid="forge-result" data-stop={result.stop} className="flex flex-col gap-3">
      <h3 data-testid="forge-result-heading" className={cn('m-0', 'text-sm', 'font-semibold', TONE_CLASS[heading.tone])}>
        {heading.text}
      </h3>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <StatList items={facts} aria-label={t.forgeResultClimb} />
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.04em] text-muted uppercase">{t.forgeAgainstPlanTitle}</span>
            <AgainstPlan spent={result.spent} plan={plan} gold={labels.gold} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.04em] text-muted uppercase">{t.forgeBoughtTitle}</span>
            <Bought result={result} plan={plan} labels={labels} wearerName={wearerName} realisedDelta={realisedDelta} />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="primary" data-testid="forge-done" onClick={onDone}>
          {t.forgeDone}
        </Button>
      </div>
    </div>
  );
}
