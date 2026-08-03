import { sub, type Strings } from '@/shared/i18n';
import { buildStatBreakdown, type BreakdownStatId, type PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import { Accordion } from '@bombfarm/ui';
import {
  accordionLedgerBodyClass,
  accordionStackClass,
} from '@bombfarm/ui/accordion.recipe';
import { derivedLabel, formatBreakdownValue, isSheetKey, rowValue } from '../model/breakdown-labels';
import { LedgerBody } from './stat-breakdown-ledger';
import { FormulaBody } from './stat-breakdown-formula';

export function EffectiveStatGroup({
  t,
  formatNumber,
  facts,
  title,
  ids,
}: {
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
  facts: PipelineFacts;
  title: string;
  ids: readonly BreakdownStatId[];
}) {
  return (
    <div className="mt-3">
      <h3 className="m-0 mb-1.5 text-[10px] font-bold tracking-[0.08em] text-accent uppercase">
        {title}
      </h3>
      <Accordion.Root multiple className={accordionStackClass}>
        {ids.map((statId) => {
          const label = isSheetKey(statId) ? t.statFull[statId] : derivedLabel(t, statId);
          const value = rowValue(statId, facts);
          const breakdown = buildStatBreakdown(statId, facts);
          return (
            <Accordion.Item key={statId} value={statId}>
              <Accordion.Trigger
                tone="row"
                size="compact"
                aria-label={sub(t.bdTriggerAria, { stat: label })}
              >
                <span className="min-w-0 flex-1 text-left font-medium">{label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">
                  {formatBreakdownValue(statId, value, formatNumber)}
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
