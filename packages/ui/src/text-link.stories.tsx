import type { ComponentPropsWithoutRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TextLink } from './index';

function RouterLink({ to, ...props }: ComponentPropsWithoutRef<'a'> & { to: string }) {
  return <a href={to} {...props} />;
}

const meta = {
  title: 'UI/Text link',
  component: TextLink,
  args: { href: '/account', children: 'Account settings' },
} satisfies Meta<typeof TextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accent: Story = {};

export const Muted: Story = {
  args: { tone: 'muted', href: '/terms', children: 'Terms of use' },
};

export const ThroughConsumerLink: Story = {
  render: () => (
    <TextLink as={RouterLink} to="/account">
      Account settings
    </TextLink>
  ),
};
