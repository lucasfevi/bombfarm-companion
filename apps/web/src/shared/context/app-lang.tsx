'use client';

// Store-backed compat hook — provider removed in W4.
import { usePlannerStore, selectLang, selectStrings } from '@/shared/stores';
import type { Lang, Strings } from '@/shared/i18n';

type AppLangValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: Strings;
};

/** Compat hook — same return shape as the former context provider (W4-07). */
export function useAppLang(): AppLangValue {
  const lang = usePlannerStore(selectLang);
  const strings = usePlannerStore(selectStrings);
  const setLang = usePlannerStore((state) => state.setLang);
  return { lang, setLang, t: strings };
}
