'use client';

/**
 * The Account screen — what the account could sell, who it belongs to, and what its House and
 * skill tree grant. Every drawing here is `@bombfarm/account`'s, the same one the web planner
 * shows; this file is their connector, and `account-labels.ts` beside it is their vocabulary.
 *
 * The arrangement is the planner's too, and for the same reason it is not restated here: holdings
 * and identity share the first row, House and tree the second, and `AccountScreenLayout` owns both.
 * Two things differ. Each panel is drawn only when the account sections it reads were usable, so an
 * inventory the game would not give up hides that figure and nothing else. And the heroes component
 * carries a figure at all, which the planner's cannot: the roster the game serves says whether a
 * hero may be sold, and a save export never did.
 */
import { useMemo } from 'react';
import { AccountScreenLayout } from '@bombfarm/account/layout';
import { AccountHouseView, AccountIdentityView, AccountTreeView } from '@bombfarm/account/panels';
import { HoldingsView } from '@bombfarm/account/holdings';
import { Banner, Button, EmptyState, colClass } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import { useAccountView } from '../../lib/account/use-account-view';
import { accountFactsFrom } from '../../lib/account/account-facts';
import { accountHoldingsFrom, holdingsComponents } from '../../lib/account/account-holdings';
import { useMarketSnapshot } from '../../lib/market/use-market-snapshot';
import { quoteAge } from '../inventory/market-labels';
import {
  accountHoldingsLabels,
  accountHouseLabels,
  accountIdentityLabels,
  accountTreeLabels,
} from './account-labels';

export function AccountView({ onOpenInventory }: { onOpenInventory: () => void }) {
  const t = useCopy();
  const { lang, locale } = useLocale();
  const accountViewState = useAccountView();
  const { state: marketState, snapshot } = useMarketSnapshot();

  const view = accountViewState.status === 'loaded' ? accountViewState.view : null;
  const facts = useMemo(() => (view === null ? null : accountFactsFrom(view)), [view]);
  const holdings = useMemo(
    () => (facts === null ? null : accountHoldingsFrom(facts.holdings, snapshot)),
    [facts, snapshot],
  );

  const holdingsLabels = useMemo(() => accountHoldingsLabels(t, locale), [t, locale]);
  const identityLabels = useMemo(() => accountIdentityLabels(t, lang), [t, lang]);
  const houseLabels = useMemo(() => accountHouseLabels(t, lang), [t, lang]);
  const treeLabels = useMemo(() => accountTreeLabels(t, lang), [t, lang]);

  if (accountViewState.status === 'loading') {
    return (
      <div data-testid="account-view">
        <EmptyState title={t.accountLoadingTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'bridge-unavailable') {
    return (
      <div data-testid="account-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'error') {
    // The raw message from main is untranslatable English, so it is carried as diagnostic data
    // only and never rendered as player-facing copy — the treatment the other screens give it.
    return (
      <div data-testid="account-view">
        <Banner
          tone="warn"
          title={t.errorAccountReadFailed}
          data-account-error-detail={accountViewState.message}
        >
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  // Unreachable today — the three states above are the only ones that carry no account. Drawn as
  // the loading state rather than as nothing, so a fourth state added above cannot blank the
  // screen in silence.
  if (facts === null || holdings === null) {
    return (
      <div data-testid="account-view">
        <EmptyState title={t.accountLoadingTitle} />
      </div>
    );
  }

  const publishedUtc = marketState.status === 'ready' ? marketState.view.publishedUtc : null;
  const priceAge =
    publishedUtc === null ? null : sub(t.accountHoldingsPricesUpdated, { age: quoteAge(publishedUtc, t) });
  const nothingReadable = facts.identity === null && facts.house === null && facts.tree === null;

  return (
    <div data-testid="account-view" className={colClass}>
      <AccountScreenLayout
        holdings={
          <>
            <HoldingsView
              {...holdingsComponents(holdings, facts.holdings.heroes, lang)}
              labels={holdingsLabels}
              inventoryLink={
                <Button
                  type="button"
                  variant="text"
                  data-testid="account-holdings-inventory-link"
                  onClick={onOpenInventory}
                >
                  {t.accountHoldingsInventoryLink}
                </Button>
              }
              {...(priceAge === null ? {} : { footnote: priceAge })}
            />
          </>
        }
        meta={
          // The prices inside the holdings section age on their own clock; this is how old the
          // reading of the ACCOUNT is. It dates all four panels rather than any one of them, so it
          // sits under the row — inside a column it would push that panel past its neighbour and
          // leave the two of them not lining up.
          facts.readCapturedAt === null ? null : (
            <p data-testid="account-read-age" className="text-xs text-muted">
              {sub(t.accountReadAge, { age: formatCapturedAt(facts.readCapturedAt, t) })}
            </p>
          )
        }
        identity={
          facts.identity === null ? null : (
            <AccountIdentityView {...facts.identity} labels={identityLabels} />
          )
        }
        house={
          facts.house === null ? null : <AccountHouseView {...facts.house} labels={houseLabels} />
        }
        tree={facts.tree === null ? null : <AccountTreeView {...facts.tree} labels={treeLabels} />}
      />

      {nothingReadable ? (
        <EmptyState title={t.accountUnavailableTitle} description={t.accountUnavailableDescription} />
      ) : null}
    </div>
  );
}
