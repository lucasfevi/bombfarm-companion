import type { Lang } from '@/shared/i18n';

export const PRIVACY_CONTACT_EMAIL = 'black.gamingacc@gmail.com';

/** Moves whenever the policy's substance does — the page promises to date every change. */
export const PRIVACY_UPDATED_ON = '2026-09-23';

export function formatPolicyDate(isoDay: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${isoDay}T00:00:00Z`),
  );
}

/** A paragraph split around its `{email}` slot, so the address can render as a link. */
export function splitAtEmail(text: string): readonly [string, string] | null {
  const slot = text.indexOf('{email}');
  if (slot === -1) return null;
  return [text.slice(0, slot), text.slice(slot + '{email}'.length)];
}
