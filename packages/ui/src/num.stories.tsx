import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Fields, Num, ReadonlyNum } from './index';

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
      <div className="w-[120px]">
        <Num {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const IntegerStep: Story = {
  args: { step: 1, decimals: 0 },
  render: function Render(args) {
    const [value, setValue] = useState(12);
    return (
      <div className="w-[96px]">
        <Num {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};

/** Skill-tree style: import-sourced floats use ReadonlyNum; team buffs stay editable Num. */
export const InFieldStack: Story = {
  render: function Render() {
    const [buff, setBuff] = useState(20);
    return (
      <Fields layout="stack" className="max-w-sm">
        <label>
          <span>Total damage ×</span>
          <ReadonlyNum value={2.60988968151606} decimals={3} />
        </label>
        <label>
          <span>Crit chance +% base</span>
          <ReadonlyNum value={12.3456789} decimals={2} />
        </label>
        <label>
          <span>War Cry %</span>
          <Num value={buff} onChange={setBuff} step={1} decimals={0} />
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
