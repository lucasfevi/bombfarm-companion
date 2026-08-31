'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { DownloadPage } from '@/features/download';

export default function Page() {
  const { t, lang } = useAppLang();

  return <DownloadPage t={t} lang={lang} />;
}
