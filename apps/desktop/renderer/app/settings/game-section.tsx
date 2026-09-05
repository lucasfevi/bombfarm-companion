/**
 * The "Restart Bomb Farm if it exits" switch, built from the same three shipped `@bombfarm/ui`
 * primitives as `forge-section.tsx` (`SettingsSection` → `SettingsRow` → `Switch`) with the
 * not-persisted warning in an always-mounted `Banner` (`docs/no-layout-shift.md` rule 1).
 *
 * Presentational only — `page.tsx` owns the stored flag, the persist warning, and the write;
 * this component reaches for no bridge of its own.
 */
import { Banner, SettingsRow, SettingsSection, Switch, cn } from '@bombfarm/ui';
import type { SettingsWriteReason } from '@bombfarm/contracts';
import { SETTINGS_WRITE_REASON_COPY_KEY, useCopy } from '../../lib/copy';

export function GameSection({
  restartGameOnExit,
  onRestartGameOnExitChange,
  persistWarning,
}: {
  restartGameOnExit: boolean;
  onRestartGameOnExitChange: (next: boolean) => void;
  persistWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsGameSectionTitle}>
      <SettingsRow label={t.settingsRestartGameOnExitLabel} help={t.settingsRestartGameOnExitHelp}>
        <Switch
          checked={restartGameOnExit}
          onCheckedChange={onRestartGameOnExitChange}
          aria-label={t.settingsRestartGameOnExitLabel}
          data-testid="settings-restart-game-on-exit-switch"
        />
      </SettingsRow>
      <Banner
        tone="warn"
        title={t.settingsRestartGameOnExitNotSavedTitle}
        data-testid="settings-restart-game-on-exit-warning"
        aria-hidden={!persistWarning}
        className={cn(!persistWarning && 'invisible')}
      >
        {persistWarning ? t[SETTINGS_WRITE_REASON_COPY_KEY[persistWarning]] : ''}
      </Banner>
    </SettingsSection>
  );
}
