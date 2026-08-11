import type { TestRunnerConfig } from '@storybook/test-runner';
import { checkA11y, injectAxe } from 'axe-playwright';

/**
 * SBC-14/15/16 — smoke-renders every story against a built, statically served
 * Storybook (see `test-storybook` in package.json, which serves `storybook-static/`
 * before pointing the runner at it) and asserts zero a11y violations via
 * `@storybook/addon-a11y`'s underlying `axe-playwright` engine.
 *
 * No global rule allowlist (SBC-13) — if a rule ever needs to be disabled for a
 * single story, that goes in the story file itself with a written reason, not here.
 */
const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    // Toast / Toast System fade in via a 160ms CSS entrance animation
    // (--animate-toast-in). Checking a11y mid-fade reads a transiently
    // blended, lower-contrast color even though the settled state passes —
    // wait for any running animations to finish (capped, in case a story
    // ever adds a looping one) so the check reflects the real end state.
    await page.evaluate(() =>
      Promise.race([
        Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]),
    );

    // Docs (autodocs) entries render inside #storybook-docs, not #storybook-root —
    // check whichever canvas root the current entry actually mounted.
    const hasStoryRoot = (await page.$('#storybook-root')) !== null;
    const target = hasStoryRoot ? '#storybook-root' : '#storybook-docs';
    await checkA11y(page, target, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  },
};

export default config;
