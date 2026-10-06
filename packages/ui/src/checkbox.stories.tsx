import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './index';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  args: { 'aria-label': 'Pick Iron Ring', defaultChecked: false },
};

export const Checked: Story = {
  args: { 'aria-label': 'Pick Iron Ring', defaultChecked: true },
};

export const Disabled: Story = {
  args: { 'aria-label': 'Pick Iron Ring', disabled: true, defaultChecked: false },
};

export const Controlled: Story = {
  render: function Render() {
    const [on, setOn] = useState(false);
    return <Checkbox aria-label="Pick Iron Ring" checked={on} onCheckedChange={setOn} />;
  },
};
