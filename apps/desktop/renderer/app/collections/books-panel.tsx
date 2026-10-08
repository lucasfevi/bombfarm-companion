'use client';

import { useMemo, useState } from 'react';
import { COLLECTION_AXES } from '@bombfarm/contracts';
import { levelLabel, setName } from '@bombfarm/domain/game-labels';
import type { CollectionBoard, CollectionSetRow } from '@bombfarm/domain/model';
import { inventoryFieldHeightClass, ItemIcon } from '@bombfarm/game-art';
import {
  Bar,
  Button,
  Chip,
  cn,
  DataTable,
  EmptyState,
  Panel,
  PanelHeader,
  SegmentedToggle,
  Select,
  Switch,
  Tooltip,
} from '@bombfarm/ui';
import {
  effectiveFilters,
  hasActiveFilters,
  type CollectionBonusFilter,
  type CollectionStatusFilter,
} from '../../lib/collections/collection-filters';
import { axisColourStyle } from '../../lib/collections/collections-axis-colour';
import { BOOK_BUTTON_TEST_ID } from '../../lib/collections/collections-focus';
import { fillPercent, formatBonus } from '../../lib/collections/collections-format';
import {
  booksReadyCount,
  DEFAULT_BOOK_SORT,
  nextBookSort,
  sortBooks,
  weaponDefId,
  type BookSort,
  type BookSortKey,
} from '../../lib/collections/collections-rows';
import type { CollectionFiltersHandle } from '../../lib/collections/use-collection-filters';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { COLLECTION_DETAIL_ID } from './book-detail-panel';
import { axisLabel, countOf, readyBooksLabel } from './collections-labels';
import { PagesCell } from './pages-cell';
import { ReadyUnknown } from './ready-unknown';

const EM_DASH = '—';
const LIST_ROWS = 13;
const LIST_ROW_HEIGHT = '2.75rem';

function statusOptions(t: Copy): { id: CollectionStatusFilter; label: string }[] {
  return [
    { id: 'all', label: t.collectionsStatusAll },
    { id: 'started', label: t.collectionsStatusStarted },
    { id: 'complete', label: t.collectionsStatusComplete },
    { id: 'empty', label: t.collectionsStatusEmpty },
  ];
}

function figureTone(value: number): string {
  return value > 0 ? 'text-ink' : 'text-muted';
}

function BookButton({
  book,
  selected,
  onSelect,
}: {
  book: CollectionSetRow;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  const { lang } = useLocale();
  const name = setName(book.code, lang);
  return (
    <button
      type="button"
      aria-expanded={selected}
      aria-controls={COLLECTION_DETAIL_ID}
      aria-label={name}
      data-testid={BOOK_BUTTON_TEST_ID}
      data-set={book.code}
      className={cn(
        'flex', 'w-full', 'min-w-0', 'cursor-pointer', 'items-center', 'gap-2', 'border-0', 'bg-transparent', 'p-0', 'text-left', 'text-inherit',
        'focus-visible:[outline-style:solid]', 'focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-accent',
      )}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(book.code);
      }}
    >
      <ItemIcon item={{ defId: weaponDefId(book), rarityIdx: book.completedRarity ?? 0, level: book.level, upgrade: 0 }} size="xs" showLevel={false} className={cn(book.completedRarity === null && 'opacity-50 grayscale')} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold text-ink" data-testid="collections-book-name">
          {name}
        </span>
        <span className="text-[11px] text-muted tabular-nums">{levelLabel(book.level, lang)}</span>
      </span>
    </button>
  );
}

function EffectLines({
  book,
  read,
  muted = false,
}: {
  book: CollectionSetRow;
  read: (effect: CollectionSetRow['effects'][number]) => number;
  muted?: boolean;
}) {
  const { locale } = useLocale();
  return (
    <span className="flex flex-col items-end">
      {book.effects.map((effect) => (
        <span key={effect.axis} className={muted ? 'text-muted' : figureTone(read(effect))}>
          {formatBonus(read(effect), locale)}
        </span>
      ))}
    </span>
  );
}

function ReadyCell({ book, bagAvailable }: { book: CollectionSetRow; bagAvailable: boolean }) {
  const t = useCopy();
  const { locale } = useLocale();
  if (!bagAvailable) return <ReadyUnknown />;
  if (book.readyInBag === 0) return <span aria-hidden>{EM_DASH}</span>;
  return (
    <span className="flex flex-col items-start gap-0.5" data-testid="collections-ready">
      <Chip variant="small-active" className="ml-0">
        {sub(t.collectionsReadyChip, { n: formatCount(book.readyInBag, locale) })}
      </Chip>
      <span className="flex flex-col font-mono text-[11px] tabular-nums text-up">
        {book.effects.map((effect) => (
          <span key={effect.axis}>{formatBonus(effect.readyGain, locale)}</span>
        ))}
      </span>
    </span>
  );
}

function BookRow({
  book,
  selected,
  bagAvailable,
  onSelect,
}: {
  book: CollectionSetRow;
  selected: boolean;
  bagAvailable: boolean;
  onSelect: (code: string) => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();

  return (
    <DataTable.Row
      data-testid="collections-book-row"
      data-set={book.code}
      data-status={book.status}
      data-selected={selected ? 'true' : 'false'}
      onClick={() => {
        onSelect(book.code);
      }}
      className={cn(
        'cursor-pointer', 'hover:bg-[color-mix(in_oklch,var(--line)_28%,transparent)]',
        selected && 'bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]',
      )}
      style={{ height: LIST_ROW_HEIGHT }}
    >
      <DataTable.RowHeader>
        <BookButton book={book} selected={selected} onSelect={onSelect} />
      </DataTable.RowHeader>
      <DataTable.Cell className="leading-5" data-testid="collections-book-bonus">
        {book.effects.map((effect) => (
          <span
            key={effect.axis}
            data-axis={effect.axis}
            style={axisColourStyle(effect.axis)}
            className="block truncate text-[var(--axis-colour)]"
          >
            {axisLabel(effect.axis, t)}
          </span>
        ))}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className="leading-5" data-testid="collections-book-now">
        <EffectLines book={book} read={(effect) => effect.now} />
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className="leading-5" data-testid="collections-book-max">
        <EffectLines book={book} read={(effect) => effect.max} muted />
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className="leading-5" data-testid="collections-book-left">
        <EffectLines book={book} read={(effect) => effect.remaining} />
      </DataTable.Cell>
      <DataTable.Cell>
        <PagesCell book={book} />
      </DataTable.Cell>
      <DataTable.Cell data-testid="collections-book-pieces">
        <span className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tabular-nums">
            {countOf(book.piecesSacrificed, book.piecesTotal, t, locale)}
          </span>
          <Bar percent={fillPercent(book.piecesSacrificed, book.piecesTotal)} />
        </span>
      </DataTable.Cell>
      <DataTable.Cell>
        <ReadyCell book={book} bagAvailable={bagAvailable} />
      </DataTable.Cell>
    </DataTable.Row>
  );
}

function ReadySwitch({
  checked,
  available,
  count,
  onChange,
}: {
  checked: boolean;
  available: boolean;
  count: number;
  onChange: (checked: boolean) => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<label />}
        tabIndex={available ? undefined : 0}
        data-testid="collections-ready-filter"
        data-available={available ? 'true' : 'false'}
        className={cn(
          'inline-flex', 'items-center', 'gap-2', 'text-xs',
          available ? cn('cursor-pointer', 'text-ink') : cn('cursor-not-allowed', 'text-muted'),
        )}
      >
        <Switch
          checked={checked && available}
          disabled={!available}
          onCheckedChange={onChange}
          aria-label={t.collectionsFilterReady}
          className={cn(!available && 'pointer-events-none')}
        />
        <span>{t.collectionsFilterReady}</span>
        {available ? (
          <span className="text-muted tabular-nums" data-testid="collections-ready-count">
            {readyBooksLabel(count, t, locale)}
          </span>
        ) : null}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-64 text-[11px] leading-snug">
              {available ? t.collectionsFilterReadyTip : t.collectionsFilterReadyUnavailable}
            </p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Every book of the collection that the filters let through, sorted in place. `books` arrives
 *  already filtered, because the screen needs the same list to know whether the open book is still
 *  among those shown. */
export function BooksPanel({
  board,
  books,
  filters,
  bagAvailable,
  selectedCode,
  onSelect,
}: {
  board: CollectionBoard;
  books: readonly CollectionSetRow[];
  filters: CollectionFiltersHandle;
  bagAvailable: boolean;
  selectedCode: string | null;
  onSelect: (code: string) => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const [sort, setSort] = useState<BookSort>(DEFAULT_BOOK_SORT);

  const shown = useMemo(() => sortBooks(books, sort, filters.axis), [books, sort, filters.axis]);
  const readyBooks = useMemo(() => booksReadyCount(board.sets), [board.sets]);
  const filtered = hasActiveFilters(effectiveFilters(filters, bagAvailable));
  const sortProps = {
    sortKey: sort.key,
    sortDir: sort.direction,
    onSort: (key: BookSortKey) => {
      setSort(nextBookSort(sort, key));
    },
  };

  return (
    <Panel data-testid="collections-books" data-state={shown.length === 0 ? 'no-match' : 'books'}>
      <PanelHeader title={t.collectionsBooksTitle}>
        <span className="text-xs tabular-nums text-muted" data-testid="collections-books-count">
          {sub(t.inventoryFilterCount, {
            shown: formatCount(shown.length, locale),
            total: formatCount(board.sets.length, locale),
          })}
        </span>
      </PanelHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="collections-filters">
          <Select
            size="compact"
            value={filters.axis}
            onChange={(event) => {
              filters.setAxis(event.target.value as CollectionBonusFilter);
            }}
            aria-label={t.collectionsFilterBonusLabel}
            className={cn(inventoryFieldHeightClass, 'w-48', 'shrink-0')}
          >
            <option value="all">{t.collectionsFilterBonusAll}</option>
            {COLLECTION_AXES.map((axis) => (
              <option key={axis} value={axis}>
                {axisLabel(axis, t)}
              </option>
            ))}
          </Select>
          <SegmentedToggle
            options={statusOptions(t)}
            value={filters.status}
            onChange={(id) => {
              filters.setStatus(id as CollectionStatusFilter);
            }}
            ariaLabel={t.collectionsFilterStatusLabel}
            className={inventoryFieldHeightClass}
          />
          <ReadySwitch
            checked={filters.readyOnly}
            available={bagAvailable}
            count={readyBooks}
            onChange={filters.setReadyOnly}
          />
        </div>
        {shown.length === 0 ? (
          <EmptyState
            title={t.collectionsNoMatchTitle}
            description={t.collectionsNoMatchDescription}
            headingLevel={3}
            action={
              filtered ? (
                <Button type="button" onClick={filters.clear} data-testid="collections-clear-filters">
                  {t.collectionsClearFilters}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable.Root scrollable maxRows={LIST_ROWS} rowHeight={LIST_ROW_HEIGHT} data-testid="collections-books-scroll">
            <DataTable.Table className="min-w-[53rem] table-fixed">
              <DataTable.Caption>{t.collectionsCaption}</DataTable.Caption>
              <colgroup>
                <col />
                <col className="w-32" />
                <col className="w-[4.25rem]" />
                <col className="w-[4.25rem]" />
                <col className="w-[4.25rem]" />
                <col className="w-[13.75rem]" />
                <col className="w-20" />
                <col className="w-[6.5rem]" />
              </colgroup>
              <DataTable.Head>
                <DataTable.Row>
                  <DataTable.Header<BookSortKey> sortable scope="col" col="level" {...sortProps}>
                    {t.collectionsColumnBook}
                  </DataTable.Header>
                  <DataTable.Header scope="col">{t.collectionsColumnBonus}</DataTable.Header>
                  <DataTable.Header<BookSortKey> sortable scope="col" align="right" col="now" {...sortProps}>
                    {t.collectionsColumnNow}
                  </DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    {t.collectionsColumnMax}
                  </DataTable.Header>
                  <DataTable.Header<BookSortKey> sortable scope="col" align="right" col="remaining" {...sortProps}>
                    {t.collectionsColumnLeft}
                  </DataTable.Header>
                  <DataTable.Header scope="col">{t.collectionsColumnPages}</DataTable.Header>
                  <DataTable.Header<BookSortKey> sortable scope="col" col="pieces" {...sortProps}>
                    {t.collectionsColumnPieces}
                  </DataTable.Header>
                  <DataTable.Header<BookSortKey> sortable scope="col" col="ready" {...sortProps}>
                    {t.collectionsColumnReady}
                  </DataTable.Header>
                </DataTable.Row>
              </DataTable.Head>
              <DataTable.Body data-testid="collections-books-body">
                {shown.map((book) => (
                  <BookRow
                    key={book.code}
                    book={book}
                    selected={book.code === selectedCode}
                    bagAvailable={bagAvailable}
                    onSelect={onSelect}
                  />
                ))}
              </DataTable.Body>
            </DataTable.Table>
          </DataTable.Root>
        )}
      </div>
    </Panel>
  );
}
