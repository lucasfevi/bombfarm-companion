/**
 * The manual frame-ring dump control — writes a scrubbed local diagnostics file a player can
 * attach to a bug report. Built from the same shipped `@bombfarm/ui` primitives as
 * `consent-section.tsx`/`language-section.tsx` (`SettingsSection` → `SettingsRow` → `Button`,
 * plus `language-section.tsx`'s always-mounted `Banner` pattern for a result slot that only
 * sometimes has something to say, `docs/no-layout-shift.md` rule 1).
 *
 * Presentational only — `page.tsx` owns the `live:dumpDiagnostics` invoke and its last result;
 * this component never touches `window.bfc` itself.
 */
import type { LiveDiagnosticsDumpOutcome } from '@bombfarm/contracts';
import { Banner, Button, SettingsRow, SettingsSection, cn } from '@bombfarm/ui';
import { DIAGNOSTICS_DUMP_REASON_COPY_KEY, sub, useCopy } from '../../lib/copy';

export function DiagnosticsSection({
  onSave,
  result,
}: {
  onSave: () => void;
  result: LiveDiagnosticsDumpOutcome | null;
}) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsDiagnosticsSectionTitle}>
      <SettingsRow label={t.settingsDiagnosticsSaveLabel} help={t.settingsDiagnosticsSaveHelp}>
        <Button type="button" variant="ghost" data-testid="settings-diagnostics-save" onClick={onSave}>
          {t.settingsDiagnosticsSaveAction}
        </Button>
      </SettingsRow>
      <Banner
        tone={result?.written ? 'ok' : 'warn'}
        title={result ? (result.written ? t.settingsDiagnosticsSavedTitle : t.settingsDiagnosticsNotSavedTitle) : ''}
        data-testid="settings-diagnostics-save-result"
        aria-hidden={!result}
        className={cn(!result && 'invisible')}
      >
        {result
          ? result.written
            ? sub(t.settingsDiagnosticsSavedBody, { path: result.path })
            : t[DIAGNOSTICS_DUMP_REASON_COPY_KEY[result.reason]]
          : ''}
      </Banner>
    </SettingsSection>
  );
}
