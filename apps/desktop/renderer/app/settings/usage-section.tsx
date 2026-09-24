import { Banner, SettingsRow, SettingsSection, Switch, buttonRecipe, cn } from '@bombfarm/ui';
import type { SettingsWriteReason } from '@bombfarm/contracts';
import { SETTINGS_WRITE_REASON_COPY_KEY, useCopy } from '../../lib/copy';

export const PRIVACY_POLICY_URL = 'https://bombfarm-companion.app/privacy';

export function UsageSection({
  usagePingEnabled,
  onUsagePingEnabledChange,
  persistWarning,
}: {
  usagePingEnabled: boolean;
  onUsagePingEnabledChange: (next: boolean) => void;
  persistWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsUsageSectionTitle}>
      <SettingsRow label={t.settingsUsagePingLabel} help={t.settingsUsagePingHelp}>
        <Switch
          checked={usagePingEnabled}
          onCheckedChange={onUsagePingEnabledChange}
          aria-label={t.settingsUsagePingLabel}
          data-testid="settings-usage-ping-switch"
        />
      </SettingsRow>
      <Banner
        tone="warn"
        title={t.settingsUsagePingNotSavedTitle}
        data-testid="settings-usage-ping-warning"
        aria-hidden={!persistWarning}
        className={cn(!persistWarning && 'invisible')}
      >
        {persistWarning ? t[SETTINGS_WRITE_REASON_COPY_KEY[persistWarning]] : ''}
      </Banner>
      <SettingsRow label={t.settingsUsagePolicyLabel} help={t.settingsUsagePolicyHelp}>
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noreferrer"
          data-testid="settings-usage-privacy-policy"
          className={buttonRecipe({ variant: 'default' })}
        >
          {t.settingsUsagePolicyAction}
        </a>
      </SettingsRow>
    </SettingsSection>
  );
}
