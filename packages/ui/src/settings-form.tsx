import type { PropsWithChildren, ReactNode } from 'react';
import { Button } from './button';
import { cn } from './cn';
import { Fields, type FieldsLayout } from './fields';
import {
  saveBarClass,
  settingsRowHelpClass,
  settingsRowLabelSpanClass,
  settingsSectionBodyClass,
  settingsSectionClass,
  settingsSectionDescriptionClass,
  settingsSectionHeaderClass,
  settingsSectionTitleClass,
} from './settings-form.recipe';

const HEADING_TAG = { 2: 'h2', 3: 'h3', 4: 'h4' } as const;

export type SettingsSectionProps = PropsWithChildren<{
  title: string;
  description?: string;
  /** Heading tag for `title` — defaults to `h2`, mirroring `EmptyState`'s `headingLevel`. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}>;

/** SettingsSection — a titled region for a group of `SettingsRow`s. */
export function SettingsSection({
  title,
  description,
  headingLevel = 2,
  className,
  children,
}: SettingsSectionProps) {
  const Heading = HEADING_TAG[headingLevel];
  return (
    <section className={cn(settingsSectionClass, className)}>
      <div className={settingsSectionHeaderClass}>
        <Heading className={settingsSectionTitleClass}>{title}</Heading>
        {description ? <p className={settingsSectionDescriptionClass}>{description}</p> : null}
      </div>
      <div className={settingsSectionBodyClass}>{children}</div>
    </section>
  );
}

export type SettingsRowProps = PropsWithChildren<{
  label: string;
  help?: string | undefined;
  /** Passed straight through to `Fields` — default `stack` fits a settings list best. */
  layout?: FieldsLayout | undefined;
  className?: string | undefined;
}>;

/**
 * SettingsRow — label + optional help text + control slot. Composes `Fields`
 * rather than hand-rolling the label/control grid: the row is a
 * single-`<label>` `Fields` instance, so it inherits `stackFieldsClass`'s
 * two-column layout, `data-num`/`data-select` control alignment, and
 * `data-field-hint` styling for free.
 */
export function SettingsRow({ label, help, layout = 'stack', className, children }: SettingsRowProps) {
  return (
    <Fields layout={layout} className={className}>
      <label>
        <span className={settingsRowLabelSpanClass}>
          {label}
          {help ? (
            <span data-field-hint className={settingsRowHelpClass}>
              {help}
            </span>
          ) : null}
        </span>
        {children}
      </label>
    </Fields>
  );
}

export type SaveBarProps = {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: ReactNode;
  discardLabel?: ReactNode;
  savingLabel?: ReactNode;
  className?: string;
};

/**
 * SaveBar — presentational only (Out of Scope: auto-save policy is M5's).
 * Both actions disable when there is nothing to save (`!dirty`) or while a
 * save is already in flight (`saving`); the Save button reflects `saving`
 * via `aria-busy` and swaps its label to `savingLabel`.
 */
export function SaveBar({
  dirty,
  saving = false,
  onSave,
  onDiscard,
  saveLabel = 'Save',
  discardLabel = 'Discard',
  savingLabel = 'Saving…',
  className,
}: SaveBarProps) {
  const disabled = !dirty || saving;
  return (
    <div
      className={cn(saveBarClass, className)}
      data-dirty={dirty || undefined}
      data-saving={saving || undefined}
    >
      <Button type="button" variant="ghost" onClick={onDiscard} disabled={disabled}>
        {discardLabel}
      </Button>
      <Button type="button" variant="primary" onClick={onSave} disabled={disabled} aria-busy={saving}>
        {saving ? savingLabel : saveLabel}
      </Button>
    </div>
  );
}
