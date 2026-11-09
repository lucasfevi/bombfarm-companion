import type { Lang } from './format-number';

/**
 * Relative ages, in the two shapes the apps print: a short elapsed span (`45s`, `5m`) and a
 * "how long ago" stamp (`just now`, `3h ago`). Four buckets is the whole need, so this is not an
 * `Intl.RelativeTimeFormat` wrapper or a plural engine — every word below reads the same for
 * every count.
 *
 * The words live here rather than in a host's dictionary so every consumer prints one spelling.
 * 's' abbreviates seconds identically in both languages; Portuguese writes minutes as 'min'.
 */
const AGE_WORDS = {
  en: { seconds: '{n}s', minutes: '{n}m', justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago' },
  pt: { seconds: '{n}s', minutes: '{n}min', justNow: 'agora mesmo', minutesAgo: 'há {n}m', hoursAgo: 'há {n}h', daysAgo: 'há {n}d' },
} as const satisfies Record<Lang, Record<string, string>>;

function withCount(template: string, n: number): string {
  return template.replace('{n}', String(n));
}

function wholeSeconds(ms: number): number {
  return Math.max(0, Math.round(ms / 1000));
}

/** A short elapsed span: whole seconds under a minute, whole minutes from there on. */
export function formatAge(ms: number, lang: Lang): string {
  const words = AGE_WORDS[lang];
  const seconds = wholeSeconds(ms);
  return seconds < 60 ? withCount(words.seconds, seconds) : withCount(words.minutes, Math.round(seconds / 60));
}

/** How long ago something happened, `ms` being its age: "just now" under a minute, then minutes,
 *  hours and days. A negative age (a clock ahead of ours) reads as just now. */
export function formatTimeAgo(ms: number, lang: Lang): string {
  const words = AGE_WORDS[lang];
  const seconds = wholeSeconds(ms);
  if (seconds < 60) return words.justNow;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return withCount(words.minutesAgo, minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return withCount(words.hoursAgo, hours);
  return withCount(words.daysAgo, Math.round(hours / 24));
}
