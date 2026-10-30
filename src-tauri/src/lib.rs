use std::path::Path;
use std::sync::Mutex;
use serde::Serialize;
use tauri::{Emitter, Manager};

mod open_file;

use open_file::open_file_from_args;

struct PendingFile(Mutex<Option<String>>);

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = std::fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let path_str = e.path().to_string_lossy().to_string();
            let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let is_md = name.ends_with(".md") || name.ends_with(".markdown");
            if is_dir || is_md {
                Some(FileEntry { name, path: path_str, is_dir })
            } else {
                None
            }
        })
        .collect();

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_title(window: tauri::WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_open_file(state: tauri::State<PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

/// Release asset suffix matching this build (e.g. "aarch64.dmg"), so the update link can
/// point straight at the right installer. `None` when no published asset fits.
#[tauri::command]
fn release_asset_suffix() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Some("aarch64.dmg"),
        ("macos", "x86_64") => Some("x64.dmg"),
        ("windows", "x86_64") => Some("x64-setup.exe"),
        ("linux", "x86_64") => {
            if std::env::var_os("APPIMAGE").is_some() {
                Some("amd64.AppImage")
            } else if Path::new("/etc/debian_version").exists() {
                Some("amd64.deb")
            } else if Path::new("/etc/redhat-release").exists() {
                Some("x86_64.rpm")
            } else {
                None
            }
        }
        _ => None,
    }
}

fn send_open_file(app: &tauri::AppHandle, path: String) {
    let state = app.state::<PendingFile>();
    *state.0.lock().unwrap() = Some(path.clone());
    app.emit("open-file", path).ok();

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
async fn print_document(window: tauri::WebviewWindow, html: String) -> Result<(), String> {
    // On Windows and Linux, print the main window itself: its `@media print` styles show only
    // a light copy of the document (`.print-root`). Earlier versions rendered the document in a
    // separate "Print" window, which kept failing on Windows (frozen or blank window, window
    // closed before the job was sent; see #1).
    #[cfg(not(target_os = "macos"))]
    {
        let _ = html;
        window.eval("window.print()").map_err(|e| e.to_string())
    }

    // macOS's WebView (WKWebView) does NOT implement JavaScript `window.print()`, so open the
    // document in the default `.html` handler instead, which on macOS is reliably a browser.
    #[cfg(target_os = "macos")]
    {
        let _ = window;
        let document = format!(r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #24292e;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }}
    h1, h2 {{ border-bottom: 1px solid #eee; padding-bottom: 0.3em; }}
    h1 {{ font-size: 2em; }}
    h2 {{ font-size: 1.5em; }}
    code {{
      background: #f6f8fa;
      border-radius: 3px;
      font-size: 85%;
      padding: 0.2em 0.4em;
      font-family: 'SFMono-Regular', Consolas, monospace;
    }}
    pre {{
      background: #f6f8fa;
      border-radius: 6px;
      padding: 1rem;
      overflow: auto;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }}
    pre code {{ background: none; padding: 0; font-size: 100%; }}
    pre[data-lang] {{ overflow: visible; }}
    pre[data-lang] code {{
      white-space: pre-wrap;
      word-break: break-word;
      word-wrap: break-word;
    }}
    blockquote {{
      border-left: 4px solid #dfe2e5;
      color: #6a737d;
      margin: 0;
      padding: 0 1rem;
    }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #dfe2e5; padding: 0.5rem 1rem; }}
    th {{ background: #f6f8fa; font-weight: 600; }}
    img {{ max-width: 100%; }}
    @page {{ margin: 1.5cm 2cm; }}
    @media print {{
      body {{ padding: 0; max-width: none; margin: 0; }}
    }}
  </style>
  <script>
    window.onload = function() {{ window.print(); }};
  </script>
</head>
<body>
{html}
</body>
</html>"#);

        let path = std::env::temp_dir().join("marka_print.html");
        std::fs::write(&path, &document).map_err(|e| e.to_string())?;
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's DMA-BUF renderer leaves the window blank on NVIDIA's proprietary
    // driver (GBM buffer creation fails). Fall back to the older renderer there,
    // unless the user has set the variable themselves.
    #[cfg(target_os = "linux")]
    if std::path::Path::new("/proc/driver/nvidia/version").exists()
        && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let args: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    let initial_file =
        open_file_from_args(&args, &cwd).map(|path| path.to_string_lossy().into_owned());

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(path) = open_file_from_args(&args, Path::new(&cwd)) {
                send_open_file(app, path.to_string_lossy().into_owned());
            } else if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .manage(PendingFile(Mutex::new(initial_file)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![read_file, write_file, list_dir, set_window_title, print_document, get_open_file, release_asset_suffix])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    let path: String = url.path().to_string();
                    if !path.is_empty() {
                        send_open_file(app_handle, path);
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app_handle, event);
        });
}
