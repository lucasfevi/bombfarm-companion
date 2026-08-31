import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { LatestRelease } from '../model/latest-release';
import { CountFigure } from './count-figure';
import { ReleaseChannelCard } from './release-channel-card';

export function ReleaseChannels({
  t,
  lang,
  release,
}: {
  t: Strings;
  lang: Lang;
  /** `null` while unknown, and stays null if GitHub could not be reached. */
  release: LatestRelease | null;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-8 rounded-xl border border-line bg-bg-2 px-6 py-5">
      {release !== null ? (
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
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <ReleaseChannelCard
          current
          title={t.downloadChannelBetaTitle}
          note={
            release === null
              ? t.downloadChannelBetaNotePending
              : sub(t.downloadChannelBetaNote, { version: release.version })
          }
        />
        <ReleaseChannelCard
          title={t.downloadChannelNightlyTitle}
          note={t.downloadChannelNightlyNote}
        />
        <ReleaseChannelCard
          title={t.downloadChannelStableTitle}
          note={t.downloadChannelStableNote}
        />
      </div>
    </section>
  );
}
