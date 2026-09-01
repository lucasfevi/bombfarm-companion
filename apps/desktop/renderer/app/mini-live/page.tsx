'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AppLocale, MiniLiveLayoutPatch, MiniLiveLayoutView } from '@bombfarm/contracts';
import { DEFAULT_SETTINGS } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { useLiveModel } from '../../lib/live/use-live-model';
import { MiniChrome } from './mini-chrome';
import { MiniEarnings } from './mini-earnings';
import { MiniGear } from './mini-gear';
import { MiniHeroes } from './mini-heroes';
import { MiniMap } from './mini-map';

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
  const [gearOpen, setGearOpen] = useState(false);

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

  const onLayoutChange = useCallback((patch: MiniLiveLayoutPatch) => {
    const bridge = getBridge();
    if (!bridge) {
      setLayout(patch);
      return;
    }
    void bridge.invoke('miniLive:setLayout', patch).then(setLayout);
  }, []);

  const onResetEarnings = useCallback(() => {
    const bridge = getBridge();
    if (!bridge) return;
    void bridge.invoke('live:resetEarnings');
  }, []);

  return (
    <CopyProvider locale={locale}>
      <MiniLiveShell
        layout={layout}
        gearOpen={gearOpen}
        onGearOpenChange={setGearOpen}
        onClose={onClose}
        onLayoutChange={onLayoutChange}
        onResetEarnings={onResetEarnings}
      />
    </CopyProvider>
  );
}

function MiniLiveShell({
  layout,
  gearOpen,
  onGearOpenChange,
  onClose,
  onLayoutChange,
  onResetEarnings,
}: {
  layout: MiniLiveLayoutView;
  gearOpen: boolean;
  onGearOpenChange: (open: boolean) => void;
  onClose: () => void;
  onLayoutChange: (patch: MiniLiveLayoutPatch) => void;
  onResetEarnings: () => void;
}) {
  const model = useLiveModel();
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = contentRef.current;
    const bridge = getBridge();
    if (!node || !bridge) return;
    void bridge.invoke('miniLive:fitGrowthAxis', {
      width: node.scrollWidth,
      height: node.scrollHeight,
    });
  }, [layout, model.earnings, model.map, model.slow]);

  const sections = (
    <>
      {layout.showEarnings ? <MiniEarnings earnings={model.earnings} onReset={onResetEarnings} /> : null}
      {layout.showMap ? <MiniMap map={model.map} /> : null}
      {layout.showHeroes ? <MiniHeroes slow={model.slow} fast={model.fast} /> : null}
    </>
  );

  return (
    <div data-testid="mini-live-page" className="flex h-dvh flex-col bg-bg text-ink font-sans">
      <MiniChrome
        onClose={onClose}
        gear={<MiniGear open={gearOpen} onOpenChange={onGearOpenChange} layout={layout} onLayoutChange={onLayoutChange} />}
      />
      {layout.axis === 'horizontal' ? (
        <div
          ref={contentRef}
          data-testid="mini-live-sections"
          data-axis="horizontal"
          className="flex min-h-0 flex-1 flex-row gap-2 p-2"
        >
          {sections}
        </div>
      ) : (
        <div
          ref={contentRef}
          data-testid="mini-live-sections"
          data-axis="vertical"
          className="flex min-h-0 flex-1 flex-col gap-2 p-2"
        >
          {sections}
        </div>
      )}
    </div>
  );
}
