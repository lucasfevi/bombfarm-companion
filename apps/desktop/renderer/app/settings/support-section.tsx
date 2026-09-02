/**
 * The support section — built from the same shipped `@bombfarm/ui` primitives as
 * `consent-section.tsx`/`language-section.tsx` (`SettingsSection` → `SettingsRow`), with the
 * labelled shapes of `coffee-link.tsx` and `referral-link.tsx` in the control slots.
 */
import { SettingsRow, SettingsSection } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { CoffeeButtonLink } from '../coffee-link';
import { ReferralCopyControl } from '../referral-link';

export function SupportSection() {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsSupportSectionTitle}>
      <SettingsRow label={t.settingsSupportCoffeeLabel} help={t.settingsSupportCoffeeHelp}>
        <CoffeeButtonLink />
      </SettingsRow>
      <SettingsRow label={t.settingsSupportReferralLabel} help={t.settingsSupportReferralHelp}>
        <ReferralCopyControl />
      </SettingsRow>
    </SettingsSection>
  );
}
