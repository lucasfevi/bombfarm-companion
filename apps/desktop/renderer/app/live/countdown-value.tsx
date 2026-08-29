/**
 * Every countdown reads in one colour, estimated or not: a number that dims as the tap comes and
 * goes reads as a different kind of number, when it is the same reading from a second-best basis.
 * The modelled/paused distinction is carried by the `sr-only` qualifier alone.
 *
 * `min-w-16` + right alignment reserves the digit column: this now sits inline at the end of a
 * hero row, and a tick that drops a digit ("1:00" → "0:59") must not shift anything beside it.
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
      className="inline-flex min-w-16 items-baseline justify-end gap-1 text-sm tabular-nums text-ink"
    >
      <span>{formatted}</span>
      <span data-testid={`${testId}-qualifier`} className="sr-only">
        {qualified ? qualifier : ''}
      </span>
    </span>
  );
}
