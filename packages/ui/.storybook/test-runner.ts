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
