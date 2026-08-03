import type { Strings } from '@/shared/i18n';
import type { StatBreakdown } from '@bombfarm/domain/stat-breakdown';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { groupLabel, ledgerStepNote } from '../model/breakdown-labels';

/**
 * Claim on top; notes under the label; running math right-aligned under the claim.
 * BSP-29/BSP-30 (AC-25, AC-26): ledger step amounts / running totals at 2 dp; the `×` factor
 * stays at 3 dp (already correct — this sweep asserts it, not assumes it).
 */
export function LedgerBody({
  t,
  formatNumber,
  breakdown,
}: {
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
  breakdown: Extract<StatBreakdown, { kind: 'ledger' }>;
}) {
  const last = breakdown.steps.at(-1);
  const stepCount = breakdown.steps.length;
  return (
    <ol className="m-0 list-none p-0">
      {breakdown.steps.map((step, index) => {
        const note = ledgerStepNote(t, formatNumber, step);
        const isBase = step.source === 'base';
        const isLastStep = index === stepCount - 1;
        const previous = breakdown.steps[index - 1];
        const percent = step.pctOfBase;

        let opAmt: string;
        if (isBase) {
          opAmt = formatNumber(step.amount, 2);
        } else if (percent) {
          const term = `${formatNumber(Math.abs(percent.percent), 2)}% × ${formatNumber(percent.base, 2)}`;
          opAmt = percent.percent < 0 ? `− ${term}` : `+ ${term}`;
        } else if (step.op === '×') {
          opAmt = `× ${formatNumber(step.amount, 3)}`;
        } else if (step.amount < 0) {
          opAmt = `− ${formatNumber(Math.abs(step.amount), 2)}`;
        } else {
          opAmt = `+ ${formatNumber(step.amount, 2)}`;
        }

        let formulaInner: string | null = null;
        if (!isBase && previous) {
          if (percent) {
            const term = `(${formatNumber(Math.abs(percent.percent), 2)}% × ${formatNumber(percent.base, 2)})`;
            formulaInner =
              percent.percent < 0
                ? `${formatNumber(previous.running, 2)} − ${term} = `
                : `${formatNumber(previous.running, 2)} + ${term} = `;
          } else if (step.op === '×') {
            formulaInner = `${formatNumber(previous.running, 2)} × ${formatNumber(step.amount, 3)} = `;
          } else if (step.amount < 0) {
            formulaInner = `${formatNumber(previous.running, 2)} − ${formatNumber(Math.abs(step.amount), 2)} = `;
          } else {
            formulaInner = `${formatNumber(previous.running, 2)} + ${formatNumber(step.amount, 2)} = `;
          }
        }

        return (
          <li
            key={`${step.source}-${index}`}
            className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2 py-1.5 text-[11px] ${
              isLastStep
                ? ''
                : 'border-b border-[color-mix(in_oklch,var(--line)_45%,transparent)]'
            }`}
          >
            <span className="text-[10px] font-semibold tabular-nums text-accent" aria-hidden>
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-ink">{groupLabel(t, step.source)}</div>
              {note ? (
                <div className={`mt-0.5 text-[10px] leading-snug ${mutedClass}`}>{note}</div>
              ) : null}
            </div>
            <div className="text-right tabular-nums">
              <div
                className={
                  isBase ? 'font-semibold text-ink' : 'font-semibold text-accent'
                }
              >
                {opAmt}
              </div>
              {/* Always reserve the proof-line slot so birth matches other row heights. */}
              <div
                className={`mt-0.5 text-[10px] leading-snug ${formulaInner ? mutedClass : 'invisible'}`}
                aria-hidden={!formulaInner}
              >
                → {formulaInner ?? '0 + 0 = '}
                <span className={formulaInner ? 'font-semibold text-ink' : undefined}>
                  {formatNumber(step.running, 2)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
      {last ? (
        <li className="mt-1.5 grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border-t border-accent pt-1.5 text-[11px]">
          <span className="text-[10px] font-semibold text-accent" aria-hidden>
            =
          </span>
          <div className="font-bold tracking-wide text-accent uppercase">{t.bdLedgerTotal}</div>
          <div className="text-right text-[13px] font-bold tabular-nums text-ink">
            {formatNumber(last.running, 2)}
          </div>
        </li>
      ) : null}
    </ol>
  );
}
