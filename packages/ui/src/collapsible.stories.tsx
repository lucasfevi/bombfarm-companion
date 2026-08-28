import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Collapsible } from './index';

const meta = {
  title: 'UI/Collapsible',
  component: Collapsible.Root,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  // Every story below fully composes its own tree via `render`; this satisfies
  // CollapsibleRootProps' required `children` for the CSF3 args type only.
  args: { children: null },
} satisfies Meta<typeof Collapsible.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `tone="section"` (default) — the `ExplainSection` chrome, closed by default. */
export const Closed: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Collapsible.Root>
        <Collapsible.Trigger tone="section">How the math works</Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="w-full p-4">
            <p className="m-0 text-sm text-muted">Source, intro, sections, formula blocks.</p>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  ),
};

/** `defaultOpen` — panel content visible on mount. */
export const Open: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger tone="section">How the math works</Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="w-full p-4">
            <p className="m-0 text-sm text-muted">Source, intro, sections, formula blocks.</p>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  ),
};

/** Long PT label wraps in the label column; the chevron slot stays fixed. */
export const LongContentOverflow: Story = {
  render: () => (
    <div className="w-[20rem]">
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger tone="section">
          Como calculamos o dano efetivo total considerando árvore, habilidades e buffs de time
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="w-full p-4">
            <p className="m-0 text-sm text-muted">
              Formula breakdown text that can also wrap across multiple lines without shifting the
              trigger row or the fixed chevron slot.
            </p>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  ),
};

/** `disabled` — the whole disclosure is non-interactive. */
export const DisabledRoot: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Collapsible.Root disabled>
        <Collapsible.Trigger tone="section" disabled>
          How the math works
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="w-full p-4">
            <p className="m-0 text-sm text-muted">Source, intro, sections, formula blocks.</p>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  ),
};

/** Trigger focused on mount — verifies the visible focus-visible affordance. */
export const KeyboardFocusedTrigger: Story = {
  render: function Render() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }, []);
    return (
      <div className="w-[26rem]" ref={ref}>
        <Collapsible.Root>
          <Collapsible.Trigger tone="section">How the math works</Collapsible.Trigger>
          <Collapsible.Panel>
            <div className="w-full p-4">
              <p className="m-0 text-sm text-muted">Source, intro, sections, formula blocks.</p>
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      </div>
    );
  },
};

/** `tone="row"` compact trailing-chevron trigger. */
export const RowTone: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger tone="row" size="compact">
          <span>Attack</span>
          <span>1,204</span>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="w-full p-3">
            <p className="m-0 text-xs text-muted">Base + items + points + tree.</p>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  ),
};
