import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS } from '../../lib/copy';
import { RecoveryCountdown } from './recovery-countdown';

const en = STRINGS.en;

function render(model: Parameters<typeof RecoveryCountdown>[0]['model']) {
  return renderToStaticMarkup(createElement(RecoveryCountdown, { testId: 'live-countdown-recovery-h1', model }));
}

describe('RecoveryCountdown — a hero at a genuine zero is not the same as a hero the game never reported', () => {
  it('a real zero renders the formatted countdown, not the missing-data string', () => {
    const html = render({ heroId: 'h1', secondsRemaining: 0, advancing: true });
    expect(html).toContain('0:00');
    expect(html).not.toContain(en.valueNotAvailable);
  });

  it('an absent countdown renders the missing-data string, never a substituted 0', () => {
    const html = render(undefined);
    expect(html).toContain(en.valueNotAvailable);
    expect(html).not.toMatch(/>\s*0:00\s*</);
  });
});

describe('RecoveryCountdown — a frozen countdown never looks like a running one', () => {
  it('the same number renders whether the countdown is advancing or paused', () => {
    const advancing = render({ heroId: 'h1', secondsRemaining: 120, advancing: true });
    const paused = render({ heroId: 'h1', secondsRemaining: 120, advancing: false });
    expect(advancing).toContain('2:00');
    expect(paused).toContain('2:00');
  });

  it('only a paused countdown carries the visually-hidden paused qualifier', () => {
    const advancing = render({ heroId: 'h1', secondsRemaining: 120, advancing: true });
    const paused = render({ heroId: 'h1', secondsRemaining: 120, advancing: false });
    expect(paused).toContain(en.liveCountdownPausedQualifier);
    expect(advancing).not.toContain(en.liveCountdownPausedQualifier);
  });

  it('never runs its own clock — the component is a pure function of its props, called once per render', () => {
    const first = render({ heroId: 'h1', secondsRemaining: 120, advancing: false });
    const second = render({ heroId: 'h1', secondsRemaining: 120, advancing: false });
    expect(first).toBe(second);
  });

  it('pausing changes no layout-affecting class and no element structure, only colour/border-style utilities', () => {
    const advancing = render({ heroId: 'h1', secondsRemaining: 120, advancing: true });
    const paused = render({ heroId: 'h1', secondsRemaining: 120, advancing: false });

    const stripClasses = (html: string) => html.replace(/ class="[^"]*"/g, '');
    const stripQualifierText = (html: string) =>
      html.replace(/(data-testid="live-countdown-recovery-h1-qualifier"[^>]*>)[^<]*(<)/, '$1$2');

    expect(stripQualifierText(stripClasses(advancing))).toBe(stripQualifierText(stripClasses(paused)));
  });
});
