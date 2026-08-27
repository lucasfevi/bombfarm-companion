'use client';

import { Banner } from '@bombfarm/ui';
import { setupBannerListClass, setupBannerPClass } from '@bombfarm/ui/panel-field.recipe';
import type { RequiredAccountField } from '@bombfarm/domain/account-required-fields';
import { useAppLang } from '@/shared/context/app-lang';
import type { Strings } from '@/shared/i18n';
import { usePlannerStore, selectMissingRequiredFields } from '@/shared/stores';

/**
 * Deliberately the SAME labels the Account page prints for these values, so a player who follows
 * the banner there finds the words it used rather than a second vocabulary for the same fields.
 */
const FIELD_LABEL_KEY = {
  tree: 'panelTree',
  houseIdx: 'house',
  houseLevel: 'houseLevelLabel',
  phase: 'accountCurrentPhase',
  maxPhase: 'accountMaxPhase',
} as const satisfies Record<RequiredAccountField, keyof Strings>;

/**
 * Issue #141 — names the required fields the imported save omitted and asks for a fresh export.
 *
 * Shows on every page, not just Account: the harm lands on the Farm board, where a missing
 * `maxPhase` lets the Respec Advisor recommend spending real gold toward a phase the player
 * cannot enter. A player who never opens Account would otherwise never be told.
 *
 * Renders nothing when the store holds `null` — an account stored before this rule existed is
 * not evidence of a bad save, and greeting it with a banner about a save the player may no
 * longer have would be a worse lie than the silence it replaces.
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
