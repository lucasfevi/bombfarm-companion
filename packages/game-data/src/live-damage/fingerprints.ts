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
  resolve(fuseTotal: number, present: ReadonlySet<string>): FingerprintResolution;
  clear(): void;
}

interface HeroFuse {
  seed?: number;
  learned?: number;
}

export function createFingerprintBook(): FingerprintBook {
  const fuses = new Map<string, HeroFuse>();
  const disagreed = new Set<string>();

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
      entryFor(heroId).seed = fuseTotal;
    },

    learn(heroId, fuseTotal) {
      const entry = entryFor(heroId);
      entry.learned = fuseTotal;
      if (entry.seed === undefined || disagreed.has(heroId)) return null;
      if (Math.abs(entry.seed - fuseTotal) <= FUSE_TOLERANCE) return null;
      disagreed.add(heroId);
      return { heroId, seeded: entry.seed, learned: fuseTotal };
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
    },
  };
}
