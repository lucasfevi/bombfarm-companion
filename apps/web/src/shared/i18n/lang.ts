export type Lang = 'pt' | 'en';

const LANG_KEY = 'bf_lang';

export function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return stored === 'en' ? 'en' : 'pt';
  } catch {
    return 'pt';
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode */
  }
}
