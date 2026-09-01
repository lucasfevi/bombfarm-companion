'use client';

import type { FarmRespecHeroEntry } from '@bombfarm/domain/farm-optimize';
import { DeltaTable, type DeltaTableRow, cn } from '@bombfarm/ui';
import { HeroIdentityChip } from '@bombfarm/game-art';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { FarmCopy, Lang } from '../copy';
import { buildHeroCardRows } from '../model/farm-respec-view';
import type { FarmStatLabels } from './stat-labels';

/**
 * One hero's respec split. A CHANGED hero lists all eight keys in the shared `DeltaTable` ledger
 * (now → target → change, chronological — a respec refunds everything, so target is the absolute
 * value the player re-spends toward, and current/change are the two bases for judging whether the
 * move is worth it). Luck's row is `locked` — a compact glyph carries the hint instead of moving
 * it. An UNCHANGED hero is its identity alone, de-emphasized: the note and the gold those builds
 * save are stated ONCE above the group rather than repeated on every card. Always present in the
 * list, always visible, never dropped.
 */
export function FarmRespecHeroCard({
  entry,
  hero,
  lang,
  t,
  statLabels,
}: {
  entry: FarmRespecHeroEntry;
  hero: HeroRecord | undefined;
  lang: Lang;
  t: FarmCopy;
  statLabels: FarmStatLabels;
}) {
  const rows: DeltaTableRow[] = buildHeroCardRows(entry).map((row) => ({
    id: row.key,
    label: statLabels.full[row.key],
    now: row.current,
    target: row.target,
    locked: row.keep,
    lockLabel: t.farmRespecLuckKeep,
    lockHint: t.farmRespecLuckHint,
    testId: `farm-respec-key-${entry.heroId}-${row.key}`,
  }));

  return (
    <div
      data-testid={`farm-respec-hero-${entry.heroId}`}
      className={cn(
        'flex flex-col gap-2 rounded-sm border border-line p-2.5',
        !entry.changed && 'opacity-60',
      )}
    >
      <HeroIdentityChip hero={hero} fallbackName={entry.heroName} lang={lang} />

      {entry.changed ? (
        <DeltaTable
          caption={entry.heroName}
          columnLabels={{
            label: statLabels.column,
            now: t.farmRespecKeyCurrent,
            target: t.farmRespecKeyTarget,
            change: t.farmRespecKeyDelta,
          }}
          rows={rows}
          decimals={0}
        />
      ) : null}
    </div>
  );
}
