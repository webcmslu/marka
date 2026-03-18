import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface FileBrowserProps {
  currentFile: string;
  currentDir: string;
  recentFiles: string[];
  onFileSelect: (path: string) => void;
  onDirChange: (dir: string) => void;
}

function basename(path: string) {
  return path.split('/').pop() ?? path;
}

function parentDir(path: string) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

function shortenPath(path: string) {
  // Replace /Users/<name> with ~ on macOS
  return parentDir(path).replace(/^\/Users\/[^/]+/, '~');
}

export function FileBrowser({ currentFile, currentDir, recentFiles, onFileSelect, onDirChange }: FileBrowserProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);

  useEffect(() => {
    if (!currentDir) return;
    invoke<FileEntry[]>('list_dir', { path: currentDir })
      .then(setEntries)
      .catch(console.error);
  }, [currentDir]);

  const canGoUp = currentDir.length > 1;
  const recentToShow = recentFiles.filter(p => p !== currentFile).slice(0, 5);

  return (
    <div className="file-browser">
      {currentDir && (
        <div className="fb-header">
          <button
            className="fb-up-btn"
            disabled={!canGoUp}
            onClick={() => onDirChange(parentDir(currentDir))}
            title="Parent folder"
          >
            ↑
          </button>
          <span className="fb-dir-name" title={currentDir}>
            {basename(currentDir) || '/'}
          </span>
        </div>
      )}

      {!currentDir && recentToShow.length === 0 && (
        <div className="fb-empty-state">Open a file to browse its folder</div>
      )}

      {recentToShow.length > 0 && (
        <div className="fb-section">
          <div className="fb-section-title">Recent</div>
          {recentToShow.map((p) => (
            <button
              key={p}
              className={`fb-item fb-file fb-item-recent${p === currentFile ? ' active' : ''}`}
              onClick={() => onFileSelect(p)}
              title={p}
            >
              <span className="fb-icon">📄</span>
              <span className="fb-item-info">
                <span className="fb-name">{basename(p)}</span>
                <span className="fb-path">{shortenPath(p)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {currentDir && (
        <div className="fb-section">
          {recentToShow.length > 0 && <div className="fb-section-title">Files</div>}
          {entries.map((entry) => (
            <button
              key={entry.path}
              className={`fb-item ${entry.is_dir ? 'fb-dir' : 'fb-file'}${entry.path === currentFile ? ' active' : ''}`}
              onClick={() => (entry.is_dir ? onDirChange(entry.path) : onFileSelect(entry.path))}
              title={entry.path}
            >
              <span className="fb-icon">{entry.is_dir ? '📁' : '📄'}</span>
              <span className="fb-name">{entry.name}</span>
              {entry.is_dir && <span className="fb-chevron">›</span>}
            </button>
          ))}
          {entries.length === 0 && (
            <div className="fb-empty">No markdown files here</div>
          )}
        </div>
      )}
    </div>
  );
}
