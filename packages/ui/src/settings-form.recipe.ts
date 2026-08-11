/**
 * Settings primitives chrome — fixed layout bundles (DS-05). `SettingsRow`
 * composes `Fields`'s `stackFieldsClass` for its label/control grid rather
 * than reimplementing it (TST-26); these classes only dress the section
 * shell and the row's own label/hint text.
 */

export const settingsSectionClass = 'flex min-w-0 flex-col gap-3';
export const settingsSectionHeaderClass = 'flex flex-col gap-1';
export const settingsSectionTitleClass = 'text-[15px] font-bold tracking-[0.01em] text-ink';
export const settingsSectionDescriptionClass = 'text-sm text-muted';
export const settingsSectionBodyClass = 'flex min-w-0 flex-col gap-1';

export const settingsRowLabelSpanClass = 'flex min-w-0 flex-col gap-0.5';
export const settingsRowHelpClass = 'text-xs font-normal normal-case text-muted';

export const saveBarClass =
  'flex items-center justify-end gap-2 border-t border-line bg-surface px-3.5 py-2.5 motion-safe:transition-opacity motion-safe:duration-[120ms] data-[saving]:opacity-90';
