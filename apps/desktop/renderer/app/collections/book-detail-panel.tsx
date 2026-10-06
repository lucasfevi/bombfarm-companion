'use client';

import { useEffect, useRef } from 'react';
import { itemRarityLabel, levelLabel, setName } from '@bombfarm/domain/game-labels';
import {
  COLLECTION_PAGES,
  COLLECTION_PIECES_PER_PAGE,
  type CollectionPageRow,
  type CollectionPieceRow,
  type CollectionSetEffectRow,
  type CollectionSetRow,
} from '@bombfarm/domain/model';
import { ItemIcon, rarityDotClass, rarityTextClass } from '@bombfarm/game-art';
import { Button, cn, DataTable, FactTile, Icon, Panel, panelHClass, panelTitleClass, Tooltip, type IconName } from '@bombfarm/ui';
import { formatBonus } from '../../lib/collections/collections-format';
import { axisColourStyle } from '../../lib/collections/collections-axis-colour';
import { weaponDefId } from '../../lib/collections/collections-rows';
import { bringBandIntoView } from '../../lib/forge/run-into-view';
import { useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { axisLabel, countOf, pieceCellLabel, pieceSlotLabel, pieceState, type PieceState } from './collections-labels';
import { ReadyUnknown } from './ready-unknown';

const EM_DASH = '—';

export const COLLECTION_DETAIL_ID = 'collections-book-detail';

const sectionHeadingClass = cn('m-0', 'text-[10.5px]', 'font-semibold', 'uppercase', 'tracking-[0.06em]', 'text-muted');

/** Three placements, each stated by its own range so no rule depends on which of two overlapping
 *  media queries the stylesheet happens to emit last: one stack under `lg`, two columns from `lg`
 *  up to `wide` (effects and pages beside the piece grid, which keeps its natural width), and the
 *  same single stack again from `wide`, where the panel sits beside the table in a narrow column. */
const bodyClass = cn('grid', 'grid-cols-1', 'gap-4', 'lg:max-wide:grid-cols-[minmax(0,1fr)_auto]');

const RARITIES = Array.from({ length: COLLECTION_PAGES }, (_, rarity) => rarity);

function figureTone(value: number): string {
  return value > 0 ? 'text-ink' : 'text-muted';
}

function CloseCorner({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            type="button"
            variant="icon"
            aria-label={label}
            data-testid="collections-detail-close"
            onClick={onClose}
            className={cn('absolute', 'top-1.5', 'right-1.5', 'z-10')}
          >
            <Icon name="x-mark" size="sm" />
          </Button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function EffectFigures({ effect }: { effect: CollectionSetEffectRow }) {
  const t = useCopy();
  const { locale } = useLocale();
  return (
    <div data-testid="collections-detail-effect" data-axis={effect.axis} className="flex flex-col gap-1.5">
      <p
        style={axisColourStyle(effect.axis)}
        className="m-0 text-xs font-semibold text-[var(--axis-colour)]"
        data-testid="collections-detail-effect-heading"
      >
        {axisLabel(effect.axis, t)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <FactTile
          label={t.collectionsColumnNow}
          value={formatBonus(effect.now, locale)}
          valueClassName={figureTone(effect.now)}
          data-testid="collections-detail-now"
        />
        <FactTile
          label={t.collectionsColumnMax}
          value={formatBonus(effect.max, locale)}
          valueClassName="text-muted"
          data-testid="collections-detail-max"
        />
        <FactTile
          label={t.collectionsColumnLeft}
          value={formatBonus(effect.remaining, locale)}
          valueClassName={figureTone(effect.remaining)}
          data-testid="collections-detail-left"
        />
      </div>
    </div>
  );
}

function PageEffectLines({
  page,
  multiEffect,
  read,
}: {
  page: CollectionPageRow;
  multiEffect: boolean;
  read: (effect: CollectionPageRow['effects'][number]) => number;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  return (
    <span className="flex flex-col items-end gap-0.5">
      {page.effects.map((effect) => (
        <span key={effect.axis} className={cn('flex', 'flex-col', 'items-end', 'leading-tight', figureTone(read(effect)))}>
          {multiEffect ? <span className="max-w-24 truncate text-[10px] text-muted">{axisLabel(effect.axis, t)}</span> : null}
          {formatBonus(read(effect), locale)}
        </span>
      ))}
    </span>
  );
}

function PageRow({ page, multiEffect, bagAvailable }: { page: CollectionPageRow; multiEffect: boolean; bagAvailable: boolean }) {
  const t = useCopy();
  const { locale, lang } = useLocale();
  return (
    <DataTable.Row data-testid="collections-detail-page" data-rarity={page.rarity} data-complete={page.complete ? 'true' : 'false'}>
      <DataTable.RowHeader className={cn('font-semibold', rarityTextClass(page.rarity))}>
        {itemRarityLabel(page.rarity, lang)}
      </DataTable.RowHeader>
      <DataTable.Cell align="right" numeric data-testid="collections-detail-page-pieces">
        {countOf(page.pieces, COLLECTION_PIECES_PER_PAGE, t, locale)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid="collections-detail-page-now">
        <PageEffectLines page={page} multiEffect={multiEffect} read={(effect) => effect.granted} />
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid="collections-detail-page-full">
        {page.complete ? (
          <span className="font-sans text-up">{t.collectionsPageComplete}</span>
        ) : (
          <PageEffectLines page={page} multiEffect={multiEffect} read={(effect) => effect.full} />
        )}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid="collections-detail-page-ready">
        {!bagAvailable ? (
          <ReadyUnknown />
        ) : page.ready > 0 ? (
          <span className="font-semibold text-accent">{formatCount(page.ready, locale)}</span>
        ) : (
          EM_DASH
        )}
      </DataTable.Cell>
    </DataTable.Row>
  );
}

function PagesTable({ book, bagAvailable }: { book: CollectionSetRow; bagAvailable: boolean }) {
  const t = useCopy();
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={sectionHeadingClass}>{t.collectionsColumnPages}</h3>
      <DataTable.Root>
        <DataTable.Table>
          <DataTable.Caption>{t.collectionsDetailPagesCaption}</DataTable.Caption>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header scope="col">{t.collectionsDetailPageColumn}</DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.collectionsColumnPieces}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.collectionsDetailGrantsNow}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.collectionsDetailWhenComplete}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.collectionsColumnReady}
              </DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {book.pages.map((page) => (
              <PageRow key={page.rarity} page={page} multiEffect={book.effects.length > 1} bagAvailable={bagAvailable} />
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </div>
  );
}

const markerBase = cn('grid', 'size-3.5', 'place-items-center', 'rounded-full', 'border', 'border-bg');
/** On a piece the marker hangs off the tile's corner; in the legend it sits in the text line. */
const markerPlacement = { corner: cn('absolute', '-right-1', '-bottom-1'), inline: cn('inline-grid', 'shrink-0') } as const;

const markerLook = {
  sacrificed: { icon: 'check', className: cn('bg-up', 'text-bg') },
  ready: { icon: 'archive-box', className: cn('bg-accent', 'text-accent-ink') },
  pending: { icon: 'arrow-path', className: cn('bg-surface', 'text-ink') },
} as const satisfies Record<Exclude<PieceState, 'missing'>, { icon: IconName; className: string }>;

function StateMarker({ state, placement = 'corner' }: { state: Exclude<PieceState, 'missing'>; placement?: keyof typeof markerPlacement }) {
  const look = markerLook[state];
  return (
    <span aria-hidden className={cn(markerBase, markerPlacement[placement], look.className)} data-marker={state}>
      <Icon name={look.icon} size="xs" className="size-2.5" />
    </span>
  );
}

const cellStateClass = {
  sacrificed: '',
  ready: cn('outline', 'outline-2', 'outline-offset-1', 'outline-accent'),
  pending: cn('outline', 'outline-1', 'outline-offset-1', 'outline-dashed', 'outline-ink'),
  missing: cn('opacity-35', 'grayscale'),
} as const satisfies Record<PieceState, string>;

function PieceCell({ piece, rarity }: { piece: CollectionPieceRow; rarity: number }) {
  const t = useCopy();
  const { lang } = useLocale();
  const state = pieceState(piece, rarity);
  const label = pieceCellLabel(piece, rarity, t, lang);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span />}
        role="img"
        aria-label={label}
        tabIndex={-1}
        data-testid="collections-piece"
        data-slot={piece.slot}
        data-rarity={rarity}
        data-state={state}
        className={cn('relative', 'inline-block', 'align-top', 'rounded-sm', cellStateClass[state])}
      >
        <ItemIcon item={{ defId: piece.defId, rarityIdx: rarity, level: piece.level, upgrade: 0 }} size="sm" showLevel={false} />
        {state === 'missing' ? null : <StateMarker state={state} />}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0">{label}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function RarityHeader({ rarity }: { rarity: number }) {
  const { lang } = useLocale();
  const name = itemRarityLabel(rarity, lang);
  return (
    <DataTable.Header scope="col" align="center" className="px-0">
      <Tooltip.Root>
        <Tooltip.Trigger
          render={<span />}
          role="img"
          aria-label={name}
          tabIndex={-1}
          className={cn('block', 'size-2.5', 'rounded-full', rarityDotClass(rarity))}
        />
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className={cn('m-0', 'font-semibold', rarityTextClass(rarity))}>{name}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </DataTable.Header>
  );
}

function PieceGrid({ book }: { book: CollectionSetRow }) {
  const t = useCopy();
  const { lang } = useLocale();
  return (
    <DataTable.Root data-testid="collections-piece-grid">
      <DataTable.Table>
        <DataTable.Caption>{t.collectionsDetailGridCaption}</DataTable.Caption>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header scope="col">{t.collectionsColumnSlot}</DataTable.Header>
            {RARITIES.map((rarity) => (
              <RarityHeader key={rarity} rarity={rarity} />
            ))}
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {book.pieces.map((piece) => (
            <DataTable.Row key={piece.slot} data-testid="collections-piece-row" data-slot={piece.slot}>
              <DataTable.RowHeader className="text-muted">{pieceSlotLabel(piece.slot, lang)}</DataTable.RowHeader>
              {RARITIES.map((rarity) => (
                <DataTable.Cell key={rarity} align="center" className="px-1 py-1">
                  <PieceCell piece={piece} rarity={rarity} />
                </DataTable.Cell>
              ))}
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}

function Legend({ t, bagAvailable }: { t: Copy; bagAvailable: boolean }) {
  const entries: { state: PieceState; label: string }[] = [
    { state: 'sacrificed', label: t.collectionsLegendSacrificed },
    ...(bagAvailable ? [{ state: 'ready' as const, label: t.collectionsLegendReady }] : []),
    { state: 'pending', label: t.collectionsLegendPending },
    { state: 'missing', label: t.collectionsLegendNotSacrificed },
  ];
  return (
    <p data-testid="collections-piece-legend" className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] leading-none text-muted">
      {entries.map((entry) => (
        <span key={entry.state} className="inline-flex items-center gap-1.5" data-state={entry.state}>
          {entry.state === 'missing' ? (
            <span aria-hidden className="inline-block size-3.5 shrink-0 rounded-sm border border-line opacity-35" />
          ) : (
            <StateMarker state={entry.state} placement="inline" />
          )}
          <span>{entry.label}</span>
        </span>
      ))}
    </p>
  );
}

/** One book in full: what each of its effects grants, the six pages with what completing each is
 *  worth, and which of the set's pieces are sacrificed at which rarity. Drawn only while a book is
 *  selected. */
export function BookDetailPanel({
  book,
  bagAvailable,
  onClose,
}: {
  book: CollectionSetRow | null;
  bagAvailable: boolean;
  onClose: () => void;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const band = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const code = book?.code ?? null;

  useEffect(() => {
    if (code === null || band.current === null) return;
    heading.current?.focus({ preventScroll: true });
    bringBandIntoView(band.current, band.current.getBoundingClientRect().height);
  }, [code]);

  if (book === null) return null;

  return (
    <Panel
      id={COLLECTION_DETAIL_ID}
      data-testid="collections-book-detail"
      data-set={book.code}
      className="relative min-w-0"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
    >
      <CloseCorner label={t.collectionsDetailClose} onClose={onClose} />
      <div ref={band}>
        <div className={cn(panelHClass, 'items-center', 'justify-start', 'pr-8')}>
          <ItemIcon item={{ defId: weaponDefId(book), rarityIdx: 0, level: book.level, upgrade: 0 }} size="xs" showLevel={false} />
          <h2 ref={heading} tabIndex={-1} className={cn(panelTitleClass, 'outline-none')} data-testid="collections-detail-heading">
            {setName(book.code, lang)}
          </h2>
          <span className="text-xs text-muted tabular-nums">{levelLabel(book.level, lang)}</span>
        </div>
        <div className={bodyClass} data-testid="collections-detail-body">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3">
              {book.effects.map((effect) => (
                <EffectFigures key={effect.axis} effect={effect} />
              ))}
            </div>
            <PagesTable book={book} bagAvailable={bagAvailable} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className={sectionHeadingClass}>{t.collectionsColumnPieces}</h3>
            {book.pieces.length === 0 ? (
              <p className="m-0 text-xs text-muted" data-testid="collections-no-pieces">
                {t.collectionsNoPieces}
              </p>
            ) : (
              <>
                <PieceGrid book={book} />
                <Legend t={t} bagAvailable={bagAvailable} />
              </>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
