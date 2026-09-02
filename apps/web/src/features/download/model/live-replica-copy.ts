import type { Lang } from '@/shared/i18n';

/**
 * The labels the Live replica prints, mirrored from the desktop shell's own copy.
 *
 * They are duplicated rather than imported on purpose: the desktop speaks a second, independent
 * bilingual layer (`docs/i18n.md`), and the web app's boundaries forbid reaching into it. So this
 * module is a deliberate copy of another module's values, which is exactly the kind of thing that
 * rots quietly.
 *
 * Each key here is the desktop copy key it mirrors, and `tools/download-page-drift.test.mjs`
 * fails when a value stops matching the desktop's. Do not rename a key to something readable —
 * the key IS the link to the source of truth, and the guard resolves it by name.
 */
const MIRRORED = {
  liveStatusLiveLabel: { en: 'Streaming live from the game', pt: 'Transmitindo ao vivo do jogo' },
  liveHeroesTitle: { en: 'Heroes', pt: 'Heróis' },
  liveListOnFieldTitle: { en: 'Field', pt: 'Campo' },
  liveListRecoveringTitle: { en: 'Resting', pt: 'Descansando' },
  liveListQueuedTitle: { en: 'Idle', pt: 'Ociosos' },
  liveListBenchedTitle: { en: 'Benched', pt: 'No banco' },
  liveEarningsTitle: { en: 'Earnings', pt: 'Ganhos' },
  liveEarningsCurrentGoldLabel: { en: 'Current gold', pt: 'Ouro atual' },
  liveEarningsGoldHeadlineUnit: { en: 'gold / h', pt: 'ouro / h' },
  liveEarningsXpHeadlineUnit: { en: 'xp / h', pt: 'xp / h' },
  liveEarningsGoldSessionLabel: { en: 'Gold/hr', pt: 'Ouro/h' },
  liveEarningsXpSessionLabel: { en: 'XP/hr', pt: 'XP/h' },
  liveEarningsGoldSessionTotalLabel: { en: 'Gold total', pt: 'Total de ouro' },
  liveEarningsXpSessionTotalLabel: { en: 'XP total', pt: 'Total de XP' },
  liveEarningsElapsedLabel: { en: 'Elapsed', pt: 'Decorrido' },
  liveEarningsSeriesLabel: { en: 'Gold / hr — last {minutes} min', pt: 'Ouro / h — últimos {minutes} min' },
  liveEarningsSeriesPeakLabel: { en: 'peak {value}', pt: 'pico {value}' },
  liveEarningsMeasuredNote: { en: 'Measured', pt: 'Medido' },
  liveEarningsGoldPerPropLabel: { en: 'Gold / prop', pt: 'Ouro / prop' },
  liveEarningsPropsPerMinuteLabel: { en: 'Props / min', pt: 'Props / min' },
  liveEarningsPropsTotalLabel: { en: 'Props', pt: 'Props' },
  liveEarningsGoldPerPropUnder: { en: '{percent}% under estimate', pt: '{percent}% abaixo da estimativa' },
  liveMapTitle: { en: 'Map', pt: 'Mapa' },
  liveMapHealthLabel: { en: 'Map health', pt: 'Vida do mapa' },
  liveMapPropsLabel: { en: 'Props alive', pt: 'Props vivos' },
  liveMapXpPerPropLabel: { en: 'XP / prop', pt: 'XP / prop' },
  liveMapGoldPerPropLabel: { en: 'Gold / prop', pt: 'Ouro / prop' },
  liveMapGoldPerClearLabel: { en: 'Gold / clear', pt: 'Ouro / limpeza' },
  liveMapEstimateNote: { en: 'Estimated', pt: 'Estimativa' },
  liveEarningsRecentWindowLabel: { en: 'last {minutes} min', pt: 'últimos {minutes} min' },
  miniLiveOpenLabel: { en: 'Open mini', pt: 'Abrir mini' },
  miniLiveAxisLabel: { en: 'Growth direction', pt: 'Direção de crescimento' },
  miniLiveAxisVerticalLabel: { en: 'Stacked', pt: 'Empilhado' },
  miniLiveAxisHorizontalLabel: { en: 'Side by side', pt: 'Em linha' },
  miniLiveLastSectionNote: { en: 'At least one panel must stay on', pt: 'Pelo menos um painel precisa permanecer ligado' },
} as const;

export type MirroredKey = keyof typeof MIRRORED;

export const MIRRORED_KEYS = Object.keys(MIRRORED) as readonly MirroredKey[];

/**
 * The labels only the compact-window drawing prints. They are split out because the two drawings
 * are checked separately: a key added here has to appear in the mini section, and every other
 * mirrored key has to appear in the full-size replica. Folded into one list, a label could be
 * mirrored, guarded against the desktop, and drawn by neither.
 */
const MINI_KEYS = new Set<string>([
  'liveEarningsRecentWindowLabel',
  'miniLiveOpenLabel',
  'miniLiveAxisLabel',
  'miniLiveAxisVerticalLabel',
  'miniLiveAxisHorizontalLabel',
  'miniLiveLastSectionNote',
]);

export const MIRRORED_MINI_KEYS = MIRRORED_KEYS.filter((key) => MINI_KEYS.has(key));

export const MIRRORED_BASE_KEYS = MIRRORED_KEYS.filter((key) => !MINI_KEYS.has(key));

export function liveLabel(key: MirroredKey, lang: Lang): string {
  return MIRRORED[key][lang];
}
