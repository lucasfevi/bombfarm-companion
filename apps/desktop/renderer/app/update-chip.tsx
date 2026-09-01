/**
 * The footer's update indicator, sitting immediately left of the version. It reports the same
 * `UpdateStatus` the Settings section does and drives nothing itself: clicking opens Settings,
 * where the download and restart controls already live. Drawing those controls a second time
 * here would be a second copy of a state machine main already owns.
 */
import type { UpdateStatus } from '@bombfarm/contracts';
import { ActionChip, type ActionChipTone } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../lib/copy';

interface ChipContent {
  tone: ActionChipTone;
  label: string;
}

/** The three phases a player can act on. Every other phase — `idle`, `checking`, `not-available`,
 *  `error`, `disabled` — belongs to the Settings section alone: a footer that announced a routine
 *  six-hourly check, or an error nobody asked for, would be noise in permanent furniture. */
function chipContent(status: UpdateStatus, t: Copy): ChipContent | null {
  switch (status.phase) {
    case 'available':
      return { tone: 'active', label: t.shellUpdateAvailable };
    case 'downloading':
      return { tone: 'muted', label: sub(t.shellUpdateDownloading, { percent: status.percent ?? 0 }) };
    case 'ready':
      return { tone: 'active', label: t.shellUpdateReady };
    default:
      return null;
  }
}

export function UpdateChip({ status, onOpenSettings }: { status: UpdateStatus; onOpenSettings: () => void }) {
  const t = useCopy();
  const content = chipContent(status, t);
  if (content === null) return null;

  return (
    <ActionChip
      data-testid="shell-update-chip"
      data-phase={status.phase}
      tone={content.tone}
      label={content.label}
      aria-label={`${content.label} — ${t.shellUpdateOpenSettings}`}
      onClick={onOpenSettings}
    />
  );
}
