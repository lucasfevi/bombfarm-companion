import type {
  DamageAttributionResult,
  DamageChunk,
  DmgIdentifiedBy,
  RawBomb,
  RawGameState,
  RawHeroRecord,
  RawStateHero,
} from '@bombfarm/contracts';
import { buildBombOwnerMap, computeHeroFt } from './bomb-ownership.js';

export const GRID_COLS = 19;

export function crossFootprint(cell: number, reach: number): Set<number> {
  const cells = new Set<number>([cell]);
  const col = cell % GRID_COLS;
  for (let k = 1; k <= reach; k++) {
    if (col - k >= 0) cells.add(cell - k);
    if (col + k < GRID_COLS) cells.add(cell + k);
    cells.add(cell - GRID_COLS * k);
    cells.add(cell + GRID_COLS * k);
  }
  return cells;
}

function calibrateHeroReach(
  pushes: RawGameState[],
): Map<string, number> {
  const heroRVotes = new Map<string, Map<number, number>>();
  for (let i = 1; i < pushes.length; i++) {
    const prev = pushes[i - 1];
    const cur = pushes[i];
    if (!prev || !cur) continue;
    const prevCells = new Set((prev.bombs ?? []).map((b) => b.c));
    for (const bomb of cur.bombs ?? []) {
      if (prevCells.has(bomb.c)) continue;
      const at = new Set(
        [...(prev.heroes ?? []), ...(cur.heroes ?? [])]
          .filter((h) => h.c === bomb.c)
          .map((h) => h.id),
      );
      if (at.size !== 1) continue;
      const id = [...at][0];
      if (!id) continue;
      if (!heroRVotes.has(id)) heroRVotes.set(id, new Map());
      const votes = heroRVotes.get(id);
      if (!votes) continue;
      votes.set(bomb.r, (votes.get(bomb.r) ?? 0) + 1);
    }
  }
  const heroReach = new Map<string, number>();
  for (const [id, votes] of heroRVotes) {
    const [reach] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] ?? [1];
    heroReach.set(id, reach);
  }
  return heroReach;
}

function calibrateHeroFt(
  heroes: RawHeroRecord[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const hero of heroes) {
    const cdr = hero.stats?.cooldown_reduction ?? 0;
    map.set(hero.id, computeHeroFt(cdr));
  }
  return map;
}

function attributeCellDamage(
  cell: number,
  amount: number,
  dyingBombs: RawBomb[],
  bombOwners: Map<RawBomb, string | null>,
  prev: RawGameState,
  cur: RawGameState,
  heroReach: Map<string, number>,
  heroFt: Map<string, number>,
): DamageChunk {
  const claims = new Map<number, RawBomb[]>();
  for (const bomb of dyingBombs) {
    for (const covered of crossFootprint(bomb.c, bomb.r)) {
      const list = claims.get(covered) ?? [];
      list.push(bomb);
      claims.set(covered, list);
    }
  }

  const owners = claims.get(cell) ?? [];
  const ownerIds = new Set(
    owners
      .map((bomb) => bombOwners.get(bomb))
      .filter((id): id is string => id != null),
  );

  if (ownerIds.size === 1) {
    const heroId = [...ownerIds][0] ?? null;
    return { cell, amount, heroId, identifiedBy: 'dying_bomb_footprint' };
  }
  if (ownerIds.size > 1) {
    return { cell, amount, heroId: null, identifiedBy: 'unattributed' };
  }

  const candidates = new Map<string, RawStateHero>();
  for (const hero of [...(prev.heroes ?? []), ...(cur.heroes ?? [])]) {
    const reach = heroReach.get(hero.id) ?? 1;
    if (crossFootprint(hero.c, reach).has(cell)) {
      candidates.set(hero.id, hero);
    }
  }

  if (candidates.size === 1) {
    const hero = [...candidates.values()][0];
    const heroId = hero?.id ?? null;
    if (heroId && heroFt.has(heroId)) {
      return { cell, amount, heroId, identifiedBy: 'invisible_cell_cross' };
    }
  }

  return { cell, amount, heroId: null, identifiedBy: 'unattributed' };
}

export function attributeHpDeltaDamage(
  prev: RawGameState,
  cur: RawGameState,
  heroes: RawHeroRecord[],
): DamageAttributionResult {
  const bombOwners = buildBombOwnerMap(cur.bombs ?? [], heroes, [...(prev.heroes ?? []), ...(cur.heroes ?? [])]);
  const heroReach = calibrateHeroReach([prev, cur]);
  const heroFt = calibrateHeroFt(heroes);

  const curBombCells = new Set((cur.bombs ?? []).map((b) => b.c));
  const dying = (prev.bombs ?? []).filter((b) => !curBombCells.has(b.c));

  const kinds = prev.kinds ?? [];
  const kinds2 = cur.kinds ?? [];
  const hps = prev.hps ?? [];
  const hps2 = cur.hps ?? [];

  const chunks: DamageChunk[] = [];

  for (let cell = 0; cell < kinds.length; cell++) {
    if (kinds[cell] === -1) continue;
    let dealt = 0;
    if (kinds2[cell] === kinds[cell] && (hps2[cell] ?? 0) < (hps[cell] ?? 0)) {
      dealt = (hps[cell] ?? 0) - (hps2[cell] ?? 0);
    } else if (kinds2[cell] === -1 || kinds2[cell] !== kinds[cell]) {
      dealt = hps[cell] ?? 0;
    }
    if (dealt <= 0) continue;

    chunks.push(
      attributeCellDamage(cell, dealt, dying, bombOwners, prev, cur, heroReach, heroFt),
    );
  }

  const perHero: Record<string, number> = {};
  let unattributed = 0;
  let total = 0;
  for (const chunk of chunks) {
    total += chunk.amount;
    if (chunk.heroId) {
      perHero[chunk.heroId] = (perHero[chunk.heroId] ?? 0) + chunk.amount;
    } else {
      unattributed += chunk.amount;
    }
  }

  return { chunks, perHero, unattributed, total };
}

export function summarizeProvenance(chunks: DamageChunk[]): Record<DmgIdentifiedBy, number> {
  const summary: Record<DmgIdentifiedBy, number> = {
    dying_bomb_footprint: 0,
    invisible_cell_cross: 0,
    unattributed: 0,
  };
  for (const chunk of chunks) {
    summary[chunk.identifiedBy] += chunk.amount;
  }
  return summary;
}
