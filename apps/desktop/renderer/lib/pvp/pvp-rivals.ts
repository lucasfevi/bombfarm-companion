import type { PvpDuelRow } from '@bombfarm/contracts';

export interface RivalRecord {
  readonly name: string;
  readonly duels: number;
  readonly won: number;
  readonly lost: number;
  readonly yourScore: number;
  readonly theirScore: number;
  /** Your summed score over theirs, as a percent of theirs; `null` while they have scored nothing. */
  readonly marginPct: number | null;
  readonly latest: PvpDuelRow;
}

export type RivalSortKey = 'name' | 'record' | 'score' | 'last';

export interface RivalSort {
  readonly key: RivalSortKey;
  readonly direction: 'asc' | 'desc';
}

/** Worst record first — the rivalry the player is losing sits at the top. */
export const DEFAULT_RIVAL_SORT: RivalSort = { key: 'record', direction: 'asc' };

/** The record against every opponent fought, in {@link DEFAULT_RIVAL_SORT} order. */
export function rivalRecords(rows: readonly PvpDuelRow[]): RivalRecord[] {
  const byName = new Map<string, PvpDuelRow[]>();
  for (const row of rows) {
    const against = byName.get(row.defender.name);
    if (against === undefined) byName.set(row.defender.name, [row]);
    else against.push(row);
  }
  return sortRivals(
    [...byName.entries()].map(([name, against]) => recordOf(name, against)),
    DEFAULT_RIVAL_SORT,
  );
}

/** A second press on the sorted column flips it; a new column opens names A→Z and figures
 *  highest (or newest) first. */
export function nextRivalSort(sort: RivalSort, key: RivalSortKey): RivalSort {
  if (sort.key === key) return { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: key === 'name' ? 'asc' : 'desc' };
}

/** Ties fall to the most duels fought, then the name. An opponent with no margin yet sorts
 *  after every scored one in either direction — a missing figure is not a small one. */
export function sortRivals(rivals: readonly RivalRecord[], sort: RivalSort): RivalRecord[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const tieBreak = (left: RivalRecord, right: RivalRecord) =>
    right.duels - left.duels || left.name.localeCompare(right.name);
  const compare = (left: RivalRecord, right: RivalRecord): number => {
    switch (sort.key) {
      case 'name':
        return sign * left.name.localeCompare(right.name);
      case 'record':
        return sign * (left.won - left.lost - (right.won - right.lost)) || tieBreak(left, right);
      case 'score':
        if (left.marginPct === null || right.marginPct === null) {
          return Number(left.marginPct === null) - Number(right.marginPct === null) || tieBreak(left, right);
        }
        return sign * (left.marginPct - right.marginPct) || tieBreak(left, right);
      case 'last':
        return sign * (Date.parse(left.latest.recordedAt) - Date.parse(right.latest.recordedAt)) || tieBreak(left, right);
    }
  };
  return [...rivals].sort(compare);
}

/** Names containing the query, ignoring case and accents — "joao" finds "João". */
export function searchRivals(rivals: readonly RivalRecord[], query: string): readonly RivalRecord[] {
  const needle = foldForSearch(query.trim());
  if (needle === '') return rivals;
  return rivals.filter((rival) => foldForSearch(rival.name).includes(needle));
}

function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
}

function recordOf(name: string, against: readonly PvpDuelRow[]): RivalRecord {
  const won = against.filter((row) => row.won).length;
  const yourScore = against.reduce((sum, row) => sum + row.attacker.score, 0);
  const theirScore = against.reduce((sum, row) => sum + row.defender.score, 0);
  return {
    name,
    duels: against.length,
    won,
    lost: against.length - won,
    yourScore,
    theirScore,
    marginPct: theirScore === 0 ? null : ((yourScore - theirScore) / theirScore) * 100,
    latest: newestOf(against),
  };
}

function newestOf(against: readonly PvpDuelRow[]): PvpDuelRow {
  let newest = against[0] as PvpDuelRow;
  for (const row of against) {
    if (Date.parse(row.recordedAt) > Date.parse(newest.recordedAt)) newest = row;
  }
  return newest;
}
