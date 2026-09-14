'use client';

import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { Collapsible, Panel, formatNumber, mutedClass, panelTitleClass } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';
import { parseEmphasis } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';
import { formatElapsedSeconds, seedStartLabel } from '../model/run-summary-copy';

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

export type TeamPlanRunSummaryProps = {
  t: TeamPlanCopy;
  lang: Lang;
  plan: TeamPlan;
  ranOnMainThread: boolean;
  copy: TeamPlanObjectiveCopy;
};

/**
 * How the search went — the sentences behind the gain breakdown's cards, the run's own figures,
 * and the rune caveat. Folded away by default: the phase and field load it used to lead with are
 * cards on the breakdown now, and a reader who wants the rest opens it. The two notices that
 * qualify the figures themselves — a search cut short, a search that ran on the main thread —
 * stay outside the fold, since a hidden warning is no warning.
 */
export function TeamPlanRunSummary(props: TeamPlanRunSummaryProps) {
  const { t, plan, ranOnMainThread } = props;
  return (
    <Panel data-testid="team-plan-run-summary">
      <Collapsible.Root>
        <h2 className={panelTitleClass}>
          <Collapsible.Trigger tone="panel">{t.teamPlanRunSummaryTitle}</Collapsible.Trigger>
        </h2>
        <Collapsible.Panel>
          <TeamPlanRunSummaryBody {...props} />
        </Collapsible.Panel>
      </Collapsible.Root>
      {plan.run.budgetExhausted ? (
        <p className="m-0 mt-2 text-[13px] text-warn" role="status">
          {t.teamPlanBudgetExhausted}
        </p>
      ) : null}
      {ranOnMainThread ? (
        <p className={`m-0 mt-2 ${mutedClass}`} role="status">
          {t.teamPlanMainThreadFallback}
        </p>
      ) : null}
    </Panel>
  );
}

export function TeamPlanRunSummaryBody({ t, lang, plan, copy }: TeamPlanRunSummaryProps) {
  const regimeHint = plan.regime === 'saturated' ? copy.regimeHintSaturated : t.teamPlanRunSummaryRegimeHintUnder;

  const metaLine = sub(t.teamPlanRunMetaFooter, {
    seconds: formatElapsedSeconds(plan.run.elapsedMs, lang),
    rounds: String(plan.run.rounds),
    evals: formatNumber(plan.run.evaluations, lang, 0),
    seed: seedStartLabel(t, plan.run.seedUsed),
  });

  return (
    <div className="space-y-2 pt-2.5 text-[13px]" role="status" data-testid="team-plan-run-summary-body">
      <p className={`m-0 ${mutedClass}`}>{regimeHint}</p>
      <p className={`m-0 ${mutedClass}`}>{t.teamPlanRunSummaryDutyHint}</p>
      <p className={`m-0 ${mutedClass}`}>{emphasizedLine(metaLine)}</p>
      {plan.runedHeroNames.length > 0 ? (
        <p className={`m-0 ${mutedClass}`}>
          {sub(t.teamPlanRunedHeroes, { heroes: plan.runedHeroNames.join(', ') })}
        </p>
      ) : null}
    </div>
  );
}
