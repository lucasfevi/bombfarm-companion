/**
 * MP3 F4 — MIN-16's language control, built from three shipped `@bombfarm/ui` primitives
 * (`SettingsSection` → `SettingsRow` → `Select`) and zero bespoke controls
 * (`docs/base-ui-first.md`). MIN-11's surface half: the not-persisted warning is an
 * always-mounted `Banner` toggled with `invisible`/`aria-hidden` (`docs/no-layout-shift.md` rule
 * 1, `FieldRequired`'s own pattern) rather than a conditionally mounted paragraph that would
 * shift the section's own height on every switch.
 *
 * Presentational only — `page.tsx` owns `locale`/`persistWarning` state and the two
 * `settings:use*` invokes; this component never touches `window.bfc` itself.
 */
import { Banner, SettingsRow, SettingsSection, Select, cn } from '@bombfarm/ui';
import type { AppLocale, SettingsWriteReason } from '@bombfarm/contracts';
import { SETTINGS_WRITE_REASON_COPY_KEY, useCopy } from '../../lib/copy';

export function LanguageSection({
  locale,
  onLocaleChange,
  persistWarning,
}: {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  persistWarning: SettingsWriteReason | null;
}) {
  const t = useCopy();

  return (
    <SettingsSection title={t.settingsLanguageSectionTitle}>
      <SettingsRow label={t.settingsLanguageLabel} help={t.settingsLanguageHelp}>
        <Select
          value={locale}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'en' || next === 'pt-BR') {
              onLocaleChange(next);
            }
          }}
          aria-label={t.settingsLanguageLabel}
        >
          <option value="en">{t.settingsLanguageOptionEnglish}</option>
          <option value="pt-BR">{t.settingsLanguageOptionPortuguese}</option>
        </Select>
      </SettingsRow>
      {/* Always mounted; visibility toggles with persistWarning so the section's own height
          never shifts on a switch (docs/no-layout-shift.md rule 1) — the component test asserts
          the slot is present and empty when persisted, not absent. */}
      <Banner
        tone="warn"
        title={t.settingsLanguageNotSavedTitle}
        data-testid="settings-language-warning"
        aria-hidden={!persistWarning}
        className={cn(!persistWarning && 'invisible')}
      >
        {persistWarning ? t[SETTINGS_WRITE_REASON_COPY_KEY[persistWarning]] : ''}
      </Banner>
    </SettingsSection>
  );
}
