import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AccountIdentityView,
  type AccountIdentityLabels,
  type AccountIdentityViewProps,
} from './account-identity-view.js';

function labelsTagged(tag: string): AccountIdentityLabels {
  return {
    title: `${tag}-title`,
    tip: `${tag}-tip`,
    playerName: `${tag}-playerName`,
    accountId: `${tag}-accountId`,
    currentPhase: `${tag}-currentPhase`,
    maxPhase: `${tag}-maxPhase`,
    phase: (phase) => `${tag}-phase(${String(phase)})`,
    missing: `${tag}-missing`,
  };
}

function render(props: Partial<AccountIdentityViewProps> = {}) {
  return renderToStaticMarkup(
    <AccountIdentityView
      playerName="Kendo"
      accountId="486"
      phase={26}
      maxPhase={31}
      labels={labelsTagged('aa')}
      {...props}
    />,
  );
}

function facts(html: string): { label: string; value: string }[] {
  const pattern = /data-account-fact[^>]*><div[^>]*>([^<]*)<\/div><div[^>]*>([^<]*)<\/div>/g;
  return [...html.matchAll(pattern)].map((match) => ({
    label: match[1] ?? '',
    value: match[2] ?? '',
  }));
}

function textChunks(html: string): string[] {
  return html
    .split(/<[^>]*>/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

describe('AccountIdentityView', () => {
  it('renders the four facts in the order the header is scoped by', () => {
    const labels = labelsTagged('aa');
    expect(facts(render()).map((fact) => fact.label)).toEqual([
      labels.playerName,
      labels.accountId,
      labels.currentPhase,
      labels.maxPhase,
    ]);
  });

  it('prints each value the account carries', () => {
    const labels = labelsTagged('aa');
    expect(facts(render()).map((fact) => fact.value)).toEqual([
      'Kendo',
      '486',
      labels.phase(26),
      labels.phase(31),
    ]);
  });

  it('hands the phase to the label bag as a bare number, having formatted nothing itself', () => {
    const labels = labelsTagged('aa');
    const phase = vi.fn(labels.phase);
    render({ labels: { ...labels, phase } });

    expect(phase.mock.calls).toEqual([[26], [31]]);
  });

  it('falls back to the placeholder for every fact the account did not carry', () => {
    const labels = labelsTagged('aa');
    const html = render({ playerName: null, accountId: null, phase: null, maxPhase: null });

    expect(facts(html).map((fact) => fact.value)).toEqual([
      labels.missing,
      labels.missing,
      labels.missing,
      labels.missing,
    ]);
  });

  it('falls back per fact, so a half-imported account still shows what it does know', () => {
    const labels = labelsTagged('aa');
    const html = render({ accountId: null, maxPhase: null });

    expect(facts(html).map((fact) => fact.value)).toEqual([
      'Kendo',
      labels.missing,
      labels.phase(26),
      labels.missing,
    ]);
  });

  it('never asks the bag to format a phase it does not have', () => {
    const labels = labelsTagged('aa');
    const phase = vi.fn(labels.phase);
    render({ phase: null, maxPhase: null, labels: { ...labels, phase } });

    expect(phase).not.toHaveBeenCalled();
  });

  it('prints no word of its own — every string comes from the label bag or a prop', () => {
    const labels = labelsTagged('aa');
    const supplied = new Set<string>([
      ...Object.values(labels).filter((value): value is string => typeof value === 'string'),
      labels.phase(26),
      labels.phase(31),
      'Kendo',
      '486',
    ]);

    expect(textChunks(render()).filter((chunk) => !supplied.has(chunk))).toEqual([]);
  });

  it('changes every word when a differently worded bag is supplied', () => {
    const html = render({ labels: labelsTagged('bb') });

    expect(html).not.toContain('aa-');
    expect(html).toContain('bb-title');
  });
});
