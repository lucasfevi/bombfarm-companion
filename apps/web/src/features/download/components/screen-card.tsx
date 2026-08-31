export function ScreenCard({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="bg-bg p-6">
      <h3 className="m-0 mb-2 text-base tracking-tight text-ink">{title}</h3>
      <ul className="m-0 grid list-none gap-2 p-0">
        {items.map((item) => (
          <li
            key={item}
            className="relative pl-4 text-sm leading-relaxed text-muted before:absolute before:top-2 before:left-0 before:size-1 before:rounded-xs before:bg-line before:content-['']"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
