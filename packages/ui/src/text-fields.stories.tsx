import type { Meta, StoryObj } from '@storybook/react';
import { TextArea, TextInput } from './index';

const meta = {
  title: 'UI/Text fields',
  component: TextInput,
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Input: Story = {
  args: { 'aria-label': 'Display name', placeholder: 'Display name' },
};

export const InputFilled: Story = {
  args: { 'aria-label': 'Email address', type: 'email', defaultValue: 'player@example.com' },
};

export const InputInvalid: Story = {
  args: { 'aria-label': 'Email address', defaultValue: 'not an email', 'aria-invalid': true },
};

export const InputDisabled: Story = {
  args: { 'aria-label': 'Locked field', defaultValue: 'Read only value', disabled: true },
};

export const Area: Story = {
  render: () => <TextArea aria-label="Message" rows={4} placeholder="Tell us what happened" />,
};

export const AreaInvalid: Story = {
  render: () => <TextArea aria-label="Message" rows={4} defaultValue="Too short" aria-invalid />,
};
