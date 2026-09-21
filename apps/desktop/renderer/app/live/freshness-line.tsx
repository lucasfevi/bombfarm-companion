import { Button } from '@bombfarm/ui';
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

  // Live needs no line of its own: the Live tab's corner dot and the strip's game cell already
  // say so, and a screen full of moving figures is its own evidence.
  if (freshness.kind === 'live') return null;

  const reasonText =
    freshness.reason === 'runtimeUnavailable' && freshness.likelyQuarantine
      ? t.liveGapReasonRuntimeUnavailableQuarantine
      : t[LIVE_GAP_REASON_COPY_KEY[freshness.reason]];

  return (
    <p data-testid="live-freshness" className="m-0 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-warn">{t.liveStatusNotLiveLabel}</span>
      <span className="text-muted">{reasonText}</span>
      {freshness.reason === 'consentMissing' && onReopenConsent ? (
        <Button type="button" variant="text" data-testid="live-freshness-reopen-consent" onClick={onReopenConsent}>
          {t.consentGateReadAgainAction}
        </Button>
      ) : null}
      {freshness.detail !== undefined ? (
        <span data-testid="live-freshness-detail" className="basis-full font-mono text-xs break-all text-muted">
          {t.liveGapDetailLabel}: {freshness.detail}
        </span>
      ) : null}
    </p>
  );
}
