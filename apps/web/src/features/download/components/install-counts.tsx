import { type Lang, type Strings } from '@/shared/i18n';
import type { LatestRelease } from '../model/latest-release';
import { CountFigure } from './count-figure';

export function InstallCounts({
  t,
  lang,
  release,
}: {
  t: Strings;
  lang: Lang;
  /** `null` while unknown, and stays null if GitHub could not be reached. */
  release: LatestRelease | null;
}) {
  if (release === null) return null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-8 rounded-xl border border-line bg-bg-2 px-6 py-5">
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
        <CountFigure
          lang={lang}
          tone="gold"
          testId="download-install-count"
          value={release.installs}
          label={t.downloadInstallsSuffix}
        />
        {release.updates > 0 ? (
          <CountFigure
            lang={lang}
            tone="ink"
            testId="download-update-count"
            value={release.updates}
            label={t.downloadUpdatesSuffix}
          />
        ) : null}
      </div>
    </section>
  );
}
