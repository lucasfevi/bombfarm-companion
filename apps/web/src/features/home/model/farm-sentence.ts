import { formatClearTime } from '@bombfarm/hero/model';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';
import type { FarmSentenceFragment } from './farm-card-view';

const levels = (values: readonly number[]) => values.join('/');

function fragmentText(fragment: FarmSentenceFragment, strings: Strings): string {
  switch (fragment.kind) {
    case 'ahead':
      return sub(strings.homeCardFarmSentenceAhead, { count: fragment.count });
    case 'behind':
      return sub(strings.homeCardFarmSentenceBehind, { count: fragment.count });
    case 'clearFaster':
      return sub(strings.homeCardFarmSentenceClearFaster, { delta: formatClearTime(fragment.deltaSecs) });
    case 'clearSlower':
      return sub(strings.homeCardFarmSentenceClearSlower, { delta: formatClearTime(fragment.deltaSecs) });
    case 'dropsKeepAdd':
      return sub(strings.homeCardFarmSentenceDropsKeepAdd, { keep: levels(fragment.keep), add: levels(fragment.add) });
    case 'dropsAdd':
      return sub(strings.homeCardFarmSentenceDropsAdd, { add: levels(fragment.add) });
    case 'dropsKeepLose':
      return sub(strings.homeCardFarmSentenceDropsKeepLose, { keep: levels(fragment.keep), lose: levels(fragment.lose) });
    case 'dropsLose':
      return sub(strings.homeCardFarmSentenceDropsLose, { lose: levels(fragment.lose) });
    case 'dropsSwap':
      return sub(strings.homeCardFarmSentenceDropsSwap, { lose: levels(fragment.lose), add: levels(fragment.add) });
    case 'oneShotGained':
      return strings.homeCardFarmSentenceOneShotGained;
    case 'oneShotLost':
      return strings.homeCardFarmSentenceOneShotLost;
  }
}

export function buildFarmSentence(fragments: readonly FarmSentenceFragment[], strings: Strings): string | null {
  if (fragments.length === 0) return null;
  const parts = fragments.map((fragment) => fragmentText(fragment, strings));
  const last = parts.pop() as string;
  const joined = parts.length === 0 ? last : `${parts.join(', ')}${strings.homeCardFarmSentenceAnd}${last}`;
  return `${joined}.`;
}

export function formatSignedPct(pct: number, lang: Lang): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(pct), lang, 1)}%`;
}
