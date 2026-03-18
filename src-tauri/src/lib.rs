use serde::Serialize;
use tauri::{Emitter, Manager};
use std::sync::Mutex;

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

#[tauri::command]
fn print_document(html: String) -> Result<(), String> {
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
    }}
    pre code {{ background: none; padding: 0; font-size: 100%; }}
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
    @media print {{ body {{ padding: 0; }} }}
  </style>
  <script>window.onload = function() {{ window.print(); }}</script>
</head>
<body>
{html}
</body>
</html>"#);

    let path = std::env::temp_dir().join("marka_print.html");
    std::fs::write(&path, &document).map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd").args(["/C", "start", "", &path.to_string_lossy()]).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingFile(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![read_file, write_file, list_dir, set_window_title, print_document, get_open_file])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    let path: String = url.path().to_string();
                    if !path.is_empty() {
                        // Store for startup fetch (fresh launch)
                        let state = app_handle.state::<PendingFile>();
                        *state.0.lock().unwrap() = Some(path.clone());
                        // Also emit for already-running case
                        app_handle.emit("open-file", path).ok();
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app_handle, event);
        });
}
