// The desktop main process's proof that it can compute with @bombfarm/domain
// (following the decision to build @bombfarm/domain to dist). This is a deliberately trivial
// value import from the DIRECTORY subpath
// `@bombfarm/domain/model` — the shape the OLD src-targeting `exports` map could not
// express at all (design.md). F1's job is to prove the edge compiles and bundles;
// F3 (mp3-auto-recompute) is what actually calls the planner engine from real account data.
import { fuseSeconds } from '@bombfarm/domain/model';

/** Trivial wrapper — the point is that this compiles and bundles against the built package. */
export function fuseSecondsForCdr(cdrPct: number): number {
  return fuseSeconds(cdrPct);
}
