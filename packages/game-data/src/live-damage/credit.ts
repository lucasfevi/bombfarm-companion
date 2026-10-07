import type { LiveExplosion, LiveHit, LiveLootPop, LiveTickHero, UnattributedReason } from '@bombfarm/contracts';
import type { LedgerStep, RetiredBomb } from './bomb-ledger.js';
import { crossCells } from './geometry.js';

export interface SignatureBook {
  record(damage: number, critical: boolean, heroId: string): void;
  decisive(damage: number, critical: boolean, candidates: readonly string[]): string | null;
  clear(): void;
}

export function createSignatureBook(): SignatureBook {
  const producers = new Map<string, Set<string>>();
  const keyOf = (damage: number, critical: boolean) => `${String(damage)}|${critical ? 'crit' : 'plain'}`;

  return {
    record(damage, critical, heroId) {
      const key = keyOf(damage, critical);
      const heroes = producers.get(key);
      if (heroes === undefined) producers.set(key, new Set([heroId]));
      else heroes.add(heroId);
    },

    decisive(damage, critical, candidates) {
      const heroes = producers.get(keyOf(damage, critical));
      if (heroes === undefined || heroes.size !== 1) return null;
      const [only] = [...heroes];
      return only !== undefined && candidates.includes(only) ? only : null;
    },

    clear() {
      producers.clear();
    },
  };
}

export interface HitCredit {
  readonly cell: number;
  readonly damage: number;
  readonly credited: string | null;
  readonly reason: UnattributedReason | null;
}

export interface CreditHitsInput {
  readonly hits: readonly LiveHit[];
  readonly explosions: readonly LiveExplosion[];
  readonly ledger: LedgerStep;
  readonly heroes: readonly LiveTickHero[];
  readonly fantasma: ReadonlySet<string> | null;
  readonly rows: number;
  readonly signatures: SignatureBook;
}

interface CrossEntry {
  readonly owner: string | null;
  readonly reason: UnattributedReason | null;
}

function ownerOfExplosion(explosion: LiveExplosion, ledger: LedgerStep): CrossEntry {
  if (ledger.discontinuous) return { owner: null, reason: 'streamDiscontinuity' };
  const matches = (retired: RetiredBomb | undefined): retired is RetiredBomb =>
    retired !== undefined && retired.radius === explosion.radius;

  let source = ledger.retiredThisFrame.get(explosion.cell);
  if (!matches(source) && explosion.secondBlast === true) source = ledger.retiredLastFrame.get(explosion.cell);
  if (!matches(source)) return { owner: null, reason: 'explosionWithoutBomb' };
  return source.owner === null
    ? { owner: null, reason: source.reason ?? 'noOwnerAtBirth' }
    : { owner: source.owner, reason: null };
}

function buildCrossMaps(explosions: readonly LiveExplosion[], ledger: LedgerStep, rows: number) {
  const ordinary = new Map<number, CrossEntry[]>();
  const secondBlast = new Map<number, CrossEntry[]>();
  for (const explosion of explosions) {
    const entry = ownerOfExplosion(explosion, ledger);
    const target = explosion.secondBlast === true ? secondBlast : ordinary;
    for (const cell of crossCells(explosion.cell, explosion.radius, rows)) {
      const entries = target.get(cell);
      if (entries === undefined) target.set(cell, [entry]);
      else entries.push(entry);
    }
  }
  return { ordinary, secondBlast };
}

export function creditHits({
  hits,
  explosions,
  ledger,
  heroes,
  fantasma,
  rows,
  signatures,
}: CreditHitsInput): HitCredit[] {
  const crosses = buildCrossMaps(explosions, ledger, rows);
  const heroesByCell = new Map<number, string[]>();
  for (const hero of heroes) {
    if (hero.cell === undefined) continue;
    const onCell = heroesByCell.get(hero.cell);
    if (onCell === undefined) heroesByCell.set(hero.cell, [hero.id]);
    else onCell.push(hero.id);
  }

  return hits.map((hit): HitCredit => {
    const critical = hit.critical === true;
    const secondBlast = hit.secondBlast === true;
    const plain = !secondBlast && hit.shardOrigin === undefined;
    const covering = (secondBlast ? crosses.secondBlast : crosses.ordinary).get(hit.shardOrigin ?? hit.cell) ?? [];

    const crossOwners = new Set<string>();
    let unownedReason: UnattributedReason | null = null;
    for (const entry of covering) {
      if (entry.owner === null) unownedReason ??= entry.reason ?? 'noOwnerAtBirth';
      else crossOwners.add(entry.owner);
    }

    const ghostOwners = new Set<string>();
    if (plain) {
      const onCell = heroesByCell.get(hit.cell) ?? [];
      if (fantasma !== null) {
        for (const id of onCell) if (fantasma.has(id) && !crossOwners.has(id)) ghostOwners.add(id);
      } else if (onCell.length > 0) {
        unownedReason ??= 'explosionlessWithoutFantasma';
      }
    }

    const owners = [...crossOwners, ...ghostOwners];
    const candidateCount = owners.length + (unownedReason === null ? 0 : 1);
    const credit = (heroId: string): HitCredit => ({ cell: hit.cell, damage: hit.damage, credited: heroId, reason: null });
    const unattributed = (reason: UnattributedReason): HitCredit => ({
      cell: hit.cell,
      damage: hit.damage,
      credited: null,
      reason,
    });

    if (candidateCount === 0) return unattributed('explosionlessWithoutFantasma');

    if (candidateCount === 1) {
      const [only] = owners;
      if (only === undefined) return unattributed(unownedReason ?? 'noOwnerAtBirth');
      const throughOneOrdinaryCross = covering.length === 1 && !secondBlast && ghostOwners.size === 0;
      if (throughOneOrdinaryCross) signatures.record(hit.damage, critical, only);
      return credit(only);
    }

    if (unownedReason !== null) return unattributed('unresolvedOverlap');
    const decided = signatures.decisive(hit.damage, critical, owners);
    return decided === null ? unattributed('unresolvedOverlap') : credit(decided);
  });
}

export interface LootCredit {
  readonly gold: number;
  readonly credited: string | null;
  readonly reason: UnattributedReason | null;
}

export function creditLoot(loot: readonly LiveLootPop[], credited: readonly HitCredit[]): LootCredit[] {
  const credits: LootCredit[] = [];
  for (const pop of loot) {
    if (pop.gold === undefined || !Number.isFinite(pop.gold)) continue;
    const onCell = credited.filter((hit) => hit.cell === pop.cell);
    const [first] = onCell;
    if (first === undefined) {
      credits.push({ gold: pop.gold, credited: null, reason: 'noHitOnLootCell' });
    } else if (first.credited !== null && onCell.every((hit) => hit.credited === first.credited)) {
      credits.push({ gold: pop.gold, credited: first.credited, reason: null });
    } else {
      credits.push({ gold: pop.gold, credited: null, reason: 'sharedOrUnattributedKill' });
    }
  }
  return credits;
}
