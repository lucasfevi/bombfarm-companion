/**
 * The one seeded PRNG the property suites draw from. Deterministic by construction, so a red run
 * is reproduced by re-running the seed its failure message prints — which `Math.random` cannot
 * offer, and which is the whole reason a property test on synthetic input is worth more than a
 * fixture assertion.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
