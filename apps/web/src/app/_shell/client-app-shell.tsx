'use client';

import type { ReactNode } from 'react';
import { ClientMountGate } from './client-mount-gate';
import { AppShellInner } from './app-shell-inner';

export function ClientAppShell({
  children,
  planner,
}: {
  children: ReactNode;
  planner: ReactNode;
}) {
  return (
    <ClientMountGate>
      <AppShellInner planner={planner}>{children}</AppShellInner>
    </ClientMountGate>
  );
}
