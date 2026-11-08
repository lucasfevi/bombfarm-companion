/**
 * The "Start with Windows" switch, built from the same three shipped `@bombfarm/ui` primitives
 * as `game-section.tsx` (`SettingsSection` → `SettingsRow` → `Switch`). Four independent warning
 * slots — not saved, unpackaged, failed, switched off by Windows — are always mounted so a
 * warning appearing or going away never moves the layout (`docs/no-layout-shift.md` rule 1).
 *
 * Presentational only — `page.tsx` owns the stored flag, the login-item status, and the write;
 * this component reaches for no bridge of its own.
 */
import { Banner, SettingsRow, SettingsSection, Switch, cn } from "@bombfarm/ui";
import type { LoginItemBlock, SettingsWriteReason } from "@bombfarm/contracts";
import { SETTINGS_WRITE_REASON_COPY_KEY, useCopy } from "../../lib/copy";

export function StartupSection({
  startWithWindows,
  onStartWithWindowsChange,
  persistWarning,
  loginItemBlock,
}: {
  startWithWindows: boolean;
  onStartWithWindowsChange: (next: boolean) => void;
  persistWarning: SettingsWriteReason | null;
  loginItemBlock: LoginItemBlock | null;
}) {
  const t = useCopy();
  // `not_supported` (a platform without login items) has no copy of its own: it reads as the
  // unpackaged reason and disables the switch the same way, so no block value is left unmapped.
  const unpackaged =
    loginItemBlock === "unpackaged" || loginItemBlock === "not_supported";
  const failed = loginItemBlock === "failed";
  const disabledByWindows = loginItemBlock === "disabled_by_windows";

  return (
    <SettingsSection title={t.settingsStartWithWindowsSectionTitle}>
      <SettingsRow
        label={t.settingsStartWithWindowsLabel}
        help={t.settingsStartWithWindowsHelp}
      >
        <Switch
          checked={startWithWindows}
          onCheckedChange={onStartWithWindowsChange}
          disabled={unpackaged}
          aria-label={t.settingsStartWithWindowsLabel}
          data-testid="settings-start-with-windows-switch"
        />
      </SettingsRow>
      <Banner
        tone="warn"
        title={t.settingsStartWithWindowsNotSavedTitle}
        data-testid="settings-start-with-windows-warning"
        aria-hidden={!persistWarning}
        className={cn(!persistWarning && "invisible")}
      >
        {persistWarning
          ? t[SETTINGS_WRITE_REASON_COPY_KEY[persistWarning]]
          : ""}
      </Banner>
      <Banner
        tone="warn"
        title={t.settingsStartWithWindowsLabel}
        data-testid="settings-start-with-windows-unpackaged"
        aria-hidden={!unpackaged}
        className={cn(!unpackaged && "invisible")}
      >
        {unpackaged ? t.settingsStartWithWindowsUnpackagedText : ""}
      </Banner>
      <Banner
        tone="warn"
        title={t.settingsStartWithWindowsLabel}
        data-testid="settings-start-with-windows-failed"
        aria-hidden={!failed}
        className={cn(!failed && "invisible")}
      >
        {failed ? t.settingsStartWithWindowsFailedText : ""}
      </Banner>
      <Banner
        tone="warn"
        title={t.settingsStartWithWindowsLabel}
        data-testid="settings-start-with-windows-disabled-by-windows"
        aria-hidden={!disabledByWindows}
        className={cn(!disabledByWindows && "invisible")}
      >
        {disabledByWindows
          ? t.settingsStartWithWindowsDisabledByWindowsText
          : ""}
      </Banner>
    </SettingsSection>
  );
}
