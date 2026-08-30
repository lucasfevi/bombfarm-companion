/**
 * The update check / download / install control. Built from the same shipped `@bombfarm/ui`
 * primitives as the other three settings sections, with `diagnostics-section.tsx`'s
 * always-mounted `Banner` so the section does not change height as the phase advances
 * (`docs/no-layout-shift.md` rule 1).
 *
 * Presentational only — `page.tsx` owns the `updates:*` invokes and the subscription; this
 * component never touches `window.bfc` itself.
 */
import type { UpdateStatus } from '@bombfarm/contracts';
import { Bar, Banner, Button, SettingsRow, SettingsSection, cn } from '@bombfarm/ui';
import { UPDATE_ERROR_REASON_COPY_KEY, sub, useCopy, type Copy } from '../../lib/copy';

interface BannerContent {
  tone: 'ok' | 'warn';
  title: string;
  body: string;
}

/**
 * The one place a phase becomes words. `idle` has nothing to say — the player has not asked yet
 * and no automatic check has landed — so it renders the invisible placeholder rather than filler.
 */
export function updateBanner(status: UpdateStatus, t: Copy): BannerContent | null {
  switch (status.phase) {
    case 'checking':
      return { tone: 'ok', title: t.settingsUpdatesStatusChecking, body: '' };
    case 'not-available':
      return { tone: 'ok', title: t.settingsUpdatesStatusUpToDate, body: '' };
    case 'available':
      return {
        tone: 'ok',
        title: sub(t.settingsUpdatesStatusAvailableTitle, { version: status.availableVersion ?? '' }),
        body: t.settingsUpdatesStatusAvailableBody,
      };
    case 'downloading':
      return {
        tone: 'ok',
        title: sub(t.settingsUpdatesStatusDownloading, {
          version: status.availableVersion ?? '',
          percent: status.percent ?? 0,
        }),
        body: '',
      };
    case 'ready':
      return {
        tone: 'ok',
        title: sub(t.settingsUpdatesStatusReadyTitle, { version: status.availableVersion ?? '' }),
        body: t.settingsUpdatesStatusReadyBody,
      };
    case 'error':
      return {
        tone: 'warn',
        title: t.settingsUpdatesErrorTitle,
        body: t[UPDATE_ERROR_REASON_COPY_KEY[status.error ?? 'unknown']],
      };
    case 'disabled':
      return { tone: 'warn', title: t.settingsUpdatesStatusDisabled, body: '' };
    default:
      return null;
  }
}

/** The action row names whatever its button does — a row labelled "check for updates" above a
 *  "Restart and install" button reads as two different controls. */
function actionLabel(status: UpdateStatus, t: Copy): string {
  if (status.phase === 'ready') return t.settingsUpdatesInstallLabel;
  if (status.phase === 'available') return t.settingsUpdatesDownloadLabel;
  return t.settingsUpdatesCheckLabel;
}

function actionHelp(status: UpdateStatus, t: Copy): string {
  if (status.phase === 'ready') return t.settingsUpdatesInstallHelp;
  if (status.phase === 'available') return t.settingsUpdatesDownloadHelp;
  return t.settingsUpdatesCheckHelp;
}

export function UpdatesSection({
  status,
  onCheck,
  onDownload,
  onInstall,
}: {
  status: UpdateStatus;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
}) {
  const t = useCopy();
  const banner = updateBanner(status, t);
  const enabled = status.phase !== 'disabled';
  // A check during a download would race the transfer it invalidates, and `ready` is terminal
  // until the app restarts — main enforces both, and the button reflects that rather than
  // offering a click that main would discard.
  const canCheck = enabled && status.phase !== 'checking' && status.phase !== 'downloading' && status.phase !== 'ready';

  return (
    <SettingsSection title={t.settingsUpdatesSectionTitle}>
      <SettingsRow
        label={t.settingsUpdatesCurrentVersionLabel}
        help={status.channel ? sub(t.settingsUpdatesChannelHelp, { channel: status.channel }) : undefined}
      >
        {/* `data-settings-value` is what puts a read-only value in the row's control column;
            without it the stack grid drops it into the label cell, on top of the label. */}
        <span data-settings-value data-testid="settings-updates-current-version" className="font-mono tabular-nums">
          v{status.currentVersion}
        </span>
      </SettingsRow>

      <SettingsRow label={actionLabel(status, t)} help={actionHelp(status, t)}>
        {status.phase === 'ready' ? (
          <Button type="button" data-testid="settings-updates-install" onClick={onInstall}>
            {t.settingsUpdatesInstallAction}
          </Button>
        ) : status.phase === 'available' ? (
          <Button type="button" data-testid="settings-updates-download" onClick={onDownload}>
            {t.settingsUpdatesDownloadAction}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            data-testid="settings-updates-check"
            disabled={!canCheck}
            onClick={onCheck}
          >
            {t.settingsUpdatesCheckAction}
          </Button>
        )}
      </SettingsRow>

      <Banner
        tone={banner?.tone ?? 'ok'}
        title={banner?.title ?? ''}
        data-testid="settings-updates-status"
        aria-hidden={!banner}
        className={cn(!banner && 'invisible')}
      >
        {banner?.body ?? ''}
      </Banner>

      {status.phase === 'downloading' ? (
        <div data-testid="settings-updates-progress">
          <Bar percent={status.percent ?? 0} />
        </div>
      ) : null}
    </SettingsSection>
  );
}
