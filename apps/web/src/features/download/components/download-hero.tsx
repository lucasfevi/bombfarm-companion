import { buttonRecipe, cn } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { RELEASES_URL, REPO_URL } from '../model/release';
import type { LatestRelease } from '../model/latest-release';
import { LiveReplica } from './live/live-replica';
import { TrustLine } from './trust-line';

export function DownloadHero({
  t,
  lang,
  release,
}: {
  t: Strings;
  lang: Lang;
  /** `null` until GitHub answers — the button then points at the releases page, never a 404. */
  release: LatestRelease | null;
}) {
  return (
    <section className="grid items-center gap-10 py-8 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <div>
        <p className="m-0 font-mono text-[11px] tracking-[0.17em] text-accent uppercase">
          {t.downloadEyebrow}
        </p>
        <h1 className="m-0 mt-4 mb-4 text-[clamp(2rem,4.2vw,3rem)] leading-tight font-extrabold tracking-tight text-balance text-ink">
          {t.downloadHeadlineLead} <span className="text-accent">{t.downloadHeadlineAccent}</span>
        </h1>
        <p className="m-0 max-w-[46ch] text-[16.5px] text-muted">{t.downloadLede}</p>

        <div className="mt-7 flex flex-wrap items-center gap-3.5">
          <a
            className={cn(buttonRecipe({ variant: 'primary' }), 'h-auto px-6 py-4 text-base')}
            href={release?.downloadUrl ?? RELEASES_URL}
            data-testid="download-installer"
          >
            {t.downloadCta}
            {release !== null ? (
              <span className="ml-2 font-mono text-xs opacity-70">v{release.version}</span>
            ) : null}
          </a>
        </div>

        <p
          className="m-0 mt-3.5 font-mono text-[11.5px] text-muted"
          data-testid="download-file-meta"
        >
          {release === null
            ? t.downloadFileMetaPending
            : sub(t.downloadFileMeta, { file: release.fileName, size: release.sizeLabel })}
        </p>

        <ul className="m-0 mt-5 grid list-none gap-2 p-0">
          <TrustLine>{t.downloadTrustPermission}</TrustLine>
          <TrustLine>{t.downloadTrustUpdates}</TrustLine>
          <TrustLine>
            {t.downloadTrustLicense}{' '}
            <a
              className="text-accent underline-offset-2 hover:underline"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t.downloadTrustLicenseLink}
            </a>
          </TrustLine>
        </ul>
      </div>

      <div className="min-w-0">
        <LiveReplica lang={lang} />
      </div>
    </section>
  );
}
