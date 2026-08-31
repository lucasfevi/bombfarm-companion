'use client';

import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { useLatestRelease } from '../model/use-latest-release';
import { DownloadHero } from './download-hero';
import { ReleaseChannels } from './release-channels';
import { InstallSteps } from './install-steps';
import { IncludedScreens } from './included-screens';

/**
 * A section of the app, not a landing page beside it — the shell supplies the header, the nav,
 * the language toggle and the footer, and this renders between them like `/farm` does.
 */
export function DownloadPage({ t, lang }: { t: Strings; lang: Lang }) {
  const release = useLatestRelease();

  return (
    <div className={workspaceClass}>
      <DownloadHero t={t} lang={lang} release={release} />
      <ReleaseChannels t={t} lang={lang} release={release} />
      <InstallSteps t={t} fileName={release?.fileName ?? null} />
      <IncludedScreens t={t} />
    </div>
  );
}
