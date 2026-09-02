/**
 * The support section — built from the same shipped `@bombfarm/ui` primitives as
 * `consent-section.tsx`/`language-section.tsx` (`SettingsSection` → `SettingsRow`), with the
 * labelled shape of `coffee-link.tsx` in the control slot.
 */
import { SettingsRow, SettingsSection } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { CoffeeButtonLink } from '../coffee-link';

export function SupportSection() {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsSupportSectionTitle}>
      <SettingsRow label={t.settingsSupportCoffeeLabel} help={t.settingsSupportCoffeeHelp}>
        <CoffeeButtonLink />
      </SettingsRow>
    </SettingsSection>
  );
}
