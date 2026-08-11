import { HiMiniChevronDown, HiMiniChevronUp, HiMiniXMark } from 'react-icons/hi2';
import { BiCoffee } from 'react-icons/bi';
import type { IconGlyph } from './types';

export const uiIconRegistry = {
  // select affix, num spinner, accordion/collapsible trigger, sort desc, idle sort stack
  'chevron-down': HiMiniChevronDown,
  // num spinner increment, sort asc, idle sort stack
  'chevron-up': HiMiniChevronUp,
  // ConfirmDialog close mark
  'x-mark': HiMiniXMark,
  // Button coffee / coffee-full stories
  coffee: BiCoffee,
} as const satisfies Record<string, IconGlyph>;
