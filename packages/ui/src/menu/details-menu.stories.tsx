import type { Meta, StoryObj } from '@storybook/react';
import { DetailsMenu } from '../details-menu';

const meta = {
  title: 'UI/DetailsMenu',
  component: DetailsMenu.Root,
  tags: ['autodocs'],
  args: { label: 'Site menu', children: null },
  decorators: [
    (Story) => (
      <div className="flex min-h-56 justify-end p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DetailsMenu.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = (
  <>
    <DetailsMenu.Item render={<a href="#reports" />}>Reports</DetailsMenu.Item>
    <DetailsMenu.Item render={<a href="#billing" />}>Billing</DetailsMenu.Item>
    <DetailsMenu.Separator />
    <DetailsMenu.GroupLabel>Account</DetailsMenu.GroupLabel>
    <DetailsMenu.Item>Settings</DetailsMenu.Item>
  </>
);

export const Closed: Story = {
  args: { children: items },
};

export const Open: Story = {
  args: { children: items, open: true },
};
