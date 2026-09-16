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

/** The record against every opponent fought, worst first: the lowest wins-minus-losses, then the
 *  most duels, then the name — the rivalry the player is losing sits at the top. */
export function rivalRecords(rows: readonly PvpDuelRow[]): RivalRecord[] {
  const byName = new Map<string, PvpDuelRow[]>();
  for (const row of rows) {
    const against = byName.get(row.defender.name);
    if (against === undefined) byName.set(row.defender.name, [row]);
    else against.push(row);
  }
  return [...byName.entries()]
    .map(([name, against]) => recordOf(name, against))
    .sort(
      (left, right) =>
        left.won - left.lost - (right.won - right.lost) || right.duels - left.duels || left.name.localeCompare(right.name),
    );
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
