'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AppEnvironmentInfo, GameSnapshotPayload, GameStatusInfo } from '@bombfarm/contracts';
import { AppShell } from '@bombfarm/ui';

function formatStatus(status: GameStatusInfo['status']): string {
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

function statusClass(status: GameStatusInfo['status']): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30';
    case 'stale':
      return 'bg-amber-500/20 text-amber-100 border-amber-400/30';
    default:
      return 'bg-white/10 text-bf-muted border-white/10';
  }
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
    if (!snapshot) return '{}';
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
    <AppShell
      title={environment?.productName}
      badge={environment?.badgeLabel ?? null}
    >
      <section data-testid="app-ready" className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            data-testid="game-status-chip"
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${status ? statusClass(status.status) : 'bg-white/10 text-bf-muted border-white/10'}`}
          >
            {status ? formatStatus(status.status) : 'Loading…'}
          </span>
          {status?.status === 'stale' && status.staleAgeMs != null ? (
            <span className="text-sm text-bf-muted">age {Math.round(status.staleAgeMs / 1000)}s</span>
          ) : null}
        </div>

        {error ? <p className="text-red-400">Boot error: {error}</p> : null}

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-bf-muted">Current snapshot (raw + mapped)</h2>
          <pre
            data-testid="game-snapshot-json"
            className="max-h-[480px] overflow-auto rounded-lg border border-white/10 bg-black/30 p-4 text-xs leading-relaxed"
          >
            {rawJson}
          </pre>
        </div>
      </section>

      {environment ? (
        <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-3 text-xs text-bf-muted">
          <span data-testid="app-version" className="font-mono tabular-nums">
            v{environment.version}
          </span>
          {environment.flavor !== 'prod' && environment.badgeLabel ? (
            <span className="font-semibold uppercase tracking-wide">{environment.badgeLabel}</span>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
