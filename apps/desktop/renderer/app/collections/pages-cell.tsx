'use client';

import { COLLECTION_PIECES_PER_PAGE, type CollectionPageRow, type CollectionSetRow } from '@bombfarm/domain/model';
import { itemRarityLabel } from '@bombfarm/domain/game-labels';
import { rarityTextClass } from '@bombfarm/game-art';
import { cn, Tooltip } from '@bombfarm/ui';
import { formatBonus } from '../../lib/collections/collections-format';
import { pageFill, type PageFill } from '../../lib/collections/collections-rows';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { axisLabel, countOf } from './collections-labels';

const cellBase =
  'inline-flex w-8 justify-center rounded-sm border px-0.5 py-0.5 font-mono text-[11px] leading-none tabular-nums';

function cellClass(fill: PageFill, rarity: number): string {
  if (fill === 'empty') return cn(cellBase, 'border-line text-muted opacity-60');
  if (fill === 'partial') return cn(cellBase, 'border-line', rarityTextClass(rarity));
  return cn(cellBase, 'border-current font-bold bg-[color-mix(in_oklch,currentColor_18%,transparent)]', rarityTextClass(rarity));
}

function PageCell({ page }: { page: CollectionPageRow }) {
  const t = useCopy();
  const { locale, lang } = useLocale();
  const rarity = itemRarityLabel(page.rarity, lang);
  const pieces = countOf(page.pieces, COLLECTION_PIECES_PER_PAGE, t, locale);
  const ariaLabel = sub(t.collectionsPageAria, {
    rarity,
    have: formatCount(page.pieces, locale),
    total: formatCount(COLLECTION_PIECES_PER_PAGE, locale),
  });

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span />}
        role="img"
        aria-label={ariaLabel}
        tabIndex={-1}
        data-testid="collections-page-cell"
        data-rarity={page.rarity}
        data-pieces={page.pieces}
        data-fill={pageFill(page.pieces, COLLECTION_PIECES_PER_PAGE)}
        className={cellClass(pageFill(page.pieces, COLLECTION_PIECES_PER_PAGE), page.rarity)}
      >
        {pieces}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <div className="flex max-w-64 flex-col gap-0.5">
              <p className={cn('m-0 font-semibold', rarityTextClass(page.rarity))}>{sub(t.collectionsPageName, { rarity })}</p>
              <p className="m-0">
                {sub(t.collectionsPagePieces, {
                  have: formatCount(page.pieces, locale),
                  total: formatCount(COLLECTION_PIECES_PER_PAGE, locale),
                })}
              </p>
              {page.effects.map((effect) => (
                <p key={effect.axis} className="m-0 tabular-nums">
                  {sub(t.collectionsPageGrantLine, {
                    axis: axisLabel(effect.axis, t),
                    now: formatBonus(effect.granted, locale),
                    full: formatBonus(effect.full, locale),
                  })}
                </p>
              ))}
              {page.ready > 0 ? (
                <p className="m-0 text-accent">{sub(t.collectionsPageReady, { n: formatCount(page.ready, locale) })}</p>
              ) : null}
            </div>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** The six pages of a book as six compact cells, common first, each coloured by its rarity: empty
 *  dims, a started page shows its count, a full page fills in. */
export function PagesCell({ book }: { book: CollectionSetRow }) {
  return (
    <span className="inline-flex gap-0.5" data-testid="collections-pages">
      {book.pages.map((page) => (
        <PageCell key={page.rarity} page={page} />
      ))}
    </span>
  );
}
