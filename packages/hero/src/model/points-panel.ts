/**
 * Which of the Points panel's parts a host gets. Editing is optional: a host that supplies the
 * callbacks gets the panel it always had, and a host that supplies none gets the same figures
 * with no way to change them.
 *
 * `showResetAdvice` is the one reading that is not simply `editable`. The advice line names
 * Optimize build as the way to collect the gain it reports, so without that button it advertises
 * a control the reader cannot reach; with it, the line stays governed by `heroBattleAllowed`
 * alone, exactly as it was before editing became optional.
 *
 * `mountResetAdvice` is the difference between "nothing to say right now" and "nothing to say
 * ever". The line keeps its space while it is hidden, so the panel does not reflow when a reset
 * starts or stops being worth it — but a host with no Optimize build can never show it, and
 * reserving a blank line for it there is a gap under the heading that never fills.
 *
 * It is a function rather than a ternary inside the panel because this package renders no
 * component in a test — logic in JSX here is logic nothing can prove.
 */
export type PointsPanelReading = {
  showReset: boolean;
  showPointSteppers: boolean;
  showPreviewActions: boolean;
  showResetAdvice: boolean;
  mountResetAdvice: boolean;
};

export function pointsPanelReading(input: {
  editable: boolean;
  heroBattleAllowed: boolean;
}): PointsPanelReading {
  const { editable, heroBattleAllowed } = input;
  return {
    showReset: editable,
    showPointSteppers: editable,
    showPreviewActions: editable,
    showResetAdvice: editable && heroBattleAllowed,
    mountResetAdvice: editable,
  };
}
