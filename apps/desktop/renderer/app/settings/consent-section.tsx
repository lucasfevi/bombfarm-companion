/**
 * The consent revoke/re-allow control — built from the same three shipped `@bombfarm/ui`
 * primitives as `language-section.tsx` (`SettingsSection` → `SettingsRow` → `Button`,
 * `docs/base-ui-first.md`). A `Switch` would fit an ordinary settings flag, but granting here
 * must re-show the disclosure text rather than flip instantly, so `Button` is the right call per
 * `docs/base-ui-first.md` rule 3's own exception.
 *
 * Presentational only — `page.tsx` owns the consent record and the `consent:*` invokes; this
 * component never touches `window.bfc` itself.
 */
import { Button, SettingsRow, SettingsSection } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';

export function ConsentSection({
  granted,
  onRevoke,
  onReallow,
}: {
  granted: boolean;
  onRevoke: () => void;
  onReallow: () => void;
}) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsConsentSectionTitle}>
      <SettingsRow
        label={granted ? t.settingsConsentStatusGranted : t.settingsConsentStatusNotGranted}
        help={granted ? t.settingsConsentHelpGranted : t.settingsConsentHelpNotGranted}
      >
        <Button
          type="button"
          variant={granted ? 'ghost' : 'primary'}
          data-testid={granted ? 'settings-consent-revoke' : 'settings-consent-reallow'}
          onClick={granted ? onRevoke : onReallow}
        >
          {granted ? t.settingsConsentRevokeAction : t.settingsConsentReallowAction}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
