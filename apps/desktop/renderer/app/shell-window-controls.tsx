'use client';

import { useEffect, useState } from 'react';
import { WindowControls } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';

function getBridge(): NonNullable<Window['bfc']> | null {
  return (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc ?? null;
}

/**
 * The header's caption buttons, wired to main.
 *
 * `maximized` is main's answer, never this component's guess: the window is maximized and
 * restored by things that never touch these buttons — a double-clicked header, Win+Up, a drag to
 * the top edge — and a locally toggled flag would have the middle button drawing the opposite of
 * what the window is doing within one snap.
 */
export function ShellWindowControls() {
  const t = useCopy();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;

    void bridge
      .invoke('window:getState')
      .then((state) => {
        setMaximized(state.maximized);
      })
      .catch(() => {});

    return bridge.on('window:changed', (state) => {
      setMaximized(state.maximized);
    });
  }, []);

  return (
    <WindowControls
      maximized={maximized}
      onMinimize={() => {
        void getBridge()?.invoke('window:minimize');
      }}
      onToggleMaximize={() => {
        void getBridge()?.invoke('window:toggleMaximize');
      }}
      onClose={() => {
        void getBridge()?.invoke('window:close');
      }}
      labels={{
        minimize: t.windowControlMinimizeAria,
        maximize: t.windowControlMaximizeAria,
        restore: t.windowControlRestoreAria,
        close: t.windowControlCloseAria,
      }}
    />
  );
}
