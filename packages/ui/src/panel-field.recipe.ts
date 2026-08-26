import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Panel / field / dialog / setup-banner / import chrome — migrated from the
 * former `chrome.ts`. Fixed layout bundles stay as documented recipe constants
 * (design DS-05); cva is applied only where genuine variants exist (panel
 * focus/need/unverified, setup-banner warn/ok). All strings preserve parity.
 */

export const colClass = 'flex min-w-0 flex-col gap-2.5';

const panelBaseClass = 'border border-line bg-surface px-3.5 py-3 max-[720px]:overflow-x-auto';
const panelFocusClass =
  'border-[color-mix(in_oklch,var(--accent)_45%,var(--line))] shadow-[inset_3px_0_0_var(--accent)]';
/** @deprecated Required state uses `FieldRequired` only — never a panel outline. */
const panelNeedClass = '';
export const panelAlignedClass =
  'border-[color-mix(in_oklch,var(--up)_45%,var(--line))] shadow-[inset_3px_0_0_var(--up)]';
/**
 * m2-storybook-ci (T7, SBC-12): was `opacity-[0.78]`. `mutedClass` text composited
 * at 0.78 alpha over the panel's `bg-surface` (itself alpha-blended over the page's
 * `bg-bg`) measured 4.25:1 (OKLCH -> linear-sRGB -> WCAG relative luminance), just
 * under the 4.5:1 AA floor. 0.85 measures 4.81:1.
 */
const panelUnverifiedClass = 'opacity-[0.85]';

/**
 * Panel chrome variants. Booleans are appended in focus → need → aligned →
 * unverified order to reproduce the legacy concatenation exactly.
 * `need` is a no-op (required = `FieldRequired` text only).
 */
export const panelRecipe = cva(panelBaseClass, {
  variants: {
    focus: { true: panelFocusClass, false: '' },
    need: { true: panelNeedClass, false: '' },
    aligned: { true: panelAlignedClass, false: '' },
    unverified: { true: panelUnverifiedClass, false: '' },
  },
  defaultVariants: { focus: false, need: false, aligned: false, unverified: false },
});

export type PanelVariant = VariantProps<typeof panelRecipe>;

/** Standalone panel base class (used where a panel wrapper is composed inline, e.g. explain body). */
export const panelClass = panelBaseClass;

export const panelHClass = 'mb-2.5 flex items-baseline justify-between gap-2.5';
export const panelTitleClass = 'm-0 text-[13px] font-bold tracking-[0.04em] uppercase';

export const mutedClass = 'text-xs text-muted';
/** Inline warn (header counters) — margin-free twin of `mutedClass`. */
export const warnClass = 'text-xs text-warn';
export const tipClass = 'mb-2 text-xs leading-[1.35] text-muted';
/** Block warn tip (keeps `mb-2` like `tipClass`). */
export const warnTextClass = 'mb-2 text-xs text-warn';
export const reqClass = 'ml-1 text-[10px] font-semibold tracking-[0.03em] text-warn uppercase';

/** @deprecated Required state uses `FieldRequired` only — never a field outline/border. */
export const labelNeedClass = '';

/** @deprecated Required state uses `FieldRequired` only — never an input warn border. */
export const tdNeedInputClass = '';

const fieldControlDesc =
  '[&_[data-num]]:w-full [&_[data-select]]:w-full [&_input:not([data-num-input])]:w-full [&_input:not([data-num-input])]:rounded-sm [&_input:not([data-num-input])]:border [&_input:not([data-num-input])]:border-line [&_input:not([data-num-input])]:bg-bg [&_input:not([data-num-input])]:px-2 [&_input:not([data-num-input])]:py-1.5 [&_input:not([data-num-input])]:text-[13px] [&_input:not([data-num-input])]:tabular-nums';

const inlineLabelDesc =
  '[&_label]:flex [&_label]:flex-col [&_label]:gap-[3px] [&_label]:text-[11px] [&_label]:tracking-[0.03em] [&_label]:text-muted [&_label]:uppercase';

export const inlineFieldsClass = `grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2 ${inlineLabelDesc} ${fieldControlDesc}`;
export const inlineFieldsDenseClass = `grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-2 ${inlineLabelDesc} ${fieldControlDesc}`;

export const stackFieldsClass = `grid grid-cols-1 gap-0 ${fieldControlDesc} [&_label]:grid [&_label]:grid-cols-[1fr_auto] [&_label]:items-center [&_label]:gap-x-2 [&_label]:border-b [&_label]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_label]:py-1.5 [&_label]:text-[13px] [&_label]:text-ink [&_label:last-child]:border-b-0 [&_label>span]:col-start-1 [&_label>span]:row-start-1 [&_label>span]:flex [&_label>span]:min-w-0 [&_label>span]:flex-col [&_label>span]:gap-0.5 [&_label>span_[data-field-hint]]:text-[11px] [&_label>span_[data-field-hint]]:font-normal [&_label>span_[data-field-hint]]:normal-case [&_label>span_[data-field-hint]]:text-muted [&_label_[data-num]]:col-start-2 [&_label_[data-num]]:row-start-1 [&_label_[data-num]]:w-[96px] [&_label_[data-account-tree-value]]:col-start-2 [&_label_[data-account-tree-value]]:row-start-1 [&_label_[data-account-tree-value]]:justify-self-end [&_label_[data-select]]:col-start-2 [&_label_[data-select]]:row-start-1 [&_label_[data-select]]:w-[96px]`;

/**
 * Equal Account stack row height for single- and two-line labels (title +
 * `data-field-hint`). Reserves the hint slot so Skill Tree / Team Buff /
 * House rows share one baseline; controls stay vertically centered.
 */
export const accountStackAlignClass =
  '[&_label]:min-h-[3.25rem] [&_label>span]:min-h-[2.375rem] [&_label>span]:justify-center';

/**
 * House subsection stack — same row rhythm as Skill Tree / Team Buffs, plus a
 * wider control slot so full house labels (e.g. "House IV (Legendary)") fit.
 */
export const accountHouseStackClass =
  `${accountStackAlignClass} [&_label_[data-num]]:w-[14rem] [&_label_[data-select]]:w-[14rem]`;

/**
 * Math check stacks — same row rhythm as Account stacks, plus a shared 14rem
 * control slot for Num, Select, and read-only mit value (content-fit).
 */
export const mathCheckPropStackClass =
  `${accountStackAlignClass} [&_label_[data-num]]:w-[14rem] [&_label_[data-select]]:w-[14rem] [&_label_[data-math-check-value]]:col-start-2 [&_label_[data-math-check-value]]:row-start-1 [&_label_[data-math-check-value]]:flex [&_label_[data-math-check-value]]:w-[14rem] [&_label_[data-math-check-value]]:items-center [&_label_[data-math-check-value]]:justify-end [&_label_[data-math-check-value]]:tabular-nums`;

/** Plain Skill Tree numeric readout (import-sourced — not an editable control). */
export const accountTreeValueClass = 'text-[13px] tabular-nums text-ink';

export const fieldLabelClass =
  'flex flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';
export const fieldControlClass =
  'w-full rounded-sm border border-line bg-bg px-2 py-1.5 text-[13px] tabular-nums';
export const stackLabelClass = 'grid grid-cols-[1fr_auto] items-center gap-2 text-[13px] text-ink';

export const treeKeysClass =
  'mt-2.5 flex flex-col gap-1.5 [&_.check]:text-[13px] [&_.check]:tracking-normal [&_.check]:text-ink [&_.check]:normal-case';
export const splitClass = 'grid grid-cols-1 gap-2.5 min-[720px]:grid-cols-2';

/** Account panel Skill Tree / Team Buffs — wider column gap than generic `splitClass`. */
export const accountSplitClass = 'grid grid-cols-1 gap-x-8 gap-y-3 min-[720px]:grid-cols-2';

/**
 * Points / Check dual panes — stack below 720px, side-by-side above (same break as
 * Account / `splitClass`). Uniform `gap-2.5` matches `colClass` so horizontal and
 * vertical panel gaps read as one rhythm.
 */
export const adviceSplitClass =
  'grid grid-cols-1 gap-2.5 min-[720px]:grid-cols-2 min-[720px]:items-stretch';

/** Compact rank-mode Select in the Next point panel header (content-sized, right-aligned). */
export const rankModeSelectClass = '!w-auto max-w-[7rem] shrink-0';

/** Shared top rule + padding for the Account two-column body (one border, not per subsection). */
export const accountBodyClass = 'mt-1 border-t border-line pt-3';

/** Subsection header row inside Account (no per-column border-t / extra top padding). */
export const accountSubHClass =
  'mb-1.5 flex min-h-8 flex-wrap items-center justify-between gap-2';

export const heroAbilHClass =
  'mt-3.5 mb-1.5 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3';
export const heroAbilTitleClass = 'm-0 text-xs font-bold tracking-[0.04em] text-muted uppercase';

export const rankHeadClass =
  'mt-3 mb-2 flex flex-wrap items-center justify-between gap-2 [&_h3]:m-0 [&_h3]:text-xs [&_h3]:font-[650] [&_h3]:tracking-[0.04em] [&_h3]:uppercase [&_[data-select]]:min-h-7 [&_[data-select]]:w-auto [&_[data-select]]:min-w-[7.5rem] [&_[data-select]]:text-xs';
export const barRowClass =
  'mb-[5px] grid grid-cols-[88px_1fr_52px] items-center gap-2 text-xs [&_span]:truncate [&_span]:text-muted [&_b]:text-right [&_b]:font-mono [&_b]:text-[11px]';

export const factsClass =
  'mt-2 m-0 grid gap-1.5 text-xs [&_>div]:grid [&_>div]:grid-cols-[max-content_minmax(0,1fr)] [&_>div]:items-baseline [&_>div]:gap-x-3 [&_>div]:gap-y-0.5 [&_dt]:m-0 [&_dt]:whitespace-nowrap [&_dt]:text-muted [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:font-mono [&_dd]:text-[11.5px]';

/**
 * Math check readout — KPI strip + stacked ledger rows (label over value).
 * Keeps the right pane scannable beside the form without nesting cards-in-cards.
 */
export const mathCheckKpiStripClass =
  'mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line';

export const mathCheckKpiCellClass =
  'flex min-h-[4.5rem] flex-col justify-center gap-1 bg-surface px-3 py-2.5 leading-none';

export const mathCheckKpiLabelClass =
  'text-[10px] font-bold tracking-[0.08em] text-muted uppercase';

export const mathCheckKpiValueClass =
  'font-mono text-xl font-semibold tabular-nums text-accent max-[720px]:text-lg';

export const mathCheckFactsClass =
  'm-0 grid gap-0 text-xs [&_>div]:grid [&_>div]:grid-cols-1 [&_>div]:gap-0.5 [&_>div]:border-b [&_>div]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_>div]:py-2 [&_>div:last-child]:border-b-0 [&_dt]:m-0 [&_dt]:text-[10px] [&_dt]:font-bold [&_dt]:tracking-[0.06em] [&_dt]:text-muted [&_dt]:uppercase [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:font-mono [&_dd]:text-[13px] [&_dd]:font-semibold [&_dd]:tabular-nums [&_dd]:text-ink [&_dd]:leading-snug';

/** Math check facts column — stack separator only below 720px. */
export const adviceFactsPaneClass =
  'min-w-0 max-[719px]:border-t max-[719px]:border-line max-[719px]:pt-3';

export const workspaceShellClass = 'relative';
export const workspaceClass =
  'mx-auto grid max-w-app grid-cols-1 gap-3 px-4 pt-3';
/** Full-width planner tab stage (replaces the former two-column panel grid). */
export const plannerStageClass = 'w-full min-w-0';

/**
 * Phases page board — equal-width cells per row via named areas:
 * · ≥1100: map | economy | jaula · drops | props · hero | squad
 * · ≥720:  map | economy · jaula | drops · props · hero | squad
 * · else:  stacked
 */
export const phasesBoardClass = [
  'grid gap-2.5',
  'grid-cols-1',
  '[grid-template-areas:"map"_"economy"_"jaula"_"drops"_"props"_"roster"]',
  'min-[720px]:grid-cols-[repeat(2,minmax(14rem,1fr))]',
  'min-[720px]:[grid-template-areas:"map_economy"_"jaula_drops"_"props_props"_"roster_roster"]',
  'min-[1100px]:grid-cols-[repeat(3,minmax(14rem,1fr))]',
  'min-[1100px]:[grid-template-areas:"map_economy_jaula"_"drops_props_props"_"roster_roster_roster"]',
].join(' ');

export const phasesBoardMapClass = '[grid-area:map] min-w-0';
export const phasesBoardEconomyClass = '[grid-area:economy] min-w-0';
export const phasesBoardJaulaClass = '[grid-area:jaula] min-w-0';
export const phasesBoardDropsClass = '[grid-area:drops] min-w-0';
export const phasesBoardPropsClass = '[grid-area:props] min-w-0';
/** Side-by-side Your hero | Top 9 on ≥720px; stack on narrow. */
export const phasesBoardRosterClass =
  '[grid-area:roster] grid min-w-0 grid-cols-1 gap-2.5 min-[720px]:grid-cols-2';
/** When roster has a single empty-state panel, span both columns. */
export const phasesBoardRosterSpanClass = 'min-w-0 min-[720px]:col-span-2';

export const workspaceDimmedClass = 'pointer-events-none opacity-35 saturate-[0.4] select-none';
export const adviceStickyClass =
  'min-[1100px]:sticky min-[1100px]:top-[calc(var(--top)+10px)] min-[1100px]:max-h-[calc(100vh-var(--top)-20px)] min-[1100px]:overflow-auto';

const setupBannerWarnClass =
  'mx-auto mt-2.5 max-w-app rounded-sm border border-[color-mix(in_oklch,var(--warn)_45%,var(--line))] bg-[color-mix(in_oklch,var(--warn)_12%,var(--surface))] px-3.5 py-2.5 [&_h2]:mb-1.5 [&_h2]:m-0 [&_h2]:text-[13px] [&_h2]:font-bold [&_ul]:m-0 [&_ul]:list-disc [&_ul]:py-0 [&_ul]:pl-[18px] [&_ul]:text-xs [&_ul]:leading-[1.45] [&_ul]:text-ink [&_ul]:marker:text-warn [&_p]:m-0 [&_p]:text-xs [&_p]:leading-[1.45] [&_p]:text-ink';
const setupBannerOkVariantClass =
  'mx-auto mt-2.5 max-w-app rounded-sm border border-[color-mix(in_oklch,var(--up)_40%,var(--line))] bg-[color-mix(in_oklch,var(--up)_10%,var(--surface))] px-3.5 py-2.5 [&_h2]:m-0 [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-up';

/** In-tab status banner — full width of the stage, no page-level max-width centering. */
export const setupBannerEmbeddedClass = 'mx-0 mt-0 mb-2.5 max-w-none w-full';

/** Setup banner chrome — warn (issues) vs ok (ready) tone. */
export const setupBannerRecipe = cva('', {
  variants: {
    tone: { warn: setupBannerWarnClass, ok: setupBannerOkVariantClass },
  },
  defaultVariants: { tone: 'warn' },
});

export type SetupBannerVariant = VariantProps<typeof setupBannerRecipe>;

export const setupBannerTitleClass = 'mb-1.5 m-0 text-[13px] font-bold';
export const setupBannerOkTitleClass = 'm-0 text-[13px] font-bold text-up';
export const setupBannerListClass =
  'm-0 list-disc py-0 pl-[18px] text-xs leading-[1.45] text-ink marker:text-warn';
export const setupBannerPClass = 'm-0 text-xs leading-[1.45] text-ink';
export const importResetWarningClass =
  'max-w-none rounded-sm border border-[color-mix(in_oklch,var(--warn)_45%,var(--line))] bg-[color-mix(in_oklch,var(--warn)_12%,var(--surface))] px-3.5 py-2.5 [&_h2]:mb-1.5 [&_h2]:m-0 [&_h2]:text-[13px] [&_h2]:font-bold [&_ul]:m-0 [&_ul]:list-disc [&_ul]:py-0 [&_ul]:pl-[18px] [&_ul]:text-xs [&_ul]:leading-[1.45] [&_ul]:text-ink [&_ul]:marker:text-warn [&_p]:m-0 [&_p]:text-xs [&_p]:leading-[1.45] [&_p]:text-ink';

export const explainClass = 'mx-auto mt-4 w-[min(var(--maxw),calc(100%-32px))]';
export const explainBodyClass = 'mt-2 w-full p-4';
export const explainSourceClass = 'mb-2 text-[13px] leading-normal font-semibold [&_a]:text-accent';
export const explainSecClass =
  'mt-4 [&_h3]:mb-1.5 [&_h3]:m-0 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:tracking-[0.04em] [&_h3]:text-accent [&_h3]:uppercase [&_p]:mb-1.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.55]';
export const explainFormulaClass =
  'my-2 block w-full overflow-x-auto border border-line bg-bg px-2.5 py-2 font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap';

export const dialogHeadClass = 'mb-2 flex items-start justify-between gap-3';
export const dialogTitleClass = 'm-0 text-[15px] font-bold';
export const dialogDescClass = 'm-0 mb-3 text-xs leading-normal text-muted';
export const dialogActionsClass =
  'mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3';
export const importAccountClass =
  'shrink-0 border border-[color-mix(in_oklch,var(--accent)_28%,var(--line))] bg-[linear-gradient(135deg,color-mix(in_oklch,var(--accent)_9%,var(--surface)),color-mix(in_oklch,var(--bg)_40%,var(--surface)))] px-3.5 py-3 text-xs';
export const importAccountLeadClass = 'm-0 mb-2.5 text-[11px] tracking-[0.01em] text-muted';
export const importAccountGridClass =
  'grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-x-5 gap-y-3.5 max-[560px]:grid-cols-1';
export const importAccountBlockClass =
  '[&_h3]:mb-2 [&_h3]:m-0 [&_h3]:text-[11px] [&_h3]:font-bold [&_h3]:tracking-[0.06em] [&_h3]:text-accent [&_h3]:uppercase';
export const statListClass =
  'm-0 grid gap-[5px] [&_>div]:grid [&_>div]:grid-cols-[minmax(0,1fr)_auto] [&_>div]:items-baseline [&_>div]:gap-x-3 [&_>div]:gap-y-2 [&_>div]:border-b [&_>div]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_>div]:py-1 [&_>div:last-child]:border-b-0 [&_>div:last-child]:pb-0 [&_dt]:m-0 [&_dt]:text-[11px] [&_dt]:leading-[1.35] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:text-right [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-semibold [&_dd]:text-ink [&_dd]:tabular-nums [&_dd]:whitespace-nowrap';

/** Phases intel panels — compact rows; value column sizes to content (map names stay one line). */
export const phasesStatListClass =
  'm-0 grid gap-0 [&_>div]:grid [&_>div]:grid-cols-[minmax(0,1fr)_auto] [&_>div]:items-start [&_>div]:gap-x-3 [&_>div]:border-b [&_>div]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_>div]:py-1.5 [&_>div:last-child]:border-b-0 [&_>div:last-child]:pb-0 [&_dt]:m-0 [&_dt]:pt-0.5 [&_dt]:text-[11px] [&_dt]:leading-[1.35] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:min-w-[7rem] [&_dd]:text-right [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-semibold [&_dd]:text-ink [&_dd]:tabular-nums [&_dd]:leading-snug [&_dd]:whitespace-nowrap';
/**
 * Account page stat rows — every row the same height, and vertically centred.
 *
 * The Account panels are pure readouts with no art and no wrapping labels, so a row's height
 * should not depend on whether its label happens to carry a tooltip underline or a second line.
 * Layered over {@link phasesStatListClass}, which stays `items-start` for the Phases panels whose
 * labels genuinely do wrap.
 */
export const accountStatListClass =
  '[&_>div]:min-h-8 [&_>div]:items-center [&_dt]:pt-0';

/** A `StatList` row that cannot apply right now — dimmed rather than hidden, so a value that
 *  cannot be read as live never sits at full contrast next to the rows that are. */
export const statListMutedRowClass = 'opacity-45';
export const statListCompareClass =
  'm-0 grid gap-[5px] [&_>div]:grid [&_>div]:grid-cols-[minmax(0,1fr)_auto] [&_>div]:items-baseline [&_>div]:gap-x-3 [&_>div]:gap-y-2 [&_>div]:border-b [&_>div]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_>div]:py-1 [&_>div:last-child]:border-b-0 [&_>div:last-child]:pb-0 [&_dt]:m-0 [&_dt]:text-[11px] [&_dt]:leading-[1.35] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:flex [&_dd]:flex-row [&_dd]:items-baseline [&_dd]:justify-end [&_dd]:gap-1.5 [&_dd]:whitespace-nowrap [&_dd_strong]:text-xs [&_dd_strong]:font-semibold [&_dd_strong]:text-accent [&_dd_em]:font-mono [&_dd_em]:text-[11px] [&_dd_em]:font-medium [&_dd_em]:not-italic';
export const importWarningsClass = 'shrink-0 text-xs text-muted [&_summary]:cursor-pointer';
export const importActionsClass =
  'mt-0 flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-line bg-surface py-3 pb-4';
export const importActionsEndClass =
  'ml-auto flex gap-2 max-[560px]:w-full max-[560px]:justify-end';
