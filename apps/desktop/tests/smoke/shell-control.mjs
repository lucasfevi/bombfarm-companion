/**
 * A top-bar control, wherever the bar has put it.
 *
 * The bar folds its secondary actions into an overflow button once the window is too narrow to
 * hold them, so a control is either in the bar or inside that menu depending on the width the
 * window happens to have. A CI runner clamps the window to a small virtual display and gets the
 * folded bar; a developer on a wide screen gets the flat one. Reaching the control the way a
 * reader would — look in the bar, open the menu if it is not there — is what makes a spec agree
 * with itself on both.
 *
 * Asking twice is safe. The trigger TOGGLES, so a second call that clicked it again would shut the
 * menu it was asked to look in — which is exactly what a test does when it checks a control is
 * there and then clicks it.
 */
const IN_OVERFLOW = {
  'open-mini': 'shell-overflow-open-mini',
  'shell-coffee': 'shell-overflow-coffee',
  'shell-referral': 'shell-overflow-referral',
};

export async function shellControl(page, testId) {
  const inBar = page.getByTestId(testId);
  if ((await inBar.count()) > 0) return inBar;

  const folded = IN_OVERFLOW[testId];
  if (!folded) throw new Error(`no overflow entry known for ${testId}`);

  const menu = page.getByTestId('shell-overflow-menu');
  if ((await menu.count()) === 0) {
    await page.getByTestId('shell-overflow').click();
    await menu.waitFor({ state: 'visible', timeout: 10_000 });
  }
  return page.getByTestId(folded);
}
