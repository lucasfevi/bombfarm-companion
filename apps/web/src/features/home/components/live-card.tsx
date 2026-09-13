'use client';

import { buttonRecipe, cn } from '@bombfarm/ui';
import { RELEASES_URL, useLatestRelease } from '@/features/download';
import { useAppLang } from '@/shared/context/app-lang';
import { sub } from '@/shared/i18n';
import { HomeSectionCard } from './home-section-card';
import { HomeTrustLine } from './home-trust-line';

export function LiveCard() {
  const { t } = useAppLang();
  const release = useLatestRelease();

  return (
    <HomeSectionCard
      section="download"
      state="ready"
      context={t.homeCardLiveContext}
      footer={
        release === null
          ? t.downloadFileMetaPending
          : sub(t.downloadFileMeta, { file: release.fileName, size: release.sizeLabel })
      }
    >
      <p className="m-0 text-sm">{t.homeCardLiveBody}</p>
      <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
        <HomeTrustLine>{t.homeCardLiveTrustReads}</HomeTrustLine>
        <HomeTrustLine>{t.downloadTrustPermission}</HomeTrustLine>
        <HomeTrustLine>{t.downloadTrustUpdates}</HomeTrustLine>
      </ul>
      <a
        className={cn(buttonRecipe({ variant: 'primary' }), 'mt-4')}
        href={release?.downloadUrl ?? RELEASES_URL}
        data-testid="home-live-download"
      >
        {t.downloadCta}
        {release === null ? null : (
          <span className="ml-2 font-mono text-xs opacity-70">v{release.version}</span>
        )}
      </a>
    </HomeSectionCard>
  );
}
