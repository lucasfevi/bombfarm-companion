import {
  HiMiniChevronDown,
  HiMiniChevronUp,
  HiMiniXMark,
  HiMiniCheckCircle,
  HiMiniXCircle,
  HiMiniExclamationTriangle,
  HiMiniInformationCircle,
  HiMiniArrowPath,
  HiMiniLockClosed,
} from 'react-icons/hi2';
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
  // toast/notification `success` variant (m2-toast-settings, TST-13)
  'check-circle': HiMiniCheckCircle,
  // toast/notification `error` variant (m2-toast-settings, TST-13)
  'x-circle': HiMiniXCircle,
  // toast/notification `warning` variant (m2-toast-settings, TST-13)
  'exclamation-triangle': HiMiniExclamationTriangle,
  // toast/notification `info` variant (m2-toast-settings, TST-13)
  'information-circle': HiMiniInformationCircle,
  // toast/notification `progress` variant spinner (m2-toast-settings, TST-13)
  'arrow-path': HiMiniArrowPath,
  // DeltaTable locked-row glyph — replaces a Chip + HelpTip pair on a row a table can't change
  'lock-closed': HiMiniLockClosed,
} as const satisfies Record<string, IconGlyph>;
