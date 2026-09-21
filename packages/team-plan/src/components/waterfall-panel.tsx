'use client';

import type { ReactNode } from 'react';
import type { TeamPlan as DomainTeamPlan, WaterfallStep } from '@bombfarm/domain/team-plan/types';
import { Panel, Tooltip, cn, formatCompactNumber, formatNumber, mutedClass, panelHClass, panelTitleClass } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';
import { parseEmphasis } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';
import {
  formatElapsedSeconds,
  scoredPhaseHint,
  scoredPhaseMovedFrom,
  scoredPhaseValue,
  seedStartLabel,
} from '../model/run-summary-copy';
import { AbbreviatedNumber } from './abbreviated-number';
import { FactCell } from './fact-cell';
import { StepCell } from './step-cell';

const stepLabels: Record<WaterfallStep['id'], (t: TeamPlanCopy) => string> = {
  today: (t) => t.teamPlanStepToday,
  gear: (t) => t.teamPlanStepGear,
  respec: (t) => t.teamPlanStepRespec,
};

function withDeltaPlaceholder(template: string, delta: ReactNode) {
  const [before = '', after = ''] = template.split('{delta}');
  return (
    <>
      {before}
      {delta}
      {after}
    </>
  );
}

/** Renders the run meta line's `<em>` spans — the only markup its template ever carries. */
function emphasizedLine(text: string) {
  return parseEmphasis(text).map((part, index) =>
    part.kind === 'em' ? (
      <strong key={index} className="font-semibold text-ink">
        {part.value}
      </strong>
    ) : (
      <span key={index}>{part.value}</span>
    ),
  );
}

export function WaterfallPanel({
  t,
  lang,
  plan,
  copy,
  accountPhase,
  ranOnMainThread,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  plan: DomainTeamPlan;
  copy: TeamPlanObjectiveCopy;
  /** The account's own phase, so the phase card can say when the plan is about another one. */
  accountPhase: number | null;
  /** Whether this run fell back off the background worker — the notice stays outside any fold,
   *  since a hidden warning is no warning. */
  ranOnMainThread: boolean;
}) {
  const saturated = plan.regime === 'saturated';
  const totalDelta = plan.planDps - plan.currentDps;
  const totalPct = plan.currentDps > 0 ? (totalDelta / plan.currentDps) * 100 : 0;
  const totalSign = totalDelta >= 0 ? '+' : '';
  const pctSign = totalPct >= 0 ? '+' : '';

  const metaLine = sub(t.teamPlanRunMetaFooter, {
    seconds: formatElapsedSeconds(plan.run.elapsedMs, lang),
    rounds: String(plan.run.rounds),
    evals: formatNumber(plan.run.evaluations, lang, 0),
    seed: seedStartLabel(t, plan.run.seedUsed),
  });

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanWaterfallTitle}</h2>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <div
          className="mt-1 grid gap-px overflow-hidden rounded-sm border border-line bg-line"
          role="group"
          aria-label={t.teamPlanWaterfallTitle}
        >
          <div className="flex flex-col items-center justify-center bg-[color-mix(in_oklch,var(--accent)_8%,var(--surface))] px-4 py-5 text-center sm:px-5 sm:py-6">
            <p className="m-0 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
              {t.teamPlanTotalGainLabel}
            </p>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <p
                    data-testid="team-plan-total-gain"
                    className={cn(
                      'm-0 mt-2 text-[clamp(1.75rem,4vw,2.35rem)] leading-none font-black tracking-tight tabular-nums',
                      totalDelta < 0 ? 'text-down' : 'text-up',
                    )}
                  />
                }
              >
                {sub(copy.totalGainValue, {
                  delta: `${totalSign}${formatCompactNumber(totalDelta, lang, 1)}`,
                  pct: `${pctSign}${formatNumber(totalPct, lang, 1)}`,
                })}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0 font-mono">
                      {sub(copy.totalGainValue, {
                        delta: `${totalSign}${formatNumber(totalDelta, lang, 0)}`,
                        pct: `${pctSign}${formatNumber(totalPct, lang, 1)}`,
                      })}
                    </p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
            {plan.steps.map((step) => {
              const showDelta = step.id !== 'today' && step.delta !== 0;
              return (
                <StepCell
                  key={step.id}
                  label={stepLabels[step.id](t)}
                  objective={step.objective}
                  delta={showDelta ? step.delta : null}
                  deltaTone={step.delta < 0 ? 'down' : 'up'}
                  lang={lang}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
            <FactCell
              testId="team-plan-phase-card"
              label={t.teamPlanWaterfallPhaseLabel}
              value={scoredPhaseValue(lang, plan)}
              valueTone={plan.scoredPhaseInfeasible ? 'warn' : 'ink'}
              tag={scoredPhaseMovedFrom(t, lang, plan, accountPhase)}
              note={scoredPhaseHint(t, plan)}
            />
            <FactCell
              testId="team-plan-battle-load-card"
              label={t.teamPlanRunSummaryDuty}
              value={sub(t.teamPlanRunSummaryDutyValue, {
                duty: formatNumber(plan.sumDuty, lang, 2),
                slots: String(plan.slots),
              })}
              tag={saturated ? t.teamPlanRegimeSaturated : t.teamPlanRegimeUnderSaturated}
              tagTone={saturated ? 'warn' : 'up'}
            />
          </div>
        </div>
      </Tooltip.Provider>
      {plan.requiresFullPlan ? (
        <p className="m-0 mt-2 text-center text-[12px] text-muted" role="status">
          {withDeltaPlaceholder(
            copy.gearDipNote,
            <AbbreviatedNumber value={plan.gearDipDps} lang={lang} />,
          )}
        </p>
      ) : null}
      <div className="mt-2 space-y-1">
        <p className={`m-0 ${mutedClass}`}>{emphasizedLine(metaLine)}</p>
        {plan.run.budgetExhausted ? (
          <p className="m-0 text-[13px] text-warn" role="status">
            {t.teamPlanBudgetExhausted}
          </p>
        ) : null}
        {ranOnMainThread ? (
          <p className={`m-0 ${mutedClass}`} role="status">
            {t.teamPlanMainThreadFallback}
          </p>
        ) : null}
        {plan.runedHeroNames.length > 0 ? (
          <p className={`m-0 ${mutedClass}`}>
            {sub(t.teamPlanRunedHeroes, { heroes: plan.runedHeroNames.join(', ') })}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
