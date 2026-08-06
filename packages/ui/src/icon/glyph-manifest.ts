import type { GameGlyphName } from './glyph-names';

/**
 * Per-glyph approval state. Approving a glyph is a one-line edit to one row
 * here — it touches nothing else (enum, registry, generated files, Icon API).
 */
export type GlyphApproval =
  | { approval: 'placeholder' }
  | { approval: 'approved'; approvedOn: `${number}-${number}-${number}` };

export const glyphApproval: Record<GameGlyphName, GlyphApproval> = {
  'slot-arma': { approval: 'placeholder' },
  'slot-elmo': { approval: 'placeholder' },
  'slot-peito': { approval: 'placeholder' },
  'slot-calca': { approval: 'placeholder' },
  'slot-luva': { approval: 'placeholder' },
  'slot-bota': { approval: 'placeholder' },
  'slot-anel': { approval: 'placeholder' },
  'slot-amuleto': { approval: 'placeholder' },
  gem: { approval: 'placeholder' },
  key: { approval: 'placeholder' },
  gold: { approval: 'placeholder' },
  'rarity-0': { approval: 'placeholder' },
  'rarity-1': { approval: 'placeholder' },
  'rarity-2': { approval: 'placeholder' },
  'rarity-3': { approval: 'placeholder' },
  'rarity-4': { approval: 'placeholder' },
  'rarity-5': { approval: 'placeholder' },
};
