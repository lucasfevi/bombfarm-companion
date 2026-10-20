// @vitest-environment happy-dom
/// <reference types="vite/client" />
import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { composeStories, setProjectAnnotations } from '@storybook/react';
import type { Meta } from '@storybook/react';
import preview from '../.storybook/preview';
import { stubMatchMedia } from './dom-test-harness';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

setProjectAnnotations(preview);

type StoryModule = { default: Meta } & Record<string, unknown>;

const modules = import.meta.glob<StoryModule>('./**/*.stories.tsx', { eager: true });

const SETTLE_ROUNDS = 5;

/**
 * React's `useId` hands out ids from a process-wide counter, so one story's ids would shift when
 * another story is added before it. They carry no meaning, so number them by first appearance.
 */
function normaliseReactIds(html: string): string {
  const seen = new Map<string, string>();
  return html.replace(/:r[0-9a-z]+:|«r[0-9a-z]+»|_r_[0-9a-z]+_/g, (raw) => {
    let stable = seen.get(raw);
    if (!stable) {
      stable = `:id${seen.size + 1}:`;
      seen.set(raw, stable);
    }
    return stable;
  });
}

function pretty(html: string): string {
  return html.replace(/></g, '>\n<');
}

async function settle(): Promise<void> {
  for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

let root: Root | undefined;
let host: HTMLElement | undefined;

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  document.body.innerHTML = '';
});

async function renderSettledHtml(Story: ComponentType): Promise<string> {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Story />);
  });
  await settle();
  return pretty(normaliseReactIds(document.body.innerHTML));
}

describe('design-system story HTML', () => {
  it('discovers story modules', () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });

  describe.each(Object.entries(modules).sort(([a], [b]) => a.localeCompare(b)))('%s', (file, mod) => {
    const stories = composeStories(mod as Parameters<typeof composeStories>[0]) as Record<string, ComponentType>;
    const name = file.replace(/^\.\//, '').replace(/\.stories\.tsx$/, '').replaceAll('/', '__');

    it('renders every story to stable HTML', async () => {
      const sections: string[] = [];
      for (const [storyName, Story] of Object.entries(stories)) {
        stubMatchMedia(false);
        sections.push(`<!-- story: ${storyName} -->\n${await renderSettledHtml(Story)}`);
        await act(async () => root?.unmount());
        host?.remove();
        root = undefined;
        host = undefined;
        document.body.innerHTML = '';
      }
      await expect(sections.join('\n\n') + '\n').toMatchFileSnapshot(
        `./__snapshots__/stories-html/${name}.html`,
      );
    });
  });
});
