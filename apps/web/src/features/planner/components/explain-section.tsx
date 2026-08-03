'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { Collapsible } from '@bombfarm/ui';
import {
  explainBodyClass,
  explainClass,
  explainFormulaClass,
  explainSecClass,
  explainSourceClass,
  panelClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';

export function ExplainSection() {
  const { t } = useAppLang();
  return (
    <Collapsible.Root className={explainClass}>
      <Collapsible.Trigger tone="section">{t.explainTitle}</Collapsible.Trigger>
      <Collapsible.Panel>
        <div className={`${explainBodyClass} ${panelClass}`}>
          <p className={explainSourceClass}>
            {t.explainSource}
            <a href="https://wiki.bombfarm.net" target="_blank" rel="noreferrer">
              wiki.bombfarm.net
            </a>
            .
          </p>
          <p className={tipClass}>{t.explainIntro}</p>
          {t.explainSections.map((section) => (
            <div className={explainSecClass} key={section.h}>
              <h3>{section.h}</h3>
              {section.p.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {section.code && <code className={explainFormulaClass}>{section.code}</code>}
            </div>
          ))}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
