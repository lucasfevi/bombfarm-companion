import type { UpdateStatus } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { UpdatesSection } from './updates-section';

// Mocking `useCopy()` lets `UpdatesSection` be called directly as a plain function (no renderer,
// no jsdom) and its element tree walked for the rendered Button's real `onClick` — proving which
// callback each phase actually wires, not just which data-testid appears in the markup
// (`updates-section.test.tsx` already covers that). Each phase offers a different action, so a
// swapped pair of props would render identical markup and only this test would catch it.
vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  sub: (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (fallback: string, key: string) => values[key] ?? fallback),
  UPDATE_ERROR_REASON_COPY_KEY: {
    offline: 'settingsUpdatesReasonOffline',
    'rate-limited': 'settingsUpdatesReasonRateLimited',
    'no-release': 'settingsUpdatesReasonNoRelease',
    unknown: 'settingsUpdatesReasonUnknown',
  },
}));

function status(overrides: Partial<UpdateStatus> = {}): UpdateStatus {
  return {
    phase: 'idle',
    currentVersion: '1.2.3',
    channel: 'beta',
    availableVersion: null,
    percent: null,
    error: null,
    lastCheckedAt: null,
    ...overrides,
  };
}

function actionButton(value: UpdateStatus, handlers: Record<'onCheck' | 'onDownload' | 'onInstall', () => void>) {
  const section = UpdatesSection({ status: value, ...handlers }) as unknown as {
    props: { children: [unknown, { props: { children: unknown } }, unknown, unknown] };
  };
  const actionRow = section.props.children[1];
  return actionRow.props.children as { props: { onClick: () => void; 'data-testid': string; disabled?: boolean } };
}

describe('UpdatesSection — each phase wires its own action', () => {
  it.each([
    ['idle', 'settings-updates-check', 'onCheck'],
    ['not-available', 'settings-updates-check', 'onCheck'],
    ['available', 'settings-updates-download', 'onDownload'],
    ['ready', 'settings-updates-install', 'onInstall'],
  ] as const)('%s renders %s wired to %s', (phase, testId, expectedHandler) => {
    const handlers = { onCheck: vi.fn(), onDownload: vi.fn(), onInstall: vi.fn() };
    const button = actionButton(status({ phase, availableVersion: '1.3.0' }), handlers);

    expect(button.props['data-testid']).toBe(testId);
    expect(button.props.onClick).toBe(handlers[expectedHandler]);

    button.props.onClick();
    expect(handlers[expectedHandler]).toHaveBeenCalledTimes(1);
    for (const [name, fn] of Object.entries(handlers)) {
      if (name !== expectedHandler) expect(fn).not.toHaveBeenCalled();
    }
  });

  it('offers no live action in a build with updates turned off', () => {
    const handlers = { onCheck: vi.fn(), onDownload: vi.fn(), onInstall: vi.fn() };
    const button = actionButton(status({ phase: 'disabled', channel: null }), handlers);

    expect(button.props.disabled).toBe(true);
  });
});
