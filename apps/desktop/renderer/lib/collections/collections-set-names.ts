import type { CollectionAxis, DomainLang } from '@bombfarm/contracts';
import { setName } from '@bombfarm/domain/game-labels';
import type { CollectionAxisRow, CollectionSetRow } from '@bombfarm/domain/model';

export interface AxisSetEntry {
  readonly name: string;
  /** The set already grants something on this axis, so its name is drawn in ink. */
  readonly grants: boolean;
}

export const SET_LINE_SEPARATOR = ' · ';

/** Characters the line may hold: a tile at the 960px window gives about 148px of text, which is
 *  about 26 characters at 11px. The line is also truncated by its box, so a wider name than
 *  this budget guessed still cannot wrap the tile taller. */
export const SET_LINE_BUDGET = 26;

export function axisSetEntries(
  row: CollectionAxisRow,
  sets: readonly CollectionSetRow[],
  lang: DomainLang,
): AxisSetEntry[] {
  return row.setCodes.map((code) => {
    const set = sets.find((candidate) => candidate.code === code);
    return { name: setName(code, lang), grants: grantsOn(set, row.axis) };
  });
}

function grantsOn(set: CollectionSetRow | undefined, axis: CollectionAxis): boolean {
  return set?.effects.some((effect) => effect.axis === axis && effect.now > 0) ?? false;
}

/** The names that fit, in order, and how many were left out. The first name is always shown, and
 *  when some are left out the "+N" marker counts against the budget too. */
export function fitSetNames(
  entries: readonly AxisSetEntry[],
  budget: number = SET_LINE_BUDGET,
): { readonly shown: readonly AxisSetEntry[]; readonly hidden: number } {
  const shown: AxisSetEntry[] = [];
  let used = 0;
  for (const [index, entry] of entries.entries()) {
    const cost = (shown.length === 0 ? 0 : SET_LINE_SEPARATOR.length) + entry.name.length;
    const remaining = entries.length - index - 1;
    const marker = remaining === 0 ? 0 : SET_LINE_SEPARATOR.length + `+${String(remaining)}`.length;
    if (shown.length > 0 && used + cost + marker > budget) break;
    shown.push(entry);
    used += cost;
  }
  return { shown, hidden: entries.length - shown.length };
}
