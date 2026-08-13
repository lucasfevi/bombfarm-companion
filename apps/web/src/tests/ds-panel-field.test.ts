import { describe, expect, it } from 'vitest';
import * as pf from '@bombfarm/ui/panel-field.recipe';

/**
 * Parity guard: every bundle migrated from `chrome.ts` into
 * `panel-field.recipe.ts` must reproduce the legacy string exactly, and the
 * cva recipes must reproduce the legacy panel / setup-banner concatenations.
 *
 * `chrome.ts` was deleted at T15, so its exact class strings are inlined below
 * as the frozen source-of-truth snapshot captured from the pre-migration file.
 */

const fieldControlDesc =
  '[&_[data-num]]:w-full [&_[data-select]]:w-full [&_input:not([data-num-input])]:w-full [&_input:not([data-num-input])]:rounded-sm [&_input:not([data-num-input])]:border [&_input:not([data-num-input])]:border-line [&_input:not([data-num-input])]:bg-bg [&_input:not([data-num-input])]:px-2 [&_input:not([data-num-input])]:py-1.5 [&_input:not([data-num-input])]:text-[13px] [&_input:not([data-num-input])]:tabular-nums';
const inlineLabelDesc =
  '[&_label]:flex [&_label]:flex-col [&_label]:gap-[3px] [&_label]:text-[11px] [&_label]:tracking-[0.03em] [&_label]:text-muted [&_label]:uppercase';

const chrome = {
  colClass: 'flex min-w-0 flex-col gap-2.5',
  panelClass: 'border border-line bg-surface px-3.5 py-3 max-[720px]:overflow-x-auto',
  panelFocusClass:
    'border-[color-mix(in_oklch,var(--accent)_45%,var(--line))] shadow-[inset_3px_0_0_var(--accent)]',
  panelNeedClass: '',
  panelAlignedClass:
    'border-[color-mix(in_oklch,var(--up)_45%,var(--line))] shadow-[inset_3px_0_0_var(--up)]',
  // m2-storybook-ci (T7, SBC-12): was 'opacity-[0.78]' pre-migration — raised to
  // 0.85 because dimmed muted text measured 4.25:1 contrast, under WCAG AA's
  // 4.5:1 floor. See packages/ui/src/panel-field.recipe.ts for the computation.
  panelUnverifiedClass: 'opacity-[0.85]',
  panelHClass: 'mb-2.5 flex items-baseline justify-between gap-2.5',
  panelTitleClass: 'm-0 text-[13px] font-bold tracking-[0.04em] uppercase',
  mutedClass: 'text-xs text-muted',
  tipClass: 'mb-2 text-xs leading-[1.35] text-muted',
  warnTextClass: 'mb-2 text-xs text-warn',
  reqClass: 'ml-1 text-[10px] font-semibold tracking-[0.03em] text-warn uppercase',
  labelNeedClass: '',
  tdNeedInputClass: '',
  inlineFieldsClass: `grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2 ${inlineLabelDesc} ${fieldControlDesc}`,
  inlineFieldsDenseClass: `grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-2 ${inlineLabelDesc} ${fieldControlDesc}`,
  stackFieldsClass: `grid grid-cols-1 gap-0 ${fieldControlDesc} [&_label]:grid [&_label]:grid-cols-[1fr_auto] [&_label]:items-center [&_label]:gap-x-2 [&_label]:border-b [&_label]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_label]:py-1.5 [&_label]:text-[13px] [&_label]:text-ink [&_label:last-child]:border-b-0 [&_label>span]:col-start-1 [&_label>span]:row-start-1 [&_label>span]:flex [&_label>span]:min-w-0 [&_label>span]:flex-col [&_label>span]:gap-0.5 [&_label>span_[data-field-hint]]:text-[11px] [&_label>span_[data-field-hint]]:font-normal [&_label>span_[data-field-hint]]:normal-case [&_label>span_[data-field-hint]]:text-muted [&_label_[data-num]]:col-start-2 [&_label_[data-num]]:row-start-1 [&_label_[data-num]]:w-[96px] [&_label_[data-account-tree-value]]:col-start-2 [&_label_[data-account-tree-value]]:row-start-1 [&_label_[data-account-tree-value]]:justify-self-end [&_label_[data-select]]:col-start-2 [&_label_[data-select]]:row-start-1 [&_label_[data-select]]:w-[96px]`,
  fieldLabelClass: 'flex flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase',
  fieldControlClass: 'w-full rounded-sm border border-line bg-bg px-2 py-1.5 text-[13px] tabular-nums',
  stackLabelClass: 'grid grid-cols-[1fr_auto] items-center gap-2 text-[13px] text-ink',
  treeKeysClass:
    'mt-2.5 flex flex-col gap-1.5 [&_.check]:text-[13px] [&_.check]:tracking-normal [&_.check]:text-ink [&_.check]:normal-case',
  splitClass: 'grid grid-cols-1 gap-2.5 min-[720px]:grid-cols-2',
  heroAbilHClass:
    'mt-3.5 mb-1.5 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3',
  heroAbilTitleClass: 'm-0 text-xs font-bold tracking-[0.04em] text-muted uppercase',
  rankHeadClass:
    'mt-3 mb-2 flex flex-wrap items-center justify-between gap-2 [&_h3]:m-0 [&_h3]:text-xs [&_h3]:font-[650] [&_h3]:tracking-[0.04em] [&_h3]:uppercase [&_[data-select]]:min-h-7 [&_[data-select]]:w-auto [&_[data-select]]:min-w-[7.5rem] [&_[data-select]]:text-xs',
  barRowClass:
    'mb-[5px] grid grid-cols-[88px_1fr_52px] items-center gap-2 text-xs [&_span]:truncate [&_span]:text-muted [&_b]:text-right [&_b]:font-mono [&_b]:text-[11px]',
  factsClass:
    'mt-2 m-0 grid gap-1.5 text-xs [&_>div]:grid [&_>div]:grid-cols-[max-content_minmax(0,1fr)] [&_>div]:items-baseline [&_>div]:gap-x-3 [&_>div]:gap-y-0.5 [&_dt]:m-0 [&_dt]:whitespace-nowrap [&_dt]:text-muted [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:font-mono [&_dd]:text-[11.5px]',
  workspaceShellClass: 'relative',
  workspaceClass:
    'mx-auto grid max-w-app grid-cols-1 gap-3 px-4 pt-3',
  workspaceDimmedClass: 'pointer-events-none opacity-35 saturate-[0.4] select-none',
  adviceStickyClass:
    'min-[1100px]:sticky min-[1100px]:top-[calc(var(--top)+10px)] min-[1100px]:max-h-[calc(100vh-var(--top)-20px)] min-[1100px]:overflow-auto',
  setupBannerClass:
    'mx-auto mt-2.5 max-w-app rounded-sm border border-[color-mix(in_oklch,var(--warn)_45%,var(--line))] bg-[color-mix(in_oklch,var(--warn)_12%,var(--surface))] px-3.5 py-2.5 [&_h2]:mb-1.5 [&_h2]:m-0 [&_h2]:text-[13px] [&_h2]:font-bold [&_ul]:m-0 [&_ul]:list-disc [&_ul]:py-0 [&_ul]:pl-[18px] [&_ul]:text-xs [&_ul]:leading-[1.45] [&_ul]:text-ink [&_ul]:marker:text-warn [&_p]:m-0 [&_p]:text-xs [&_p]:leading-[1.45] [&_p]:text-ink',
  setupBannerOkClass:
    'mx-auto mt-2.5 max-w-app rounded-sm border border-[color-mix(in_oklch,var(--up)_40%,var(--line))] bg-[color-mix(in_oklch,var(--up)_10%,var(--surface))] px-3.5 py-2.5 [&_h2]:m-0 [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-up',
  setupBannerTitleClass: 'mb-1.5 m-0 text-[13px] font-bold',
  setupBannerOkTitleClass: 'm-0 text-[13px] font-bold text-up',
  setupBannerListClass:
    'm-0 list-disc py-0 pl-[18px] text-xs leading-[1.45] text-ink marker:text-warn',
  setupBannerPClass: 'm-0 text-xs leading-[1.45] text-ink',
  importResetWarningClass:
    'mt-2.5 mb-0 max-w-none rounded-sm border border-[color-mix(in_oklch,var(--warn)_45%,var(--line))] bg-[color-mix(in_oklch,var(--warn)_12%,var(--surface))] px-3.5 py-2.5 [&_h2]:mb-1.5 [&_h2]:m-0 [&_h2]:text-[13px] [&_h2]:font-bold [&_ul]:m-0 [&_ul]:list-disc [&_ul]:py-0 [&_ul]:pl-[18px] [&_ul]:text-xs [&_ul]:leading-[1.45] [&_ul]:text-ink [&_ul]:marker:text-warn [&_p]:m-0 [&_p]:text-xs [&_p]:leading-[1.45] [&_p]:text-ink',
  explainClass: 'mx-auto mt-4 w-[min(var(--maxw),calc(100%-32px))]',
  explainBodyClass: 'mt-2 w-full p-4',
  explainSourceClass: 'mb-2 text-[13px] leading-normal font-semibold [&_a]:text-accent',
  explainSecClass:
    'mt-4 [&_h3]:mb-1.5 [&_h3]:m-0 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:tracking-[0.04em] [&_h3]:text-accent [&_h3]:uppercase [&_p]:mb-1.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.55]',
  explainFormulaClass:
    'my-2 block w-full overflow-x-auto border border-line bg-bg px-2.5 py-2 font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap',
  dialogHeadClass: 'mb-2 flex items-start justify-between gap-3',
  dialogTitleClass: 'm-0 text-[15px] font-bold',
  dialogDescClass: 'm-0 mb-3 text-xs leading-normal text-muted',
  dialogActionsClass:
    'mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3',
  importAccountClass:
    'mb-3.5 shrink-0 border border-[color-mix(in_oklch,var(--accent)_28%,var(--line))] bg-[linear-gradient(135deg,color-mix(in_oklch,var(--accent)_9%,var(--surface)),color-mix(in_oklch,var(--bg)_40%,var(--surface)))] px-3.5 py-3 text-xs',
  importAccountLeadClass: 'm-0 mb-2.5 text-[11px] tracking-[0.01em] text-muted',
  importAccountGridClass:
    'grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-x-5 gap-y-3.5 max-[560px]:grid-cols-1',
  importAccountBlockClass:
    '[&_h3]:mb-2 [&_h3]:m-0 [&_h3]:text-[11px] [&_h3]:font-bold [&_h3]:tracking-[0.06em] [&_h3]:text-accent [&_h3]:uppercase',
  statListClass:
    'm-0 grid gap-[5px] [&_>div]:grid [&_>div]:grid-cols-[minmax(0,1fr)_auto] [&_>div]:items-baseline [&_>div]:gap-x-3 [&_>div]:gap-y-2 [&_>div]:border-b [&_>div]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_>div]:py-1 [&_>div:last-child]:border-b-0 [&_>div:last-child]:pb-0 [&_dt]:m-0 [&_dt]:text-[11px] [&_dt]:leading-[1.35] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:text-right [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-semibold [&_dd]:text-ink [&_dd]:tabular-nums [&_dd]:whitespace-nowrap',
  phasesStatListClass:
    'm-0 grid gap-0 [&_>div]:grid [&_>div]:grid-cols-[minmax(0,1fr)_auto] [&_>div]:items-start [&_>div]:gap-x-3 [&_>div]:border-b [&_>div]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_>div]:py-1.5 [&_>div:last-child]:border-b-0 [&_>div:last-child]:pb-0 [&_dt]:m-0 [&_dt]:pt-0.5 [&_dt]:text-[11px] [&_dt]:leading-[1.35] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:min-w-[7rem] [&_dd]:text-right [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-semibold [&_dd]:text-ink [&_dd]:tabular-nums [&_dd]:leading-snug [&_dd]:whitespace-nowrap',
  statListCompareClass:
    'm-0 grid gap-[5px] [&_>div]:grid [&_>div]:grid-cols-[minmax(0,1fr)_auto] [&_>div]:items-baseline [&_>div]:gap-x-3 [&_>div]:gap-y-2 [&_>div]:border-b [&_>div]:border-[color-mix(in_oklch,var(--line)_70%,transparent)] [&_>div]:py-1 [&_>div:last-child]:border-b-0 [&_>div:last-child]:pb-0 [&_dt]:m-0 [&_dt]:text-[11px] [&_dt]:leading-[1.35] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:flex [&_dd]:flex-row [&_dd]:items-baseline [&_dd]:justify-end [&_dd]:gap-1.5 [&_dd]:whitespace-nowrap [&_dd_strong]:text-xs [&_dd_strong]:font-semibold [&_dd_strong]:text-accent [&_dd_em]:font-mono [&_dd_em]:text-[11px] [&_dd_em]:font-medium [&_dd_em]:not-italic',
  importWarningsClass: 'mt-2.5 shrink-0 text-xs text-muted [&_summary]:cursor-pointer',
  importActionsClass:
    'mt-0 flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-line bg-surface py-3 pb-4',
  importActionsEndClass: 'ml-auto flex gap-2 max-[560px]:w-full max-[560px]:justify-end',
} as const;

// Fixed bundles re-homed verbatim (name → legacy chrome export).
const passthrough: Array<keyof typeof pf & keyof typeof chrome> = [
  'colClass',
  'panelClass',
  'panelHClass',
  'panelTitleClass',
  'mutedClass',
  'tipClass',
  'warnTextClass',
  'reqClass',
  'labelNeedClass',
  'tdNeedInputClass',
  'inlineFieldsClass',
  'inlineFieldsDenseClass',
  'stackFieldsClass',
  'fieldLabelClass',
  'fieldControlClass',
  'stackLabelClass',
  'treeKeysClass',
  'splitClass',
  'heroAbilHClass',
  'heroAbilTitleClass',
  'rankHeadClass',
  'barRowClass',
  'factsClass',
  'workspaceShellClass',
  'workspaceClass',
  'workspaceDimmedClass',
  'adviceStickyClass',
  'setupBannerTitleClass',
  'setupBannerOkTitleClass',
  'setupBannerListClass',
  'setupBannerPClass',
  'importResetWarningClass',
  'explainClass',
  'explainBodyClass',
  'explainSourceClass',
  'explainSecClass',
  'explainFormulaClass',
  'dialogHeadClass',
  'dialogTitleClass',
  'dialogDescClass',
  'dialogActionsClass',
  'importAccountClass',
  'importAccountLeadClass',
  'importAccountGridClass',
  'importAccountBlockClass',
  'statListClass',
  'statListCompareClass',
  'importWarningsClass',
  'importActionsClass',
  'importActionsEndClass',
];

describe('account house stack recipe (AHK-12)', () => {
  it('exports house stack classes', () => {
    expect(pf.accountHouseStackClass).toContain('[&_label_[data-select]]:w-[14rem]');
    expect(pf.accountHouseStackClass).toContain('[&_label_[data-num]]:w-[14rem]');
    expect(pf.accountHouseStackClass).toContain(pf.accountStackAlignClass);
    expect(pf.stackFieldsClass).toContain('[&_label_[data-select]]:w-[96px]');
    expect(pf.stackFieldsClass).toContain('[&_label_[data-account-tree-value]]:justify-self-end');
    expect(pf.accountTreeValueClass).toContain('tabular-nums');
  });

  // MP5 F3 (MSC-17/MSC-18) — the keystone control/status recipe classes and stack variant
  // are gone, not weakened: absence asserted by name, and the trailing template-literal
  // segment that used to enable them no longer appears anywhere in stackFieldsClass.
  it('no longer exports the keystone control/status recipe classes', () => {
    expect('accountKeystoneControlClass' in pf).toBe(false);
    expect('accountKeystoneStatusClass' in pf).toBe(false);
    expect(pf.stackFieldsClass).not.toContain('data-keystone-control');
  });

  it('reserves equal label slot height for single- and two-line Account rows', () => {
    expect(pf.accountStackAlignClass).toContain('[&_label]:min-h-[3.25rem]');
    expect(pf.accountStackAlignClass).toContain('[&_label>span]:min-h-[2.375rem]');
    expect(pf.accountStackAlignClass).toContain('[&_label>span]:justify-center');
  });
});

describe('math check stack alignment', () => {
  it('shares 14rem control slot for Num, Select, and mit readout', () => {
    expect(pf.mathCheckPropStackClass).toContain('[&_label_[data-num]]:w-[14rem]');
    expect(pf.mathCheckPropStackClass).toContain('[&_label_[data-select]]:w-[14rem]');
    expect(pf.mathCheckPropStackClass).toContain('[data-math-check-value]');
    expect(pf.mathCheckPropStackClass).toContain('w-[14rem]');
    expect(pf.mathCheckPropStackClass).toContain(pf.accountStackAlignClass);
  });

  it('advice dual panes use uniform gap-2.5 and sit side-by-side above 720px', () => {
    expect(pf.adviceSplitClass).toContain('grid-cols-1');
    expect(pf.adviceSplitClass).toContain('min-[720px]:grid-cols-2');
    expect(pf.adviceSplitClass).toContain('gap-2.5');
    expect(pf.adviceSplitClass).not.toContain('gap-x-8');
    expect(pf.adviceFactsPaneClass).toContain('max-[719px]:border-t');
    expect(pf.rankModeSelectClass).toContain('!w-auto');
  });

  it('math check readout has KPI strip + stacked ledger rows', () => {
    expect(pf.mathCheckKpiStripClass).toContain('grid-cols-2');
    expect(pf.mathCheckFactsClass).toContain('[&_dt]:uppercase');
    expect(pf.mathCheckFactsClass).toContain('grid-cols-1');
  });

  it('facts dt column uses max-content + nowrap so long labels stay one line', () => {
    expect(pf.factsClass).toContain('grid-cols-[max-content_minmax(0,1fr)]');
    expect(pf.factsClass).toContain('[&_dt]:whitespace-nowrap');
    expect(pf.factsClass).not.toContain('grid-cols-[120px_1fr]');
  });
});

describe('panel-field recipe bundle parity', () => {
  for (const key of passthrough) {
    it(`preserves ${key}`, () => {
      expect(pf[key]).toBe(chrome[key]);
    });
  }

  it('warnClass is margin-free twin of mutedClass (inline header counters)', () => {
    expect(pf.warnClass).toBe('text-xs text-warn');
    expect(pf.warnClass).not.toMatch(/\bmb-/);
    expect(pf.warnTextClass).toMatch(/\bmb-2\b/);
  });
});

describe('panelRecipe parity with legacy panel concatenations', () => {
  it('default → panelClass', () => {
    expect(pf.panelRecipe()).toBe(chrome.panelClass);
  });

  it('need outline classes are retired (FieldRequired owns required chrome)', () => {
    expect(pf.labelNeedClass).toBe('');
    expect(pf.tdNeedInputClass).toBe('');
    expect(chrome.panelNeedClass).toBe('');
  });

  it('need → panelClass only (need outline removed)', () => {
    expect(pf.panelRecipe({ need: true })).toBe(chrome.panelClass);
  });

  it('focus + unverified → panelClass + panelFocusClass + panelUnverifiedClass (advice points panel)', () => {
    expect(pf.panelRecipe({ focus: true, unverified: true })).toBe(
      `${chrome.panelClass} ${chrome.panelFocusClass} ${chrome.panelUnverifiedClass}`,
    );
  });

  it('focus only → panelClass + panelFocusClass', () => {
    expect(pf.panelRecipe({ focus: true })).toBe(`${chrome.panelClass} ${chrome.panelFocusClass}`);
  });

  it('aligned → panelClass + panelAlignedClass (Math check trust)', () => {
    expect(pf.panelRecipe({ aligned: true })).toBe(
      `${chrome.panelClass} ${chrome.panelAlignedClass}`,
    );
  });

  it('need + aligned → panelClass + panelAlignedClass (need is a no-op)', () => {
    expect(pf.panelRecipe({ need: true, aligned: true })).toBe(
      `${chrome.panelClass} ${chrome.panelAlignedClass}`,
    );
  });
});

describe('setupBannerRecipe parity', () => {
  it('warn tone → setupBannerClass', () => {
    expect(pf.setupBannerRecipe({ tone: 'warn' })).toBe(chrome.setupBannerClass);
  });

  it('defaults to warn tone', () => {
    expect(pf.setupBannerRecipe()).toBe(chrome.setupBannerClass);
  });

  it('ok tone → setupBannerOkClass', () => {
    expect(pf.setupBannerRecipe({ tone: 'ok' })).toBe(chrome.setupBannerOkClass);
  });
});
