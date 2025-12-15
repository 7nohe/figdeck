# figdeck VS Code Extension

VS Code extension for [figdeck](https://github.com/7nohe/figdeck) - Markdown to Figma Slides.

## Features

### Snippets

Quick insertion of figdeck-specific syntax:

- `figdeck-global` - Global frontmatter with background, color, align, valign
- `figdeck-slide` - New slide with separator
- `figdeck-transition` - Slide with transition animation
- `:::columns2/3/4` - Column layouts (2-4 columns)
- `:::figma` - Figma link block
- `figdeck-gradient` - Gradient background
- And more...

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

Commands:
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

Run figdeck commands from VS Code:

- `figdeck: Init slides.md` - Create new slides file
- `figdeck: Build JSON (current file)` - Build to JSON
- `figdeck: Start Serve` - Start WebSocket server
- `figdeck: Stop Serve` - Stop WebSocket server
- `figdeck: Restart Serve` - Restart WebSocket server
- `figdeck: Show Output` - Show output channel

Status bar shows serve status and port.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `figdeck.cli.command` | `null` | Custom CLI command (e.g., `["bunx", "figdeck"]`) |
| `figdeck.serve.host` | `"127.0.0.1"` | Host for serve command |
| `figdeck.serve.port` | `4141` | Port for serve command |
| `figdeck.diagnostics.enabled` | `true` | Enable diagnostics |
| `figdeck.diagnostics.debounceMs` | `300` | Debounce time for diagnostics |
| `figdeck.images.maxSizeMb` | `5` | Maximum image file size in MB |

## CLI Detection

The extension looks for figdeck CLI in this order:

1. `node_modules/.bin/figdeck` in workspace
2. `figdeck` in PATH
3. `figdeck.cli.command` setting

If not found, you'll be prompted to install or configure it.

## Development

```bash
# Build extension
cd packages/vscode
bun run build

# Watch mode
bun run dev

# Type check
bun run typecheck
```

### Debugging

1. Open VS Code in the figdeck workspace
2. Press F5 to launch Extension Development Host
3. Open a Markdown file to activate the extension

## License

MIT
