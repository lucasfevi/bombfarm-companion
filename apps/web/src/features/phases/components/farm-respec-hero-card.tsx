'use client';

import type { FarmRespecHeroEntry } from '@bombfarm/domain/farm-optimize';
import { Chip, HelpTip, cn } from '@bombfarm/ui';
import { HeroIdentityChip, GoldValue } from '@/shared/game-art';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import { buildHeroCardRows } from '@/features/phases/model/farm-respec-view';
import { formatGold, formatSignedPoints } from '@/features/phases/model/farm-respec-format';

/**
 * One hero's respec split. A CHANGED hero lists all eight keys with the absolute TARGET as the
 * primary column and current + signed delta as secondary columns — a respec refunds
 * everything, so the target is what the player re-spends toward, and the delta is their only
 * basis for judging whether the move is worth it. An UNCHANGED hero renders de-emphasized,
 * identity + two lines, no key table, naming the gold it does NOT cost to leave alone —
 * always present in the list, always visible, never dropped.
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
  const rows = buildHeroCardRows(entry);

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
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-[10px] tracking-[0.03em] text-muted uppercase">
              <th className="pr-1 text-left font-normal">&nbsp;</th>
              <th className="text-right font-normal">{t.farmRespecKeyTarget}</th>
              <th className="pl-2 text-right font-normal">{t.farmRespecKeyCurrent}</th>
              <th className="pl-2 text-right font-normal">{t.farmRespecKeyDelta}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                data-testid={`farm-respec-key-${entry.heroId}-${row.key}`}
                className="border-t border-line/50"
              >
                <td className="py-1 pr-1">
                  <span className="inline-flex items-center gap-1">
                    {t.statFull[row.key]}
                    {row.keep ? (
                      <>
                        <Chip>{t.farmRespecLuckKeep}</Chip>
                        <HelpTip label={t.farmRespecLuckKeep} className="size-4 min-w-0 text-[9px]">
                          {t.farmRespecLuckHint}
                        </HelpTip>
                      </>
                    ) : null}
                  </span>
                </td>
                <td className="py-1 text-right font-bold">{row.target}</td>
                <td className="py-1 pl-2 text-right text-muted">{row.current}</td>
                <td className="py-1 pl-2 text-right text-muted">{formatSignedPoints(row.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
