'use client';

import { useEffect, useState } from 'react';
import log from 'electron-log/renderer';
import { AppShell } from '@bombfarm/ui';

interface BootState {
  flavor: string;
  storageBinding: string;
  preloadPing: string;
  mainPing: string;
}

export default function HomePage() {
  const [boot, setBoot] = useState<BootState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootApp() {
      try {
        const bridge = (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc;
        if (!bridge) {
          setError('Preload bridge unavailable');
          return;
        }

        bridge.logBoot();
        log.info({ scope: 'renderer', event: 'boot' });

        const [flavor, storage, mainPing] = await Promise.all([
          bridge.invoke('app:getFlavor'),
          bridge.invoke('storage:health'),
          bridge.invoke('app:ping'),
        ]);
        const preloadPing = bridge.ping().from;

        setBoot({
          flavor,
          storageBinding: storage.binding,
          preloadPing,
          mainPing: mainPing.from,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void bootApp();
  }, []);

  return (
    <AppShell>
      <section data-testid="app-ready" className="space-y-4">
        <p className="text-bf-muted">M0 scaffold — renderer mounted.</p>
        {error ? (
          <p className="text-red-400">Boot error: {error}</p>
        ) : boot ? (
          <ul className="space-y-1 text-sm">
            <li>Flavor: {boot.flavor}</li>
            <li>SQLite binding: {boot.storageBinding}</li>
            <li>Preload ping: {boot.preloadPing}</li>
            <li>Main ping: {boot.mainPing}</li>
          </ul>
        ) : (
          <p className="text-sm text-bf-muted">Connecting to main process…</p>
        )}
      </section>
    </AppShell>
  );
}
