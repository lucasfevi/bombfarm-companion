import { parseEmphasis, type Strings } from '@/shared/i18n';

import { Button } from '@bombfarm/ui';

export function GuideSection({ t, onHide }: { t: Strings; onHide: () => void }) {
  return (
    <section
      className="mx-auto mt-3 w-[min(var(--maxw),calc(100%-32px))] border border-[color-mix(in_oklch,var(--accent)_35%,var(--line))] bg-[color-mix(in_oklch,var(--accent)_7%,var(--surface))] px-3.5 py-3"
      aria-label={t.guideTitle}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-2.5">
        <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.04em] text-accent">
          {t.guideTitle}
        </h2>
        <Button type="button" variant="text" onClick={onHide}>
          {t.hide}
        </Button>
      </div>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-3.5 gap-y-2.5 p-0">
        {t.guideSteps.map((step) => (
          <li key={step.t} className="flex flex-col gap-[3px] text-[12.5px] leading-1.45">
            <b className="text-[11px] font-bold tracking-wider text-accent uppercase">{step.t}</b>
            <span className="text-ink">
              {parseEmphasis(step.d).map((part, index) =>
                part.kind === 'em' ? (
                  <em key={index} className="font-[650] not-italic">
                    {part.value}
                  </em>
                ) : (
                  part.value
                ),
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
