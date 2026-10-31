import { createElement } from 'app://bundle/_premium/_shared/react.js';

// The text a smoke test looks for in the Premium mount point.
export default function FixturePanel() {
  return createElement('div', { 'data-premium-fixture': '' }, 'bfc-premium-fixture-marker');
}
