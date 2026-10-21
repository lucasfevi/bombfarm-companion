import type { Meta, StoryObj } from '@storybook/react';
import { Pagination } from './pagination';

const meta = {
  title: 'UI/Pagination',
  component: Pagination,
  args: { page: 2, pageCount: 5, hrefFor: (page: number) => `/records?page=${page}` },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Middle: Story = {};

export const FirstPage: Story = { args: { page: 1 } };

export const LastPage: Story = { args: { page: 5 } };

export const SinglePage: Story = { args: { page: 1, pageCount: 1 } };
