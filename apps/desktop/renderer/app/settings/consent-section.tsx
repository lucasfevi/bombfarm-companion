/**
 * The consent revoke control — built from the same shipped `@bombfarm/ui` primitives as
 * `language-section.tsx` (`SettingsSection` → `SettingsRow` → `Button`, `docs/base-ui-first.md`).
 *
 * Settings is only reachable behind the permission gate (`page.tsx` hides the nav entirely while
 * consent is not granted), so this section only ever renders for a granted record — there is no
 * not-granted branch to offer a re-allow control for; that path now lives in `consent-gate.tsx`.
 *
 * Presentational only — `page.tsx` owns the consent record and the `consent:*` invokes; this
 * component never touches `window.bfc` itself.
 */
import { Button, SettingsRow, SettingsSection } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';

export function ConsentSection({ onRevoke }: { onRevoke: () => void }) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsConsentSectionTitle}>
      <SettingsRow label={t.settingsConsentStatusGranted} help={t.settingsConsentHelpGranted}>
        <Button type="button" variant="ghost" data-testid="settings-consent-revoke" onClick={onRevoke}>
          {t.settingsConsentRevokeAction}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
