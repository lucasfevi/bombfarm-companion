import type { Lang } from './lang';
import * as chrome from './namespaces/chrome';
import * as planner from './namespaces/planner';
import * as gear from './namespaces/gear';
import * as abilities from './namespaces/abilities';
import * as account from './namespaces/account';
import * as advice from './namespaces/advice';
import * as breakdown from './namespaces/breakdown';
import * as phases from './namespaces/phases';
import * as gearPlan from './namespaces/gear-plan';
import * as importNs from './namespaces/import';
import * as stats from './namespaces/stats';

const en = {
  ...chrome.en,
  ...planner.en,
  ...gear.en,
  ...abilities.en,
  ...account.en,
  ...advice.en,
  ...breakdown.en,
  ...phases.en,
  ...gearPlan.en,
  ...importNs.en,
  ...stats.en,
};
const pt = {
  ...chrome.pt,
  ...planner.pt,
  ...gear.pt,
  ...abilities.pt,
  ...account.pt,
  ...advice.pt,
  ...breakdown.pt,
  ...phases.pt,
  ...gearPlan.pt,
  ...importNs.pt,
  ...stats.pt,
};

export type Strings = typeof en;
export const STRINGS: Record<Lang, Strings> = { en, pt };
