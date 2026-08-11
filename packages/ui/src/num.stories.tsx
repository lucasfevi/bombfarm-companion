import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Fields, Num } from './index';

const meta = {
  title: 'UI/Num',
  component: Num,
  tags: ['autodocs'],
  args: {
    value: 1.25,
    onChange: () => undefined,
    step: 0.05,
    decimals: 2,
  },
} satisfies Meta<typeof Num>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(1.25);
    return (
      // Every real call site wraps Num in a <label> (see InFieldStack / InFieldInline
      // below, and e.g. AccountFarmTargetFields) so the native <input> gets an
      // accessible name for free. This story stood bare, which is a story-authoring
      // gap, not a Num defect — axe's "label" rule caught it (SBC-12).
      <label className="block w-[120px] text-xs text-muted">
        <span>Multiplier</span>
        <Num {...args} value={value} onChange={setValue} />
      </label>
    );
  },
};

export const IntegerStep: Story = {
  args: { step: 1, decimals: 0 },
  render: function Render(args) {
    const [value, setValue] = useState(12);
    return (
      <label className="block w-[96px] text-xs text-muted">
        <span>Level</span>
        <Num {...args} value={value} onChange={setValue} />
      </label>
    );
  },
};

export const InFieldStack: Story = {
  render: function Render() {
    const [dmg, setDmg] = useState(2.156);
    const [crit, setCrit] = useState(65.68);
    return (
      <Fields layout="stack" className="max-w-sm">
        <label>
          <span>Total damage ×</span>
          <Num value={dmg} onChange={setDmg} step={0.001} decimals={3} />
        </label>
        <label>
          <span>Crit chance +% base</span>
          <Num value={crit} onChange={setCrit} decimals={2} />
        </label>
      </Fields>
    );
  },
};

export const InFieldInline: Story = {
  render: function Render() {
    const [value, setValue] = useState(1.25);
    return (
      <Fields layout="inline">
        <label>
          Multiplier
          <Num value={value} onChange={setValue} step={0.05} decimals={2} />
        </label>
      </Fields>
    );
  },
};
