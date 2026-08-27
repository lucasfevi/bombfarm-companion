'use client';

import { Banner } from '@bombfarm/ui';
import { setupBannerListClass, setupBannerPClass } from '@bombfarm/ui/panel-field.recipe';
import type { RequiredAccountField } from '@bombfarm/domain/account-required-fields';
import { useAppLang } from '@/shared/context/app-lang';
import type { Strings } from '@/shared/i18n';
import { usePlannerStore, selectMissingRequiredFields } from '@/shared/stores';

/** The Account page's own labels, so the banner does not invent a second vocabulary. */
const FIELD_LABEL_KEY = {
  tree: 'panelTree',
  houseIdx: 'house',
  houseLevel: 'houseLevelLabel',
  phase: 'accountCurrentPhase',
  maxPhase: 'accountMaxPhase',
} as const satisfies Record<RequiredAccountField, keyof Strings>;

/**
 * Mounted in the app shell, so it shows on every page rather than only on Account: the harm
 * lands on the Farm board, where a missing `maxPhase` lets the Respec Advisor recommend
 * spending real gold toward a phase the player cannot enter.
 */
export function AccountMissingFieldsBanner() {
  const { t } = useAppLang();
  const missing = usePlannerStore(selectMissingRequiredFields);
  if (missing == null || missing.length === 0) return null;

  return (
    <Banner tone="warn" title={t.accountMissingFieldsTitle} data-testid="account-missing-fields-banner">
      <ul className={setupBannerListClass}>
        {missing.map((field) => (
          <li key={field}>{t[FIELD_LABEL_KEY[field]]}</li>
        ))}
      </ul>
      <p className={`${setupBannerPClass} mt-1.5`}>{t.accountMissingFieldsBody}</p>
    </Banner>
  );
}
