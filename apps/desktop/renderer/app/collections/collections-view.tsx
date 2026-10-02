'use client';

/**
 * The Collections screen: the bonus the account gets on each axis against its cap, every set's
 * book with its pages, and which pieces in the bag are ready to sacrifice. The state is read from
 * the game when the tab opens and again when the account read shows the totals moved — a piece
 * sacrificed in the game with this tab open. Nothing here sacrifices anything.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCollectionBoard, collectionBagItemsFromInventory, type CollectionBagItem } from '@bombfarm/domain/model';
import { Button, cn, colClass, EmptyState, Tooltip } from '@bombfarm/ui';
import { accountReadRefusalText } from '../../lib/account-read-labels';
import { isSectionUsable, sectionFidelityOf } from '../../lib/account/account-facts';
import { useAccountView } from '../../lib/account/use-account-view';
import { useCollectionFilters } from '../../lib/collections/use-collection-filters';
import {
  accountCollectionTotals,
  collectionFreshnessDecision,
  collectionTotalsCovered,
} from '../../lib/collections/collections-fresh';
import { toggleSelection } from '../../lib/collections/collections-rows';
import { refreshCollections, useCollections } from '../../lib/collections/use-collections';
import { useCollectionsRefresh } from '../../lib/collections/use-collections-refresh';
import { sub, useCopy } from '../../lib/copy';
import { useScreenRefreshRegistration } from '../../lib/refresh/screen-refresh-store';
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
  const selectedBook = board?.sets.find((book) => book.code === selectedCode) ?? null;

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

  const ageLine = useCallback((age: string) => sub(t.collectionsAge, { age }), [t]);
  useScreenRefreshRegistration('collections', {
    capturedAt: state.view.capturedAt,
    stale: false,
    busy: false,
    readState: refresh.state,
    onRefresh: refresh.request,
    ageLine,
  });

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
                detailOpen ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]' : 'grid-cols-1',
              )}
            >
              <BooksPanel
                board={board}
                filters={filters}
                bagAvailable={bag !== null}
                selectedCode={selectedBook?.code ?? null}
                onSelect={(code) => {
                  setSelectedCode(toggleSelection(selectedBook?.code ?? null, code));
                }}
              />
              <BookDetailPanel
                book={selectedBook}
                onClose={() => {
                  setSelectedCode(null);
                }}
              />
            </div>
          </>
        ) : state.status === 'loading' ? (
          <EmptyState title={t.shellLoadingLabel} />
        ) : state.status === 'bridge-unavailable' ? (
          <EmptyState title={t.emptyBridgeUnavailableTitle} />
        ) : (
          <EmptyState title={t.collectionsEmptyTitle} description={t.collectionsEmptyDescription}>
            <Button
              type="button"
              variant="primary"
              data-testid="collections-read-now"
              disabled={refresh.state.kind === 'working'}
              onClick={refresh.request}
            >
              {refresh.state.kind === 'working' ? t.collectionsReading : t.collectionsReadNow}
            </Button>
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
