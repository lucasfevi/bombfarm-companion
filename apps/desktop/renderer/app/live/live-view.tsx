'use client';

import { Button, EmptyState } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { useLiveModel } from '../../lib/live/use-live-model';
import { LivePanel } from './live-panel';
import { NeverReadEmptyState } from './never-read-empty-state';

/** Presentational components under this tree never touch `window.bfc` themselves — same split as
 *  `consent-modal.tsx`'s own `getBridge()`. */
function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

function OpenMiniButton() {
  const t = useCopy();

  const onOpenMini = () => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('miniLive:open');
  };

  return (
    <Button type="button" variant="text" data-testid="live-open-mini" onClick={onOpenMini}>
      {t.miniLiveOpenLabel}
    </Button>
  );
}

function LiveViewChrome({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="live-view" className="flex flex-col gap-2">
      <div className="flex justify-end">
        <OpenMiniButton />
      </div>
      {children}
    </div>
  );
}

export function LiveView({ onReopenConsent }: { onReopenConsent?: (() => void) | undefined }) {
  const t = useCopy();
  const { freshness, slow, fast, earnings, map } = useLiveModel();

  const onResetEarnings = () => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('live:resetEarnings');
  };

  if (freshness.kind === 'bridge-unavailable') {
    return (
      <LiveViewChrome>
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </LiveViewChrome>
    );
  }

  if (freshness.kind === 'loading') {
    return (
      <LiveViewChrome>
        <EmptyState title={t.shellLoadingLabel} />
      </LiveViewChrome>
    );
  }

  if (slow === null) {
    return (
      <LiveViewChrome>
        <NeverReadEmptyState freshness={freshness} onReopenConsent={onReopenConsent} />
      </LiveViewChrome>
    );
  }

  return (
    <LiveViewChrome>
      <LivePanel
        freshness={freshness}
        slow={slow}
        fast={fast}
        earnings={earnings}
        map={map}
        onResetEarnings={onResetEarnings}
        onReopenConsent={onReopenConsent}
      />
    </LiveViewChrome>
  );
}
