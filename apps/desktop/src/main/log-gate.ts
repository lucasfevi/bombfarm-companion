export interface KeyedLogGateOptions<Context> {
  /** Records admitted at once to a key that has been quiet. */
  burst: number;
  /** Time for one admitted record to come back after it is spent. */
  refillMs: number;
  /** How long after a key's first drop its count is reported. */
  reportMs: number;
  /** Milliseconds on a clock that never steps backwards; the default is monotonic, so a wall-clock
   *  change cannot hand a key a fresh burst. */
  now?: (() => number) | undefined;
  /** Runs `callback` once after `delayMs`. The default timer is unref'd so a pending report never
   *  holds the process open. */
  schedule?: ((callback: () => void, delayMs: number) => void) | undefined;
  /** Called once per report with the context the key was first admitted under. */
  onSuppressed: (context: Context, suppressed: number) => void;
}

export interface KeyedLogGate<Context> {
  /** `false` when this key has used its allowance: the record is to be dropped. */
  admit(key: string, context: Context): boolean;
}

interface Bucket<Context> {
  context: Context;
  tokens: number;
  refilledAt: number;
  suppressed: number;
  reportPending: boolean;
}

function unrefTimer(callback: () => void, delayMs: number): void {
  setTimeout(callback, delayMs).unref();
}

/** A token bucket per key. What it drops is counted and reported once, so a flood leaves a bounded
 *  trail that says it was bounded. A backward step of the clock neither refills a bucket nor moves
 *  the point it refills from, so stepping back and returning mints nothing. */
export function createKeyedLogGate<Context>(options: KeyedLogGateOptions<Context>): KeyedLogGate<Context> {
  const schedule = options.schedule ?? unrefTimer;
  const clock = options.now ?? (() => performance.now());
  const buckets = new Map<string, Bucket<Context>>();

  function bucketFor(key: string, context: Context): Bucket<Context> {
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = { context, tokens: options.burst, refilledAt: clock(), suppressed: 0, reportPending: false };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  function report(bucket: Bucket<Context>): void {
    const { suppressed } = bucket;
    bucket.suppressed = 0;
    bucket.reportPending = false;
    options.onSuppressed(bucket.context, suppressed);
  }

  return {
    admit: (key, context) => {
      const bucket = bucketFor(key, context);
      const now = clock();
      if (now > bucket.refilledAt) {
        const refill = (now - bucket.refilledAt) / options.refillMs;
        bucket.tokens = Math.min(options.burst, bucket.tokens + refill);
        bucket.refilledAt = now;
      }
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }
      bucket.suppressed += 1;
      if (!bucket.reportPending) {
        bucket.reportPending = true;
        schedule(() => {
          report(bucket);
        }, options.reportMs);
      }
      return false;
    },
  };
}
