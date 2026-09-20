'use client';

/**
 * One line of the modal's step ledger — memoised (this renderer enables no React Compiler, and a
 * run can carry dozens of units) on `unit` (resolved once at confirm time and frozen for the run)
 * and `status` (a stable string), so a tick that only moves the elapsed clock re-renders no line
 * that did not change.
 */
import { memo } from 'react';
import { cn, Icon } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { unitCardText, type ApplyUnitLabel } from '../../lib/optimizer/apply-labels';
import type { UnitStatus } from '../../lib/optimizer/apply-run-reducer';

function LedgerMark({ status }: { status: UnitStatus }) {
  switch (status) {
    case 'ok':
      return <Icon name="check-circle" className="shrink-0 text-up" />;
    case 'skipped':
    case 'failed':
      return <Icon name="exclamation-triangle" className="shrink-0 text-warn" />;
    case 'sent':
      return <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />;
    case 'next':
      return <span aria-hidden className="size-2 shrink-0 rounded-full bg-line" />;
  }
}

export const ApplyModalLedgerLine = memo(function ApplyModalLedgerLine({ unit, status }: { unit: ApplyUnitLabel; status: UnitStatus }) {
  const t = useCopy();
  return (
    <li data-testid="apply-modal-ledger-line" data-unit-status={status} className="flex items-center gap-2 py-1 text-[12px]">
      <LedgerMark status={status} />
      <span className={cn('truncate', status === 'next' ? 'text-muted' : 'text-ink')}>{unitCardText(unit, t)}</span>
    </li>
  );
});
