import { type Lang, type Strings } from '@/shared/i18n';
import type { DownloadCounts } from '../model/latest-release';
import { CountFigure } from './count-figure';

export function InstallCounts({
  t,
  lang,
  counts,
}: {
  t: Strings;
  lang: Lang;
  /** `null` while unknown, and stays null if any page of the release list could not be read. */
  counts: DownloadCounts | null;
}) {
  if (counts === null) return null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-8 rounded-xl border border-line bg-bg-2 px-6 py-5">
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
        <CountFigure
          lang={lang}
          tone="gold"
          testId="download-install-count"
          value={counts.installs}
          label={t.downloadInstallsSuffix}
        />
        {counts.updates > 0 ? (
          <CountFigure
            lang={lang}
            tone="ink"
            testId="download-update-count"
            value={counts.updates}
            label={t.downloadUpdatesSuffix}
          />
        ) : null}
      </div>
    </section>
  );
}
