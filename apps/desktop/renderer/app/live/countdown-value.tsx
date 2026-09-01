/**
 * Every countdown reads in one colour, estimated or not: a number that dims as the tap comes and
 * goes reads as a different kind of number, when it is the same reading from a second-best basis.
 * The modelled/paused distinction is carried by the `sr-only` qualifier alone.
 *
 * `min-w-16` + right alignment reserves the digit column: this now sits inline at the end of a
 * hero row, and a tick that drops a digit ("1:00" → "0:59") must not shift anything beside it.
 * The reserve holds the longest form the formatter can produce, `h:mm:ss`.
 *
 * The mono face is what makes the digits themselves hold still. `tabular-nums` sat here and did
 * nothing: `DM Sans` ships no tabular figures, so `1` renders at barely half the width of `8` and
 * every second of a countdown re-flowed the number inside its own reserve.
 */
export function CountdownValue({
  testId,
  formatted,
  qualified,
  qualifier,
}: {
  testId: string;
  formatted: string;
  /** Whether {@link qualifier} applies — a modelled field time, or a rest clock that is not advancing. */
  qualified: boolean;
  qualifier: string;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex min-w-16 items-baseline justify-end gap-1 font-mono text-sm text-ink"
    >
      <span>{formatted}</span>
      <span data-testid={`${testId}-qualifier`} className="sr-only">
        {qualified ? qualifier : ''}
      </span>
    </span>
  );
}
