import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SegmentedToggle } from './segmented-toggle';
import { SegmentedToggleForm } from './segmented-toggle-form';
import { segmentedToggleItemRecipe, segmentedToggleRootClass } from './segmented-toggle.recipe';

const OPTIONS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
];

const render = (props: Partial<Parameters<typeof SegmentedToggleForm>[0]> = {}) =>
  renderToStaticMarkup(<SegmentedToggleForm options={OPTIONS} value="week" name="range" ariaLabel="Range" {...props} />);

describe('SegmentedToggleForm', () => {
  it('renders a get form around a labelled group of submit buttons', () => {
    const active = segmentedToggleItemRecipe({ active: true });
    const idle = segmentedToggleItemRecipe({ active: false });
    expect(render()).toBe(
      '<form class="inline-flex" method="get">' +
        `<div class="${segmentedToggleRootClass}" role="group" aria-label="Range">` +
        `<button type="submit" value="day" aria-pressed="false" class="${idle}" name="range">Day</button>` +
        `<button type="submit" value="week" aria-pressed="true" class="${active}" name="range">Week</button>` +
        '</div></form>',
    );
  });

  it('looks the same as the script-driven toggle', () => {
    const scripted = renderToStaticMarkup(
      <SegmentedToggle options={OPTIONS} value="week" onChange={() => {}} ariaLabel="Range" />,
    );
    const classes = (html: string) =>
      [...html.matchAll(/class="([^"]*)"/g)].map((match) => match[1]).filter((value) => value !== 'inline-flex');
    expect(classes(render())).toEqual(classes(scripted));
  });

  it('takes the action, method and hidden fields from the consumer', () => {
    const html = render({ action: '/records', method: 'post', hidden: { sort: 'name' } });
    expect(html).toMatch(
      /^<form class="inline-flex" action="\/records" method="post"><input type="hidden" name="sort" value="name"\/>/,
    );
  });

  it('merges a class name onto the group', () => {
    expect(render({ className: 'w-full' })).toContain(`class="${segmentedToggleRootClass} w-full" role="group"`);
  });
});
