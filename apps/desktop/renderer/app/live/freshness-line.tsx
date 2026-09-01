import { Button, Chip } from '@bombfarm/ui';
import { LIVE_GAP_REASON_COPY_KEY, useCopy } from '../../lib/copy';
import type { LiveFreshness } from '../../lib/live/live-model';

export type ReachedLiveFreshness = Extract<LiveFreshness, { kind: 'live' } | { kind: 'gap' }>;

export function FreshnessLine({
  freshness,
  onReopenConsent,
}: {
  freshness: ReachedLiveFreshness;
  onReopenConsent?: (() => void) | undefined;
}) {
  const t = useCopy();

  if (freshness.kind === 'live') {
    return (
      <p data-testid="live-freshness" className="m-0 flex items-center gap-2 text-sm">
        <Chip variant="small-active">{t.liveStatusLiveLabel}</Chip>
      </p>
    );
  }

  const reasonText =
    freshness.reason === 'runtimeUnavailable' && freshness.likelyQuarantine
      ? t.liveGapReasonRuntimeUnavailableQuarantine
      : t[LIVE_GAP_REASON_COPY_KEY[freshness.reason]];

  return (
    <p data-testid="live-freshness" className="m-0 flex flex-wrap items-center gap-2 text-sm">
      <Chip variant="small-muted">{t.liveStatusNotLiveLabel}</Chip>
      <span className="text-muted">{reasonText}</span>
      {freshness.reason === 'consentMissing' && onReopenConsent ? (
        <Button type="button" variant="text" data-testid="live-freshness-reopen-consent" onClick={onReopenConsent}>
          {t.consentGateReadAgainAction}
        </Button>
      ) : null}
    </p>
  );
}
