import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REQUIRED_ACCOUNT_FIELDS } from '@bombfarm/domain/account-required-fields';
import { resolveHouseRestSeconds } from '@bombfarm/domain/model';
import {
  AccountHousePanel,
  AccountMissingFieldsBanner,
  AccountTreePanel,
  FIELD_LABEL_KEY,
  formatHouseRest,
  formatLuckPoints,
  formatTreePercent,
} from '@/features/account';
import { STRINGS } from '@/shared/i18n';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

function listItems(html: string): string[] {
  return Array.from(html.matchAll(/<li>([^<]*)<\/li>/g), (match) => match[1]);
}

function definitions(html: string): string[] {
  return Array.from(html.matchAll(/<dd>([^<]*)<\/dd>/g), (match) => match[1]);
}

describe('the Account page prints what its model formats', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('the missing-fields banner prints the label the model maps for each required field', () => {
    for (const field of REQUIRED_ACCOUNT_FIELDS) {
      usePlannerStore.setState({ missingRequiredFields: [field] });
      const html = renderToStaticMarkup(createElement(AccountMissingFieldsBanner));

      expect(listItems(html)).toEqual([STRINGS.pt[FIELD_LABEL_KEY[field]]]);
    }
  });

  it("the House panel's recovery cycle is the model's formatting of the same seconds", () => {
    usePlannerStore.setState({ houseIdx: 2, houseLevel: 7, houseCycleSecs: null });
    const state = usePlannerStore.getState();
    const seconds = resolveHouseRestSeconds(
      state.houseCycleSecs,
      state.houseIdx,
      state.houseLevel,
      state.houseCycleSecsHouseIdx,
      state.houseCycleSecsLevel,
    );
    const html = renderToStaticMarkup(createElement(AccountHousePanel));

    expect(definitions(html)).toContain(formatHouseRest(seconds));
    expect(formatHouseRest(seconds)).toMatch(/^\d+ min \d+ s$/);
  });

  it("the tree panel's squad damage and luck read as the model formats them", () => {
    usePlannerStore.setState({ treeSquadDmgPct: 12.5, treeLuckFlatPct: 2.5 });
    const html = renderToStaticMarkup(createElement(AccountTreePanel));
    const values = definitions(html);

    expect(values).toContain(formatTreePercent(12.5, 'pt'));
    expect(values).toContain(formatLuckPoints(2.5, 'pt'));
    expect(formatTreePercent(12.5, 'pt')).toBe('+12,50%');
    expect(formatLuckPoints(2.5, 'pt')).toBe('+2,50 pp');
  });
});
