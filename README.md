# Markdown Clipboard

<img width="128" height="128" alt="clipboard-final-woohoo" src="https://github.com/user-attachments/assets/6975cdfd-fa44-4994-a100-0f1844b93375" />

A VS Code extension that converts HTML on your clipboard to GitHub-Flavored Markdown.

When you copy text from a webview (like Claude Code's chat panel), the clipboard receives rich HTML. This extension converts that HTML to clean Markdown so you can paste it into `.md` files, GitHub comments, Slack, and anywhere else that renders Markdown.

## Usage

**Keyboard shortcut** — Select text and press `Cmd+Shift+C` (macOS) or `Ctrl+Shift+C` (Windows/Linux).

**Right-click** — Select text in a Claude Code webview and choose **Copy as Markdown** from the context menu.

**Command palette** — Run **Clipboard: Copy as Markdown** to convert whatever HTML is currently on your clipboard.

## What it converts

- Fenced code blocks with language annotations (` ```typescript `, ` ```python `, etc.)
- GFM tables, task lists, and strikethrough
- Headings, bold, italic, links, and lists
- Windows CF_HTML clipboard headers (stripped automatically)

## How it works

The extension runs as a [UI extension](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds), executing on your local machine even during Remote SSH sessions. It reads `text/html` from the system clipboard using OS-native tools and converts it with [Turndown](https://github.com/mixmark-io/turndown).

| Platform | Clipboard tool | Install |
|---|---|---|
| macOS | `osascript` | Built-in |
| Windows | PowerShell | Built-in |
| Linux (X11) | `xclip` | `sudo apt install xclip` |
| Linux (Wayland) | `wl-paste` | `sudo apt install wl-clipboard` |

## License

[MIT](LICENSE)
