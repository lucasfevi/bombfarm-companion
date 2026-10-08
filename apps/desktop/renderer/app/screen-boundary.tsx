'use client';

import type { ReactNode } from 'react';
import { Button, ErrorBoundary, InfoTip } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';

export function ScreenCrashFallback({ onRetry }: { onRetry: () => void }) {
  const t = useCopy();
  return (
    <div
      role="alert"
      data-testid="screen-crash"
      className="mx-auto flex w-full max-w-settings items-center gap-3 rounded-md border border-line p-4"
    >
      <span className="font-medium">{t.screenCrashTitle}</span>
      <InfoTip label={t.screenCrashInfoLabel} tip={t.screenCrashInfo} />
      <Button type="button" className="ml-auto" onClick={onRetry}>
        {t.screenCrashRetry}
      </Button>
    </div>
  );
}

export function ScreenBoundary({ screen, children }: { screen: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      resetKey={screen}
      onError={(error, info) => {
        window.bfc?.logRendererError({
          event: 'screen.crash',
          screen,
          message: error.message,
          stack: error.stack ?? '',
          componentStack: info.componentStack ?? '',
        });
      }}
      fallback={(retry) => <ScreenCrashFallback onRetry={retry} />}
    >
      {children}
    </ErrorBoundary>
  );
}
