import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { ErrorScreen } from './error-screen';

const meta = {
  title: 'UI/ErrorScreen',
  component: ErrorScreen,
  args: {
    title: 'Something went wrong',
    message: 'The page could not be loaded. Try again in a moment.',
  },
} satisfies Meta<typeof ErrorScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRetryButton: Story = {
  args: { action: <Button variant="primary">Try again</Button> },
};

export const WithRetryLink: Story = {
  args: {
    action: (
      <a href="/" className="text-accent">
        Back to the start
      </a>
    ),
    headingLevel: 1,
  },
};
