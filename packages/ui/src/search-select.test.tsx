// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import { SearchSelect, searchSelectMatches, type SearchSelectOption } from './search-select';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

const levels: SearchSelectOption[] = [
  { value: '110', label: 'Level 110 - Iron', triggerLabel: 'Iron' },
  { value: '120', label: 'Level 120 - Steel', triggerLabel: 'Steel' },
  { value: '130', label: 'Level 130 - Ámbar', triggerLabel: 'Ámbar' },
];

describe('searchSelectMatches', () => {
  it('finds a level row by its set name or by its level number', () => {
    expect(searchSelectMatches(levels[1]!, 'steel')).toBe(true);
    expect(searchSelectMatches(levels[1]!, '120')).toBe(true);
    expect(searchSelectMatches(levels[0]!, 'steel')).toBe(false);
  });

  it('ignores case and accents', () => {
    expect(searchSelectMatches(levels[2]!, 'AMBAR')).toBe(true);
  });
});

describe('SearchSelect trigger label', () => {
  const render = (value: string) =>
    dom.render(
      <SearchSelect
        options={levels}
        value={value}
        onValueChange={() => {}}
        aria-label="Item level: Level 120 - Steel"
        emptyLabel="none"
      />,
    );

  it('prints the option’s trigger label while the row keeps the full label', () => {
    render('120');
    const trigger = dom.container.querySelector<HTMLElement>('[data-select]');
    expect(trigger?.textContent).toBe('Steel');
    expect(trigger?.getAttribute('aria-label')).toBe('Item level: Level 120 - Steel');
  });

  it('falls back to the row label when an option has no trigger label', () => {
    dom.render(
      <SearchSelect
        options={[{ value: 'a', label: 'Alpha' }]}
        value="a"
        onValueChange={() => {}}
        emptyLabel="none"
      />,
    );
    expect(dom.container.querySelector('[data-select]')?.textContent).toBe('Alpha');
  });
});
