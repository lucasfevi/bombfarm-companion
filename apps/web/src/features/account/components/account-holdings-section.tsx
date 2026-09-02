'use client';

import Link from 'next/link';
import { HoldingsView } from '@bombfarm/account/holdings';
import { useAppLang } from '@/shared/context/app-lang';
import { SITE_SECTION_HREF } from '@/shared/lib/site-sections';
import { useAccountHoldings } from '../model/use-account-holdings';

/**
 * The bag row's link opens the Inventory as the player last left it — no filter in the URL and
 * nothing written to the stored view — because the figure beside it is over the WHOLE bag, and a
 * link that narrowed the screen would land the reader on a smaller number than the one they clicked.
 */
export function AccountHoldingsSection() {
  const { t } = useAppLang();
  const holdings = useAccountHoldings();

  return (
    <HoldingsView
      {...holdings}
      bagLink={
        <Link
          href={SITE_SECTION_HREF.inventory}
          className="text-xs text-accent underline-offset-2 hover:underline"
        >
          {t.accountHoldingsBagLink}
        </Link>
      }
    />
  );
}
