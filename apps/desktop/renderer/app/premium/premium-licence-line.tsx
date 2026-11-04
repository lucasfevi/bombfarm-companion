import type { LicenceState, PremiumLicenceView } from '@bombfarm/contracts';
import { SUPPORT_URL } from '@bombfarm/contracts';
import { useState } from 'react';
import { Button, ConfirmDialog } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatDate } from '../../lib/format';

type LineState = Exclude<LicenceState, 'signed_out' | 'inactive'>;

/** The line for each state; `moved` and `ended` have a shorter first-sentence form until removal is done. */
const LINE_KEY = {
  holds: { done: 'premiumLicenceHolds', pending: 'premiumLicenceHolds' },
  elsewhere: { done: 'premiumLicenceElsewhere', pending: 'premiumLicenceElsewhere' },
  unconfirmed: { done: 'premiumLicenceUnconfirmed', pending: 'premiumLicenceUnconfirmed' },
  mismatch: { done: 'premiumLicenceMismatch', pending: 'premiumLicenceMismatch' },
  moved: { done: 'premiumLicenceMoved', pending: 'premiumLicenceMovedPending' },
  released: { done: 'premiumLicenceReleased', pending: 'premiumLicenceReleased' },
  ended: { done: 'premiumLicenceEnded', pending: 'premiumLicenceEndedPending' },
  move_limit: { done: 'premiumLicenceMoveLimit', pending: 'premiumLicenceMoveLimit' },
} as const satisfies Record<LineState, { done: keyof Copy; pending: keyof Copy }>;

/** States in which the Use Premium on this PC button shows; `move_limit` shows it disabled. */
const BUTTON_STATES: readonly LicenceState[] = ['elsewhere', 'mismatch', 'released', 'moved', 'move_limit'];

/** The `moved` line when the Lease names no holder. */
const MOVED_AWAY_KEY = { done: 'premiumLicenceMovedAway', pending: 'premiumLicenceMovedAwayPending' } as const;

function isLineState(state: LicenceState): state is LineState {
  return state !== 'signed_out' && state !== 'inactive';
}

export function PremiumLicenceLine({
  licence,
  onUseHere,
  supportUrl = SUPPORT_URL,
}: {
  licence: PremiumLicenceView | null;
  onUseHere: () => void;
  supportUrl?: string | null;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const [confirming, setConfirming] = useState(false);
  if (licence === null || !isLineState(licence.state)) return null;

  const nameless = licence.state === 'moved' && (licence.holderName ?? '') === '';
  const keys = nameless ? MOVED_AWAY_KEY : LINE_KEY[licence.state];
  const text = sub(t[licence.removalDone ? keys.done : keys.pending], {
    name: licence.holderName ?? '',
    date: licence.lastMoveAt === undefined ? '' : formatDate(licence.lastMoveAt, locale),
    next: licence.nextMoveAt === undefined ? '' : formatDate(licence.nextMoveAt, locale),
  });

  const words = t.premiumSupportWords;
  const at = licence.state === 'move_limit' ? text.lastIndexOf(words) : -1;
  const line =
    at >= 0 && supportUrl !== null ? (
      <>
        {text.slice(0, at)}
        <a
          href={supportUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="premium-licence-support"
          className="underline"
        >
          {words}
        </a>
        {text.slice(at + words.length)}
      </>
    ) : (
      text
    );

  return (
    <section data-testid="premium-licence" data-state={licence.state} className="flex flex-col gap-2">
      <p data-testid="premium-licence-line" className="text-sm text-ink">
        {line}
      </p>
      {BUTTON_STATES.includes(licence.state) && (licence.state !== 'moved' || licence.removalDone) ? (
        <div>
          <Button
            type="button"
            variant="default"
            data-testid="premium-use-here"
            disabled={licence.state === 'move_limit' || licence.moveInFlight}
            onClick={() => { setConfirming(true); }}
          >
            {t.premiumLicenceUseHere}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t.premiumMoveConfirmTitle}
            description={t.premiumMoveConfirmBody}
            confirmLabel={t.premiumLicenceUseHere}
            cancelLabel={t.premiumMoveConfirmCancel}
            closeLabel={t.confirmDialogClose}
            destructive={false}
            onConfirm={onUseHere}
          />
        </div>
      ) : null}
      {licence.moveFailed ? (
        <p role="status" data-testid="premium-licence-move-failed" className="text-xs text-muted">
          {t.premiumLicenceMoveFailed}
        </p>
      ) : null}
    </section>
  );
}
