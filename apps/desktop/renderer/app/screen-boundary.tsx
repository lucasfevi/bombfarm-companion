'use client';

import type { ReactNode } from 'react';
import { Button, ErrorBoundary, InfoTip } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';

export function ScreenCrashFallback({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  const t = useCopy();
  return (
    <div
      role="alert"
      data-testid="screen-crash"
      className="mx-auto flex w-full max-w-settings items-center gap-3 rounded-md border border-line p-4"
    >
      <span className="font-medium">{t.screenCrashTitle}</span>
      <InfoTip label={t.screenCrashInfoLabel} tip={compact ? t.screenCrashInfoCompact : t.screenCrashInfo} />
      <Button type="button" className="ml-auto" onClick={onRetry}>
        {t.screenCrashRetry}
      </Button>
    </div>
  );
}

/** A component can throw anything, and a boundary that trips on `null.message` shows no fallback
 *  and logs nothing. */
function asError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  try {
    return new Error(String(thrown));
  } catch {
    return new Error('unprintable thrown value');
  }
}

export function ScreenBoundary({
  screen,
  children,
  fallback = (retry) => <ScreenCrashFallback onRetry={retry} />,
}: {
  screen: string;
  children: ReactNode;
  fallback?: (retry: () => void) => ReactNode;
}) {
  return (
    <ErrorBoundary
      resetKey={screen}
      onError={(thrown: unknown, info) => {
        const error = asError(thrown);
        void window.bfc
          ?.invoke('log:rendererError', {
            event: 'screen.crash',
            screen,
            message: error.message,
            stack: error.stack ?? '',
            componentStack: info.componentStack ?? '',
          })
          .catch(() => undefined);
      }}
      fallback={fallback}
    >
      {children}
    </ErrorBoundary>
  );
}
