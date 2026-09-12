'use client';

/**
 * Where each combat figure came from: one collapsed row per stat, opening onto the package's own
 * ledger or formula presentation.
 *
 * The two presentations ship with `@bombfarm/hero`; the group headings and the accordion around
 * them are the host's, which is why neither heading is in the panel copy contract. Nothing here
 * is editable — an accordion row opens and closes and touches no account state.
 */
import { BREAKDOWN_DERIVED_IDS, buildStatBreakdown, type BreakdownStatId, type PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import {
  Accordion,
  Panel,
  Tooltip,
  accordionLedgerBodyClass,
  accordionStackClass,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui';
import { FormulaBody, LedgerBody } from '@bombfarm/hero/components';
import { derivedLabel, formatBreakdownValue, isSheetKey, rowValue } from '@bombfarm/hero/model';
import { sub, useCopy } from '../../lib/copy';
import type { StatPanelCopy } from '../screen-copy';
import { breakdownSheetKeys } from './hero-detail-panels';

export function HeroEffectiveStats({
  t,
  facts,
  formatNumber,
}: {
  t: StatPanelCopy;
  facts: PipelineFacts;
  formatNumber: (n: number, d?: number) => string;
}) {
  const copy = useCopy();
  const sheetIds = breakdownSheetKeys(facts);

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{copy.heroesEffectiveTitle}</h2>
      </div>
      <p className={tipClass}>{copy.heroesEffectiveTip}</p>
      <Tooltip.Provider delay={200} closeDelay={100}>
        {sheetIds.length > 0 && (
          <BreakdownGroup
            t={t}
            facts={facts}
            formatNumber={formatNumber}
            title={copy.heroesEffectiveGroupSheet}
            ids={sheetIds}
          />
        )}
        <BreakdownGroup
          t={t}
          facts={facts}
          formatNumber={formatNumber}
          title={copy.heroesEffectiveGroupDerived}
          ids={BREAKDOWN_DERIVED_IDS}
        />
      </Tooltip.Provider>
    </Panel>
  );
}

function BreakdownGroup({
  t,
  facts,
  formatNumber,
  title,
  ids,
}: {
  t: StatPanelCopy;
  facts: PipelineFacts;
  formatNumber: (n: number, d?: number) => string;
  title: string;
  ids: readonly BreakdownStatId[];
}) {
  const copy = useCopy();

  return (
    <div className="mt-3">
      <h3 className="m-0 mb-1.5 text-[10px] font-bold tracking-[0.08em] text-accent uppercase">
        {title}
      </h3>
      <Accordion.Root multiple className={accordionStackClass}>
        {ids.map((statId) => {
          const label = isSheetKey(statId) ? t.statFull[statId] : derivedLabel(t, statId);
          const breakdown = buildStatBreakdown(statId, facts);
          return (
            <Accordion.Item key={statId} value={statId}>
              <Accordion.Trigger
                tone="row"
                size="compact"
                aria-label={sub(copy.heroesEffectiveTriggerAria, { stat: label })}
              >
                <span className="min-w-0 flex-1 text-left font-medium">{label}</span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-ink">
                  {formatBreakdownValue(statId, rowValue(statId, facts), formatNumber)}
                </span>
              </Accordion.Trigger>
              <Accordion.Panel>
                <div className={accordionLedgerBodyClass}>
                  {breakdown.kind === 'ledger' ? (
                    <LedgerBody t={t} formatNumber={formatNumber} breakdown={breakdown} />
                  ) : (
                    <FormulaBody t={t} formatNumber={formatNumber} id={statId} breakdown={breakdown} />
                  )}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </div>
  );
}
