use std::path::{Path, PathBuf};

const MARKDOWN_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];

pub fn open_file_from_args(args: &[String], cwd: &Path) -> Option<PathBuf> {
    args.iter().skip(1).find_map(|argument| {
        let path = Path::new(argument);
        let is_markdown = path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                MARKDOWN_EXTENSIONS
                    .iter()
                    .any(|supported| extension.eq_ignore_ascii_case(supported))
            });

        if !is_markdown {
            return None;
        }

        Some(if path.is_absolute() {
            path.to_path_buf()
        } else {
            cwd.join(path)
        })
    })
}

#[cfg(test)]
mod tests {
    use super::open_file_from_args;
    use std::path::{Path, PathBuf};

    #[test]
    fn finds_markdown_path_in_desktop_launch_arguments() {
        let args = vec![
            "marka".to_string(),
            "/tmp/project notes/readme.md".to_string(),
        ];

        assert_eq!(
            open_file_from_args(&args, Path::new("/unused")),
            Some(PathBuf::from("/tmp/project notes/readme.md"))
        );
    }

    #[test]
    fn resolves_relative_markdown_path_from_launch_directory() {
        let args = vec!["marka".to_string(), "notes/readme.markdown".to_string()];

        assert_eq!(
            open_file_from_args(&args, Path::new("/tmp/project")),
            Some(PathBuf::from("/tmp/project/notes/readme.markdown"))
        );
    }

    #[test]
    fn ignores_non_markdown_arguments() {
        let args = vec![
            "marka".to_string(),
            "--verbose".to_string(),
            "/tmp/notes.txt".to_string(),
        ];

        assert_eq!(open_file_from_args(&args, Path::new("/tmp")), None);
    }
}
