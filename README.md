<p align="center">
  <img src="https://github.com/7nohe/figdeck/raw/main/images/logo.svg" width="300" alt="figdeck">
</p>


# figdeck

Convert Markdown to Figma Slides with CLI + Plugin

[日本語](./README.ja.md)

## Overview

figdeck is a tool that automatically generates Figma Slides from Markdown files. The CLI parses Markdown and communicates with the Figma Plugin via WebSocket to create slides.

## Installation

### Figma Plugin

Install the figdeck plugin from Figma Community:

**[figdeck - Figma Community](https://www.figma.com/community/plugin/1577342026252824260/figdeck)**

### CLI

```bash
# Install globally
npm install -g figdeck

# Or use directly with npx/bunx
npx figdeck@latest your-slides.md
bunx figdeck@latest your-slides.md
```

## Usage

### Quick Start

```bash
# Create a template slides.md with all syntax examples
npx figdeck@latest init

# Start the server
npx figdeck@latest slides.md
```

### Method 1: WebSocket Connection (Live Reload Support)

> [!NOTE]
> WebSocket connection requires **Figma Desktop app**. The web browser version cannot connect to localhost due to security restrictions.

```bash
# Start WebSocket server with CLI (watch mode enabled by default)
npx figdeck@latest your-slides.md

# Or explicitly use serve command
npx figdeck@latest serve your-slides.md

# Disable watch mode
npx figdeck@latest your-slides.md --no-watch
```

1. Open the figdeck plugin in Figma Desktop
2. Connect to CLI from the "WebSocket" tab in the Plugin
3. Slides are automatically generated

### Method 2: JSON Import (Works on Desktop & Web)

```bash
# Output JSON from Markdown
npx figdeck@latest build your-slides.md -o slides.json
```

1. Open the figdeck plugin in Figma
2. Select the "Import JSON" tab in the Plugin
3. Paste JSON or select a file to load
4. Click "Generate Slides" to create slides

## Markdown Syntax

```markdown
---
# Title Slide

Subtitle or message

---
## Content Slide

Body text

- Bullet point 1
- Bullet point 2
- Bullet point 3

---
# Summary

Thank you for your attention
```

### Slide Separator

- `---` (horizontal rule) separates slides

### Headings

- `# H1` → Title slide (large font)
- `## H2` → Content slide

### Body

- Paragraphs → Added as body text
- Lists → Added as bullet points

### Slide Style Settings

You can set background color and text color using YAML frontmatter.

#### Global Settings (File Header)

```markdown
---
background: "#1a1a2e"
color: "#ffffff"
---

# Dark background & white text for all slides
```

#### Per-Slide Settings

Add frontmatter at the beginning of each slide to override:

```markdown
---

---
background: "#3b82f6"
color: "#ffffff"
---

# Only this slide has blue background
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `background` | Background color | `"#1a1a2e"` |
| `gradient` | Gradient | `"#000:0%,#fff:100%@90"` |
| `template` | Figma paint style | `"Background/Dark"` |
| `color` | Text color | `"#ffffff"` |

#### Gradient Syntax

```
#color1:position1%,#color2:position2%,...@angle
```

- `color`: Color (hex or rgb/rgba)
- `position`: Position (0-100%)
- `angle`: Angle (degrees), defaults to 0 if omitted

#### Priority

Per-slide frontmatter > Global frontmatter

## CLI Commands

### `init` - Create Template

```bash
figdeck init [options]

Options:
  -o, --out <path>  Output file path (default: "slides.md")
  -f, --force       Overwrite existing file
  -h, --help        Show help
```

Creates a template `slides.md` with examples of all supported Markdown syntax.

### `build` - JSON Output

```bash
figdeck build <file> [options]

Options:
  -o, --out <path>  Output file path (stdout if omitted)
  -h, --help        Show help
```

### `serve` - WebSocket Server

```bash
figdeck serve <file> [options]

Options:
  --host <host>      WebSocket host (default: "localhost")
  -p, --port <port>  WebSocket port (default: "4141")
  --no-watch         Disable file watching (enabled by default)
  --allow-remote     Allow connections from non-loopback hosts
  --secret <secret>  Authentication secret for remote connections
  -h, --help         Show help
```

> [!WARNING]
> When using `--allow-remote`, port `4141` is exposed to your network. Use `--secret` to require authentication.

## Project Structure

```
figdeck/
├── packages/
│   ├── cli/          # CLI package
│   ├── plugin/       # Figma Plugin
│   └── docs/         # Documentation site
├── examples/         # Sample Markdown files
└── README.md
```

## Documentation

- [Markdown Specification](packages/docs/src/content/docs/en/markdown-spec.md) - Supported Markdown syntax
- [API Reference](packages/docs/src/content/docs/en/api-reference.md) - CLI commands and type definitions
- [Architecture](packages/docs/src/content/docs/en/architecture.md) - System architecture and data flow
- [Plugin Setup](packages/docs/src/content/docs/en/plugin-setup.md) - Figma Plugin installation guide

## Development

```bash
# CLI watch mode
cd packages/cli && bun run dev

# Plugin watch mode
cd packages/plugin && bun run watch
```

## License

MIT
