import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS } from '../../lib/copy';
import { FieldCountdown } from './field-countdown';

const en = STRINGS.en;

function render(model: Parameters<typeof FieldCountdown>[0]['model']) {
  return renderToStaticMarkup(createElement(FieldCountdown, { testId: 'live-countdown-field-h1', model }));
}

describe('FieldCountdown — a hero at a genuine zero is not the same as a hero the game never reported', () => {
  it('a real zero renders the formatted countdown, not the missing-data string', () => {
    const html = render({ heroId: 'h1', secondsRemaining: 0, basis: 'observed' });
    expect(html).toContain('0:00');
    expect(html).not.toContain(en.valueNotAvailable);
  });

  it('an absent countdown renders the missing-data string, never a substituted 0', () => {
    const html = render(undefined);
    expect(html).toContain(en.valueNotAvailable);
    expect(html).not.toMatch(/>\s*0:00\s*</);
  });

  it('shows the absence as a dash and keeps the words for a screen reader only', () => {
    const html = render(undefined);
    expect(html).toContain('<span aria-hidden="true">—</span>');
    expect(html).toContain(`<span class="sr-only">${en.valueNotAvailable}</span>`);
    // Once, and only inside the visually-hidden span: the sighted sentence is what wraps the row.
    expect(html.split(en.valueNotAvailable)).toHaveLength(2);
  });

  it('reserves the same digit column as a live reading, so an arriving countdown shifts nothing', () => {
    expect(render(undefined)).toContain('min-w-16');
    expect(render({ heroId: 'h1', secondsRemaining: 0, basis: 'observed' })).toContain('min-w-16');
  });

  it('the two states produce different markup, not just different text', () => {
    const zero = render({ heroId: 'h1', secondsRemaining: 0, basis: 'observed' });
    const absent = render(undefined);
    expect(zero).not.toBe(absent);
    // A real zero prints digits; an absent reading prints a dash and says why out of sight.
    expect(zero).toContain('0:00');
    expect(zero).not.toContain('—');
    expect(absent).toContain('—');
    expect(absent).not.toContain('0:00');
  });
});

describe('FieldCountdown — an estimated reading is marked without moving the number', () => {
  it('the same number renders for both an observed and a modelled reading of the same duration', () => {
    const observed = render({ heroId: 'h1', secondsRemaining: 90, basis: 'observed' });
    const modelled = render({ heroId: 'h1', secondsRemaining: 90, basis: 'modelled' });
    expect(observed).toContain('1:30');
    expect(modelled).toContain('1:30');
  });

  it('only a modelled reading carries the visually-hidden estimate qualifier', () => {
    const observed = render({ heroId: 'h1', secondsRemaining: 90, basis: 'observed' });
    const modelled = render({ heroId: 'h1', secondsRemaining: 90, basis: 'modelled' });
    expect(modelled).toContain(en.liveCountdownEstimatedQualifier);
    expect(observed).not.toContain(en.liveCountdownEstimatedQualifier);
  });

  it('flipping basis changes no layout-affecting class and no element structure, only text colour — no border either way', () => {
    const observed = render({ heroId: 'h1', secondsRemaining: 90, basis: 'observed' });
    const modelled = render({ heroId: 'h1', secondsRemaining: 90, basis: 'modelled' });

    const stripClasses = (html: string) => html.replace(/ class="[^"]*"/g, '');
    const stripQualifierText = (html: string) =>
      html.replace(/(data-testid="live-countdown-field-h1-qualifier"[^>]*>)[^<]*(<)/, '$1$2');

    expect(stripQualifierText(stripClasses(observed))).toBe(stripQualifierText(stripClasses(modelled)));

    const classOf = (html: string) =>
      /data-testid="live-countdown-field-h1" class="([^"]*)"/.exec(html)?.[1]?.split(' ') ?? [];
    const observedTokens = new Set(classOf(observed));
    const modelledTokens = new Set(classOf(modelled));
    const changed = [...observedTokens, ...modelledTokens].filter(
      (token) => observedTokens.has(token) !== modelledTokens.has(token),
    );
    for (const token of changed) {
      expect(['text-ink', 'text-muted']).toContain(token);
    }
    expect([...observedTokens, ...modelledTokens].some((token) => token.startsWith('border'))).toBe(false);
  });
});
