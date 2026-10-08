// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';
import {
  ActionChip,
  Banner,
  Button,
  Chip,
  CornerDismiss,
  DataTable,
  Dialog,
  FactTile,
  Menu,
  Panel,
  Switch,
  Tooltip,
} from './index';

/**
 * A hyphenated JSX attribute is not type-checked against a component's prop list, so a component
 * that declares its props one by one accepts `data-testid` at compile time and drops it at render
 * time. Only the rendered DOM can tell the two apart, which is why this reads the document instead
 * of the sources — and it reads the whole document, because a popup part lands in a portal rather
 * than in the mount container.
 */
type ForwardingCase = { name: string; render: (testId: string) => ReactNode };

const CASES: ForwardingCase[] = [
  { name: 'ActionChip', render: (testId) => <ActionChip label="Refresh" data-testid={testId} /> },
  { name: 'Banner', render: (testId) => <Banner data-testid={testId}>Saved</Banner> },
  { name: 'Button', render: (testId) => <Button data-testid={testId}>Go</Button> },
  { name: 'Chip', render: (testId) => <Chip data-testid={testId}>Ready</Chip> },
  { name: 'CornerDismiss', render: (testId) => <CornerDismiss label="Remove" data-testid={testId} /> },
  {
    name: 'DataTable.Root',
    render: (testId) => <DataTable.Root data-testid={testId}>rows</DataTable.Root>,
  },
  {
    name: 'DataTable.Table',
    render: (testId) => (
      <DataTable.Table data-testid={testId}>
        <DataTable.Body>
          <DataTable.Row>
            <DataTable.Cell>1</DataTable.Cell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    ),
  },
  {
    name: 'DataTable.Body',
    render: (testId) => (
      <DataTable.Table>
        <DataTable.Body data-testid={testId}>
          <DataTable.Row>
            <DataTable.Cell>1</DataTable.Cell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    ),
  },
  {
    name: 'DataTable.Row',
    render: (testId) => (
      <DataTable.Table>
        <DataTable.Body>
          <DataTable.Row data-testid={testId}>
            <DataTable.Cell>1</DataTable.Cell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    ),
  },
  {
    name: 'DataTable.Cell',
    render: (testId) => (
      <DataTable.Table>
        <DataTable.Body>
          <DataTable.Row>
            <DataTable.Cell data-testid={testId}>1</DataTable.Cell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    ),
  },
  {
    name: 'DataTable.Header',
    render: (testId) => (
      <DataTable.Table>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header data-testid={testId}>Hero</DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
      </DataTable.Table>
    ),
  },
  {
    name: 'Dialog.Popup',
    render: (testId) => (
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Popup data-testid={testId}>
            <Dialog.Body>body</Dialog.Body>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
  },
  {
    name: 'Dialog.Body',
    render: (testId) => (
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Body data-testid={testId}>body</Dialog.Body>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
  },
  { name: 'FactTile', render: (testId) => <FactTile label="Power" value="1" data-testid={testId} /> },
  {
    name: 'Menu.Trigger',
    render: (testId) => (
      <Menu.Root>
        <Menu.Trigger data-testid={testId}>Open</Menu.Trigger>
      </Menu.Root>
    ),
  },
  {
    name: 'Menu.Popup',
    render: (testId) => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid={testId}>
              <Menu.Item>One</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  },
  {
    name: 'Menu.Item',
    render: (testId) => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item data-testid={testId}>One</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  },
  {
    name: 'Menu.RadioItem',
    render: (testId) => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.RadioGroup value="one">
                <Menu.RadioItem value="one" data-testid={testId}>
                  One
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  },
  { name: 'Panel', render: (testId) => <Panel data-testid={testId}>panel</Panel> },
  { name: 'Switch', render: (testId) => <Switch aria-label="Toggle" data-testid={testId} /> },
  {
    name: 'Tooltip.Trigger',
    render: (testId) => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid={testId}>Hover</Tooltip.Trigger>
      </Tooltip.Root>
    ),
  },
  {
    name: 'Tooltip.Popup',
    render: (testId) => (
      <Tooltip.Root open>
        <Tooltip.Trigger>Hover</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid={testId}>body</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
  },
];

// Every design-system component some call site in this repo already writes a `data-testid` on.
// A name here with no case below means the guard stopped covering a hook the apps depend on.
const CALLER_WRITTEN_FLOOR = [
  'ActionChip',
  'Banner',
  'Button',
  'Chip',
  'CornerDismiss',
  'DataTable.Body',
  'DataTable.Cell',
  'DataTable.Header',
  'DataTable.Root',
  'DataTable.Row',
  'DataTable.Table',
  'Dialog.Body',
  'Dialog.Popup',
  'FactTile',
  'Menu.Item',
  'Menu.Popup',
  'Menu.RadioItem',
  'Menu.Trigger',
  'Panel',
  'Switch',
  'Tooltip.Popup',
  'Tooltip.Trigger',
];

beforeEach(() => {
  stubMatchMedia(false);
});

// Each case gets its own root: a popup part mounted open and then replaced in place makes React
// report the swap as a controlled-to-uncontrolled change, which is noise about this harness.
function dropsTestId(forwarding: ForwardingCase, testId: string): boolean {
  const dom: DomMount = mountDom();
  try {
    dom.render(forwarding.render(testId));
    return document.querySelector(`[data-testid="${testId}"]`) === null;
  } finally {
    dom.unmount();
  }
}

describe('data-testid reaches the DOM through a design-system component', () => {
  it('no component under guard swallows the attribute a caller wrote on it', () => {
    const dropped = CASES.filter((forwarding, index) =>
      dropsTestId(forwarding, `forwarding-probe-${index}`),
    ).map((forwarding) => forwarding.name);

    expect(
      dropped,
      `these design-system components accepted a data-testid and did not put it on the element ` +
        `they rendered. A hyphenated attribute is not type-checked, so the call site compiles and ` +
        `the hook silently never reaches the page.`,
    ).toEqual([]);
  });

  it('covers every component a call site in this repo already writes a data-testid on', () => {
    const covered = new Set(CASES.map((forwarding) => forwarding.name));

    // Named before counted: a length check that fires first reports a number and no offender.
    expect(
      CALLER_WRITTEN_FLOOR.filter((name) => !covered.has(name)),
      `a component some call site writes a data-testid on has no case above, so nothing proves ` +
        `the attribute survives its render.`,
    ).toEqual([]);
    expect(
      CASES.length,
      `cases: ${CASES.length}, floor: ${CALLER_WRITTEN_FLOOR.length}. A floor, not a count — ` +
        `below it the table has stopped covering the components callers already address by testid.`,
    ).toBeGreaterThanOrEqual(CALLER_WRITTEN_FLOOR.length);
  });
});
