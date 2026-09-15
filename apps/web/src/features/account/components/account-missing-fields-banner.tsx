'use client';

import { Banner } from '@bombfarm/ui';
import { setupBannerListClass, setupBannerPClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore, selectMissingRequiredFields } from '@/shared/stores';
import { FIELD_LABEL_KEY } from '../model/required-field-labels';

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
