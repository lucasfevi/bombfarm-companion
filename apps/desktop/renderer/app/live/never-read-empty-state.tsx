import { Button, EmptyState } from '@bombfarm/ui';
import { LIVE_GAP_REASON_COPY_KEY, useCopy } from '../../lib/copy';
import type { ReachedLiveFreshness } from './freshness-line';

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
    />
  );
}
