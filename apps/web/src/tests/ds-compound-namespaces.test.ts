import { describe, it, expect } from 'vitest';
import {
  Dialog,
  Collapsible,
  Accordion,
  Tabs,
  Tooltip,
  TooltipStatusBody,
  DataTable,
  type AccordionRootProps,
  type AccordionItemProps,
  type AccordionHeaderProps,
  type AccordionTriggerProps,
  type AccordionPanelProps,
  type CollapsibleRootProps,
  type CollapsibleTriggerProps,
  type CollapsiblePanelProps,
  type TabsRootProps,
  type TabsListProps,
  type TabsTabProps,
  type TabsPanelsProps,
  type TabsPanelProps,
  type TooltipProviderProps,
  type TooltipRootProps,
  type TooltipTriggerProps,
  type TooltipPortalProps,
  type TooltipPositionerProps,
  type TooltipPopupProps,
  type TooltipArrowProps,
  type DataTableRootProps,
  type DataTableHeaderProps,
  type DataTableCellProps,
  type TableScrollerProps,
  type SortableTableHeaderProps,
  type SortDir,
} from '@bombfarm/ui';

// This suite must pass on the UNSPLIT tree (Phase 1) and stay green through every
// Phase 2 compound carve-out — that is what makes it a gate rather than a
// description of today's shape (MOD-28, W6-01, PRD AC 8).

describe('compound namespace shape (frozen)', () => {
  it('Dialog exposes exactly Root, Portal, Backdrop, Popup, Head, Title, Close, in order', () => {
    expect(Object.keys(Dialog)).toEqual(['Root', 'Portal', 'Backdrop', 'Popup', 'Head', 'Title', 'Close']);
    for (const value of Object.values(Dialog)) expect(typeof value).toBe('function');
  });

  it('Collapsible exposes exactly Root, Trigger, Panel, in order', () => {
    expect(Object.keys(Collapsible)).toEqual(['Root', 'Trigger', 'Panel']);
    for (const value of Object.values(Collapsible)) expect(typeof value).toBe('function');
  });

  it('Accordion exposes exactly Root, Item, Header, Trigger, Panel, in order', () => {
    expect(Object.keys(Accordion)).toEqual(['Root', 'Item', 'Header', 'Trigger', 'Panel']);
    for (const value of Object.values(Accordion)) expect(typeof value).toBe('function');
  });

  it('Tabs exposes exactly Root, List, Tab, Panels, Panel, in order', () => {
    expect(Object.keys(Tabs)).toEqual(['Root', 'List', 'Tab', 'Panels', 'Panel']);
    for (const value of Object.values(Tabs)) expect(typeof value).toBe('function');
  });

  it('Tooltip exposes exactly Provider, Root, Trigger, Portal, Positioner, Popup, Arrow, StatusBody, in order', () => {
    expect(Object.keys(Tooltip)).toEqual([
      'Provider',
      'Root',
      'Trigger',
      'Portal',
      'Positioner',
      'Popup',
      'Arrow',
      'StatusBody',
    ]);
    for (const value of Object.values(Tooltip)) expect(typeof value).toBe('function');
  });

  it('Tooltip.StatusBody is the same function reference as standalone TooltipStatusBody', () => {
    expect(Tooltip.StatusBody).toBe(TooltipStatusBody);
  });

  it('DataTable exposes exactly Root, Table, Head, Body, Row, Header, Cell, RowHeader, Caption, in order', () => {
    expect(Object.keys(DataTable)).toEqual([
      'Root',
      'Table',
      'Head',
      'Body',
      'Row',
      'Header',
      'Cell',
      'RowHeader',
      'Caption',
    ]);
    for (const value of Object.values(DataTable)) expect(typeof value).toBe('function');
  });
});

// Compile-time only: `pnpm typecheck` is the gate. If a namespace's type
// re-export is ever dropped from the design-system barrel, this list fails to
// compile ("has no exported member") even though the runtime suite above would
// stay green (types are erased at runtime) — see spec Edge Cases.
export type _AssertBarrelTypesStillExported = [
  AccordionRootProps,
  AccordionItemProps,
  AccordionHeaderProps,
  AccordionTriggerProps,
  AccordionPanelProps,
  CollapsibleRootProps,
  CollapsibleTriggerProps,
  CollapsiblePanelProps,
  TabsRootProps,
  TabsListProps,
  TabsTabProps,
  TabsPanelsProps,
  TabsPanelProps,
  TooltipProviderProps,
  TooltipRootProps,
  TooltipTriggerProps,
  TooltipPortalProps,
  TooltipPositionerProps,
  TooltipPopupProps,
  TooltipArrowProps,
  DataTableRootProps,
  DataTableHeaderProps,
  DataTableCellProps,
  TableScrollerProps,
  SortableTableHeaderProps<string>,
  SortDir,
];
