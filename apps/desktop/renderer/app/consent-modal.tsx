'use client';

import { useEffect, useState } from 'react';
import {
  consentTextFor,
  shouldShowConsentModal,
  type ConsentRecord,
  type ConsentText,
} from '@bombfarm/game-api';
import { Button, Dialog } from '@bombfarm/ui';
import { useLocale } from '../lib/copy';

/**
 * The first-run consent modal. Holds no
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

/**
 * The scrollable clause list — its own component (not inlined in `ConsentModalDialog`) so it can
 * be rendered and asserted on directly: `Dialog.Portal`'s children are skipped entirely by
 * `renderToStaticMarkup` (no jsdom in this project), so a heading/text assertion against the full
 * dialog tree would see nothing. Rendered standalone here, outside the portal, it's plain
 * elements with no Base UI portal machinery of their own.
 */
export function ConsentClauseList({ body }: { body: ConsentText['body'] }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
      data-testid="consent-modal-body"
    >
      {body.map((clause) => (
        <div key={clause.heading}>
          <p className="m-0 text-sm font-semibold text-ink">{clause.heading}</p>
          <p className="m-0 text-sm text-muted">{clause.text}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * The dialog's own markup, split out from `ConsentModal` so it renders from a plain `text` prop
 * instead of the bridge-backed `record` state. Exported for the same reason `ConsentClauseList`
 * is — everything from `Dialog.Portal` down is unobservable via `renderToStaticMarkup`, but the
 * component itself still documents the shape callers assemble.
 */
export function ConsentModalDialog({
  text,
  onAccept,
  onDecline,
}: {
  text: ConsentText;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Dialog.Root open modal onOpenChange={() => undefined}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className="!w-[min(92vw,34rem)]" data-testid="consent-modal">
          <Dialog.Head>
            <Dialog.Title>{text.title}</Dialog.Title>
          </Dialog.Head>
          <ConsentClauseList body={text.body} />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" data-testid="consent-decline" onClick={onDecline}>
              {text.declineLabel}
            </Button>
            <Button type="button" variant="primary" data-testid="consent-accept" onClick={onAccept}>
              {text.acceptLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
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

  return (
    <ConsentModalDialog
      text={consentTextFor(locale)}
      onAccept={() => {
        respond('consent:accept');
      }}
      onDecline={() => {
        respond('consent:decline');
      }}
    />
  );
}
