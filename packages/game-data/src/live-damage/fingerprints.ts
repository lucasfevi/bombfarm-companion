export const FUSE_TOLERANCE = 1e-6;

export interface FingerprintDisagreement {
  readonly heroId: string;
  readonly seeded: number;
  readonly learned: number;
}

export type FingerprintResolution =
  | { readonly kind: 'unique'; readonly heroId: string }
  | { readonly kind: 'shared' }
  | { readonly kind: 'unknown' };

export interface FingerprintBook {
  seed(heroId: string, fuseTotal: number): void;
  learn(heroId: string, fuseTotal: number): FingerprintDisagreement | null;
  fuseOf(heroId: string): number | undefined;
  learnRadius(heroId: string, radius: number): void;
  radiusOf(heroId: string): number | undefined;
  resolve(fuseTotal: number, present: ReadonlySet<string>): FingerprintResolution;
  clear(): void;
}

interface HeroFuse {
  seed?: number;
  learned?: number;
  pending?: number;
}

const sameFuse = (a: number, b: number) => Math.abs(a - b) <= FUSE_TOLERANCE;

export function createFingerprintBook(): FingerprintBook {
  const fuses = new Map<string, HeroFuse>();
  const disagreed = new Set<string>();
  const radii = new Map<string, number>();

  const entryFor = (heroId: string): HeroFuse => {
    let entry = fuses.get(heroId);
    if (entry === undefined) {
      entry = {};
      fuses.set(heroId, entry);
    }
    return entry;
  };

  return {
    seed(heroId, fuseTotal) {
      const entry = entryFor(heroId);
      if (entry.seed !== undefined && !sameFuse(entry.seed, fuseTotal)) {
        delete entry.learned;
        delete entry.pending;
        disagreed.delete(heroId);
      }
      entry.seed = fuseTotal;
    },

    learn(heroId, fuseTotal) {
      const entry = entryFor(heroId);
      const current = entry.learned ?? entry.seed;
      if (current !== undefined && sameFuse(current, fuseTotal)) {
        delete entry.pending;
        return null;
      }
      if (current !== undefined && (entry.pending === undefined || !sameFuse(entry.pending, fuseTotal))) {
        entry.pending = fuseTotal;
        return null;
      }
      delete entry.pending;
      entry.learned = fuseTotal;
      if (entry.seed === undefined || disagreed.has(heroId)) return null;
      if (sameFuse(entry.seed, fuseTotal)) return null;
      disagreed.add(heroId);
      return { heroId, seeded: entry.seed, learned: fuseTotal };
    },

    fuseOf(heroId) {
      const entry = fuses.get(heroId);
      return entry === undefined ? undefined : (entry.learned ?? entry.seed);
    },

    learnRadius(heroId, radius) {
      radii.set(heroId, radius);
    },

    radiusOf(heroId) {
      return radii.get(heroId);
    },

    resolve(fuseTotal, present) {
      let match: string | undefined;
      for (const [heroId, entry] of fuses) {
        if (!present.has(heroId)) continue;
        const effective = entry.learned ?? entry.seed;
        if (effective === undefined || Math.abs(effective - fuseTotal) > FUSE_TOLERANCE) continue;
        if (match !== undefined) return { kind: 'shared' };
        match = heroId;
      }
      return match === undefined ? { kind: 'unknown' } : { kind: 'unique', heroId: match };
    },

    clear() {
      fuses.clear();
      disagreed.clear();
      radii.clear();
    },
  };
}
