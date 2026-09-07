/**
 * The presentation decisions the combat panel makes ON TOP of `pipelineForHero`.
 *
 * Every figure the panel prints is already on the pipeline result; nothing here re-derives one.
 * What lives here is the judgements the panel would otherwise take inside JSX, where no test in
 * this repository can reach them: what the fuse readout is saying, which stage the figures belong
 * to and whether the reader chose it, whether the hero's penetration covers the stage, and
 * whether there is a prop table to draw at all.
 */
import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import { penGap } from '@bombfarm/domain/phase-intel';
import type { PropHtkRow } from '@bombfarm/domain/advisor-tables';
import type { PhaseSelection } from '../core';

/**
 * ALL FOUR FIELDS ARE READ, NONE IS INFERRED. The result reports the floor and the
 * cooldown-reduction cap separately, and says for itself whether the fuse has reached the floor,
 * because the three coincide today only by construction — a balance patch can move any one of
 * them alone, and a consumer deriving one from another would go on printing a self-consistent,
 * wrong readout.
 */
export type FuseSource = Pick<
  AdvisorPipelineResult,
  'fuseSecs' | 'fuseFloorSecs' | 'cdrCapPct' | 'fuseAtFloor'
>;

export type FuseReadout = {
  readonly secs: number;
  readonly floorSecs: number;
  readonly capPct: number;
  readonly atFloor: boolean;
};

export function fuseReadoutFor(combat: FuseSource): FuseReadout {
  return {
    secs: combat.fuseSecs,
    floorSecs: combat.fuseFloorSecs,
    capPct: combat.cdrCapPct,
    atFloor: combat.fuseAtFloor,
  };
}

export type FuseNotes = {
  /** Further cooldown reduction buys no cadence. */
  readonly atCeiling: string;
  readonly floor: (floorSecs: number) => string;
};

export function fuseNote(readout: FuseReadout, notes: FuseNotes): string {
  return readout.atFloor ? notes.atCeiling : notes.floor(readout.floorSecs);
}

export type StageNotes = {
  readonly farmScreen: string;
  readonly override: string;
};

export type StageLabel = {
  readonly phase: number;
  /** The reader is looking at a stage of their own choosing, not the host's. */
  readonly fromOverride: boolean;
  readonly note: string;
};

/** The figures belong to ONE stage, and a reader who cannot see which one — or cannot tell their
 *  own choice from the host's — reads them as facts about the hero rather than about a stage. */
export function stageLabelFor(selection: PhaseSelection, notes: StageNotes): StageLabel {
  const fromOverride = selection.kind === 'override';
  return {
    phase: selection.phase,
    fromOverride,
    note: fromOverride ? notes.override : notes.farmScreen,
  };
}

export type PenetrationReading =
  | { readonly kind: 'covered' }
  | { readonly kind: 'short'; readonly gapPct: number };

/** The two fields of the pipeline result this reading needs, narrowed so a test can state one
 *  without standing up a whole run. */
export type PenetrationSource = {
  readonly context: { readonly mitigation: number };
  readonly effective: { readonly penetration: number };
};

export function penetrationReadingFor(combat: PenetrationSource): PenetrationReading {
  const gapPct = penGap(combat.context.mitigation * 100, combat.effective.penetration);
  return gapPct > 0 ? { kind: 'short', gapPct } : { kind: 'covered' };
}

export type PenetrationNotes = {
  readonly covered: string;
  readonly short: (gapPct: number) => string;
};

export function penetrationNote(
  reading: PenetrationReading,
  notes: PenetrationNotes,
): string {
  return reading.kind === 'covered' ? notes.covered : notes.short(reading.gapPct);
}

export type PropTableReading =
  | { readonly kind: 'rows'; readonly rows: readonly PropHtkRow[] }
  | { readonly kind: 'empty' };

/** A stage carrying no props gets a stated sentence; an empty table reads as a failure to load. */
export function propTableReadingFor(rows: readonly PropHtkRow[]): PropTableReading {
  return rows.length === 0 ? { kind: 'empty' } : { kind: 'rows', rows };
}
