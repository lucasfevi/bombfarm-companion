'use client';

/**
 * One line of the modal's step ledger — memoised (this renderer enables no React Compiler, and a
 * run can carry dozens of units) on `unit` (resolved once at confirm time and frozen for the run),
 * `status` (a stable string) and the hero record, so a tick that only moves the elapsed clock
 * re-renders no line that did not change.
 */
import { memo } from 'react';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { HeroIdentityChip } from '@bombfarm/game-art';
import { cn, Icon } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { unitCardText, type ApplyUnitLabel } from '../../lib/optimizer/apply-labels';
import type { UnitStatus } from '../../lib/optimizer/apply-run-reducer';

/** Every mark sits in the same box, so a dot and a check line up with each other and with the
 *  text beside them. */
function LedgerMark({ status }: { status: UnitStatus }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      {status === 'ok' ? (
        <Icon name="check-circle" className="size-4 text-up" />
      ) : status === 'skipped' || status === 'failed' ? (
        <Icon name="exclamation-triangle" className="size-4 text-warn" />
      ) : (
        <span aria-hidden className={cn('size-2', 'rounded-full', status === 'sent' ? 'animate-pulse' : null, status === 'sent' ? 'bg-accent' : 'bg-line')} />
      )}
    </span>
  );
}

/** "respec, then 45 points: 20 Atk · 15 Crit · 10 CDR" — the stat-by-stat placement after the
 *  call's own words, when the unit carries one. */
export function pointsDetailText(unit: ApplyUnitLabel, t: ReturnType<typeof useCopy>): string {
  const lead = unit.call === 'respec' ? sub(t.applyModalLineRespec, { points: unit.points ?? 0 }) : sub(t.applyModalLineCommit, { points: unit.points ?? 0 });
  const alloc = unit.alloc ?? [];
  if (alloc.length === 0) return lead;
  return `${lead}: ${alloc.map((entry) => `${String(entry.points)} ${entry.stat}`).join(' · ')}`;
}

export const ApplyModalLedgerLine = memo(function ApplyModalLedgerLine({
  unit,
  status,
  hero,
}: {
  unit: ApplyUnitLabel;
  status: UnitStatus;
  hero: HeroRecord | undefined;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const pointsUnit = unit.call === 'respec' || unit.call === 'commit';
  return (
    <li
      data-testid="apply-modal-ledger-line"
      data-unit-status={status}
      className={cn('flex', 'items-center', 'gap-2.5', 'py-1.5', 'text-[12px]', status === 'next' ? 'opacity-60' : null)}
    >
      <LedgerMark status={status} />
      {pointsUnit ? (
        <>
          <span className="shrink-0">
            <HeroIdentityChip hero={hero} fallbackName={unit.subject} lang={lang} />
          </span>
          <span className={cn('min-w-0', 'flex-1', 'leading-snug', status === 'next' ? 'text-muted' : 'text-ink')}>{pointsDetailText(unit, t)}</span>
        </>
      ) : (
        <span className={cn('min-w-0', 'truncate', status === 'next' ? 'text-muted' : 'text-ink')}>{unitCardText(unit, t)}</span>
      )}
    </li>
  );
});
