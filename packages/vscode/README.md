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

### Build Commands

```bash
cd packages/vscode

# Build for production (minified)
bun run build

# Build for development (with sourcemaps)
bun run build:dev

# Watch mode for development
bun run dev

# Type check
bun run typecheck

# Run tests
bun test src
```

### Debugging

The project includes VS Code launch configurations in `.vscode/` for debugging the extension.

#### Quick Start

1. Open the figdeck workspace in VS Code
2. Press `F5` (or Run > Start Debugging)
3. Select **"Run Extension"** configuration
4. A new VS Code window (Extension Development Host) will open
5. Open a Markdown file with `figdeck: true` in frontmatter to activate the extension

#### Available Launch Configurations

| Configuration | Description |
|---------------|-------------|
| **Run Extension** | Build once and launch Extension Development Host |
| **Run Extension (Watch)** | Start watch mode and launch Extension Development Host |

#### Available Tasks

Run via `Cmd+Shift+P` > "Tasks: Run Task":

| Task | Description |
|------|-------------|
| `vscode: build dev` | Build with sourcemaps |
| `vscode: watch` | Watch mode (background task) |
| `vscode: build` | Production build |
| `vscode: test` | Run tests |

#### Debugging Tips

- **Breakpoints**: Set breakpoints in `src/` files. Sourcemaps are enabled in dev builds.
- **Console output**: View extension logs in the Debug Console panel.
- **Reload extension**: In the Extension Development Host, run `Developer: Reload Window` to reload after code changes.
- **Watch mode**: Use "Run Extension (Watch)" for automatic rebuilds on file changes.

#### Configuration Files

The debug configuration files are located in the repository root `.vscode/` directory:

<details>
<summary><code>.vscode/launch.json</code></summary>

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/packages/vscode"
      ],
      "outFiles": [
        "${workspaceFolder}/packages/vscode/dist/**/*.js"
      ],
      "sourceMaps": true,
      "preLaunchTask": "vscode: build dev"
    },
    {
      "name": "Run Extension (Watch)",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/packages/vscode"
      ],
      "outFiles": [
        "${workspaceFolder}/packages/vscode/dist/**/*.js"
      ],
      "sourceMaps": true,
      "preLaunchTask": "vscode: watch"
    }
  ]
}
```

</details>

<details>
<summary><code>.vscode/tasks.json</code></summary>

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "vscode: build dev",
      "type": "shell",
      "command": "bun",
      "args": ["run", "build:dev"],
      "options": {
        "cwd": "${workspaceFolder}/packages/vscode"
      },
      "group": "build",
      "problemMatcher": "$esbuild"
    },
    {
      "label": "vscode: watch",
      "type": "shell",
      "command": "bun",
      "args": ["run", "dev"],
      "options": {
        "cwd": "${workspaceFolder}/packages/vscode"
      },
      "isBackground": true,
      "group": "build",
      "problemMatcher": {
        "owner": "esbuild",
        "pattern": {
          "regexp": "^✘ \\[ERROR\\] (.+)$",
          "message": 1
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "^\\[watch\\]",
          "endsPattern": "^\\s*dist/extension\\.js"
        }
      }
    },
    {
      "label": "vscode: build",
      "type": "shell",
      "command": "bun",
      "args": ["run", "build"],
      "options": {
        "cwd": "${workspaceFolder}/packages/vscode"
      },
      "group": "build",
      "problemMatcher": "$esbuild"
    },
    {
      "label": "vscode: test",
      "type": "shell",
      "command": "bun",
      "args": ["test", "src"],
      "options": {
        "cwd": "${workspaceFolder}/packages/vscode"
      },
      "group": "test",
      "problemMatcher": []
    }
  ]
}
```

</details>

## License

MIT
