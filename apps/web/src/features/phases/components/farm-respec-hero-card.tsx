'use client';

import type { FarmRespecHeroEntry } from '@bombfarm/domain/farm-optimize';
import { DeltaTable, type DeltaTableRow, cn } from '@bombfarm/ui';
import { HeroIdentityChip, GoldValue } from '@/shared/game-art';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import { buildHeroCardRows } from '@/features/phases/model/farm-respec-view';
import { formatGold } from '@/features/phases/model/farm-respec-format';

/**
 * One hero's respec split. A CHANGED hero lists all eight keys in the shared `DeltaTable` ledger
 * (now → target → change, chronological — a respec refunds everything, so target is the absolute
 * value the player re-spends toward, and current/change are the two bases for judging whether the
 * move is worth it). Luck's row is `locked` — a compact glyph carries the hint instead of moving
 * it. An UNCHANGED hero renders de-emphasized, identity + two lines, no key table, naming the gold
 * it does NOT cost to leave alone — always present in the list, always visible, never dropped.
 */
export function FarmRespecHeroCard({
  entry,
  hero,
  lang,
  t,
}: {
  entry: FarmRespecHeroEntry;
  hero: HeroRecord | undefined;
  lang: Lang;
  t: Strings;
}) {
  const rows: DeltaTableRow[] = buildHeroCardRows(entry).map((row) => ({
    id: row.key,
    label: t.statFull[row.key],
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
            label: t.colStat,
            now: t.farmRespecKeyCurrent,
            target: t.farmRespecKeyTarget,
            change: t.farmRespecKeyDelta,
          }}
          rows={rows}
          decimals={0}
        />
      ) : (
        <div className="flex flex-col gap-0.5 text-[11px] text-muted">
          <p className="m-0">{t.farmRespecUnchangedNote}</p>
          <p className="m-0">
            <GoldValue>
              {sub(t.farmRespecUnchangedGoldSaved, { gold: formatGold(entry.respecCostGold) })}
            </GoldValue>
          </p>
        </div>
      )}
    </div>
  );
}
