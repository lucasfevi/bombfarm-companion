/**
 * How one pass spends the call budget: which listed items it quotes natively, and how far apart.
 *
 * Everything here is pure. The collector supplies the trading history it read back and the
 * enumeration cost the sweep has just paid; it gets back the rotation and its pacing.
 */

const MS_PER_DAY = 86_400_000;

/**
 * The rotation delay a full pass was measured drawing zero rate limits at. Never go below it
 * whatever the budget says: the budget bounds the daily total, not the instantaneous rate.
 */
export const MIN_SPACING_MS = 3_500;

export const DEFAULT_DAILY_BUDGET = 2_000;

export function readBudget(raw) {
  const budget = Number(raw);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error(`MARKET_DAILY_BUDGET must be a positive number; got ${JSON.stringify(raw)}`);
  }
  return budget;
}

/**
 * Split the listed items into the ones worth a call of their own and the ones the enumeration
 * already prices well enough.
 *
 * About half the market has never reported a sale, and an item nobody trades has a price that
 * moves only when someone relists it — which the enumeration sees anyway, for a tenth of a call.
 * Spending an equal share of a scarce budget on those is the whole inefficiency.
 *
 * An item with no trading history at all is quoted rather than assumed either way: one call
 * settles which side it belongs on, and stranding it in a tier would decide that by default.
 */
export function splitRotation(hashNames, tiers) {
  const quote = [];
  const enumerationOnly = [];
  const firstQuote = [];

  for (const hashName of hashNames) {
    if (tiers.traded.has(hashName)) {
      quote.push(hashName);
    } else if (tiers.observed.has(hashName)) {
      enumerationOnly.push(hashName);
    } else {
      quote.push(hashName);
      firstQuote.push(hashName);
    }
  }

  return { quote, enumerationOnly, firstQuote };
}

/**
 * Membership, read off the readings the rotation has already been paying for. `observed` is every
 * item the window holds a reading for at all, so "quoted and found not to trade" stays apart from
 * "never quoted" — collapsing them would put every quiet item back in the rotation forever.
 */
export function tiersFromHistory(rows) {
  const traded = new Set();
  const observed = new Set();

  for (const row of rows) {
    const hashName = row.hash_name;
    if (typeof hashName !== 'string' || hashName.length === 0) continue;
    observed.add(hashName);
    if (typeof row.volume === 'number' && row.volume > 0) traded.add(hashName);
  }

  return { traded, observed };
}

export const NO_TIERS = { traded: new Set(), observed: new Set() };

/**
 * Fold one pass's own readings in, so an item quoted for the first time is tiered from its result
 * instead of waiting out the recompute interval in the rotation.
 *
 * Promotion only. A single pass sees one 24-hour figure, and an item that traded last week and
 * not today is still an item that trades; demotion needs the whole window, which is the scheduled
 * recompute's job.
 */
export function tiersAfterPass(tiers, { attempted, quotes }) {
  const traded = new Set(tiers.traded);
  const observed = new Set(tiers.observed);

  for (const hashName of attempted) {
    observed.add(hashName);
    const byCurrency = quotes.get(hashName);
    if (byCurrency == null) continue;
    const sold = Object.values(byCurrency).some(
      (quote) => typeof quote.volume === 'number' && quote.volume > 0,
    );
    if (sold) traded.add(hashName);
  }

  return { traded, observed };
}

/**
 * The delay between quotes that makes a day of passes cost exactly the configured number of
 * calls, enumeration included.
 *
 * The quota an address accumulates makes no distinction between an enumeration call and a quote,
 * so neither does this. Pacing the rotation alone left the enumeration outside the number being
 * configured, and a day of passes spent about 9% more than the figure it was given.
 *
 * A pass costs `enumerationCalls + quoteCount` and takes `enumerationCalls * searchDelayMs +
 * quoteCount * spacingMs`, so the budget fixes how long a pass must take and the enumeration's
 * share comes off the top before the rotation is paced. Clamping at the measured-safe floor only
 * ever lengthens a pass, which spends less than the budget rather than more.
 */
/**
 * The whole plan for one pass: the rotation, and the delay that keeps the day inside the budget.
 *
 * `currencyCount` multiplies the rotation into calls, because the quote endpoint is asked once per
 * item per currency and the pacing is a delay between calls, not between items.
 */
export function planPass({
  hashNames,
  tiers,
  budget,
  currencyCount,
  enumerationCalls,
  searchDelayMs,
}) {
  const split = splitRotation(hashNames, tiers);
  const pacing = planPacing({
    budget,
    quoteCount: split.quote.length * currencyCount,
    enumerationCalls,
    searchDelayMs,
  });

  return { ...split, ...pacing, hashNames: split.quote, delayMs: pacing.spacingMs };
}

export function planPacing({ budget, quoteCount, enumerationCalls, searchDelayMs }) {
  const callsPerPass = enumerationCalls + quoteCount;
  const passMs = (MS_PER_DAY * callsPerPass) / budget;
  const rotationMs = passMs - enumerationCalls * searchDelayMs;
  // Rounded up, so the rounding spends less than the budget rather than a little more than it.
  const derivedMs = quoteCount > 0 ? Math.ceil(rotationMs / quoteCount) : MIN_SPACING_MS;

  return {
    budget,
    quoteCount,
    enumerationCalls,
    callsPerPass,
    spacingMs: Math.max(MIN_SPACING_MS, derivedMs),
    spacingClamped: derivedMs < MIN_SPACING_MS,
  };
}
