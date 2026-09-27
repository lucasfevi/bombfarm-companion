'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { PrivacyPage } from '@/features/privacy';

export default function Page() {
  const { t, lang } = useAppLang();

  return <PrivacyPage t={t} lang={lang} />;
}
