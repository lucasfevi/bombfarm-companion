'use client';

import type { ForgeRunResult } from '@bombfarm/contracts';
import { Bar, Button, cn, StatList, type StatListItem } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { formatAge } from '../../lib/format';
import type { ForgeRunPlan } from '../../lib/forge/forge-run-reducer';
import { ForgeGold } from './forge-gold';
import {
  forgeLevel,
  forgeResultHeading,
  forgeSpendVerdict,
  forgeSpendVerdictText,
  type ForgeLabels,
  type ForgeResultTone,
  type ForgeSpendVerdict,
} from './forge-labels';

const TONE_CLASS: Record<ForgeResultTone, string> = { up: 'text-up', warn: 'text-warn', down: 'text-down' };

const VERDICT_CLASS: Record<ForgeSpendVerdict, string> = {
  exact: 'text-muted',
  under: 'text-up',
  over: 'text-warn',
  worse: 'text-down',
};

/** The three figures share one scale, with a little headroom so the largest marker is not flush
 *  with the track's end. */
const BAR_HEADROOM = 1.05;

function Figure({ testId, label, amount }: { testId: string; label: string; amount: string }) {
  return (
    <span data-testid={testId}>
      {label} <ForgeGold>{amount}</ForgeGold>
    </span>
  );
}

const MIDDOT = <span aria-hidden="true">·</span>;

function AgainstPlan({ spent, plan, labels }: { spent: number; plan: ForgeRunPlan | null; labels: ForgeLabels }) {
  const t = useCopy();
  const forecast = plan?.forecast ?? null;
  if (forecast === null) {
    return (
      <p data-testid="forge-against-plan" data-state="none" className="m-0 text-xs text-muted">
        {t.forgeAgainstNoPlan}
      </p>
    );
  }
  const gold = labels.gold;
  const scale = Math.max(spent, forecast.gold, forecast.badRunGold, 1) * BAR_HEADROOM;
  const percent = (amount: number) => (100 * amount) / scale;
  const verdict = forgeSpendVerdict(spent, forecast);
  const gap =
    verdict === 'exact' || forecast.gold <= 0 ? null : labels.signedPercent((spent - forecast.gold) / forecast.gold);
  return (
    <div data-testid="forge-against-plan" data-state="plan" data-verdict={verdict} className="flex flex-col gap-1.5">
      <p className="m-0 flex flex-wrap items-baseline gap-x-2">
        {gap === null ? null : (
          <span
            data-testid="forge-against-gap"
            className={cn('font-mono', 'text-[19px]', 'font-semibold', 'leading-none', 'tabular-nums', VERDICT_CLASS[verdict])}
          >
            {gap}
          </span>
        )}
        <span data-testid="forge-against-verdict" className="text-sm text-muted">
          {forgeSpendVerdictText(verdict, t)}
        </span>
      </p>
      <div className="relative">
        <Bar percent={percent(spent)} variant={spent <= forecast.gold ? 'best' : 'fill'} />
        <span aria-hidden className="absolute inset-y-0 w-px bg-ink" style={{ left: `${String(percent(forecast.gold))}%` }} />
        <span aria-hidden className="absolute inset-y-0 w-px bg-down" style={{ left: `${String(percent(forecast.badRunGold))}%` }} />
      </div>
      <p data-testid="forge-against-figures" className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-muted">
        <Figure testId="forge-against-spent" label={t.forgeAgainstSpent} amount={gold(spent)} />
        {MIDDOT}
        <Figure testId="forge-against-expected" label={t.forgeAgainstExpected} amount={gold(forecast.gold)} />
        {MIDDOT}
        <Figure testId="forge-against-bad-run" label={t.forgeAgainstBadRun} amount={gold(forecast.badRunGold)} />
      </p>
    </div>
  );
}

export function ForgeResult({
  result,
  plan,
  labels,
  onDone,
}: {
  result: ForgeRunResult;
  plan: ForgeRunPlan | null;
  labels: ForgeLabels;
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
    { id: 'duration', label: t.forgeResultDuration, value: <span data-testid="forge-result-duration">{formatAge(result.durationMs, t)}</span> },
  ];

  return (
    <div data-testid="forge-result" data-stop={result.stop} className="flex flex-col gap-3">
      <h3 data-testid="forge-result-heading" className={cn('m-0', 'text-sm', 'font-semibold', TONE_CLASS[heading.tone])}>
        {heading.text}
      </h3>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <StatList items={facts} aria-label={t.forgeResultClimb} />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] tracking-[0.04em] text-muted uppercase">{t.forgeAgainstPlanTitle}</span>
          <AgainstPlan spent={result.spent} plan={plan} labels={labels} />
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
