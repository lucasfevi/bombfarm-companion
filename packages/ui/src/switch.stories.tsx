import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Fields, Switch } from './index';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  args: { 'aria-label': 'Glass Cannon', defaultChecked: false },
};

export const On: Story = {
  args: { 'aria-label': 'Glass Cannon', defaultChecked: true },
};

export const InStackRow: Story = {
  render: function Render() {
    const [on, setOn] = useState(false);
    return (
      <div className="w-[28rem] border border-line bg-surface px-3.5 py-3">
        <Fields layout="stack">
          <label>
            <span>
              Glass Cannon
              <span>critical damage ×2 · energy ×0.5</span>
            </span>
            <div data-keystone-control className="flex items-center justify-end gap-2">
              <span className="min-w-[2.25rem] text-right text-[11px] font-semibold text-muted">
                {on ? 'On' : 'Off'}
              </span>
              <Switch checked={on} onCheckedChange={setOn} aria-label="Glass Cannon" />
            </div>
          </label>
        </Fields>
      </div>
    );
  },
};
