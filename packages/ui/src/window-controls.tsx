import { Icon } from './icon';
import { cn } from './cn';
import {
  windowControlButtonClass,
  windowControlCloseClass,
  windowControlsClass,
} from './window-controls.recipe';

export interface WindowControlsLabels {
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
}

export interface WindowControlsProps {
  maximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  /** Caller-supplied, already-translated text — i18n stays out of the design system. */
  labels: WindowControlsLabels;
}

/**
 * WindowControls — minimize, maximize/restore and close, drawn by the app instead of by the OS.
 *
 * Icon-only, so every button carries its own accessible name; the middle one's name changes with
 * `maximized` because the control it is changes with it, and a name that stayed "Maximize" on a
 * maximized window would describe the wrong action to anyone not looking at the glyph.
 */
export function WindowControls({
  maximized,
  onMinimize,
  onToggleMaximize,
  onClose,
  labels,
}: WindowControlsProps) {
  const maximizeLabel = maximized ? labels.restore : labels.maximize;

  return (
    <div className={windowControlsClass} data-testid="window-controls">
      <button
        type="button"
        data-testid="window-minimize"
        aria-label={labels.minimize}
        onClick={onMinimize}
        className={windowControlButtonClass}
      >
        <Icon name="window-minimize" size="xs" />
      </button>
      <button
        type="button"
        data-testid="window-maximize"
        aria-label={maximizeLabel}
        onClick={onToggleMaximize}
        className={windowControlButtonClass}
      >
        <Icon name={maximized ? 'window-restore' : 'window-maximize'} size="xs" />
      </button>
      <button
        type="button"
        data-testid="window-close"
        aria-label={labels.close}
        onClick={onClose}
        className={cn(windowControlButtonClass, windowControlCloseClass)}
      >
        <Icon name="window-close" size="xs" />
      </button>
    </div>
  );
}
