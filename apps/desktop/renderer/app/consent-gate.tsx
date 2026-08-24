'use client';

import type { AppLocale } from '@bombfarm/contracts';
import { isGranted, type ConsentRecord } from '@bombfarm/game-api';
import { Button, EmptyState, Select, SettingsRow } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';

/**
 * Mirrors `isConsentModalVisible` (`consent-modal.tsx`): delegates to `isGranted` rather than
 * re-deriving it, so the gate and the modal can never disagree about what counts as granted.
 * `null` (record not loaded yet) stays hidden so the gate never flashes before the first
 * `consent:get` resolves.
 */
export function isConsentGateVisible(record: ConsentRecord | null): boolean {
  return record !== null && !isGranted(record);
}

export function ConsentGate({
  locale,
  onLocaleChange,
  onReadAgain,
}: {
  locale: AppLocale;
  onLocaleChange: (next: AppLocale) => void;
  onReadAgain: () => void;
}) {
  const t = useCopy();

  return (
    <div data-testid="consent-gate">
      <EmptyState
        title={t.consentGateTitle}
        description={t.consentGateBody}
        action={
          <Button
            type="button"
            variant="primary"
            data-testid="consent-gate-read-again"
            onClick={onReadAgain}
          >
            {t.consentGateReadAgainAction}
          </Button>
        }
      >
        <SettingsRow label={t.consentGateLanguageLabel}>
          <Select
            value={locale}
            onChange={(event) => {
              const next = event.target.value;
              if (next === 'en' || next === 'pt-BR') {
                onLocaleChange(next);
              }
            }}
            aria-label={t.consentGateLanguageLabel}
          >
            <option value="en">{t.settingsLanguageOptionEnglish}</option>
            <option value="pt-BR">{t.settingsLanguageOptionPortuguese}</option>
          </Select>
        </SettingsRow>
      </EmptyState>
    </div>
  );
}
