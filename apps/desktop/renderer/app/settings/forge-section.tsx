/**
 * The "Let Forge spend gold" switch, built from the same three shipped `@bombfarm/ui` primitives
 * as `window-section.tsx` (`SettingsSection` → `SettingsRow` → `Switch`) with the not-persisted
 * warning in an always-mounted `Banner` (`docs/no-layout-shift.md` rule 1).
 *
 * Presentational only — `page.tsx` owns `forgeWritesEnabled`/`persistWarning` state and the
 * `settings:setForgeWritesEnabled` invoke; this component never touches `window.bfc` itself.
 */
import { Banner, SettingsRow, SettingsSection, Switch, cn } from '@bombfarm/ui';
import type { SettingsWriteReason } from '@bombfarm/contracts';
import { SETTINGS_WRITE_REASON_COPY_KEY, useCopy } from '../../lib/copy';

export function ForgeSection({
  forgeWritesEnabled,
  onForgeWritesEnabledChange,
  persistWarning,
}: {
  forgeWritesEnabled: boolean;
  onForgeWritesEnabledChange: (next: boolean) => void;
  persistWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsForgeSectionTitle}>
      <SettingsRow label={t.settingsForgeWritesLabel} help={t.settingsForgeWritesHelp}>
        <Switch
          checked={forgeWritesEnabled}
          onCheckedChange={onForgeWritesEnabledChange}
          aria-label={t.settingsForgeWritesLabel}
          data-testid="settings-forge-writes-switch"
        />
      </SettingsRow>
      <Banner
        tone="warn"
        title={t.settingsForgeWritesNotSavedTitle}
        data-testid="settings-forge-writes-warning"
        aria-hidden={!persistWarning}
        className={cn(!persistWarning && 'invisible')}
      >
        {persistWarning ? t[SETTINGS_WRITE_REASON_COPY_KEY[persistWarning]] : ''}
      </Banner>
    </SettingsSection>
  );
}
