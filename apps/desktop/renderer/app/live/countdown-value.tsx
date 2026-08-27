/**
 * The two branches repeat the wrapper because the shell's untranslated-prose guard only tolerates
 * a multi-class string written directly as `className="…"`, so a composed or interpolated form is
 * reported as player-facing text. Text colour (muted vs ink) and the `sr-only` qualifier carry the
 * modelled/direct distinction; neither adds or removes a border, so a hero whose basis flips as
 * the tap comes and goes still never reflows the row it sits in.
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
      <span data-testid={testId} className="inline-flex items-baseline gap-1 text-sm tabular-nums text-muted">
        {children}
      </span>
    );
  }

  return (
    <span data-testid={testId} className="inline-flex items-baseline gap-1 text-sm tabular-nums text-ink">
      {children}
    </span>
  );
}
