/**
 * The referral code, in the two shapes the app shows it: a chip in the top bar and a labelled row
 * control in Settings. Both copy the one code held in `@bombfarm/domain/referral`, which the web
 * planner's own surfaces read too — a code updated on one app and not the other is a dead code a
 * player pastes and loses the reward on.
 *
 * The renderer writes the clipboard itself rather than going through IPC: the packaged renderer is
 * served over the `app:` scheme, registered `secure: true` (`src/main/renderer-protocol.ts`), and
 * dev serves it from 127.0.0.1 — both secure contexts, so `navigator.clipboard` is available and no
 * main-process code is needed. When the write is refused anyway the code is selected in place, so
 * the click always leaves something the player can act on.
 *
 * Feedback is inline — the glyph and the message — because the desktop mounts no toast system, and
 * `src/main/i18n-guards.test.ts` pins that absence deliberately.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Tooltip, buttonRecipe } from '@bombfarm/ui';
import { REFERRAL_CODE } from '@bombfarm/domain/referral';
import { useCopy } from '../lib/copy';
import { copyReferralCode, type CopyStatus } from './referral-clipboard';

const FEEDBACK_MS = 2400;

/**
 * The nonce is what makes a second click restart the countdown: without it a repeat click while
 * the status is already `copied` leaves the state untouched, the effect never re-runs, and the
 * first click's timer clears the feedback partway through the second one.
 */
function useReferralCopy() {
  const codeRef = useRef<HTMLElement>(null);
  const [feedback, setFeedback] = useState({ status: 'idle' as CopyStatus, nonce: 0 });

  useEffect(() => {
    if (feedback.status === 'idle') return;
    const timer = setTimeout(() => {
      setFeedback({ status: 'idle', nonce: 0 });
    }, FEEDBACK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [feedback]);

  const onClick = useCallback(() => {
    void copyReferralCode(codeRef.current).then((status) => {
      setFeedback((previous) => ({ status, nonce: previous.nonce + 1 }));
    });
  }, []);

  return { codeRef, status: feedback.status, onClick };
}

function useReferralMessages() {
  const t = useCopy();
  return {
    idle: t.shellReferralLabel,
    copied: t.shellReferralCopied,
    manual: t.shellReferralCopyManual,
  } satisfies Record<CopyStatus, string>;
}

/** Top-bar shape — the code and a copy glyph, with the why and the outcome in the tooltip. */
export function ReferralChip() {
  const messages = useReferralMessages();
  const { codeRef, status, onClick } = useReferralCopy();

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          onClick={onClick}
          aria-label={messages.idle}
          data-testid="shell-referral"
          className={buttonRecipe({ variant: 'referral' })}
        >
          <span ref={codeRef}>{REFERRAL_CODE}</span>
          <Icon name={status === 'copied' ? 'check' : 'copy'} size="xs" />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0">{messages[status]}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * Settings shape — the same control where there is room to say the outcome in words rather than
 * only in a tooltip, so the live region is the visible message and not a hidden duplicate of it.
 */
export function ReferralCopyControl() {
  const messages = useReferralMessages();
  const { codeRef, status, onClick } = useReferralCopy();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={messages.idle}
        data-testid="settings-support-referral"
        className={buttonRecipe({ variant: 'referral' })}
      >
        <span ref={codeRef}>{REFERRAL_CODE}</span>
        <Icon name={status === 'copied' ? 'check' : 'copy'} size="xs" />
      </button>
      <span role="status" data-testid="settings-support-referral-status" className="text-xs text-muted">
        {status === 'idle' ? '' : messages[status]}
      </span>
    </div>
  );
}
