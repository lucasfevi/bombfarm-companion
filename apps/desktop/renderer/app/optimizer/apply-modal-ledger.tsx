'use client';

/**
 * One line of the modal's step ledger — memoised (this renderer enables no React Compiler, and a
 * run can carry dozens of units) on `unit` (resolved once at confirm time and frozen for the run),
 * `status` (a stable string) and the hero record, so a tick that only moves the elapsed clock
 * re-renders no line that did not change.
 */
import { memo } from 'react';
import type { DomainLang } from '@bombfarm/contracts';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { HeroIdentityChip, ItemIcon, itemPeekFromInventory } from '@bombfarm/game-art';
import { cn, Icon } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import type { ApplyUnitLabel } from '../../lib/optimizer/apply-labels';
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

/** "respec, then 45 points" / "place 45 points" — the call's own words, before the stat-by-stat
 *  placement that gets its own column beside it. */
export function pointsLeadText(unit: ApplyUnitLabel, t: Copy): string {
  return unit.call === 'respec'
    ? sub(t.applyModalLineRespec, { points: unit.points ?? 0 })
    : sub(t.applyModalLineCommit, { points: unit.points ?? 0 });
}

/** "from Bellatrix" / "from Inventory" — where an equip or unequip call's piece came from. */
export function equipOriginText(unit: ApplyUnitLabel, t: Copy): string {
  return sub(t.applyModalFrom, { from: unit.from ?? t.applyModalInventory });
}

const POINTS_GRID = 'grid-cols-[16px_9rem_10.5rem_minmax(0,1fr)]';
const EQUIP_GRID = 'grid-cols-[16px_11rem_1.25rem_minmax(0,1fr)]';

function PointsRowBody({ unit, status, hero, t, lang }: { unit: ApplyUnitLabel; status: UnitStatus; hero: HeroRecord | undefined; t: Copy; lang: DomainLang }) {
  const alloc = unit.alloc ?? [];
  return (
    <>
      <span className="min-w-0 self-center">
        <HeroIdentityChip hero={hero} fallbackName={unit.subject} lang={lang} />
      </span>
      <span className={cn('self-center', 'leading-snug', status === 'next' ? 'text-muted' : 'text-ink')}>{pointsLeadText(unit, t)}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-1 self-center">
        {alloc.map((entry, index) => (
          <span key={`${entry.stat}-${String(index)}`} className="inline-flex items-center gap-1 rounded-sm bg-bg-2 px-1.5 py-0.5 text-[11px] leading-none">
            <span className="font-mono tabular-nums text-ink">{entry.points}</span>
            <span className="text-muted">{entry.stat}</span>
          </span>
        ))}
      </span>
    </>
  );
}

function EquipRowBody({
  unit,
  status,
  hero,
  item,
  t,
  lang,
}: {
  unit: ApplyUnitLabel;
  status: UnitStatus;
  hero: HeroRecord | undefined;
  item: InventoryViewItem | undefined;
  t: Copy;
  lang: DomainLang;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5 self-center">
        {item === undefined ? null : (
          <ItemIcon item={itemPeekFromInventory(item)} size="xs" showLevel={false} showUpgrade={false} peek={{ lang, name: unit.subject }} />
        )}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn('truncate', 'font-semibold', status === 'next' ? 'text-muted' : 'text-ink')}>{unit.subject}</span>
          <span className="truncate text-[11px] text-muted">{equipOriginText(unit, t)}</span>
        </span>
      </span>
      <span aria-hidden className="self-center text-center text-muted">
        →
      </span>
      <span className="flex min-w-0 items-center self-center">
        {unit.to === null ? (
          <span className={cn('min-w-0', status === 'next' ? 'text-muted' : 'text-ink')}>{t.applyModalInventory}</span>
        ) : (
          <HeroIdentityChip hero={hero} fallbackName={unit.to} lang={lang} />
        )}
      </span>
    </>
  );
}

export const ApplyModalLedgerLine = memo(function ApplyModalLedgerLine({
  unit,
  status,
  hero,
  item,
}: {
  unit: ApplyUnitLabel;
  status: UnitStatus;
  hero: HeroRecord | undefined;
  item: InventoryViewItem | undefined;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const pointsUnit = unit.call === 'respec' || unit.call === 'commit';
  return (
    <li
      data-testid="apply-modal-ledger-line"
      data-unit-status={status}
      className={cn('grid', pointsUnit ? POINTS_GRID : EQUIP_GRID, 'items-center', 'gap-x-2.5', 'gap-y-1', 'py-1.5', 'text-[12px]', status === 'next' ? 'opacity-60' : null)}
    >
      <LedgerMark status={status} />
      {pointsUnit ? (
        <PointsRowBody unit={unit} status={status} hero={hero} t={t} lang={lang} />
      ) : (
        <EquipRowBody unit={unit} status={status} hero={hero} item={item} t={t} lang={lang} />
      )}
    </li>
  );
});
