/**
 * The per-phase economy wire lexicon: a body the client receives in a burst of about ten, one per
 * phase of the stretch the account is playing, stating what each phase pays and drops. The keys
 * are English beside two Portuguese ones (`bau_chance_pct`, `jaula_teto_pct`), and this table is
 * the one place that vocabulary is translated into this codebase's own English domain field
 * names. `parse.ts` references a wire token only through {@link wireKey}, never as an inline
 * literal.
 *
 * Chances are in percent (0.1499 means 0.1499%).
 */

import { createWireKeyLookup, type WireLexiconEntry } from '../wire-lexicon.js';

export type PhaseEconomyWireSymbol =
  | 'phase'
  | 'goldPerProp'
  | 'xpPerProp'
  | 'goldMult'
  | 'xpMult'
  | 'itemLevelMin'
  | 'itemLevelMax'
  | 'chestChancePct'
  | 'chestRollChancePct'
  | 'keyChancePct'
  | 'gemChancePct'
  | 'stoneChancePct'
  | 'timeChancePct'
  | 'cageCeilingPct';

const KEY_ENTRIES: ReadonlyArray<WireLexiconEntry & { readonly symbol: PhaseEconomyWireSymbol }> = [
  { symbol: 'phase', wireToken: 'phase', kind: 'key', domainField: 'phase', description: 'The phase this body describes.', origin: 'english' },
  {
    symbol: 'goldPerProp',
    wireToken: 'gold_per_prop',
    kind: 'key',
    domainField: 'goldPerProp',
    description:
      'Average gold one prop pays on this phase, as a digit string. The account’s gold multipliers are already ' +
      "applied: across one burst it is the wiki's spawn-weighted average times one shared factor.",
    origin: 'english',
  },
  {
    symbol: 'xpPerProp',
    wireToken: 'xp_per_prop',
    kind: 'key',
    domainField: 'xpPerProp',
    description:
      "XP one prop pays on this phase, a whole number. The account's XP multipliers are already applied: across " +
      "one burst it is the wiki's per-phase XP times one shared factor (observed 1.56 to 3.96), rounded.",
    origin: 'english',
  },
  {
    symbol: 'goldMult',
    wireToken: 'gold_mult',
    kind: 'key',
    domainField: 'goldMult',
    description: 'A gold multiplier (observed `2`), sent only while one applies. Already folded into `gold_per_prop`.',
    origin: 'english',
  },
  {
    symbol: 'xpMult',
    wireToken: 'xp_mult',
    kind: 'key',
    domainField: 'xpMult',
    description: 'An XP multiplier (observed `2`), sent only while one applies. Already folded into `xp_per_prop`.',
    origin: 'english',
  },
  { symbol: 'itemLevelMin', wireToken: 'item_level_min', kind: 'key', domainField: 'itemLevelMin', description: 'Lowest item level this phase drops.', origin: 'english' },
  { symbol: 'itemLevelMax', wireToken: 'item_level_max', kind: 'key', domainField: 'itemLevelMax', description: 'Highest item level this phase drops.', origin: 'english' },
  {
    symbol: 'chestChancePct',
    wireToken: 'chest_chance_pct',
    kind: 'key',
    domainField: 'chestChancePct',
    description: 'Chance a prop drops a chest, in percent, with the account’s luck applied.',
    origin: 'english',
  },
  {
    symbol: 'chestRollChancePct',
    wireToken: 'bau_chance_pct',
    kind: 'key',
    domainField: 'chestRollChancePct',
    description:
      'Portuguese `bau` = chest. A second chest chance, in percent, sent beside `chest_chance_pct` on later bodies ' +
      '(equal to it rounded on ordinary phases, larger on gate phases). Meaning not established. Not read.',
    origin: 'portuguese',
  },
  {
    symbol: 'keyChancePct',
    wireToken: 'key_chance_pct',
    kind: 'key',
    domainField: 'keyChancePct',
    description: 'Chance a prop drops a key, in percent. Ordinary phases only.',
    origin: 'english',
  },
  {
    symbol: 'gemChancePct',
    wireToken: 'gem_chance_pct',
    kind: 'key',
    domainField: 'gemChancePct',
    description: 'Chance a prop drops a gem chest, in percent. Gate phases only.',
    origin: 'english',
  },
  {
    symbol: 'stoneChancePct',
    wireToken: 'stone_chance_pct',
    kind: 'key',
    domainField: 'stoneChancePct',
    description: 'Chance a prop drops a stone chest, in percent. Gate phases only.',
    origin: 'english',
  },
  {
    symbol: 'timeChancePct',
    wireToken: 'time_chance_pct',
    kind: 'key',
    domainField: 'timeChancePct',
    description: 'Chance a prop drops a time chest, in percent. Gate phases only.',
    origin: 'english',
  },
  {
    symbol: 'cageCeilingPct',
    wireToken: 'jaula_teto_pct',
    kind: 'key',
    domainField: 'cageCeilingPct',
    description: 'Portuguese `jaula` = cage, `teto` = ceiling. The cage ceiling for this phase’s act, in percent.',
    origin: 'portuguese',
  },
];

export const PHASE_ECONOMY_WIRE_LEXICON: readonly WireLexiconEntry[] = KEY_ENTRIES;

export const wireKey: (symbol: PhaseEconomyWireSymbol) => string = createWireKeyLookup(KEY_ENTRIES, 'phase economy lexicon');
