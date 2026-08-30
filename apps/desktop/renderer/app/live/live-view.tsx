'use client';

import { EmptyState } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { useLiveModel } from '../../lib/live/use-live-model';
import { LivePanel } from './live-panel';
import { NeverReadEmptyState } from './never-read-empty-state';

/** Presentational components under this tree never touch `window.bfc` themselves — same split as
 *  `consent-modal.tsx`'s own `getBridge()`. */
function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

export function LiveView({ onReopenConsent }: { onReopenConsent?: () => void }) {
  const t = useCopy();
  const { freshness, slow, fast, earnings, map } = useLiveModel();

  const onResetEarnings = () => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('live:resetEarnings');
  };

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
        <NeverReadEmptyState freshness={freshness} onReopenConsent={onReopenConsent} />
      </div>
    );
  }

  return (
    <div data-testid="live-view">
      <LivePanel
        freshness={freshness}
        slow={slow}
        fast={fast}
        earnings={earnings}
        map={map}
        onResetEarnings={onResetEarnings}
        onReopenConsent={onReopenConsent}
      />
    </div>
  );
}
