import { sub, type Strings } from '@/shared/i18n';


/** The published pattern, shown before GitHub answers — an illustration, not a link. */
const GENERIC_INSTALLER_NAME = 'bombfarm-companion-beta-setup.exe';

/**
 * The Windows dialog, redrawn. Its own colours rather than the app's tokens on purpose: this is a
 * picture of something the visitor is about to meet on their own screen, and it is only useful if
 * it looks like Windows rather than like this site. "Run anyway" carries the accent ring because
 * it is the button that does not exist until "More info" is clicked — the whole reason the step
 * around it is written out.
 */
export function SmartScreenDialog({ t, fileName }: { t: Strings; fileName: string | null }) {
  return (
    <div
      aria-hidden="true"
      className="mt-4 w-full max-w-[330px] overflow-hidden rounded-lg border border-[#0b1b2b] bg-[#1f3b56] text-[#eef4fa] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.95)]"
    >
      <div className="p-4">
        <p className="m-0 mb-2 text-[15px] leading-snug font-semibold">{t.downloadSmartTitle}</p>
        <p className="m-0 text-[11.5px] leading-relaxed text-[#c4d6e6]">{t.downloadSmartBody}</p>
        <span className="mt-3 inline-block text-[11.5px] text-[#9ec8f0] underline">
          {t.downloadSmartMore}
        </span>
        <p className="m-0 mt-2.5 text-[11px] leading-relaxed text-[#9fb6c9]">
          {sub(t.downloadSmartApp, { file: fileName ?? GENERIC_INSTALLER_NAME })}
          <br />
          {t.downloadSmartPublisher}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#0e2338] bg-[#183048] px-3.5 py-3">
        <span className="rounded-xs border border-accent bg-[color-mix(in_oklch,var(--accent)_26%,#25455f)] px-4 py-1.5 text-[11.5px] shadow-[0_0_0_3px_oklch(72%_0.14_55/0.22)]">
          {t.downloadSmartRunAnyway}
        </span>
        <span className="rounded-xs border border-[#4a6c8a] bg-[#25455f] px-4 py-1.5 text-[11.5px]">
          {t.downloadSmartDontRun}
        </span>
      </div>
    </div>
  );
}
