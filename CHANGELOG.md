# Changelog

All notable changes to Marka are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.1.5] — 2026-03-23

### Added
- Update checker: on startup Marka fetches the latest GitHub release and shows a green badge on the About button plus a download banner inside the modal when a newer version is available.

---

## [1.1.4] — 2026-03-23

### Added
- Scroll sync is now bidirectional: the pane the mouse is over drives the other. Moving the cursor into the preview syncs the editor to it, and vice versa.

### Fixed
- Scroll position no longer jumps to the top after the debounced preview re-render.

---

## [1.1.3] — 2026-03-23

### Added
- Resizable sidebar: drag the right edge to adjust width (160–480 px, persisted across sessions).
- Collapsible Recent files section in the Files tab (state persisted across sessions).

---

## [1.1.2] — 2026-03-23

### Added
- Synchronized scrolling between the editor and preview panes in edition mode.

---

## [1.1.1]

### Fixed
- Minor bug fixes and stability improvements.

---

## [1.1.0]

### Added
- Edition mode: live split-pane editor with debounced preview.
- Keyboard shortcut support (⌘S save, ⌘N new, ⌘F search, ⌘P print).
- Tab key inserts two spaces in the editor textarea.

---

## [1.0.0]

### Added
- Initial release.
- Markdown viewer with GitHub-flavoured rendering and syntax highlighting.
- File browser with directory navigation and recent files.
- Table of contents with scroll tracking.
- Full in-document text search with highlighted matches.
- Six themes: GitHub Light, GitHub Dark, Dracula, Nord, Solarized, Monokai.
- Font size controls.
- Print support.
- About modal.
- Drag-and-drop to open files.
- macOS, Linux and Windows builds via Tauri.
