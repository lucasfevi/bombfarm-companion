import { Tooltip } from '@base-ui/react/tooltip';
import type { Strings } from '@/shared/i18n';
import type { BreakdownStatId, StatBreakdown } from '@bombfarm/domain/stat-breakdown';
import { GlossedText } from '@bombfarm/ui';
import { explainFormulaClass } from '@bombfarm/ui/panel-field.recipe';
import { formatBreakdownValue } from '../model/breakdown-labels';
import { resolveFormulaTerms } from '../model/formula-glossary';

export function FormulaBody({
  t,
  formatNumber,
  id,
  breakdown,
}: {
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
  id: BreakdownStatId;
  breakdown: Extract<StatBreakdown, { kind: 'formula' }>;
}) {
  const template = t[breakdown.expressionKey as keyof Strings];
  return (
    <div className="text-[11px]">
      <Tooltip.Provider delay={200} closeDelay={100}>
        {typeof template === 'string' ? (
          <p className="m-0 mb-1.5">
            <GlossedText
              template={template}
              terms={resolveFormulaTerms(breakdown.expressionKey, t)}
            />
          </p>
        ) : null}
      </Tooltip.Provider>
      <code className={`${explainFormulaClass} block`}>{breakdown.substituted}</code>
      <p className="m-0 mt-1.5 flex items-baseline justify-between gap-2 border-t border-accent pt-1.5">
        <span className="font-bold tracking-wide text-accent uppercase">{t.bdLedgerTotal}</span>
        <span className="text-[13px] font-bold tabular-nums text-ink">
          {formatBreakdownValue(id, breakdown.value, formatNumber)}
        </span>
      </p>
    </div>
  );
}
