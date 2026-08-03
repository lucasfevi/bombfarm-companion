'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { propLabel } from '@bombfarm/domain/game-labels';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import { PROPS } from '@bombfarm/domain/phases';
import { Fields, Select } from '@bombfarm/ui';
import { usePlannerStore, selectTargetProp } from '@/shared/stores';
import {
  accountHouseStackClass,
  heroAbilTitleClass,
} from '@bombfarm/ui/panel-field.recipe';

export function AccountFarmTargetFields() {
  const { t, lang } = useAppLang();
  const targetProp = usePlannerStore(selectTargetProp);
  const setTargetProp = usePlannerStore((state) => state.setTargetProp);

  return (
    <div className="mb-2">
      <h3 className={heroAbilTitleClass}>{t.accountFarmSection}</h3>
      <Fields layout="stack" className={accountHouseStackClass}>
        <label>
          <span>
            {t.prop}
            <span data-field-hint>{t.accountTargetPropHint}</span>
          </span>
          <Select
            value={targetProp || DEFAULT_TARGET_PROP}
            onChange={(event) => setTargetProp(event.target.value || DEFAULT_TARGET_PROP)}
          >
            {PROPS.map((prop) => (
              <option key={prop.name} value={prop.name}>
                {propLabel(prop.name, lang)}
              </option>
            ))}
          </Select>
        </label>
      </Fields>
    </div>
  );
}
