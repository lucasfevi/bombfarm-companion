import type { GameGlyphName } from './glyph-names';
import type { IconGlyph } from './types';
import SvgGem from './game/gem';
import SvgGold from './game/gold';
import SvgKey from './game/key';
import SvgRarity0 from './game/rarity-0';
import SvgRarity1 from './game/rarity-1';
import SvgRarity2 from './game/rarity-2';
import SvgRarity3 from './game/rarity-3';
import SvgRarity4 from './game/rarity-4';
import SvgRarity5 from './game/rarity-5';
import SvgSlotAmuleto from './game/slot-amuleto';
import SvgSlotAnel from './game/slot-anel';
import SvgSlotArma from './game/slot-arma';
import SvgSlotBota from './game/slot-bota';
import SvgSlotCalca from './game/slot-calca';
import SvgSlotElmo from './game/slot-elmo';
import SvgSlotLuva from './game/slot-luva';
import SvgSlotPeito from './game/slot-peito';

export const gameIconRegistry: Record<GameGlyphName, IconGlyph> = {
  'slot-arma': SvgSlotArma,
  'slot-elmo': SvgSlotElmo,
  'slot-peito': SvgSlotPeito,
  'slot-calca': SvgSlotCalca,
  'slot-luva': SvgSlotLuva,
  'slot-bota': SvgSlotBota,
  'slot-anel': SvgSlotAnel,
  'slot-amuleto': SvgSlotAmuleto,
  gem: SvgGem,
  key: SvgKey,
  gold: SvgGold,
  'rarity-0': SvgRarity0,
  'rarity-1': SvgRarity1,
  'rarity-2': SvgRarity2,
  'rarity-3': SvgRarity3,
  'rarity-4': SvgRarity4,
  'rarity-5': SvgRarity5,
};
