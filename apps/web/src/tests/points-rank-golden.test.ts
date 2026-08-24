/**
 * Golden characterization of today's DPS next-point ranking, recorded from the tree BEFORE the
 * one-shot heuristic is deleted. The deletion that follows must reproduce these figures
 * byte-for-byte — this file is the proof, not a claim. Values were read off a real run of the
 * current (pre-deletion) code, not hand-derived.
 *
 * RE-RECORDED for the corrected House cycle table. The `HOUSES` endpoints were a whole-minute
 * reconstruction and ran short of the real cycle by a full minute per house; the wiki's
 * `rotacao.casas[].cycle_secs_base`/`cycle_secs_max` replaced them. This fixture's account
 * carries no `casa.cycle_secs`, so it resolves rest through the table and every duty cycle moved.
 * The footprint is:
 *
 * - **`energy` on all three subjects**, and only `energy` at any meaningful magnitude — a longer
 *   House cycle means a larger share of the rotation is spent refilling, so a point of Energy
 *   (which buys field seconds) is worth more than it was. It moves UP on every subject and never
 *   changes rank order.
 * - Three 13th-significant-digit re-associations off the changed uptime feeding the same shared
 *   computation: `penetration` on Bellatrix and Lyra, `critDmg` on Jon. Not on every subject,
 *   and nowhere near enough to reorder.
 * - `attack`, `critChance`, `cdr` and `speed` are byte-identical on every subject — the proof
 *   this was a duty-cycle change and touched no per-point rate.
 *
 * ---
 * RE-RECORDED for the 2026-08-18 crit-chance/CDR revert (issue #132). Diffed value by value
 * against the previous golden first; the footprint is:
 *
 * - **`critChance` and `cdr` on every subject**, moving in both directions and RE-ORDERING —
 *   under the flat model `cdr` outranked `critChance` on all four subjects; under the reverted
 *   percent-of-base model `critChance` now outranks `cdr` on all four. A pooled stat's marginal
 *   value scales with the hero's own roll again, so a hero with a well-rolled crit chance and a
 *   thin cooldown roll gets more from a crit-chance point than a flat rate ever gave it.
 * - **`critDmg` moved too, on every subject**, purely as a SECOND-ORDER effect: `critFactor`
 *   couples crit chance and crit damage (`avgHit = base × (1 + critChance/100 × (critDmg/100 −
 *   1))`), so a hero's crit-damage marginal value shifts whenever her crit-chance baseline does,
 *   even though crit damage's own per-point rate (flat, `POINT_GAIN.critDmgFlat`) never changed.
 * - `attack` / `energy` / `penetration` moved in the 12th–13th significant digit only on some
 *   subjects (IEEE-754 re-association off the changed crit-chance/cdr baseline feeding the same
 *   shared computation) — not on every subject, and never enough to change rank order. `speed`
 *   is byte-identical (0) on every subject, as it always is once it hits its own ranking floor.
 */
import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { rankNextPoint, STAT_CAPS, POINT_GAIN, type HeroSheet, type Context, type PointValue } from '@bombfarm/domain/model';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FIXTURE = 'save-20260813-5heroes.json';

const pick = (rows: readonly PointValue[]) => rows.map((r) => ({ stat: r.stat, gainPct: r.gainPct }));

describe('DPS next-point ranking — golden fixture (pre-deletion, pinned byte-for-byte)', () => {
  const raw = loadFixtureJson(FIXTURE);
  const parsed = parseAccountPayload(raw, []);
  if (parsed.rejected) throw new Error(`fixture rejected: ${parsed.rejected.reason}`);

  const accountData = parsed.account;
  if (!accountData.tree) throw new Error('fixture must carry a skill tree');
  const tree = accountData.tree;
  const phase = accountData.phase;
  if (phase == null) throw new Error('fixture must carry account.phase');
  const line = phaseLine(phase);
  if (!line) throw new Error('fixture phase has no phase line');
  const mitigationPct = line.mitig * 100;

  const account: AccountShared = {
    tree: {
      danoTotal: tree.danoTotal,
      critChance: tree.critChance,
      critDmg: tree.critDmg,
      speed: tree.speed,
      energy: tree.energy,
      teamCoinPct: tree.teamCoinPct ?? 0,
      luckFlatPct: tree.luckFlatPct,
    },
    teamBuffs: zeroTeamBuffs(),
    context: {
      houseIdx: accountData.houseIdx ?? 0,
      houseLevel: accountData.houseLevel ?? 1,
      phase,
      mitigationPct,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
    slots: accountData.slots ?? undefined,
  };

  function heroByName(name: string): HeroRecord {
    const candidate = parsed.candidates.find((c) => c.record.name === name);
    if (!candidate) throw new Error(`fixture hero "${name}" not found`);
    return { ...candidate.record, id: candidate.sourceId, updatedAt: 0 };
  }

  it('Bellatrix L42 — full ranking pinned to full precision', () => {
    // RE-MEASURED for the 2026-08-23 crit-chance ability shape. Bellatrix carries
    // `olho_clinico` 20/20 off a 5.081 birth roll: percent-of-base gave her `+4.36` crit points,
    // flat gives her `+40`, so her crit rate goes from single digits to the mid-forties and the
    // whole crit branch of the derivative moves with it. `critDmg` jumps from 0.452 to 1.685 and
    // OVERTAKES `energy` — crit damage is worth more the more often it lands. This fixture's
    // sheet numbers are a pre-patch capture; the ranking is characterization, not a claim about
    // what the game would print for her today.
    const result = pipelineForHero(heroByName('Bellatrix'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 2.124613721702251 },
      { stat: 'critDmg', gainPct: 1.6848046058554278 },
      { stat: 'energy', gainPct: 1.419237680643981 },
      { stat: 'critChance', gainPct: 0.05757950726386074 },
      { stat: 'cdr', gainPct: 0.03270868386004988 },
      { stat: 'penetration', gainPct: 0.0018927950043989838 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });

  it('Jon L38 — full ranking pinned to full precision', () => {
    // RE-MEASURED for issue #132 (team-aura roster shape): Jon carries folego_mineiro 18
    // himself. This fixture's account.teamBuffs is zeroTeamBuffs() (farm-rate-fixtures.ts
    // reproduces production's post-import default, before the team-buffs auto-fill button is
    // ever pressed) — so under the confirmed rule Jon's own rank now correctly contributes
    // NOTHING to his own drain (it only exists inside a real roster total), where the old
    // model let a hero's own rank leak through into their own mods regardless of context. His
    // uptime/duty shifts accordingly, moving every gainPct downstream of it.
    const result = pipelineForHero(heroByName('Jon'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 2.7210974575787805 },
      { stat: 'energy', gainPct: 2.5026538249044217 },
      { stat: 'critDmg', gainPct: 0.3844374051138466 },
      { stat: 'critChance', gainPct: 0.06045133145873294 },
      { stat: 'cdr', gainPct: 0.01848900890673022 },
      { stat: 'penetration', gainPct: 0.0008367710927048577 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });

  it('Lyra L2 — full ranking pinned to full precision', () => {
    // RE-MEASURED for the 2026-08-23 crit-chance ability shape. Lyra carries `olho_clinico` at
    // rank 2 only, so her crit rate moves by `+4` points rather than Bellatrix's `+40` and the
    // rank ORDER is unchanged — the same shape change, at a magnitude that does not reorder.
    const result = pipelineForHero(heroByName('Lyra'), account, phase, mitigationPct);
    expect(pick(result.ranking)).toEqual([
      { stat: 'attack', gainPct: 14.75414905657837 },
      { stat: 'energy', gainPct: 6.1320901572672115 },
      { stat: 'critDmg', gainPct: 0.47049017889033706 },
      { stat: 'critChance', gainPct: 0.0508105727768271 },
      { stat: 'cdr', gainPct: 0.03458638173732265 },
      { stat: 'penetration', gainPct: 0.0008296399027551971 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });
});

describe('DPS next-point ranking — CDR marginal-fuse special case (golden, pre-deletion)', () => {
  const baseCtx = (): Context => ({
    restSeconds: 12 * 60,
    mitigation: 0.067,
    blastRange: 1,
    cycleModel: 'serial',
    walkDelay: 0.15,
    drainMult: 1,
  });

  const sampleHero = (): HeroSheet => ({
    rarity: 'Raro',
    attack: 400,
    energy: 500,
    speed: 55,
    critChance: 12,
    critDmg: 80,
    penetration: 8,
    cdr: 10,
    attackPerPoint: POINT_GAIN.attackNative,
    energyPerPoint: POINT_GAIN.energyNative,
  });

  it('cdr below the 80% cap: positive gain, pinned to full precision', () => {
    const ranking = rankNextPoint(sampleHero(), baseCtx());
    const cdr = ranking.find((r) => r.stat === 'cdr')!;
    expect(cdr.gainPct).toBeGreaterThan(0);
    expect(cdr.gainPct).toBe(0.05130836326321386);
  });

  it('cdr at the 80% cap: exactly zero gain, pinned to full precision', () => {
    const ranking = rankNextPoint({ ...sampleHero(), cdr: STAT_CAPS.cdr }, baseCtx());
    const cdr = ranking.find((r) => r.stat === 'cdr')!;
    expect(cdr.gainPct).toBe(0);
  });

  it('no options object and a bare {} both keep working and agree exactly (isRankOptions narrowing)', () => {
    const withNoOptions = rankNextPoint(sampleHero(), baseCtx());
    const withBareObject = rankNextPoint(sampleHero(), baseCtx(), {});
    expect(pick(withBareObject)).toEqual(pick(withNoOptions));
    expect(pick(withNoOptions)).toEqual([
      { stat: 'attack', gainPct: 2.499999999999991 },
      { stat: 'energy', gainPct: 0.9381107491856833 },
      { stat: 'critDmg', gainPct: 0.5474452554744547 },
      { stat: 'critChance', gainPct: 0.10218978102187748 },
      { stat: 'cdr', gainPct: 0.05130836326321386 },
      { stat: 'penetration', gainPct: 0.003570058399771092 },
      { stat: 'speed', gainPct: 0 },
    ]);
  });
});
