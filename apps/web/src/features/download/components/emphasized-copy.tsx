import { parseEmphasis } from '@/shared/i18n';

/** i18n prose marks UI section names with `<em>`; they render as emphasis, never as markup. */
export function EmphasizedCopy({ text }: { text: string }) {
  return (
    <>
      {parseEmphasis(text).map((part, index) =>
        part.kind === 'em' ? (
          <strong key={index} className="font-semibold text-ink">
            {part.value}
          </strong>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}
