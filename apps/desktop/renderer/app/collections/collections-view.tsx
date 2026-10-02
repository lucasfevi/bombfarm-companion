'use client';

/**
 * The Collections screen: the bonus the account gets on each axis against its cap, every set's
 * book with its pages, and which pieces in the bag are ready to sacrifice. The state is read from
 * the game when the tab opens and again when the account read shows the totals moved — a piece
 * sacrificed in the game with this tab open. Nothing here sacrifices anything.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCollectionBoard, collectionBagItemsFromInventory, type CollectionBagItem } from '@bombfarm/domain/model';
import { Button, cn, colClass, EmptyState, Tooltip } from '@bombfarm/ui';
import { accountReadRefusalText } from '../../lib/account-read-labels';
import { isSectionUsable, sectionFidelityOf } from '../../lib/account/account-facts';
import { useAccountView } from '../../lib/account/use-account-view';
import { effectiveFilters } from '../../lib/collections/collection-filters';
import { focusBookButton } from '../../lib/collections/collections-focus';
import { useCollectionFilters } from '../../lib/collections/use-collection-filters';
import {
  accountCollectionTotals,
  collectionFreshnessDecision,
  collectionTotalsCovered,
} from '../../lib/collections/collections-fresh';
import { closeBook, filterBooks, pressBook, visibleSelection } from '../../lib/collections/collections-rows';
import { refreshCollections, useCollections } from '../../lib/collections/use-collections';
import { useCollectionsRefresh } from '../../lib/collections/use-collections-refresh';
import { useCopy } from '../../lib/copy';
import { BonusesPanel } from './bonuses-panel';
import { BookDetailPanel } from './book-detail-panel';
import { BooksPanel } from './books-panel';

export function CollectionsView() {
  const t = useCopy();
  const state = useCollections();
  const refresh = useCollectionsRefresh();
  const account = useAccountView();
  const filters = useCollectionFilters();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const snapshot = state.view.snapshot;

  const bag = useMemo<readonly CollectionBagItem[] | null>(() => {
    if (account.status !== 'loaded') return null;
    const { payload } = account.view;
    return isSectionUsable(sectionFidelityOf(payload, 'items')) ? collectionBagItemsFromInventory(payload.items) : null;
  }, [account]);
  const board = useMemo(() => (snapshot === null ? null : buildCollectionBoard(snapshot, bag ?? [])), [snapshot, bag]);
  const bagAvailable = bag !== null;
  const { axis, status, readyOnly } = effectiveFilters(filters, bagAvailable);
  const books = useMemo(
    () => (board === null ? [] : filterBooks(board.sets, { axis, status, readyOnly })),
    [board, axis, status, readyOnly],
  );
  const openCode = visibleSelection(selectedCode, books);
  const selectedBook = board?.sets.find((book) => book.code === openCode) ?? null;
  const restoreFocusTo = useRef<string | null>(null);
  const { setReadyOnly } = filters;

  useEffect(() => {
    if (!bagAvailable) setReadyOnly(false);
  }, [bagAvailable, setReadyOnly]);

  useEffect(() => {
    if (selectedCode !== null && openCode === null) setSelectedCode(null);
  }, [selectedCode, openCode]);

  useEffect(() => {
    const code = restoreFocusTo.current;
    if (openCode !== null || code === null) return;
    restoreFocusTo.current = null;
    focusBookButton(code);
  }, [openCode]);

  const applySelection = (next: { open: string | null; restoreFocusTo: string | null }) => {
    restoreFocusTo.current = next.restoreFocusTo;
    setSelectedCode(next.open);
  };

  useEffect(() => {
    refreshCollections();
  }, []);

  const accountTotals = useMemo(
    () => (account.status === 'loaded' ? accountCollectionTotals(account.view.payload) : null),
    [account],
  );
  const heldTotals = snapshot?.totals ?? null;
  const askedFor = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (askedFor.current === undefined) {
      askedFor.current = collectionTotalsCovered(accountTotals);
      return;
    }
    const decision = collectionFreshnessDecision({ account: accountTotals, held: heldTotals, askedFor: askedFor.current });
    if (!decision.ask) return;
    askedFor.current = decision.key;
    refreshCollections();
  }, [accountTotals, heldTotals]);

  const detailOpen = selectedBook !== null;

  return (
    <Tooltip.Provider>
      <div data-testid="collections-view" data-state={state.status} className={colClass}>
        {board !== null ? (
          <>
            <BonusesPanel board={board} activeAxis={filters.axis} onToggleAxis={filters.toggleAxis} />
            <div
              className={cn(
                'grid',
                'gap-2.5',
                'min-w-0',
                detailOpen ? 'wide:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]' : 'grid-cols-1',
              )}
            >
              <BooksPanel
                board={board}
                books={books}
                filters={filters}
                bagAvailable={bagAvailable}
                selectedCode={openCode}
                onSelect={(code) => {
                  applySelection(pressBook(openCode, code));
                }}
              />
              <BookDetailPanel
                book={selectedBook}
                bagAvailable={bagAvailable}
                onClose={() => {
                  applySelection(closeBook(openCode));
                }}
              />
            </div>
          </>
        ) : state.status === 'loading' ? (
          <EmptyState title={t.shellLoadingLabel} />
        ) : state.status === 'bridge-unavailable' ? (
          <EmptyState title={t.emptyBridgeUnavailableTitle} />
        ) : (
          <EmptyState
            title={t.collectionsEmptyTitle}
            description={t.collectionsEmptyDescription}
            action={
              <Button
                type="button"
                variant="primary"
                data-testid="collections-read-now"
                disabled={refresh.state.kind === 'working'}
                onClick={refresh.request}
              >
                {refresh.state.kind === 'working' ? t.collectionsReading : t.collectionsReadNow}
              </Button>
            }
          >
            {refresh.state.kind === 'refused' ? (
              <p className="m-0 text-xs text-muted" data-testid="collections-refused">
                {accountReadRefusalText(refresh.state.reason, t)}
              </p>
            ) : null}
          </EmptyState>
        )}
      </div>
    </Tooltip.Provider>
  );
}
