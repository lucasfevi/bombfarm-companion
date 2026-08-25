/**
 * The dashed underline is drawn in both states — transparent when the number is a direct reading —
 * so a hero whose basis flips as the tap comes and goes never reflows the row it sits in. The two
 * branches repeat the wrapper because the shell's untranslated-prose guard only tolerates a
 * multi-class string written directly as `className="…"`, so a composed or interpolated form is
 * reported as player-facing text.
 */
export function CountdownValue({
  testId,
  formatted,
  muted,
  qualifier,
}: {
  testId: string;
  formatted: string;
  muted: boolean;
  qualifier: string;
}) {
  const children = (
    <>
      <span>{formatted}</span>
      <span data-testid={`${testId}-qualifier`} className="sr-only">
        {muted ? qualifier : ''}
      </span>
    </>
  );

  if (muted) {
    return (
      <span
        data-testid={testId}
        className="inline-flex items-baseline gap-1 border-b border-dashed text-sm tabular-nums border-muted text-muted"
      >
        {children}
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      className="inline-flex items-baseline gap-1 border-b border-dashed text-sm tabular-nums border-transparent text-ink"
    >
      {children}
    </span>
  );
}
