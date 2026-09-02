'use client';

/**
 * The Account screen — what the account could sell, who it belongs to, and what its House and
 * skill tree grant. Every drawing here is `@bombfarm/account`'s, the same one the web planner
 * shows; this file is their connector, and `account-labels.ts` beside it is their vocabulary.
 *
 * The layout follows the planner's: holdings first, then identity, then House and tree side by
 * side. Two things differ. Each panel is drawn only when the account sections it reads were
 * usable, so a bag the game would not give up hides the bag figure and nothing else. And the
 * heroes component carries a figure at all, which the planner's cannot: the roster the game serves
 * says whether a hero may be sold, and a save export never did.
 */
import { useMemo } from 'react';
import { AccountHouseView, AccountIdentityView, AccountTreeView } from '@bombfarm/account/panels';
import { HoldingsView } from '@bombfarm/account/holdings';
import { Banner, Button, EmptyState, colClass } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import { useAccountView } from '../../lib/account/use-account-view';
import { accountFactsFrom } from '../../lib/account/account-facts';
import { accountHoldingsFrom } from '../../lib/account/account-holdings';
import { useMarketSnapshot } from '../../lib/market/use-market-snapshot';
import { quoteAge } from '../inventory/market-labels';
import {
  accountHoldingsLabels,
  accountHouseLabels,
  accountIdentityLabels,
  accountTreeLabels,
} from './account-labels';

export function AccountView({ onOpenBag }: { onOpenBag: () => void }) {
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
      <HoldingsView
        total={holdings.total}
        currency={holdings.currency}
        bag={holdings.bag}
        heroes={holdings.heroes}
        skins={holdings.skins}
        labels={holdingsLabels}
        bagLink={
          <Button type="button" variant="text" data-testid="account-holdings-bag-link" onClick={onOpenBag}>
            {t.accountHoldingsBagLink}
          </Button>
        }
        {...(priceAge === null ? {} : { footnote: priceAge })}
      />

      {/* The prices inside the section above age on their own clock; this one is how old the
          reading of the account itself is, and both belong on screen. */}
      {facts.readCapturedAt === null ? null : (
        <p data-testid="account-read-age" className="text-xs text-muted">
          {sub(t.accountReadAge, { age: formatCapturedAt(facts.readCapturedAt, t) })}
        </p>
      )}

      {nothingReadable ? (
        <EmptyState title={t.accountUnavailableTitle} description={t.accountUnavailableDescription} />
      ) : null}

      {facts.identity === null ? null : (
        <AccountIdentityView {...facts.identity} labels={identityLabels} />
      )}

      {/* The design system's own two-column split, restated rather than imported: it lives on a
          deep recipe subpath that resolves only for an app whose tsconfig maps the package to
          source, and this renderer resolves the package through its exports map instead. */}
      <div className="grid grid-cols-1 gap-2.5 min-[720px]:grid-cols-2">
        {facts.house === null ? null : <AccountHouseView {...facts.house} labels={houseLabels} />}
        {facts.tree === null ? null : <AccountTreeView {...facts.tree} labels={treeLabels} />}
      </div>
    </div>
  );
}
