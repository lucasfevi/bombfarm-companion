'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AppEnvironmentInfo, GameSnapshotPayload, GameStatusInfo } from '@bombfarm/contracts';
import { AppShell, EmptyState, StatusChip } from '@bombfarm/ui';
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

/** Trivial seconds/minutes formatter for StatusChip's ageLabel — M5 replaces this with locale formatting. */
function formatAgeLabel(staleAgeMs: number): string {
  const seconds = Math.max(0, Math.round(staleAgeMs / 1000));
  return seconds < 60 ? `${seconds.toFixed(0)}s` : `${Math.round(seconds / 60).toFixed(0)}m`;
}

export default function HomePage() {
  const [environment, setEnvironment] = useState<AppEnvironmentInfo | null>(null);
  const [status, setStatus] = useState<GameStatusInfo | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc;
    if (!bridge) {
      setError('Preload bridge unavailable');
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
  }, []);

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
                ageLabel={status.staleAgeMs != null ? formatAgeLabel(status.staleAgeMs) : undefined}
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
          {error ? (
            <EmptyState title="Preload bridge unavailable" description={error} />
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
            <EmptyState title="No snapshot yet" description="Waiting on the first read from the game." />
          )}
        </section>
      </AppShell>
    </>
  );
}
