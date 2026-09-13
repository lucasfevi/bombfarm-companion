import { ABILITIES } from './model';
import type { HeroRecord } from './shims/storage';

/**
 * The team auras this planner MODELS — not every `team_*`-kind ability the wiki lists.
 * `contra_relogio` ("Contra o Relógio") is excluded on purpose: the wiki's own `kind` prefix
 * (`gate_power`, not `team_*`), its "Só ele" scope column, and this catalog's `effectText`
 * (missing the "do TIME" every genuine aura below carries) all agree it is self-scoped, not a
 * team aura. `fortuna`/`brecha` are genuine `team_gold`/`team_pen` auras missing from this list,
 * but both carry `effect: { kind: 'none' }` and nothing downstream reads them —
 * adding them here would be new modelling, not a fix.
 */
export const TEAM_BUFF_ABILITY_IDS = [
  'grito_guerra',
  'pressagio_mortal',
  'marcha_acelerada',
  'folego_mineiro',
] as const;

export type TeamBuffId = (typeof TEAM_BUFF_ABILITY_IDS)[number];

/**
 * `ABILITIES` lookup for the four team buffs, resolved once at module load.
 *
 * The linear `ABILITIES.find` this replaces ran per buff id per aura computation — 14% of a
 * team-plan run's CPU by profile, since `computeRosterAuras` is called once per hero per
 * fixed-point round per roster evaluation. `ABILITIES` is a frozen catalog, so hoisting is a
 * pure lookup change: same values, same order, same arithmetic.
 */
export const TEAM_BUFF_PER_LEVEL: Record<TeamBuffId, number> = Object.fromEntries(
  TEAM_BUFF_ABILITY_IDS.map((buffId) => {
    const definition = ABILITIES.find((ability) => ability.id === buffId);
    return [buffId, definition && 'perLevel' in definition.effect ? definition.effect.perLevel : 0];
  }),
) as Record<TeamBuffId, number>;

/**
 * Each aura's own maximum — the confirmed field-wide cap every carrier's COMBINED rank clamps
 * at (two rank-20 Fôlego carriers give -20%, same as one rank-20 carrier alone). For these four
 * abilities this equals `max rank (20) × perLevel`, but is stored as a literal per ability
 * rather than computed from that formula: `matilha`'s published cap
 * (`combate.pack_dmg_cap: 0.9`) does NOT follow it, so `max × perLevel` is a reading, not a law
 * safe to lean on for an ability not yet checked against the wiki's own cap field.
 */
export const TEAM_BUFF_CAP: Record<TeamBuffId, number> = {
  grito_guerra: 20,
  pressagio_mortal: 20,
  marcha_acelerada: 3.7,
  folego_mineiro: 20,
};

export function zeroTeamBuffs(): Record<TeamBuffId, number> {
  return {
    grito_guerra: 0,
    pressagio_mortal: 0,
    marcha_acelerada: 0,
    folego_mineiro: 0,
  };
}

/** UI metadata for team-buff number fields (labels / hints / steps). */
export const TEAM_BUFF_FIELDS = [
  { id: 'grito_guerra', label: 'Grito de Guerra', hint: 'Atk %', step: 1 },
  { id: 'pressagio_mortal', label: 'Presságio Mortal', hint: 'Crit pts', step: 1 },
  { id: 'marcha_acelerada', label: 'Marcha Acelerada', hint: 'Speed %', step: 0.1 },
  { id: 'folego_mineiro', label: 'Fôlego de Mineiro', hint: 'Drain −%', step: 1 },
] as const satisfies readonly { id: TeamBuffId; label: string; hint: string; step: number }[];

/**
 * Sums each team-wide ability's contribution (perLevel × level) across EVERY deployed hero,
 * excluding nobody — the aura is a property of the field (PR #139), so every hero standing
 * in it (carrier or not) experiences the same total. Returns the raw, UNCAPPED sum: the cap
 * ({@link TEAM_BUFF_CAP}) is applied once, at the combination site (`computeCombatMults`), not
 * here.
 *
 * THE FIELD AS IT IS, NOT AS IT IS PLANNED. `deployed` is the game's own `in_field` at the moment
 * the account was read, so this is the aura the live field is actually running under — the
 * quantity the Live screen's drain readout wants and nothing else does. No planning screen prices
 * against it: a board or optimizer rotating a pool through the House reads
 * {@link computeTeamBuffsOverRotation}, and a per-hero figure reads
 * {@link computeTeamBuffsAroundHero}. Reading this snapshot on those screens made the same hero
 * print a different DPS on every account read, as the rotation turned.
 */
export function computeTeamBuffsFromDeployed(
  heroes: readonly Pick<HeroRecord, 'deployed' | 'abilities'>[],
): Record<TeamBuffId, number> {
  const out = zeroTeamBuffs();
  const contributors = heroes.filter((hero) => hero.deployed);
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    out[buffId] = contributors.reduce((total, hero) => total + perLevel * (hero.abilities[buffId] ?? 0), 0);
  }
  return out;
}

/**
 * Carrier count past which {@link expectedCappedTotal} stops enumerating and falls back to the
 * uncapped weighted sum. The distribution has at most `2^k` support points, so 20 carriers is
 * already a million-entry walk for a total that a roster that wide has certainly pinned at its cap
 * anyway. Rosters reach 3 carriers of one aura; this is a runaway guard, not a tuning knob.
 */
const COVERAGE_ENUMERATION_LIMIT = 20;

/**
 * `E[min(cap, Σ_present c_h)]` — the expected value of a CAPPED sum of independent contributions,
 * where carrier `h` contributes `c_h` with probability `presence_h`.
 *
 * WHY NOT `min(cap, Σ presence_h × c_h)`, THE OBVIOUS FORM. Capping a weighted sum is
 * `cap(E[X])`, and `min` is concave, so by Jensen it is an UPPER bound on the `E[cap(X)]` actually
 * wanted — and the bound is loose exactly where it matters. Two rank-20 carriers at uptime 0.58
 * and 0.55 sum to 22.6 and cap to the full 20, which asserts that at least one of them is on the
 * field 100% of the time. That is only true of a rotation deliberately STAGGERED to keep one up,
 * which is a thing an automated player does and a hand-played account does not: independent
 * carriers at those uptimes cover 81% of wall clock, for an expected 16.2. Live telemetry from a
 * bot-driven account measures 98%, confirming both that the staggered case is real and that it is
 * a property of how that account is played rather than of the game — so the model takes the
 * independent reading as its default and treats the staggered one as the upper bound it is.
 *
 * Exact rather than approximated: the support is enumerated carrier by carrier. Contributions are
 * usually equal (rank-20 across the board), so the distribution collapses hard and the walk stays
 * far below its `2^k` worst case. Called only once its caller has found a cap in reach and
 * fewer carriers than {@link COVERAGE_ENUMERATION_LIMIT}.
 */
function expectedCappedTotal(
  contributions: readonly { value: number; presence: number }[],
  cap: number,
): number {
  let dist = new Map<number, number>([[0, 1]]);
  for (const { value, presence } of contributions) {
    const next = new Map<number, number>();
    for (const [total, prob] of dist) {
      // Clamp as we go: everything at or above the cap is the same outcome, which is what keeps
      // the support from growing once a roster is deep enough to saturate.
      const withCarrier = Math.min(cap, total + value);
      next.set(total, (next.get(total) ?? 0) + prob * (1 - presence));
      next.set(withCarrier, (next.get(withCarrier) ?? 0) + prob * presence);
    }
    dist = next;
  }

  let expected = 0;
  for (const [total, prob] of dist) expected += prob * Math.min(cap, total);
  return expected;
}

function presenceAt(presence: readonly number[] | null, index: number): number {
  const raw = presence == null ? 1 : presence[index];
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
}

/**
 * The same sum as {@link computeTeamBuffsFromDeployed}, but over a ROTATION rather than over a
 * single deployed line-up: each hero's contribution is weighted by `presence[i]`, the fraction of
 * wall clock it is expected to actually stand on the field.
 *
 * THE ONE FORM EVERY ROSTER-WIDE FIGURE IS PRICED IN. The Farm board on both apps, the
 * Optimizer's gold objective and its damage objective (`computeRosterAuras`, a duty-map adapter
 * over this) all read this function, so the same roster carries the same aura total on every
 * screen that rotates it. Only the per-hero screens depart from it, deliberately and with their
 * own control — see {@link computeTeamBuffsAroundHero}.
 *
 * WHY A WEIGHTED SUM AND NOT THE DEPLOYED SNAPSHOT. A team aura is a property of the field, so it
 * exists only while a carrier is standing in it. A board pricing a POOL cycling through the House
 * over hours has a carrier at uptime 0.58 supplying its aura for 58% of the run and nothing for
 * the other 42%. Reading the deployed snapshot there applied one hero's aura to every hour of a
 * rotation it was absent from for most of, which over-predicted gold/hr on a Grito-carrying roster
 * and — the mirror case, equally wrong — under-predicted it whenever the heroes parked on the field
 * at import time happened to be the ones carrying nothing.
 *
 * `presence` is index-aligned with `heroes`; `null` means full presence (weight 1 for everyone),
 * which reproduces the roster's at-best total. Each weight is clamped to `[0, 1]`.
 *
 * CAPPED HERE, unlike {@link computeTeamBuffsFromDeployed}, which leaves the clamp to
 * `computeCombatMults`. Applying it downstream is what that function wants, because its input is a
 * single instant in which the carriers either are or are not present. Over a rotation the cap has
 * to be taken INSIDE the expectation ({@link expectedCappedTotal}) — `E[min(cap, X)]`, not
 * `min(cap, E[X])` — or two half-present carriers read as one permanently present one. The
 * downstream clamp then finds an already-capped value and is a no-op, so nothing double-clamps.
 *
 * THE APPROXIMATION THAT REMAINS, stated plainly: presence is treated as INDEPENDENT across
 * carriers. It is not, quite — a House rotation staggers heroes a little on its own, and an
 * automated one staggers them deliberately. Independence is the neutral reading between those and
 * the one a hand-played account is closest to. What survives is the linearity gap: this is still
 * `aura(E[presence])` per carrier, exact wherever the aura enters the model linearly (Fôlego does,
 * since field seconds are energy over a time-averaged drain rate) and approximate for Grito, whose
 * attack term reaches throughput through the `Math.ceil` in `hitsToKill`. A lone rank-20 Grito
 * carrier at uptime 0.578 prices at 11.57 where live telemetry measures 11.82.
 *
 * ALLOCATION-FREE ON THE COMMON PATH. The optimizer calls this once per fixed-point round per
 * roster evaluation, tens of thousands of times a solve; building a contribution record per hero
 * per aura there cost it ~18% of a 13-hero run. The linear weighted sum needs nothing built, so
 * the carriers are only materialised for {@link expectedCappedTotal} once a cap is actually in
 * reach — which on a real roster is one aura, if any.
 */
export function computeTeamBuffsOverRotation(
  heroes: readonly Pick<HeroRecord, 'abilities'>[],
  presence: readonly number[] | null,
): Record<TeamBuffId, number> {
  const out = zeroTeamBuffs();
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    const cap = TEAM_BUFF_CAP[buffId] ?? Infinity;
    let weightedSum = 0;
    let atBest = 0;
    let carriers = 0;
    for (let index = 0; index < heroes.length; index++) {
      const value = perLevel * (heroes[index].abilities[buffId] ?? 0);
      if (!(value > 0)) continue;
      const weight = presenceAt(presence, index);
      if (!(weight > 0)) continue;
      weightedSum += value * weight;
      atBest += value;
      carriers++;
    }
    // No cap in reach — the expectation is linear and the sum is already exact.
    if (carriers === 0 || carriers > COVERAGE_ENUMERATION_LIMIT || !(atBest > cap)) {
      out[buffId] = weightedSum;
      continue;
    }
    const contributions: { value: number; presence: number }[] = [];
    for (let index = 0; index < heroes.length; index++) {
      const value = perLevel * (heroes[index].abilities[buffId] ?? 0);
      const weight = presenceAt(presence, index);
      if (value > 0 && weight > 0) contributions.push({ value, presence: weight });
    }
    out[buffId] = expectedCappedTotal(contributions, cap);
  }
  return out;
}

/** Which of the four auras a per-hero screen counts the REST of the roster for. */
export type TeamAuraSwitches = Record<TeamBuffId, boolean>;

export function noTeamAuraSwitches(): TeamAuraSwitches {
  return {
    grito_guerra: false,
    pressagio_mortal: false,
    marcha_acelerada: false,
    folego_mineiro: false,
  };
}

/**
 * One aura as seen from one hero's seat: what the hero itself brings, and what every OTHER hero
 * the game will field would add at full presence, over `carriers` of them.
 */
export type TeamAuraAroundHero = {
  readonly own: number;
  readonly others: number;
  readonly carriers: number;
};

type RosterAuraHero = Pick<HeroRecord, 'id' | 'abilities' | 'battleAllowed'>;

/**
 * The roster's four auras from one hero's seat — the figures a per-hero screen's aura switches
 * are labelled with. `others` counts heroes with `battleAllowed !== false` other than `hero`
 * itself; the hero's own rank is `own`, whatever its own flag says, since the screen is pricing it
 * as fielded. Both are raw perLevel × rank sums, uncapped like every other total in this module.
 */
export function teamAurasAroundHero(
  hero: Pick<HeroRecord, 'id' | 'abilities'>,
  roster: readonly RosterAuraHero[],
): Record<TeamBuffId, TeamAuraAroundHero> {
  const others = roster.filter((other) => other.id !== hero.id && other.battleAllowed !== false);
  const out = {} as Record<TeamBuffId, TeamAuraAroundHero>;
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    const carriers = others.filter((other) => (other.abilities[buffId] ?? 0) > 0);
    out[buffId] = {
      own: perLevel * (hero.abilities[buffId] ?? 0),
      others: carriers.reduce((total, other) => total + perLevel * (other.abilities[buffId] ?? 0), 0),
      carriers: carriers.length,
    };
  }
  return out;
}

/**
 * The aura total a PER-HERO screen prices one hero against: the hero's own contribution always,
 * plus — for each aura switched on — every other fielded carrier's rank at FULL presence.
 *
 * WHY NOT THE ROTATION FORM. {@link computeTeamBuffsOverRotation} answers "what does this roster
 * average over hours", which is a roster question. A hero's detail screen asks a narrower one —
 * "what does THIS hero do on the field" — and there the only aura it certainly stands under is
 * its own. Whether a given other carrier is beside it is a what-if, so it is a switch: off, the
 * hero is priced alone; on, the carrier is assumed present the whole time, the at-best reading
 * rather than a fraction the player would have to guess at. The screen says so beside the
 * switches. Returns the raw, UNCAPPED sum like {@link computeTeamBuffsFromDeployed}: the clamp is
 * `computeCombatMults`'s.
 */
export function computeTeamBuffsAroundHero(
  hero: Pick<HeroRecord, 'id' | 'abilities'>,
  roster: readonly RosterAuraHero[],
  switches: TeamAuraSwitches,
): Record<TeamBuffId, number> {
  const around = teamAurasAroundHero(hero, roster);
  const out = zeroTeamBuffs();
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    out[buffId] = around[buffId].own + (switches[buffId] ? around[buffId].others : 0);
  }
  return out;
}

/**
 * Substitutes ONE hero's own contribution inside an already-computed roster total —
 * `total − oldRank×perLevel + newRank×perLevel` per aura — so a live editor preview can move
 * when the user changes THAT hero's own rank, without re-summing the whole roster and without
 * excluding anyone from the stored total itself (the old `excludeHeroId` design's defect: the
 * total two OTHER heroes read depended on which hero the exclusion happened to name). `oldAbilities`
 * is the hero's last-persisted ranks (as already counted in `total`); `newAbilities` is the
 * live-edited draft. Floors each aura at 0 — a `total` that was hand-typed, or computed before
 * the roster last changed, cannot be assumed to actually contain `oldAbilities`' contribution,
 * so the subtraction is not trusted to produce a negative result.
 */
export function substituteHeroAbilities(
  total: Record<TeamBuffId, number>,
  oldAbilities: Record<string, number>,
  newAbilities: Record<string, number>,
): Record<TeamBuffId, number> {
  const out = { ...total };
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    const oldContribution = perLevel * (oldAbilities[buffId] ?? 0);
    const newContribution = perLevel * (newAbilities[buffId] ?? 0);
    out[buffId] = Math.max(0, total[buffId] - oldContribution + newContribution);
  }
  return out;
}
