/**
 * The generic machinery both wire lexicons build on: {@link WireLexiconEntry} and its two sibling
 * types, a symbol->token lookup factory, and the markdown table renderer `docs/wire-vocabulary.md`
 * is assembled from. `rotation/lexicon.ts` (the `/rotation` route) and `live-frame/lexicon.ts` (the
 * combat websocket) each declare their own entries and call {@link createWireKeyLookup} for their
 * own lookup function — this module knows nothing about either boundary's specific vocabulary.
 */

export type WireVocabularyOrigin = 'portuguese' | 'english';
export type WireVocabularyKind = 'key' | 'enum_value';

export interface WireLexiconEntry {
  /** Stable, code-facing identifier used to look this entry up — never the wire token itself. */
  readonly symbol: string;
  readonly wireToken: string;
  readonly kind: WireVocabularyKind;
  readonly domainField: string;
  readonly description: string;
  readonly origin: WireVocabularyOrigin;
}

/**
 * Builds a `symbol -> wireToken` lookup function from a declared entry list, throwing on an
 * undeclared symbol rather than returning `undefined` — a typo in the caller is a thrown error at
 * the call site, not a silently missing wire read. `label` names the owning lexicon in that error.
 */
export function createWireKeyLookup<TSymbol extends string>(
  entries: ReadonlyArray<{ readonly symbol: TSymbol; readonly wireToken: string }>,
  label: string,
): (symbol: TSymbol) => string {
  const bySymbol = new Map(entries.map((entry) => [entry.symbol, entry.wireToken]));
  return (symbol) => {
    const wireToken = bySymbol.get(symbol);
    if (wireToken === undefined) {
      throw new Error(`[${label}] no entry declared for wire key symbol "${symbol}"`);
    }
    return wireToken;
  };
}

/** Every Portuguese-origin token in `entries` — the vocabulary guard's forbidden-identifier
 *  pattern is built from exactly this, never from a hand-written literal. */
export function portugueseWireTokens(entries: readonly WireLexiconEntry[]): readonly string[] {
  return entries.filter((entry) => entry.origin === 'portuguese').map((entry) => entry.wireToken);
}

export function glossaryTable(title: string, rows: readonly WireLexiconEntry[]): readonly string[] {
  const lines = [`### ${title}`, '', '| Wire token | Domain field | Description | Origin |', '| --- | --- | --- | --- |'];
  for (const row of rows) {
    const origin = row.origin === 'portuguese' ? 'Portuguese' : 'English';
    lines.push(`| \`${row.wireToken}\` | \`${row.domainField}\` | ${row.description} | ${origin} |`);
  }
  lines.push('');
  return lines;
}
