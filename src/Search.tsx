import { useEffect, useRef, useState } from 'react';
import Mark from 'mark.js';

interface SearchProps {
  contentEl: HTMLElement | null;
  onClose: () => void;
}

export function Search({ contentEl, onClose }: SearchProps) {
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const markRef = useRef<Mark | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (contentEl) markRef.current = new Mark(contentEl);
  }, [contentEl]);

  useEffect(() => {
    const m = markRef.current;
    if (!m) return;
    m.unmark({
      done: () => {
        if (!query.trim()) {
          setMatchCount(0);
          setCurrentMatch(0);
          return;
        }
        m.mark(query, {
          accuracy: 'partially',
          caseSensitive: false,
          acrossElements: true,
          done: (count) => {
            setMatchCount(count);
            const first = count > 0 ? 1 : 0;
            setCurrentMatch(first);
            if (first) {
              contentEl?.querySelectorAll('mark[data-markjs]')[0]
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          },
        });
      },
    });
  }, [query, contentEl]);

  const navigate = (dir: 1 | -1) => {
    if (!contentEl || matchCount === 0) return;
    const marks = Array.from(contentEl.querySelectorAll('mark[data-markjs]'));
    const next = ((currentMatch - 1 + dir + matchCount) % matchCount);
    setCurrentMatch(next + 1);
    marks[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const close = () => {
    markRef.current?.unmark();
    onClose();
  };

  useEffect(() => () => { markRef.current?.unmark(); }, []);

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        className="search-input"
        placeholder="Search in document…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          else if (e.key === 'Enter') navigate(e.shiftKey ? -1 : 1);
        }}
      />
      {query && (
        <span className="search-count">
          {matchCount === 0 ? 'No results' : `${currentMatch} / ${matchCount}`}
        </span>
      )}
      <button className="search-nav" onClick={() => navigate(-1)} disabled={matchCount === 0} title="Previous (Shift+Enter)">↑</button>
      <button className="search-nav" onClick={() => navigate(1)} disabled={matchCount === 0} title="Next (Enter)">↓</button>
      <button className="search-close" onClick={close} title="Close (Esc)">✕</button>
    </div>
  );
}
