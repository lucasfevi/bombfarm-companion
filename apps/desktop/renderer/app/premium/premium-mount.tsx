'use client';

import { createElement, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import type { PremiumHostView, PremiumSlot } from '@bombfarm/contracts';
import { ErrorBoundary } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { createPremiumBridge, type PremiumProp } from '../../lib/premium/premium-bridge';
import { installSharedModules } from '../../lib/premium/shared-modules';

/** What a bundle's UI file exports: a component as its default. */
export interface PremiumUiModule {
  readonly default: ComponentType<{ premium: PremiumProp }>;
}

export type PremiumUiLoader = (url: string) => Promise<PremiumUiModule>;

/** The bundle's UI is served by the app itself; the bundler must leave this import alone. */
const importPremiumUi: PremiumUiLoader = (url) => import(/* webpackIgnore: true */ url) as Promise<PremiumUiModule>;

function reportMountFailed(): void {
  const bridge = (window as unknown as { bfc?: { invoke: (channel: 'premium:hostMountFailed') => Promise<unknown> } }).bfc;
  bridge?.invoke('premium:hostMountFailed').catch(() => undefined);
}

function reportSectionMountFailed(): void {
  const bridge = (window as unknown as { bfc?: { invoke: (channel: 'premium:sectionMountFailed') => Promise<unknown> } }).bfc;
  bridge?.invoke('premium:sectionMountFailed').catch(() => undefined);
}

function PremiumUi({
  uiUrl,
  styleUrl,
  load,
  premium,
  onFailed,
}: {
  premium: PremiumProp;
  uiUrl: string;
  styleUrl: string | null;
  load: PremiumUiLoader;
  onFailed: () => void;
}) {
  const [Ui, setUi] = useState<PremiumUiModule['default'] | null>(null);

  useEffect(() => {
    installSharedModules();
    let live = true;
    let link: HTMLLinkElement | null = null;
    if (styleUrl !== null) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = styleUrl;
      document.head.append(link);
    }
    load(uiUrl).then(
      (module) => {
        if (live) setUi(() => module.default);
      },
      () => {
        if (live) onFailed();
      },
    );
    return () => {
      live = false;
      link?.remove();
    };
  }, [uiUrl, styleUrl, load, onFailed]);

  return Ui === null ? null : createElement(Ui, { premium });
}

/**
 * The one place Premium UI appears. It mounts the active bundle's component inside the app's own
 * React tree, and says in words when the bundle is updating, has stopped, or is a local build.
 */
export function PremiumMount({
  host,
  slot = 'premium.tab',
  load = importPremiumUi,
  onMountFailed = slot === 'live.section' ? reportSectionMountFailed : reportMountFailed,
}: {
  host: PremiumHostView | null;
  /** `live.section` shows nothing but the bundle's UI, and only while it runs and the slot is granted. */
  slot?: PremiumSlot;
  load?: PremiumUiLoader;
  onMountFailed?: () => void;
}) {
  const t = useCopy();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const reported = useRef<string | null>(null);
  // One bridge per mount: the screen's subscriptions outlive the host view that feeds them.
  const [bridge] = useState(() => createPremiumBridge(undefined, slot));
  useEffect(() => {
    bridge.feed(host);
  }, [bridge, host]);
  const uiUrl = host?.uiUrl ?? null;

  const onFailed = useCallback(() => {
    if (uiUrl === null || reported.current === uiUrl) return;
    reported.current = uiUrl;
    setFailedUrl(uiUrl);
    onMountFailed();
  }, [uiUrl, onMountFailed]);

  if (host === null) return null;

  if (slot === 'live.section') {
    // No status lines and no reserved space: a section that is not running, not granted or broken is absent.
    const granted = host.phase === 'running' && uiUrl !== null && host.slots?.includes('live.section') === true;
    if (!granted || failedUrl === uiUrl) return null;
    return (
      <div data-testid="premium-live-section">
        <ErrorBoundary resetKey={uiUrl} onError={onFailed} fallback={() => null}>
          <PremiumUi premium={bridge.prop} uiUrl={uiUrl} styleUrl={host.styleUrl} load={load} onFailed={onFailed} />
        </ErrorBoundary>
      </div>
    );
  }

  const stopped = host.phase === 'stopped' || (uiUrl !== null && failedUrl === uiUrl);
  const mounted = host.phase === 'running' && uiUrl !== null && !stopped;

  return (
    <>
      {host.localBuild ? (
        <p data-testid="premium-host-local" className="text-xs font-medium text-muted">
          {t.premiumHostLocalBuild}
        </p>
      ) : null}
      {host.localBuild && host.phase === 'running' && uiUrl === null ? (
        <p data-testid="premium-host-local-hint" className="text-xs text-muted">
          {t.premiumHostLocalBuildHint}
        </p>
      ) : null}
      {host.phase === 'updating' ? (
        <p role="status" data-testid="premium-host-updating" className="text-sm text-muted">
          {t.premiumHostUpdating}
        </p>
      ) : null}
      {stopped ? (
        <p role="status" data-testid="premium-host-stopped" className="text-sm text-muted">
          {t.premiumHostStopped}
        </p>
      ) : null}
      {mounted ? (
        <div data-testid="premium-host-mount">
          <ErrorBoundary resetKey={uiUrl} onError={onFailed} fallback={() => null}>
            <PremiumUi premium={bridge.prop} uiUrl={uiUrl} styleUrl={host.styleUrl} load={load} onFailed={onFailed} />
          </ErrorBoundary>
        </div>
      ) : null}
    </>
  );
}
