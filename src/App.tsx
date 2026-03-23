import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'github-markdown-css/github-markdown.css';
import './App.css';
import { THEMES, type ThemeId } from './themes';
import { Toc, type TocItem } from './Toc';
import { FileBrowser } from './FileBrowser';
import { Search } from './Search';

const LS_THEME          = 'markdown-reader:theme';
const LS_FONT           = 'markdown-reader:font-size';
const LS_RECENT         = 'markdown-reader:recent';
const LS_SIDEBAR        = 'markdown-reader:sidebar';
const LS_SIDEBAR_VISIBLE = 'markdown-reader:sidebar-visible';
const LS_SIDEBAR_WIDTH   = 'markdown-reader:sidebar-width';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function buildRenderer(tocItems: TocItem[]) {
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    const highlighted = hljs.highlight(text, { language }).value;
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };
  renderer.heading = ({ text, depth }) => {
    const id = slugify(text);
    const plain = text.replace(/<[^>]+>/g, '');
    tocItems.push({ id, text: plain, level: depth });
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  return renderer;
}

async function parseMarkdown(text: string): Promise<{ html: string; items: TocItem[] }> {
  const items: TocItem[] = [];
  marked.use({ renderer: buildRenderer(items) });
  const html = await marked.parse(text);
  return { html, items };
}

function parentDir(path: string) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

export default function App() {
  const [html, setHtml]               = useState('');
  const [rawContent, setRawContent]   = useState('');
  const [tocItems, setTocItems]       = useState<TocItem[]>([]);
  const [activeId, setActiveId]       = useState('');
  const [filePath, setFilePath]       = useState('');
  const [currentDir, setCurrentDir]   = useState('');
  const [isDirty, setIsDirty]         = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_RECENT) ?? '[]'); }
    catch { return []; }
  });
  const [themeId, setThemeId]         = useState<ThemeId>(
    () => (localStorage.getItem(LS_THEME) as ThemeId) ?? 'github-light'
  );
  const [sidebarMode, setSidebarMode] = useState<'files' | 'toc'>(
    () => (localStorage.getItem(LS_SIDEBAR) as 'files' | 'toc') ?? 'files'
  );
  const [fontSize, setFontSize]       = useState(
    () => parseInt(localStorage.getItem(LS_FONT) ?? '16')
  );
  const [searchVisible, setSearchVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(
    () => localStorage.getItem(LS_SIDEBAR_VISIBLE) !== 'false'
  );
  const [isDragging, setIsDragging]   = useState(false);
  const [showAbout, setShowAbout]     = useState(false);
  const [appVersion, setAppVersion]   = useState('');
  const [savedToast, setSavedToast]   = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = localStorage.getItem(LS_SIDEBAR_WIDTH);
    return v ? parseInt(v, 10) : 220;
  });

  const contentRef    = useRef<HTMLElement>(null);
  const observerRef   = useRef<IntersectionObserver | null>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const syncingRef    = useRef(false);
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  // Highlight.js CSS injection
  useEffect(() => {
    let el = document.getElementById('hl-theme') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'hl-theme';
      document.head.appendChild(el);
    }
    el.textContent = theme.hlCss;
  }, [theme.hlCss]);

  // Apply data-theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(LS_THEME, themeId);
  }, [themeId]);

  // Persist font size, sidebar mode, sidebar visibility
  useEffect(() => { localStorage.setItem(LS_FONT, String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem(LS_SIDEBAR, sidebarMode); }, [sidebarMode]);
  useEffect(() => { localStorage.setItem(LS_SIDEBAR_VISIBLE, String(sidebarVisible)); }, [sidebarVisible]);
  useEffect(() => { localStorage.setItem(LS_SIDEBAR_WIDTH, String(sidebarWidth)); }, [sidebarWidth]);

  // Scroll-spy
  useEffect(() => {
    observerRef.current?.disconnect();
    if (!html || tocItems.length === 0) return;
    const headings = contentRef.current?.querySelectorAll('h1,h2,h3,h4,h5,h6') ?? [];
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    );
    headings.forEach((h) => observerRef.current!.observe(h));
    return () => observerRef.current?.disconnect();
  }, [html, tocItems]);

  // Live preview: re-render when rawContent changes in edit mode (debounced)
  useEffect(() => {
    if (!editMode) return;
    const timer = setTimeout(async () => {
      const { html: rendered, items } = await parseMarkdown(rawContent);
      setHtml(rendered);
      setTocItems(items);
    }, 250);
    return () => clearTimeout(timer);
  }, [rawContent, editMode]);

  // Window title reflects dirty state
  useEffect(() => {
    const name = filePath.split('/').pop() ?? '';
    if (!name) return;
    const title = `${isDirty ? '• ' : ''}${name} — Marka`;
    invoke('set_window_title', { title }).catch(() => {});
  }, [isDirty, filePath]);

  const saveFile = useCallback(async () => {
    let path = filePath;
    if (!path) {
      const chosen = await save({
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
        defaultPath: 'untitled.md',
      });
      if (!chosen) return;
      path = chosen;
      setFilePath(path);
      setCurrentDir(parentDir(path));
      setRecentFiles((prev) => {
        const updated = [path, ...prev.filter((p) => p !== path)].slice(0, 10);
        localStorage.setItem(LS_RECENT, JSON.stringify(updated));
        return updated;
      });
    }
    await invoke('write_file', { path, content: rawContent });
    setIsDirty(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }, [filePath, rawContent]);

  const newFile = useCallback(() => {
    setHtml('');
    setRawContent('');
    setTocItems([]);
    setActiveId('');
    setFilePath('');
    setIsDirty(false);
    setEditMode(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const printDocument = useCallback(async () => {
    if (!html) return;
    try {
      await invoke('print_document', { html });
    } catch (err) {
      console.error('[print] failed:', err);
    }
  }, [html]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'n') { e.preventDefault(); newFile(); }
      if (e.metaKey && e.key === 'f') { e.preventDefault(); setSearchVisible(true); }
      if (e.metaKey && e.key === 'p') { e.preventDefault(); printDocument(); }
      if (e.metaKey && e.key === 's') { e.preventDefault(); if (editMode) saveFile(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, newFile, saveFile, printDocument]);

  const loadFile = useCallback(async (path: string) => {
    try {
      const text = await invoke<string>('read_file', { path });
      const { html: rendered, items } = await parseMarkdown(text);
      setHtml(rendered);
      setRawContent(text);
      setTocItems(items);
      setActiveId(items[0]?.id ?? '');
      setFilePath(path);
      setCurrentDir(parentDir(path));
      setIsDirty(false);
      setEditMode(false);
      setRecentFiles((prev) => {
        const updated = [path, ...prev.filter((p) => p !== path)].slice(0, 10);
        localStorage.setItem(LS_RECENT, JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, []);

  useEffect(() => { getVersion().then(setAppVersion); }, []);

  // On startup: open file from Finder if any, otherwise restore last recent file
  useEffect(() => {
    invoke<string | null>('get_open_file').then(pending => {
      if (pending) {
        loadFile(pending);
      } else {
        const [last] = JSON.parse(localStorage.getItem(LS_RECENT) ?? '[]') as string[];
        if (last) loadFile(last);
      }
    });
  }, [loadFile]);

  // Handle files opened via Finder while the app is already running
  useEffect(() => {
    const unlisten = listen<string>('open-file', (event) => {
      loadFile(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [loadFile]);

  const openFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (selected && typeof selected === 'string') await loadFile(selected);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const path = (file as File & { path?: string }).path;
    if (path && (path.endsWith('.md') || path.endsWith('.markdown'))) await loadFile(path);
  };

  // Sidebar resize drag
  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragRef.current) return;
      const w = Math.min(480, Math.max(160, sidebarDragRef.current.startWidth + ev.clientX - sidebarDragRef.current.startX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      sidebarDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // Tab key → insert 2 spaces in textarea
  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = rawContent.substring(0, start) + '  ' + rawContent.substring(end);
    setRawContent(next);
    setIsDirty(true);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  };

  const fileName = filePath.split('/').pop() ?? '';
  const hasToc   = tocItems.length > 0;

  const handlePreviewClick = (e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();

    const hasProtocol = /^https?:\/\/|^mailto:|^\/\//.test(href);

    // Note: bare domain detection (e.g. "webcms.lu", "www.example.com") is intentionally
    // excluded to follow strict Markdown/CommonMark spec — links without a protocol are
    // treated as relative file paths. Use full URLs (https://...) for external links.

    if (hasProtocol) {
      openUrl(href);
    } else {
      const resolved = new URL(href, `file://${currentDir}/`);
      loadFile(resolved.pathname);
    }
  };

  const preview = (
    <article
      className="markdown-body"
      data-theme={theme.dark ? 'dark' : 'light'}
      style={{ fontSize: `${fontSize}px` }}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handlePreviewClick}
    />
  );

  return (
    <div
      className={`app${isDragging ? ' dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <header className="toolbar">
        <button
          className={`btn btn-icon sidebar-toggle${sidebarVisible ? ' active' : ''}`}
          onClick={() => setSidebarVisible(v => !v)}
          title="Toggle sidebar"
        >
          ☰
        </button>
        <button className="btn" onClick={newFile} title="New file (⌘N)">New</button>
        <button className="btn" onClick={openFile}>Open</button>
        <span className="file-name">
          {isDirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
          {fileName || (editMode ? 'Untitled' : '')}
        </span>

        <div className="toolbar-right">
          {editMode ? (
            <>
              <button className="btn btn-save" onClick={saveFile} title="Save (⌘S)">
                Save
              </button>
              {html && (
                <button className="btn" onClick={() => setEditMode(false)} title="Back to preview">
                  Preview
                </button>
              )}
            </>
          ) : (
            html && (
              <button className="btn" onClick={() => { setEditMode(true); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                Edit
              </button>
            )
          )}
          <button className="btn btn-icon" onClick={() => setSearchVisible((v) => !v)} title="Search (⌘F)">🔍</button>
          <div className="font-controls">
            <button className="btn btn-icon" onClick={() => setFontSize((s) => Math.max(12, s - 1))} title="Smaller">A−</button>
            <button className="btn btn-icon" onClick={() => setFontSize((s) => Math.min(24, s + 1))} title="Larger">A+</button>
          </div>
          <button className="btn btn-icon" onClick={printDocument} title="Print (⌘P)">🖨</button>
          <button className="btn btn-icon" onClick={() => setShowAbout(true)} title="About Marka">ⓘ</button>
          <select className="theme-select" value={themeId} onChange={(e) => setThemeId(e.target.value as ThemeId)}>
            {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </header>

      {/* ── Search bar ──────────────────────────────────────────────── */}
      {searchVisible && (
        <Search contentEl={contentRef.current} onClose={() => setSearchVisible(false)} />
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      {!html && !editMode ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <p>Open a markdown file or drag it here</p>
          <button className="btn btn-primary" onClick={openFile}>Choose File</button>
        </div>
      ) : (
        <div className="layout">
          {/* Sidebar */}
          {sidebarVisible && (
            <aside className="sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
              <div className="sidebar-resizer" onMouseDown={onSidebarResizeStart} />
              <div className="sidebar-tabs">
                <button className={`sidebar-tab${sidebarMode === 'files' ? ' active' : ''}`} onClick={() => setSidebarMode('files')}>
                  Files
                </button>
                <button
                  className={`sidebar-tab${sidebarMode === 'toc' ? ' active' : ''}${!hasToc ? ' disabled' : ''}`}
                  onClick={() => hasToc && setSidebarMode('toc')}
                  disabled={!hasToc}
                  title={!hasToc ? 'No headings in this document' : undefined}
                >
                  Contents
                </button>
              </div>
              {sidebarMode === 'files' ? (
                <FileBrowser
                  currentFile={filePath}
                  currentDir={currentDir}
                  recentFiles={recentFiles}
                  onFileSelect={loadFile}
                  onDirChange={setCurrentDir}
                />
              ) : (
                <Toc items={tocItems} activeId={activeId} />
              )}
            </aside>
          )}

          {/* Content: preview or split editor */}
          {editMode ? (
            <div className="editor-split">
              <div className="editor-pane">
                <textarea
                  ref={textareaRef}
                  className="editor-textarea"
                  value={rawContent}
                  spellCheck={false}
                  onChange={(e) => { setRawContent(e.target.value); setIsDirty(true); }}
                  onKeyDown={onTextareaKeyDown}
                  onScroll={(e) => {
                    if (syncingRef.current) return;
                    const src = e.currentTarget;
                    const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight);
                    const dst = contentRef.current;
                    if (dst) {
                      syncingRef.current = true;
                      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
                      requestAnimationFrame(() => { syncingRef.current = false; });
                    }
                  }}
                />
              </div>
              <div className="editor-divider" />
              <main
                className="editor-preview content-wrapper"
                ref={contentRef}
                onScroll={(e) => {
                  if (syncingRef.current) return;
                  const src = e.currentTarget;
                  const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight);
                  const dst = textareaRef.current;
                  if (dst) {
                    syncingRef.current = true;
                    dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
                    requestAnimationFrame(() => { syncingRef.current = false; });
                  }
                }}
              >
                {preview}
              </main>
            </div>
          ) : (
            <main className="content-wrapper" ref={contentRef}>
              {preview}
            </main>
          )}
        </div>
      )}

      {isDragging && <div className="drop-overlay">Drop your markdown file here</div>}
      <div className={`toast${savedToast ? ' toast-visible' : ''}`}>✓ Saved</div>

      {showAbout && (
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-logo">M</span>
              <span className="modal-app-name">Marka</span>
              {appVersion && <span className="modal-version">v{appVersion}</span>}
            </div>
            <div className="modal-body">
              <p className="modal-dev-label">Developed by</p>
              <p className="modal-dev-name">WebCMS Sàrl</p>
              <a
                className="modal-dev-link"
                href="https://webcms.lu"
                onClick={(e) => { e.preventDefault(); openUrl('https://webcms.lu'); }}
              >
                webcms.lu
              </a>
            </div>
            <div className="modal-footer">
              <span>© 2026 WebCMS Sàrl · GPL v3</span>
            </div>
            <button className="modal-close" onClick={() => setShowAbout(false)} title="Close">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
