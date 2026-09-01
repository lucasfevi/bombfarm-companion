import { describe, expect, it } from 'vitest';
import { sub } from './format';

describe('sub', () => {
  it('substitutes a named placeholder', () => {
    expect(sub('Phase #{id}', { id: 51 })).toBe('Phase #51');
  });

  it('substitutes every occurrence of a repeated placeholder', () => {
    expect(sub('{slots} of {slots}', { slots: 9 })).toBe('9 of 9');
  });

  it('substitutes several distinct placeholders in one template', () => {
    expect(sub('{gain}% for {cost} gold', { gain: '12.8', cost: '83,000' })).toBe(
      '12.8% for 83,000 gold',
    );
  });

  it('renders a missing key as the empty string rather than leaving the token visible', () => {
    expect(sub('needs {pct}%', {})).toBe('needs %');
  });

  it('leaves a template with no placeholders untouched', () => {
    expect(sub('Farm Ranking', { id: 1 })).toBe('Farm Ranking');
  });

  it('leaves a non-word token alone — only {\\w+} is a placeholder', () => {
    expect(sub('{ id } and {}', { id: 1 })).toBe('{ id } and {}');
  });
});
