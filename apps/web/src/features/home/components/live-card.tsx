'use client';

import Link from 'next/link';
import { buttonRecipe, cn } from '@bombfarm/ui';
import { useLatestRelease } from '@/features/download';
import { useAppLang } from '@/shared/context/app-lang';
import { SITE_SECTION_HREF } from '@/shared/lib/site-sections';
import { HomeSectionCard } from './home-section-card';
import { HomeTrustLine } from './home-trust-line';

export function LiveCard() {
  const { t } = useAppLang();
  const release = useLatestRelease();

  return (
    <HomeSectionCard
      section="download"
      state="ready"
      title={t.downloadHeaderCta}
      link={false}
      bodyClassName="flex flex-col gap-4"
      footer={null}
    >
      <p className="m-0 text-sm">{t.homeCardLiveBody}</p>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        <HomeTrustLine>{t.downloadTrustPermission}</HomeTrustLine>
        <HomeTrustLine>{t.downloadTrustUpdates}</HomeTrustLine>
      </ul>
      <Link
        className={cn(buttonRecipe({ variant: 'primary' }), 'mt-auto flex h-auto w-full items-center justify-center py-3.5 text-base')}
        href={SITE_SECTION_HREF.download}
        data-testid="home-live-download"
      >
        {t.downloadCta}
        {release === null ? null : (
          <span className="ml-2 font-mono text-xs opacity-70">v{release.version}</span>
        )}
      </Link>
    </HomeSectionCard>
  );
}
