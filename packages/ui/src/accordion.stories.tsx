import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Accordion } from './index';

const meta = {
  title: 'UI/Accordion',
  component: Accordion.Root,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  // Every story below fully composes its own tree via `render`; this satisfies
  // AccordionRootProps' required `children` for the CSF3 args type only.
  args: { children: null },
} satisfies Meta<typeof Accordion.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { key: 'attack', label: 'Attack', value: '1,204' },
  { key: 'crit', label: 'Crit chance', value: '38%' },
  { key: 'speed', label: 'Speed', value: '92' },
];

/** Multi-item, `tone="section"` — every item closed by default (`defaultValue={[]}`). */
export const Closed: Story = {
  render: () => (
    <div className="flex w-[26rem] flex-col gap-2.5">
      <Accordion.Root defaultValue={[]}>
        {rows.slice(0, 2).map((r) => (
          <Accordion.Item value={r.key} key={r.key}>
            <Accordion.Trigger tone="section">{r.label}</Accordion.Trigger>
            <Accordion.Panel>
              <p className="m-0 p-4 text-sm text-muted">{r.label} breakdown goes here.</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  ),
};

/** `tone="section"` item open by `defaultValue`. */
export const Open: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Accordion.Root defaultValue={['attack']}>
        <Accordion.Item value="attack">
          <Accordion.Trigger tone="section">Attack</Accordion.Trigger>
          <Accordion.Panel>
            <p className="m-0 p-4 text-sm text-muted">Base + items + points + tree.</p>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  ),
};

/** `multiple: false` (default) — opening a second item closes the first. */
export const SingleOpenAtATime: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Accordion.Root defaultValue={['attack']} multiple={false}>
        {rows.map((r) => (
          <Accordion.Item value={r.key} key={r.key}>
            <Accordion.Trigger tone="row" size="compact">
              <span>{r.label}</span>
              <span>{r.value}</span>
            </Accordion.Trigger>
            <Accordion.Panel>
              <p className="m-0 p-3 text-xs text-muted">{r.label} ledger.</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  ),
};

/** `multiple: true` — several rows can stay open at once. */
export const MultipleOpen: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Accordion.Root defaultValue={['attack', 'crit']} multiple>
        {rows.map((r) => (
          <Accordion.Item value={r.key} key={r.key}>
            <Accordion.Trigger tone="row" size="compact">
              <span>{r.label}</span>
              <span>{r.value}</span>
            </Accordion.Trigger>
            <Accordion.Panel>
              <p className="m-0 p-3 text-xs text-muted">{r.label} ledger.</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  ),
};

/** Long PT/EN label wraps in the label column; the chevron slot stays fixed (UAC-05). */
export const LongContentOverflow: Story = {
  render: () => (
    <div className="w-[22rem]">
      <Accordion.Root defaultValue={['long']}>
        <Accordion.Item value="long">
          <Accordion.Trigger tone="section">
            Como calculamos o dano efetivo total considerando árvore, habilidades e buffs de time
          </Accordion.Trigger>
          <Accordion.Panel>
            <p className="m-0 p-4 text-sm text-muted">
              Formula breakdown text that can also wrap across multiple lines without shifting the
              trigger row or the fixed chevron slot.
            </p>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  ),
};

/** A per-item `disabled` trigger — non-interactive, skipped by arrow-key nav. */
export const DisabledItem: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Accordion.Root defaultValue={['attack']}>
        {rows.map((r) => (
          <Accordion.Item value={r.key} key={r.key} disabled={r.key === 'speed'}>
            <Accordion.Trigger tone="row" size="compact" disabled={r.key === 'speed'}>
              <span>{r.label}</span>
              <span>{r.value}</span>
            </Accordion.Trigger>
            <Accordion.Panel>
              <p className="m-0 p-3 text-xs text-muted">{r.label} ledger.</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  ),
};

/** First trigger focused on mount — verifies the visible focus-visible affordance. */
export const KeyboardFocusedTrigger: Story = {
  render: function Render() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }, []);
    return (
      <div className="w-[26rem]" ref={ref}>
        <Accordion.Root defaultValue={[]}>
          <Accordion.Item value="attack">
            <Accordion.Trigger tone="section">Attack</Accordion.Trigger>
            <Accordion.Panel>
              <p className="m-0 p-4 text-sm text-muted">Base + items + points + tree.</p>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      </div>
    );
  },
};

/** `tone="row"` compact stat-breakdown row (the shape `effective-stats-breakdown` composes). */
export const RowTone: Story = {
  render: () => (
    <div className="w-[26rem]">
      <Accordion.Root>
        {rows.map((r) => (
          <Accordion.Item value={r.key} key={r.key}>
            <Accordion.Trigger tone="row" size="compact">
              <span>{r.label}</span>
              <span>{r.value}</span>
            </Accordion.Trigger>
            <Accordion.Panel>
              <p className="m-0 p-3 text-xs text-muted">{r.label} ledger.</p>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  ),
};
