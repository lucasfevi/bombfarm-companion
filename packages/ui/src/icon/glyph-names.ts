/**
 * Closed game-glyph id tuple. Adding, removing, or renaming a member is a spec
 * change — enum ↔ `.svg` ↔ `.tsx` ↔ registry one-to-one parity is asserted in
 * icon-drift.test.ts.
 */
export const GAME_GLYPH_NAMES = [
  'slot-arma',
  'slot-elmo',
  'slot-peito',
  'slot-calca',
  'slot-luva',
  'slot-bota',
  'slot-anel',
  'slot-amuleto',
  'gem',
  'key',
  'gold',
  'rarity-0',
  'rarity-1',
  'rarity-2',
  'rarity-3',
  'rarity-4',
  'rarity-5',
] as const;

export type GameGlyphName = (typeof GAME_GLYPH_NAMES)[number];
