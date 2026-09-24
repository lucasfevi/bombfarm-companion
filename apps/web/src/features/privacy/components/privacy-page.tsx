import { sub, type Lang, type Strings } from '@/shared/i18n';
import { formatPolicyDate, PRIVACY_UPDATED_ON } from '../model/policy';
import { PolicyParagraph } from './policy-paragraph';
import { PolicySection } from './policy-section';

export function PrivacyPage({ t, lang }: { t: Strings; lang: Lang }) {
  return (
    <article data-testid="privacy-page" className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-balance text-ink">{t.privacyTitle}</h1>
        <p className="m-0 text-xs text-muted">
          {sub(t.privacyUpdated, { date: formatPolicyDate(PRIVACY_UPDATED_ON, lang) })}
        </p>
        <p className="m-0 text-sm leading-relaxed text-muted">{t.privacyIntro}</p>
      </header>

      <PolicySection title={t.privacyPingTitle}>
        <p className="m-0 text-sm leading-relaxed text-muted">{t.privacyPingIntro}</p>
        <ul data-testid="privacy-ping-fields" className="m-0 flex flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted">
          {Object.entries(t.privacyPingFields).map(([field, description]) => (
            <li key={field} data-field={field}>
              {description}
              {field === 'account' ? (
                <ul className="m-0 mt-1 flex flex-col gap-1 pl-5">
                  {Object.entries(t.privacyPingAccountFields).map(([accountField, accountDescription]) => (
                    <li key={accountField} data-field={`account.${accountField}`}>
                      {accountDescription}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="m-0 text-sm leading-relaxed text-muted">{t.privacyPingOptOut}</p>
      </PolicySection>

      {t.privacySections.map((section) => (
        <PolicySection key={section.title} title={section.title}>
          {section.p.map((text) => (
            <PolicyParagraph key={text} text={text} />
          ))}
        </PolicySection>
      ))}
    </article>
  );
}
