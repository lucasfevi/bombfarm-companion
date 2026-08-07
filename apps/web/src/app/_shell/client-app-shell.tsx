'use client';

import { useRef, type ReactNode } from 'react';
import { createGearPlanWorkerModule } from '@/features/gear-plan';
import { ClientMountGate } from './client-mount-gate';
import { AppShellInner } from './app-shell-inner';

export function ClientAppShell({
  children,
  planner,
}: {
  children: ReactNode;
  planner: ReactNode;
}) {
  // Hold the factory so the worker module stays in the production graph (T22)
  // before the optimizer page mounts. Instantiation stays in the runner.
  const workerFactoryRef = useRef(createGearPlanWorkerModule);
  void workerFactoryRef;

  return (
    <ClientMountGate>
      <AppShellInner planner={planner}>{children}</AppShellInner>
    </ClientMountGate>
  );
}
