import { describe, expect, it } from 'vitest';
import type { PropHtkRow } from '@bombfarm/domain/advisor-tables';
import {
  fuseNote,
  fuseReadoutFor,
  penetrationNote,
  penetrationReadingFor,
  propTableReadingFor,
  stageLabelFor,
  type FuseSource,
} from './combat-panel';

/** The shape the pipeline reports today: the floor is twice the base cycle at the 80% cap, so the
 *  two coincide by construction. Every test below that moves one of them apart is standing in for
 *  the balance patch that separates them. */
const AT_FLOOR: FuseSource = {
  fuseSecs: 0.4,
  fuseFloorSecs: 0.4,
  cdrCapPct: 80,
  fuseAtFloor: true,
};

describe('fuseReadoutFor', () => {
  it('reports the fuse, the floor and the cooldown ceiling as the result stated them', () => {
    expect(fuseReadoutFor(AT_FLOOR)).toEqual({
      secs: 0.4,
      floorSecs: 0.4,
      capPct: 80,
      atFloor: true,
    });
  });

  it('a patch that moves the cap without moving the floor is reported as it happened', () => {
    const readout = fuseReadoutFor({ ...AT_FLOOR, cdrCapPct: 90 });
    expect(readout.capPct).toBe(90);
    expect(readout.floorSecs).toBe(0.4);
  });

  it('a patch that moves the floor without moving the cap is reported as it happened', () => {
    const readout = fuseReadoutFor({ ...AT_FLOOR, fuseFloorSecs: 0.25 });
    expect(readout.floorSecs).toBe(0.25);
    expect(readout.capPct).toBe(80);
  });

  it('whether the fuse is at the floor is the result’s answer, not one recomputed from the two', () => {
    const readout = fuseReadoutFor({
      fuseSecs: 0.9,
      fuseFloorSecs: 0.4,
      cdrCapPct: 80,
      fuseAtFloor: true,
    });
    expect(readout.atFloor).toBe(true);
    expect(readout.secs).toBeGreaterThan(readout.floorSecs);
  });

  it('a hero clear of the floor reads as clear of it', () => {
    const readout = fuseReadoutFor({
      fuseSecs: 1.2,
      fuseFloorSecs: 0.4,
      cdrCapPct: 80,
      fuseAtFloor: false,
    });
    expect(readout.atFloor).toBe(false);
  });
});

describe('fuseNote', () => {
  const NOTES = {
    atCeiling: 'further cooldown reduction buys nothing',
    floor: (floorSecs: number) => `the fuse cannot go below ${floorSecs.toFixed(2)}s`,
  };

  it('a hero at the floor is told further cooldown reduction buys nothing', () => {
    expect(fuseNote(fuseReadoutFor(AT_FLOOR), NOTES)).toBe(NOTES.atCeiling);
  });

  it('a hero clear of the floor is told where the floor is', () => {
    const readout = fuseReadoutFor({ ...AT_FLOOR, fuseSecs: 1.2, fuseAtFloor: false });
    expect(fuseNote(readout, NOTES)).toBe('the fuse cannot go below 0.40s');
  });
});

describe('stageLabelFor', () => {
  const NOTES = {
    farmScreen: 'this is the stage your farm screen is set to',
    override: 'you are looking at a different stage than your farm screen',
  };

  it('names the stage the figures were computed at', () => {
    expect(stageLabelFor({ kind: 'farmScreen', phase: 26 }, NOTES).phase).toBe(26);
    expect(stageLabelFor({ kind: 'override', phase: 157 }, NOTES).phase).toBe(157);
  });

  it('says which of the two chose the stage, in two different sentences', () => {
    const host = stageLabelFor({ kind: 'farmScreen', phase: 26 }, NOTES);
    const reader = stageLabelFor({ kind: 'override', phase: 26 }, NOTES);
    expect(host.fromOverride).toBe(false);
    expect(reader.fromOverride).toBe(true);
    expect(host.note).not.toBe(reader.note);
  });
});

describe('penetrationReadingFor', () => {
  it('penetration pierces a share of the mitigation, so 42% against a 60% phase still loses 34.8% of each hit', () => {
    expect(
      penetrationReadingFor({ context: { mitigation: 0.6 }, effective: { penetration: 42 } }),
    ).toEqual({ kind: 'partial', lostPct: expect.closeTo(60 * 0.58, 6) as number, penetrationPct: 42, mitigationPct: 60 });
  });

  it('penetration equal to the mitigation percentage is NOT pierced — the two are not the same quantity', () => {
    const reading = penetrationReadingFor({ context: { mitigation: 0.6 }, effective: { penetration: 60 } });
    expect(reading.kind).toBe('partial');
    if (reading.kind === 'partial') expect(reading.lostPct).toBeCloseTo(24, 6);
  });

  it('only 100% penetration is pierced, whatever the phase', () => {
    expect(
      penetrationReadingFor({ context: { mitigation: 0.3 }, effective: { penetration: 100 } }),
    ).toEqual({ kind: 'pierced' });
    expect(
      penetrationReadingFor({ context: { mitigation: 0.3 }, effective: { penetration: 140 } }),
    ).toEqual({ kind: 'pierced' });
  });
});

describe('penetrationNote', () => {
  const NOTES = {
    pierced: 'nothing lost to mitigation',
    partial: ({ lostPct }: { lostPct: number }) => `${lostPct.toFixed(1)}% of each hit lost`,
  };

  it('a pierced hero and a partial one get two different sentences', () => {
    expect(penetrationNote({ kind: 'pierced' }, NOTES)).toBe(NOTES.pierced);
    expect(penetrationNote({ kind: 'partial', lostPct: 18, penetrationPct: 40, mitigationPct: 30 }, NOTES)).toBe('18.0% of each hit lost');
  });
});
describe('propTableReadingFor', () => {
  const ROW: PropHtkRow = { name: 'Rocha', hp: 100, hits: 4, oneshotGapPct: 0, highlight: false };

  it('a stage with no props is stated, not drawn as an empty table', () => {
    expect(propTableReadingFor([])).toEqual({ kind: 'empty' });
  });

  it('a stage with props hands the rows through untouched', () => {
    expect(propTableReadingFor([ROW])).toEqual({ kind: 'rows', rows: [ROW] });
  });
});
