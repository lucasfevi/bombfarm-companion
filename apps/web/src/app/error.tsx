'use client';

/**
 * App Router error boundary — recovers from Fast Refresh / runtime failures
 * without requiring a full `pnpm dev` restart.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeContent: 'center',
        gap: 12,
        padding: 24,
        background: 'oklch(18% 0.015 48)',
        color: 'oklch(93% 0.012 48)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 18 }}>Something went wrong</h1>
      <p style={{ margin: 0, maxWidth: 420, opacity: 0.8, fontSize: 14 }}>
        {error.message || 'The planner hit a runtime error (often after hot reload). Try again.'}
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          justifySelf: 'start',
          cursor: 'pointer',
          border: '1px solid oklch(35% 0.02 48)',
          borderRadius: 4,
          background: 'oklch(24% 0.016 48)',
          color: 'inherit',
          padding: '8px 12px',
          fontSize: 13,
        }}
      >
        Try again
      </button>
    </div>
  );
}
