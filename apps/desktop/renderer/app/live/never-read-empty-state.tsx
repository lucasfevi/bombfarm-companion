import { Button, EmptyState } from '@bombfarm/ui';
import { SpriteLoop } from '@bombfarm/game-art';
import { LIVE_GAP_REASON_COPY_KEY, useCopy } from '../../lib/copy';
import type { ReachedLiveFreshness } from './freshness-line';
import { HERO6_MENU_IDLE_FRAME_MS, HERO6_MENU_IDLE_FRAMES } from './hero6-menu-idle';
import { WAITING_FLAVOR_LINE_KEYS, WaitingFlavorLine } from './waiting-flavor-line';

export function NeverReadEmptyState({
  freshness,
  onReopenConsent,
}: {
  freshness: ReachedLiveFreshness;
  onReopenConsent?: () => void;
}) {
  const t = useCopy();

  const description =
    freshness.kind === 'live'
      ? t.liveNeverReadAccountPendingDescription
      : freshness.reason === 'runtimeUnavailable' && freshness.likelyQuarantine
        ? t.liveGapReasonRuntimeUnavailableQuarantine
        : t[LIVE_GAP_REASON_COPY_KEY[freshness.reason]];

  const offerReopenConsent = freshness.kind === 'gap' && freshness.reason === 'consentMissing' && onReopenConsent;
  // consentMissing is stalled on the player, not on the app — every other reached state is
  // either the first read or a gap the app keeps retrying by itself.
  const pending = freshness.kind === 'live' || freshness.reason !== 'consentMissing';

  return (
    <EmptyState
      title={t.liveNeverReadTitle}
      description={description}
      action={
        offerReopenConsent ? (
          <Button type="button" variant="text" data-testid="live-never-read-reopen-consent" onClick={onReopenConsent}>
            {t.consentGateReadAgainAction}
          </Button>
        ) : undefined
      }
    >
      <SpriteLoop
        frames={HERO6_MENU_IDLE_FRAMES}
        frameDurationMs={HERO6_MENU_IDLE_FRAME_MS}
        animate={pending}
        width={110}
        height={128}
        className="mt-3"
      />
      {pending ? <WaitingFlavorLine lines={WAITING_FLAVOR_LINE_KEYS.map((key) => t[key])} /> : null}
    </EmptyState>
  );
}
