export interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TocProps {
  items: TocItem[];
  activeId: string;
}

export function Toc({ items, activeId }: TocProps) {
  if (items.length === 0) return null;

  return (
    <nav className="toc">
      <div className="toc-title">Contents</div>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={`toc-item toc-level-${item.level}${activeId === item.id ? ' active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );
}
