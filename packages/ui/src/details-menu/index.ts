/**
 * DetailsMenu — the zero-JS native `<details>` menu. It lives in its own module, apart from
 * `Menu`, so a consumer that renders only this one never pulls in Base UI's menu and floating
 * code through the barrel.
 */

import {
  DetailsMenuGroupLabel,
  DetailsMenuItem,
  DetailsMenuRoot,
  DetailsMenuSeparator,
} from './details-menu';

export const DetailsMenu = {
  Root: DetailsMenuRoot,
  Item: DetailsMenuItem,
  Separator: DetailsMenuSeparator,
  GroupLabel: DetailsMenuGroupLabel,
};
