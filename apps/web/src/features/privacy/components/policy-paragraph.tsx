import { PRIVACY_CONTACT_EMAIL, splitAtEmail } from '../model/policy';

export function PolicyParagraph({ text }: { text: string }) {
  const parts = splitAtEmail(text);
  if (!parts) return <p className="m-0 text-sm leading-relaxed text-muted">{text}</p>;
  return (
    <p className="m-0 text-sm leading-relaxed text-muted">
      {parts[0]}
      <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
        {PRIVACY_CONTACT_EMAIL}
      </a>
      {parts[1]}
    </p>
  );
}
