'use client';

import { useEffect, useState } from 'react';
import { consentTextFor, shouldShowConsentModal, type ConsentRecord } from '@bombfarm/game-api';
import { Button, Dialog } from '@bombfarm/ui';
import { useLocale } from '../lib/copy';

/**
 * The first-run consent modal (MP2 F2, LAR-01 surface half, LAR-03 surface half). Holds no
 * logic of its own — the text comes from `consentTextFor(locale)` and the show/hide decision
 * from `shouldShowConsentModal`, both pure and unit-tested in `packages/game-api`. This
 * component's own behaviour (it shows once, its answer survives restart) is covered only by the
 * Windows Playwright smoke, since this repo's Vitest has no jsdom anywhere (Test Coverage
 * Matrix).
 */
function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

/**
 * `forceOpen` is how Settings' re-allow control reopens the modal for a record
 * `shouldShowConsentModal` would otherwise reject (e.g. `revoked`) — the player must re-read the
 * disclosure before granting again, never just flip a flag. Exported so this gate is directly
 * unit-testable without a renderer (this project has no jsdom).
 */
export function isConsentModalVisible(record: ConsentRecord | null, forceOpen: boolean): boolean {
  return record !== null && (forceOpen || shouldShowConsentModal(record));
}

export function ConsentModal({
  forceOpen = false,
  onDecided,
}: {
  forceOpen?: boolean;
  /** Fires once accept/decline actually lands, so a caller that set `forceOpen` can drop it back
   *  to `false` — otherwise the modal would stay visible after a decision was already made. */
  onDecided?: () => void;
} = {}) {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const { locale } = useLocale();

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) {
      return;
    }

    void bridge
      .invoke('consent:get')
      .then((current) => {
        setRecord(current);
      })
      .catch(() => {
        // Preload bridge unavailable — the modal simply never appears; nothing else in the
        // shell depends on this succeeding.
      });

    return bridge.on('consent:changed', (next) => {
      setRecord(next);
    });
  }, []);

  const respond = (channel: 'consent:accept' | 'consent:decline'): void => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke(channel).then((next) => {
      setRecord(next);
      onDecided?.();
    });
  };

  if (!isConsentModalVisible(record, forceOpen)) {
    return null;
  }

  const text = consentTextFor(locale);

  return (
    <Dialog.Root open modal onOpenChange={() => undefined}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="consent-modal">
          <Dialog.Head>
            <Dialog.Title>{text.title}</Dialog.Title>
          </Dialog.Head>
          <div className="space-y-2" data-testid="consent-modal-body">
            {text.body.map((paragraph) => (
              <p key={paragraph} className="m-0 text-sm text-muted">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              data-testid="consent-decline"
              onClick={() => {
                respond('consent:decline');
              }}
            >
              {text.declineLabel}
            </Button>
            <Button
              type="button"
              variant="primary"
              data-testid="consent-accept"
              onClick={() => {
                respond('consent:accept');
              }}
            >
              {text.acceptLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
