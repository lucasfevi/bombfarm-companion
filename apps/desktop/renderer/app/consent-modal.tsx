'use client';

import { useEffect, useState } from 'react';
import { CONSENT_TEXT, shouldShowConsentModal, type ConsentRecord } from '@bombfarm/game-api';
import { Button, Dialog } from '@bombfarm/ui';

/**
 * The first-run consent modal (MP2 F2, LAR-01 surface half, LAR-03 surface half). Holds no
 * logic of its own — the text comes from `CONSENT_TEXT` and the show/hide decision from
 * `shouldShowConsentModal`, both pure and unit-tested in `packages/game-api`. This component's
 * own behaviour (it shows once, its answer survives restart) is covered only by the Windows
 * Playwright smoke, since this repo's Vitest has no jsdom anywhere (Test Coverage Matrix).
 *
 * Presented over a working shell: it never blocks window creation, and declining leaves the
 * rest of the UI usable on stored data (LAR-04).
 */
function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

export function ConsentModal() {
  const [record, setRecord] = useState<ConsentRecord | null>(null);

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
    });
  };

  if (!record || !shouldShowConsentModal(record)) {
    return null;
  }

  return (
    <Dialog.Root open modal onOpenChange={() => undefined}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="consent-modal">
          <Dialog.Head>
            <Dialog.Title>{CONSENT_TEXT.title}</Dialog.Title>
          </Dialog.Head>
          <div className="space-y-2" data-testid="consent-modal-body">
            {CONSENT_TEXT.body.map((paragraph) => (
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
              {CONSENT_TEXT.declineLabel}
            </Button>
            <Button
              type="button"
              variant="primary"
              data-testid="consent-accept"
              onClick={() => {
                respond('consent:accept');
              }}
            >
              {CONSENT_TEXT.acceptLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
