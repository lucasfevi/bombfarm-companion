/**
 * The main-window always-on-top control, built from three shipped `@bombfarm/ui` primitives
 * (`SettingsSection` → `SettingsRow` → `Switch`) and zero bespoke controls
 * (`docs/base-ui-first.md`). The failure-surfaced half: the not-persisted warning is an
 * always-mounted `Banner` toggled with `invisible`/`aria-hidden` (`docs/no-layout-shift.md` rule
 * 1) rather than a conditionally mounted paragraph that would shift the section's own height on
 * every switch.
 *
 * Presentational only — `page.tsx` owns `alwaysOnTopMain`/`persistWarning` state and the
 * `settings:setAlwaysOnTopMain` invoke; this component never touches `window.bfc` itself.
 */
import { Banner, SettingsRow, SettingsSection, Switch, cn } from '@bombfarm/ui';
import type { SettingsWriteReason } from '@bombfarm/contracts';
import { SETTINGS_WRITE_REASON_COPY_KEY, useCopy } from '../../lib/copy';

export function WindowSection({
  alwaysOnTopMain,
  onAlwaysOnTopMainChange,
  persistWarning,
  alwaysOnTopMini,
  onAlwaysOnTopMiniChange,
  miniPersistWarning,
}: {
  alwaysOnTopMain: boolean;
  onAlwaysOnTopMainChange: (next: boolean) => void;
  persistWarning: SettingsWriteReason | null;
  alwaysOnTopMini: boolean;
  onAlwaysOnTopMiniChange: (next: boolean) => void;
  miniPersistWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsWindowSectionTitle}>
      <SettingsRow label={t.settingsAlwaysOnTopMainLabel} help={t.settingsAlwaysOnTopMainHelp}>
        <Switch
          checked={alwaysOnTopMain}
          onCheckedChange={onAlwaysOnTopMainChange}
          aria-label={t.settingsAlwaysOnTopMainLabel}
        />
      </SettingsRow>
      <Banner
        tone="warn"
        title={t.settingsAlwaysOnTopNotSavedTitle}
        data-testid="settings-always-on-top-warning"
        aria-hidden={!persistWarning}
        className={cn(!persistWarning && 'invisible')}
      >
        {persistWarning ? t[SETTINGS_WRITE_REASON_COPY_KEY[persistWarning]] : ''}
      </Banner>
      <SettingsRow label={t.settingsAlwaysOnTopMiniLabel} help={t.settingsAlwaysOnTopMiniHelp}>
        <Switch
          checked={alwaysOnTopMini}
          onCheckedChange={onAlwaysOnTopMiniChange}
          aria-label={t.settingsAlwaysOnTopMiniLabel}
        />
      </SettingsRow>
      <Banner
        tone="warn"
        title={t.settingsAlwaysOnTopMiniNotSavedTitle}
        data-testid="settings-always-on-top-mini-warning"
        aria-hidden={!miniPersistWarning}
        className={cn(!miniPersistWarning && 'invisible')}
      >
        {miniPersistWarning ? t[SETTINGS_WRITE_REASON_COPY_KEY[miniPersistWarning]] : ''}
      </Banner>
    </SettingsSection>
  );
}
