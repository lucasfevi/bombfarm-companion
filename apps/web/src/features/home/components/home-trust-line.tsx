export function HomeTrustLine({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed text-muted">
      <span aria-hidden="true" className="text-up">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}
