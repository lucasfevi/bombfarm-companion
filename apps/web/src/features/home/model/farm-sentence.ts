import { formatClearTime } from '@bombfarm/hero/model';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';
import type { FarmSentenceFragment } from './farm-card-view';

function fragmentText(fragment: FarmSentenceFragment, strings: Strings, lang: Lang): string {
  switch (fragment.kind) {
    case 'ahead':
      return sub(strings.homeCardFarmSentenceAhead, { count: fragment.count });
    case 'behind':
      return sub(strings.homeCardFarmSentenceBehind, { count: fragment.count });
    case 'clearFaster':
      return sub(strings.homeCardFarmSentenceClearFaster, { delta: formatClearTime(fragment.deltaSecs) });
    case 'clearSlower':
      return sub(strings.homeCardFarmSentenceClearSlower, { delta: formatClearTime(fragment.deltaSecs) });
    case 'itemLevelUp':
      return sub(strings.homeCardFarmSentenceItemLevelUp, { delta: formatNumber(fragment.delta, lang, 0) });
    case 'itemLevelDown':
      return sub(strings.homeCardFarmSentenceItemLevelDown, { delta: formatNumber(fragment.delta, lang, 0) });
    case 'oneShotGained':
      return strings.homeCardFarmSentenceOneShotGained;
    case 'oneShotLost':
      return strings.homeCardFarmSentenceOneShotLost;
  }
}

export function buildFarmSentence(
  fragments: readonly FarmSentenceFragment[],
  strings: Strings,
  lang: Lang,
): string | null {
  if (fragments.length === 0) return null;
  return `${fragments.map((fragment) => fragmentText(fragment, strings, lang)).join(', ')}.`;
}

export function formatSignedPct(pct: number, lang: Lang): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(pct), lang, 1)}%`;
}
