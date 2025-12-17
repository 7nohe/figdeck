---
title: API Reference
---

## CLI

### Commands

#### `init` - Create Template

Creates a template `slides.md` with examples of all supported Markdown syntax. Optionally generates AI agent rule files for various coding assistants.

```bash
figdeck init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --out <path>` | Output file path | `slides.md` |
| `-f, --force` | Overwrite existing files | - |
| `--ai-rules [targets]` | Generate AI agent rules (agents,claude,cursor,copilot or all) | - |
| `--no-slides` | Skip generating slides.md | - |
| `-h, --help` | Show help | - |

**AI Rules Targets:**

| Target | Generated File | Tool |
|--------|----------------|------|
| `agents` | `AGENTS.md` | Codex CLI, Cursor (AGENTS.md) |
| `claude` | `.claude/rules/figdeck.md` | Claude Code |
| `cursor` | `.cursor/rules/figdeck.mdc` | Cursor |
| `copilot` | `.github/instructions/figdeck.instructions.md` | GitHub Copilot |

**Examples:**

```bash
# Create slides.md in current directory
figdeck init

# Create with custom filename
figdeck init -o presentation.md

# Overwrite existing files
figdeck init --force

# Generate all AI agent rules
figdeck init --ai-rules all

# Generate specific rules only
figdeck init --ai-rules claude,cursor

# Add rules to existing project (keep existing slides.md)
figdeck init --ai-rules all --no-slides
```

#### `build` - JSON Output

Parses Markdown and outputs JSON (one-shot).

```bash
figdeck build <file> [options]
```

| Argument | Description | Required |
|----------|-------------|----------|
| `<file>` | Markdown file path | Yes |

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --out <path>` | Output file path | stdout |
| `-h, --help` | Show help | - |

**Examples:**

```bash
# Output to stdout
figdeck build slides.md

# Output to file
figdeck build slides.md -o slides.json

# Pipe to other commands
figdeck build slides.md | jq '.[] | .title'
```

#### `serve` - WebSocket Server

Starts a WebSocket server and waits for Plugin connections.

```bash
figdeck serve <file> [options]
```

| Argument | Description | Required |
|----------|-------------|----------|
| `<file>` | Markdown file path | Yes |

| Option | Description | Default |
|--------|-------------|---------|
| `--host <host>` | WebSocket host | `localhost` |
| `-p, --port <port>` | WebSocket port | `4141` |
| `-w, --watch` | Watch file changes and auto-update | `false` |
| `-h, --help` | Show help | - |

**Examples:**

```bash
# Basic usage
figdeck serve slides.md

# Specify port
figdeck serve slides.md --port 8080

# Specify host (allow external connections)
figdeck serve slides.md --host 0.0.0.0

# File watch mode (auto-resend on changes)
figdeck serve slides.md -w
```

## YAML Frontmatter

You can set styles using YAML frontmatter at the beginning of the Markdown file or at the beginning of each slide.

### Global Settings (File Header)

```yaml
---
background: "#1a1a2e"
color: "#ffffff"
headings:
  h1: { size: 72, color: "#fff" }
  h2: { size: 56 }
paragraphs: { size: 24 }
slideNumber:
  show: true
  position: bottom-right
---

# First Slide
```

### Per-Slide Settings

```markdown
---

background: "#0d1117"
color: "#58a6ff"
---
## This slide only has different background
```

### Configuration Properties

| Property | Type | Description |
|----------|------|-------------|
| `cover` | `boolean` | Treat the first slide as a cover (default: `true`) |
| `background` | `string \| object` | Unified background config: string (color/gradient/image/component) or object (`color`, `gradient`, `template`, `image`, `component`) |
| `color` | `string` | Base text color (applied to all elements) |
| `headings` | `object` | Heading styles (h1-h4) |
| `paragraphs` | `object` | Paragraph styles |
| `bullets` | `object` | Bullet point styles |
| `code` | `object` | Code block styles |
| `fonts` | `object` | Custom font configuration |
| `slideNumber` | `object \| boolean` | Slide number settings |
| `titlePrefix` | `object \| false` | Title prefix settings |
| `align` | `string` | Horizontal alignment (`left`, `center`, `right`) |
| `valign` | `string` | Vertical alignment (`top`, `middle`, `bottom`) |

## WebSocket API

The CLI communicates with the Figma Plugin via WebSocket on `ws://localhost:4141` (default port).

When you run `figdeck serve`, the CLI automatically sends slide data to connected plugins. You typically don't need to interact with the WebSocket API directly.
