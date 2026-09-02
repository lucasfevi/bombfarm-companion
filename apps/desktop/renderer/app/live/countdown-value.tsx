import type { ReactNode } from 'react';

export type CountdownSize = 'default' | 'compact';

/**
 * Every countdown reads in one colour, estimated or not: a number that dims as the tap comes and
 * goes reads as a different kind of number, when it is the same reading from a second-best basis.
 * The modelled/paused distinction is carried by the `sr-only` qualifier alone.
 *
 * `min-w-*` + right alignment reserves the digit column, holding the longest form the formatter
 * can produce (`h:mm:ss`), so a tick that drops a digit ("1:00" → "0:59") shifts nothing beside
 * it. `compact` is that same reserve at the second Live window's own type scale.
 *
 * The mono face is what makes the digits themselves hold still. The app's sans holds its figures
 * to one width too, so this is no longer the only face that would work here; it stays mono
 * because a clock reads as an instrument, and the two are the same superfamily.
 *
 * One whole class literal per size rather than a composed string: the shell's untranslated-prose
 * guard only tolerates a Tailwind string written directly as `className="…"`, and reports one
 * assembled from parts as player-facing text.
 */
export function CountdownValue({
  testId,
  formatted,
  qualified,
  qualifier,
  size = 'default',
}: {
  testId: string;
  formatted: string;
  /** Whether {@link qualifier} applies — a modelled field time, or a rest clock that is not advancing. */
  qualified: boolean;
  qualifier: string;
  size?: CountdownSize;
}) {
  const body: ReactNode = (
    <>
      <span>{formatted}</span>
      <span data-testid={`${testId}-qualifier`} className="sr-only">
        {qualified ? qualifier : ''}
      </span>
    </>
  );

  if (size === 'compact') {
    return (
      <span
        data-testid={testId}
        className="inline-flex min-w-11 items-baseline justify-end gap-1 font-mono text-[10px] text-ink"
      >
        {body}
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      className="inline-flex min-w-16 items-baseline justify-end gap-1 font-mono text-sm text-ink"
    >
      {body}
    </span>
  );
}

/**
 * No reading has arrived for this hero yet. A dash, with the words handed to a screen reader —
 * never the sentence itself. Neither size gives this column room for it: the compact one is four
 * characters wide, and the full-size one is `4rem`, where "not available" wraps onto a second line
 * and makes that row taller than the rows around it.
 *
 * It keeps the same reserved width a live reading holds, so a countdown arriving or lapsing moves
 * nothing beside it.
 */
export function CountdownAbsentValue({
  testId,
  label,
  size = 'default',
}: {
  testId: string;
  label: string;
  size?: CountdownSize;
}) {
  const body: ReactNode = (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </>
  );

  if (size === 'compact') {
    return (
      <span
        data-testid={testId}
        className="inline-flex min-w-11 items-baseline justify-end font-mono text-[10px] text-muted"
      >
        {body}
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      className="inline-flex min-w-16 items-baseline justify-end font-mono text-sm text-muted"
    >
      {body}
    </span>
  );
}
