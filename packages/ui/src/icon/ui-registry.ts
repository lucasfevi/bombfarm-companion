import {
  HiMiniArrowsRightLeft,
  HiMiniChevronDown,
  HiMiniChevronUp,
  HiMiniXMark,
  HiMiniCheck,
  HiMiniCheckCircle,
  HiMiniXCircle,
  HiMiniExclamationTriangle,
  HiMiniInformationCircle,
  HiMiniArrowPath,
  HiMiniLockClosed,
  HiMiniSquares2X2,
  HiMiniBars3,
  HiMiniWindow,
} from 'react-icons/hi2';
import { BiCoffee, BiCopy } from 'react-icons/bi';
import { PiSortAscending, PiSortDescending } from 'react-icons/pi';
import type { IconGlyph } from './types';

export const uiIconRegistry = {
  // Desktop header control that opens the compact second Live window
  window: HiMiniWindow,
  // Inventory layout toggle — cards
  'layout-grid': HiMiniSquares2X2,
  // Inventory layout toggle — list
  'layout-list': HiMiniBars3,
  // select affix, num spinner, accordion/collapsible trigger, sort desc, idle sort stack
  'chevron-down': HiMiniChevronDown,
  // num spinner increment, sort asc, idle sort stack
  'chevron-up': HiMiniChevronUp,
  // ConfirmDialog close mark
  'x-mark': HiMiniXMark,
  // Phases hero switcher — exchange the subject the screen is showing for another one
  swap: HiMiniArrowsRightLeft,
  // The tick inside a multi-select's checkbox. Bare, not `check-circle` — that one is the toast's
  // success badge and carries its own ring.
  check: HiMiniCheck,
  // Button coffee / coffee-full stories
  coffee: BiCoffee,
  // The referral-code controls in both apps' chrome — copy the code to the clipboard
  copy: BiCopy,
  // toast/notification `success` variant (m2-toast-settings)
  'check-circle': HiMiniCheckCircle,
  // toast/notification `error` variant (m2-toast-settings)
  'x-circle': HiMiniXCircle,
  // toast/notification `warning` variant (m2-toast-settings)
  'exclamation-triangle': HiMiniExclamationTriangle,
  // toast/notification `info` variant (m2-toast-settings)
  'information-circle': HiMiniInformationCircle,
  // toast/notification `progress` variant spinner (m2-toast-settings)
  'arrow-path': HiMiniArrowPath,
  // DeltaTable locked-row glyph — replaces a Chip + HelpTip pair on a row a table can't change
  'lock-closed': HiMiniLockClosed,
  // Sort direction on a list control. A plain chevron is the wrong glyph here: it already means
  // "this select opens downward" two elements away, so the pair read as one control's affordance
  // rather than as the order the list is in. Phosphor's sort marks show the bars AND the arrow.
  //
  // The two are crossed ON PURPOSE. Phosphor names these for the arrow's own direction, not for
  // the order they mark: read the paths and `PiSortAscending` is a DOWN arrow beside bars that
  // shorten downward, which is what every list control draws for *descending*. These keys are
  // named for what the glyph means, so a call site reading `sort-ascending` gets the ascending
  // mark. Verify by geometry, not by the import name, if this is ever revisited.
  'sort-ascending': PiSortDescending,
  'sort-descending': PiSortAscending,
} as const satisfies Record<string, IconGlyph>;
