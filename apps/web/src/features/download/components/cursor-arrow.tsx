/** The Windows pointer, drawn — the illustrations need a cursor the page can move. */
export function CursorArrow({ pressed }: { pressed: boolean }) {
  return (
    <svg viewBox="0 0 12 18" width="16" height="24" aria-hidden="true">
      <path
        d="M1 1l9.5 8.2-4.2.4 2.4 5.1-2 .9-2.4-5.2L1 13.4z"
        fill="#f5f2ec"
        stroke="#16130f"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity={pressed ? 0.85 : 1}
      />
    </svg>
  );
}
