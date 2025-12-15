---
title: VS Code Extension
---

## Overview

The figdeck VS Code extension enhances your Markdown editing experience with syntax highlighting, snippets, diagnostics, and integrated CLI commands.

**[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=figdeck.figdeck-vscode)**

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "figdeck"
4. Click Install

Or use Quick Open (Ctrl+P / Cmd+P):

```
ext install figdeck.figdeck-vscode
```

## Features

### Snippets

Quick insertion of figdeck-specific syntax. Type the prefix and press Tab:

| Prefix | Description |
|--------|-------------|
| `figdeck-global` | Global frontmatter with background, color, align, valign |
| `figdeck-slide` | New slide with separator |
| `figdeck-transition` | Slide with transition animation |
| `:::columns2` | 2-column layout |
| `:::columns3` | 3-column layout |
| `:::columns4` | 4-column layout |
| `:::figma` | Figma link block |
| `figdeck-gradient` | Gradient background |

### Syntax Highlighting

Enhanced highlighting for figdeck-specific syntax:

- `:::columns` / `:::column` / `:::figma` directives
- `key=value` attributes (link, gap, width, x, y, hideLink, text.*)
- Image size/position specs (`w:`, `h:`, `x:`, `y:`)

### Slide Outline

Tree view in the Explorer sidebar showing all slides:

- Click to jump to slide
- Shows slide number and title
- Updates automatically on document changes

Navigate between slides with commands:
- `figdeck: Go to Next Slide`
- `figdeck: Go to Previous Slide`

### Diagnostics

Real-time validation of figdeck Markdown:

- Unclosed frontmatter blocks
- Unsupported image formats
- Invalid image size/position values
- Missing `link=` in `:::figma` blocks
- Invalid Figma URLs
- Column count validation
- Gap/width parameter validation

### Quick Fixes

CodeActions to fix common issues:

- Add `link=` property to figma blocks
- Clamp gap to maximum value

### CLI Integration

Run figdeck commands directly from VS Code:

| Command | Description |
|---------|-------------|
| `figdeck: Init slides.md` | Create new slides file |
| `figdeck: Build JSON (current file)` | Build to JSON |
| `figdeck: Start Serve` | Start WebSocket server |
| `figdeck: Stop Serve` | Stop WebSocket server |
| `figdeck: Restart Serve` | Restart WebSocket server |
| `figdeck: Show Output` | Show output channel |

Status bar shows serve status and port.

## Settings

Configure the extension in VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `figdeck.cli.command` | `null` | Custom CLI command (e.g., `["bunx", "figdeck"]`) |
| `figdeck.serve.host` | `"127.0.0.1"` | Host for serve command |
| `figdeck.serve.port` | `4141` | Port for serve command |
| `figdeck.serve.allowRemote` | `false` | Allow remote connections |
| `figdeck.serve.secret` | `""` | Secret for authentication |
| `figdeck.serve.noAuth` | `false` | Disable authentication |
| `figdeck.serve.noWatch` | `false` | Disable file watching |
| `figdeck.diagnostics.enabled` | `true` | Enable diagnostics |
| `figdeck.diagnostics.debounceMs` | `300` | Debounce time for diagnostics |
| `figdeck.images.maxSizeMb` | `5` | Maximum image file size in MB |

## CLI Detection

The extension looks for figdeck CLI in this order:

1. `node_modules/.bin/figdeck` in workspace
2. `figdeck` in PATH
3. `figdeck.cli.command` setting

If not found, you'll be prompted to install or configure it.

## Workflow

1. **Create a new slides file**: Use `figdeck: Init slides.md` command
2. **Edit your Markdown**: Use snippets and syntax highlighting
3. **Start the server**: Use `figdeck: Start Serve` command
4. **Connect Figma Plugin**: Open the figdeck plugin in Figma Slides
5. **Live preview**: Your slides are generated automatically

The extension watches for file changes and updates the Figma plugin in real-time.
