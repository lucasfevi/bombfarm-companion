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

// Whole-word: `hasText` with a string is a case-blind substring match, and the Skill Tree tab's
// path cards are buttons in a group too — "Energy" answered to 'EN'.
const LANGUAGE_TOGGLE_WORD = { pt: /^PT$/, en: /^EN$/ };
const LANGUAGE_IN_OVERFLOW = { pt: 'shell-overflow-language-pt', en: 'shell-overflow-language-en' };

/**
 * Switches the interface language through the bar, wherever the bar has put the switch: the
 * inline PT / EN toggle on a wide window, the radio items inside the overflow menu on a narrow
 * one. The tenth tab put the CI runner's default window under the width the actions fold at, so
 * a spec that clicked the inline toggle passed on a wide desk and timed out on the runner.
 */
export async function switchLanguage(page, language) {
  const inline = page.locator('[role="group"] button', { hasText: LANGUAGE_TOGGLE_WORD[language] });
  if ((await inline.count()) > 0) {
    await inline.click();
    return;
  }
  const menu = page.getByTestId('shell-overflow-menu');
  if ((await menu.count()) === 0) {
    await page.getByTestId('shell-overflow').click();
    await menu.waitFor({ state: 'visible', timeout: 10_000 });
  }
  await page.getByTestId(LANGUAGE_IN_OVERFLOW[language]).click();
  // A radio item does not close the menu it sits in, and an open menu makes the page beneath
  // inert — the next tab click would wait on it forever.
  await closeShellOverflow(page);
}

/**
 * Shuts the overflow menu if a lookup opened one, and does nothing on the flat bar.
 *
 * An open menu holds the pointer for the whole window — its popup lays an inert layer over
 * everything behind it — so a spec that only READ a folded control leaves the page underneath
 * unclickable. Clicking a menu item closes it, which is why the specs that click never needed
 * this; a spec that asserts and then goes back to the page does.
 */
export async function closeShellOverflow(page) {
  const menu = page.getByTestId('shell-overflow-menu');
  if ((await menu.count()) === 0) return;

  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached', timeout: 10_000 });
}
