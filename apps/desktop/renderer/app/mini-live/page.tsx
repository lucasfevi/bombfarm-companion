'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppLocale, MiniLiveLayoutView } from '@bombfarm/contracts';
import { DEFAULT_SETTINGS } from '@bombfarm/contracts';
import { CopyProvider, useCopy } from '../../lib/copy';
import { MiniChrome } from './mini-chrome';

const DEFAULT_MINI_LAYOUT: MiniLiveLayoutView = {
  showEarnings: true,
  showMap: true,
  showHeroes: false,
  axis: 'vertical',
};

function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

export default function MiniLivePage() {
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_SETTINGS.locale);
  const [layout, setLayout] = useState<MiniLiveLayoutView>(DEFAULT_MINI_LAYOUT);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;

    void bridge.invoke('settings:get').then((settings) => {
      setLocale(settings.locale);
    });

    void bridge.invoke('miniLive:getLayout').then(setLayout);

    return bridge.on('settings:changed', (settings) => {
      setLocale(settings.locale);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const onClose = useCallback(() => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('miniLive:close');
  }, []);

  return (
    <CopyProvider locale={locale}>
      <MiniLiveShell layout={layout} onClose={onClose} />
    </CopyProvider>
  );
}

function MiniLiveShell({
  layout,
  onClose,
}: {
  layout: MiniLiveLayoutView;
  onClose: () => void;
}) {
  const t = useCopy();

  return (
    <div data-testid="mini-live-page" className="flex h-dvh flex-col bg-bg text-ink font-sans">
      <MiniChrome
        onClose={onClose}
        gear={
          <button
            type="button"
            data-testid="mini-live-gear"
            title={t.miniLiveGearTitle}
            aria-label={t.miniLiveGearTitle}
            className="grid size-7 place-items-center rounded-sm border-0 bg-transparent text-muted transition-colors hover:text-ink focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        }
      />
      <div
        data-testid="mini-live-sections"
        className={
          layout.axis === 'horizontal'
            ? 'flex min-h-0 flex-1 flex-row gap-2 p-2'
            : 'flex min-h-0 flex-1 flex-col gap-2 p-2'
        }
      />
    </div>
  );
}
