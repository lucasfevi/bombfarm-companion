import type { RequiredAccountField } from '@bombfarm/domain/account-required-fields';
import type { Strings } from '@/shared/i18n';

/** The Account page's own labels, so no other surface invents a second vocabulary for them. */
export const FIELD_LABEL_KEY = {
  tree: 'panelTree',
  houseIdx: 'house',
  houseLevel: 'houseLevelLabel',
  phase: 'accountCurrentPhase',
  maxPhase: 'accountMaxPhase',
} as const satisfies Record<RequiredAccountField, keyof Strings>;
