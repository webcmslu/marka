# Marka

A clean, fast Markdown viewer and editor for macOS, Linux and Windows, built with [Tauri 2](https://tauri.app) and React.

## Features

- **View & Edit** — Live split-pane editor with instant preview
- **New / Open / Save** — Create new files, open existing ones, save with native dialogs
- **File Browser** — Sidebar with directory navigation and recent files
- **Table of Contents** — Auto-generated from headings, with scroll tracking
- **Search** — In-document text search with highlighting (`⌘F`)
- **Print** — Print any document via your system browser (`⌘P`)
- **Themes** — GitHub Light, GitHub Dark, Dracula, Nord, Solarized, Monokai
- **Font Size** — Adjustable reading size
- **Drag & Drop** — Drop a `.md` file directly onto the window
- **File Associations** — Set Marka as the default app for Markdown files

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘N` | New file |
| `⌘S` | Save |
| `⌘F` | Search |
| `⌘P` | Print |

## Requirements

- macOS 11 or later
- [Node.js](https://nodejs.org) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Tauri CLI v2

## Getting Started

```bash
# Clone the repository
git clone https://github.com/webcmslu/marka.git
cd marka

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The compiled app will be in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri 2](https://tauri.app) |
| Frontend | [React 19](https://react.dev) + TypeScript |
| Build tool | [Vite](https://vitejs.dev) |
| Backend | Rust |
| Markdown parser | [marked](https://marked.js.org) |
| Syntax highlighting | [highlight.js](https://highlightjs.org) |
| Markdown CSS | [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) |

## Project Structure

```
marka/
├── src/                  # React frontend
│   ├── App.tsx           # Main application
│   ├── FileBrowser.tsx   # File & directory browser
│   ├── Search.tsx        # In-document search
│   ├── Toc.tsx           # Table of contents
│   └── themes.ts         # Theme definitions
├── src-tauri/            # Rust / Tauri backend
│   ├── src/lib.rs        # Tauri commands
│   ├── tauri.conf.json   # App configuration
│   └── capabilities/     # Permission configuration
└── index.html
```

## Platforms

Marka builds and runs on macOS, Linux, and Windows.

| Platform | Output |
|----------|--------|
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Linux | `.deb`, `.rpm`, `.AppImage` |
| Windows | `.msi`, `.exe` |

## Releasing

Releases are automated via GitHub Actions (`.github/workflows/release.yml`). The workflow triggers on any `v*` tag, builds for all platforms in parallel, and creates a **draft release** on GitHub with all artifacts attached.

### Steps to publish a new release

**1. Bump the version** in all three files:

```
package.json
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
```

**2. Commit the version bump:**

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 1.2.0"
```

**3. Tag the commit and push:**

```bash
git tag v1.2.0
git push origin main --tags
```

**4. Review and publish the draft release** on GitHub:

Go to `https://github.com/webcmslu/marka/releases`, review the draft, edit the release notes if needed, then click **Publish release**.

> The draft is created automatically — nothing is public until you explicitly publish it.

### What the CI builds

Each release run spins up 4 parallel runners:

```
macos-latest  →  aarch64 (Apple Silicon)  →  .dmg
macos-latest  →  x86_64  (Intel)          →  .dmg
ubuntu-22.04  →                           →  .deb / .rpm / .AppImage
windows-latest →                          →  .msi / .exe
```

The `GITHUB_TOKEN` is provided automatically by GitHub Actions — no secrets to configure.

## Versioning

This project follows [Semantic Versioning](https://semver.org). The version is kept in sync across `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.

## License

GPL v3 — see [LICENSE](LICENSE) for details.

## Author

**WebCMS Sàrl** — [webcms.lu](https://webcms.lu)
