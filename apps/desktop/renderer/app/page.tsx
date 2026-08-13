'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AppEnvironmentInfo, GameSnapshotPayload, GameStatusInfo } from '@bombfarm/contracts';
import { AppShell, EmptyState, StatusChip } from '@bombfarm/ui';
// MP3 F1 (AD-032) — proves the renderer can import @bombfarm/domain: a value import from a
// FILE subpath that itself value-imports ./data/catalog.json, so a dist missing the JSON data
// fails the static export build rather than surfacing later at runtime (spec edge case). This
// is a probe, not planning UI — F2 (mp3-planning-views) is what actually renders advice.
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { CopyProvider, useCopy } from '../lib/copy';
import { formatAge } from '../lib/format';
import { ConsentModal } from './consent-modal';

function statusLabel(status: GameStatusInfo['status']): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'not_running':
      return 'Game not running';
    case 'stale':
      return 'Stale';
    default:
      return status;
  }
}

export default function HomePage() {
  return (
    <CopyProvider>
      <HomePageContent />
    </CopyProvider>
  );
}

function HomePageContent() {
  const t = useCopy();
  const [environment, setEnvironment] = useState<AppEnvironmentInfo | null>(null);
  const [status, setStatus] = useState<GameStatusInfo | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc;
    if (!bridge) {
      setError(t.emptyBridgeUnavailableTitle);
      return;
    }

    void (async () => {
      try {
        const [nextEnvironment, initialStatus, initialSnapshot] = await Promise.all([
          bridge.invoke('app:getEnvironment'),
          bridge.invoke('game:getStatus'),
          bridge.invoke('game:getSnapshot'),
        ]);
        setEnvironment(nextEnvironment);
        setStatus(initialStatus);
        setSnapshot(initialSnapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    const offStatus = bridge.on('game:status', (next) => {
      setStatus(next);
    });
    const offSnapshot = bridge.on('snapshot:updated', (next) => {
      setSnapshot(next);
      setStatus(next.status);
    });

    return () => {
      offStatus();
      offSnapshot();
    };
    // `t.emptyBridgeUnavailableTitle` is a stable reference from the copy context (F2 mounts one
    // locale) — listed to satisfy exhaustive-deps without changing the once-on-mount behaviour.
  }, [t.emptyBridgeUnavailableTitle]);

  const rawJson = useMemo(() => {
    if (!snapshot) return null;
    return JSON.stringify(
      {
        status: snapshot.status,
        mapped: snapshot.mapped,
        raw: snapshot.raw,
      },
      null,
      2,
    );
  }, [snapshot]);

  return (
    <>
      <ConsentModal />
      <AppShell
        title={environment?.productName}
        badge={environment?.badgeLabel ?? null}
        items={[]}
        status={
          <span data-testid="game-status-chip">
            {status ? (
              <StatusChip
                status={status.status}
                label={statusLabel(status.status)}
                ageLabel={status.staleAgeMs != null ? formatAge(status.staleAgeMs) : undefined}
              />
            ) : (
              'Loading…'
            )}
          </span>
        }
        version={
          environment ? (
            <>
              <span data-testid="app-version" className="font-mono tabular-nums">
                v{environment.version}
              </span>
              {environment.flavor !== 'prod' && environment.badgeLabel ? (
                <span className="text-xs font-semibold uppercase tracking-wide">{environment.badgeLabel}</span>
              ) : null}
            </>
          ) : null
        }
      >
        <section data-testid="app-ready" className="space-y-4">
          {/* MP3 F1 probe — proves a @bombfarm/domain value reaches the DOM. Not planner UI. */}
          <span data-testid="domain-label-probe" className="sr-only">
            {rarityLabel('Comum', 'en')}
          </span>
          {error ? (
            <EmptyState title={t.emptyBridgeUnavailableTitle} description={error} />
          ) : rawJson ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted">Current snapshot (raw + mapped)</h2>
              <pre
                data-testid="game-snapshot-json"
                className="max-h-[480px] overflow-auto rounded-lg border border-line bg-bg-2 p-4 text-xs leading-relaxed"
              >
                {rawJson}
              </pre>
            </div>
          ) : (
            <EmptyState title={t.emptyNoSnapshotTitle} description={t.emptyNoSnapshotDescription} />
          )}
        </section>
      </AppShell>
    </>
  );
}
