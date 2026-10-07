import type { CSSProperties } from 'react';
import type { CollectionAxis } from '@bombfarm/contracts';

/**
 * One hue per axis, in the skill tree's own style: oklch lifted to one lightness band so no axis
 * reads as more important than another. Damage, speed, drop, energy, geo and neutral reuse the
 * tree's arm hues for the stat they share with it (28, 200, 140, 255, 300, and the neutral
 * silver); Gold keeps the wallet's gold. The two crit axes are kin — pinks either side of the
 * tree's crit hue (350), a little apart so they stay two colours. Forge is a bronze, hue 55, clear
 * of both the gold (about 85) and the damage red (28). The app is dark-only, so there is no
 * light-theme counterpart.
 */
export const COLLECTION_AXIS_COLOUR: Readonly<Record<CollectionAxis, string>> = {
  damage: 'oklch(70% 0.19 28)',
  critDamage: 'oklch(74% 0.17 335)',
  critChance: 'oklch(76% 0.15 8)',
  cooldown: 'oklch(80% 0.13 200)',
  cage: 'oklch(82% 0.02 48)',
  energy: 'oklch(74% 0.15 255)',
  gold: 'var(--gold)',
  xp: 'oklch(74% 0.16 300)',
  luck: 'oklch(78% 0.16 140)',
  forge: 'oklch(72% 0.14 55)',
};

/** The axis hue as the `--axis-colour` custom property, which the classes under it read. */
export function axisColourStyle(axis: CollectionAxis): CSSProperties {
  return { '--axis-colour': COLLECTION_AXIS_COLOUR[axis] } as CSSProperties;
}
