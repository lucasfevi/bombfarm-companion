'use client';

import { EmptyState } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { useLiveModel } from '../../lib/live/use-live-model';
import { LivePanel } from './live-panel';

export function LiveView({ onReopenConsent }: { onReopenConsent?: () => void }) {
  const t = useCopy();
  const { freshness, slow, fast } = useLiveModel();

  if (freshness.kind === 'bridge-unavailable') {
    return (
      <div data-testid="live-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (freshness.kind === 'loading') {
    return (
      <div data-testid="live-view">
        <EmptyState title={t.shellLoadingLabel} />
      </div>
    );
  }

  if (slow === null) {
    return (
      <div data-testid="live-view">
        <EmptyState title={t.liveNeverReadTitle} description={t.liveNeverReadDescription} />
      </div>
    );
  }

  return (
    <div data-testid="live-view">
      <LivePanel freshness={freshness} slow={slow} fast={fast} onReopenConsent={onReopenConsent} />
    </div>
  );
}
