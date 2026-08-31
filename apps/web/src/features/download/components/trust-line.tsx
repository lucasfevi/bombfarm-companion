export function TrustLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 font-mono text-[11.5px] leading-relaxed text-muted">
      <span aria-hidden="true" className="text-up">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}
