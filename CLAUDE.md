# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

figdeck converts Markdown files into Figma Slides via a CLI + Figma Plugin architecture. The CLI parses Markdown, starts a WebSocket server, and the Figma Plugin connects as a client to receive slide data and generate slides using `figma.createSlide()`.

## Build Commands

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Build CLI only
cd packages/cli && bun run build

# Build Plugin only
cd packages/plugin && bun run build

# Watch mode for CLI development
cd packages/cli && bun run dev
```

## Running

```bash
# Start CLI server with a Markdown file (waits for Plugin connection on port 4141)
bun run packages/cli/dist/index.js build examples/sample.md

# Options
bun run packages/cli/dist/index.js build slides.md --host localhost --port 4141

# Watch mode - auto-reload on file changes
bun run packages/cli/dist/index.js build slides.md -w
```

## Architecture

```
CLI (WebSocket Server)  <--->  Figma Plugin (WebSocket Client)
      port 4141                      ui.html connects
```

**Data Flow:**
1. CLI reads Markdown file
2. remark parses to AST, converts to `SlideContent[]`
3. CLI starts WebSocket server on port 4141
4. Plugin UI connects via WebSocket
5. CLI sends `{ type: "generate-slides", slides: [...] }`
6. Plugin creates slides via `figma.createSlide()`

**Deviation from PLAN.md:** The original plan had Plugin as WebSocket server, but Figma Plugin sandbox constraints required inverting this - CLI is server, Plugin is client.

## Key Types

```typescript
// Shared between CLI and Plugin (packages/cli/src/types.ts, packages/plugin/src/types.ts)

interface SlideContent {
  type: "title" | "content";
  title?: string;
  body?: string[];
  bullets?: string[];
  codeBlocks?: CodeBlock[];
  blocks?: SlideBlock[];          // Rich content blocks
  background?: SlideBackground;   // Solid, gradient, or template style
  styles?: SlideStyles;           // Font sizes and colors
  slideNumber?: SlideNumberConfig;
}

type SlideBlock =
  | { kind: "paragraph"; text: string; spans?: TextSpan[] }
  | { kind: "heading"; level: 3 | 4; text: string; spans?: TextSpan[] }
  | { kind: "bullets"; items: string[]; ordered?: boolean; start?: number; itemSpans?: TextSpan[][] }
  | { kind: "code"; language?: string; code: string }
  | { kind: "image"; url: string; alt?: string }
  | { kind: "blockquote"; text: string; spans?: TextSpan[] }
  | { kind: "table"; headers: TextSpan[][]; rows: TextSpan[][][]; align?: TableAlignment[] }
  | { kind: "figma"; link: FigmaSelectionLink }

interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}
```

## Markdown Parsing Rules

### Slide Structure
- `---` (thematicBreak): slide separator
- `# H1`: creates title slide (`type: "title"`)
- `## H2`: creates content slide (`type: "content"`)

### Content Blocks
- Paragraphs: added to `body[]` and `blocks[]`
- Lists (ordered/unordered): added to `bullets[]` and `blocks[]`
- `### H3`, `#### H4`: sub-headings within slides
- Code blocks (``` with language): syntax highlighted
- Images `![alt](url)`: rendered as placeholder
- Blockquotes `>`: styled with left border
- Tables (GFM): rendered with headers and alignment

### Inline Formatting
- `**bold**` or `__bold__`
- `*italic*` or `_italic_`
- `~~strikethrough~~`
- `` `inline code` ``
- `[link text](url)`

### YAML Frontmatter

Global settings at file start, or per-slide after `---`:

```yaml
---
background: "#1a1a2e"           # Solid color
gradient: "#0d1117:0%,#1f2937:50%,#58a6ff:100%@45"  # Gradient with angle
template: "Style Name"          # Figma paint style name
color: "#ffffff"                # Base text color for all elements
headings:
  h1: { size: 72, color: "#fff" }
  h2: { size: 56 }
paragraphs: { size: 24, color: "#ccc" }
bullets: { size: 20 }
code: { size: 14 }
slideNumber:
  show: true
  position: bottom-right        # bottom-right, bottom-left, top-right, top-left
  size: 14
  color: "#888"
  format: "{{current}} / {{total}}"
---
```

### Figma Link Block

Embed references to Figma nodes:

```markdown
:::figma
https://www.figma.com/design/xxx?node-id=1234-5678
x=160
y=300
:::
```

## Package Structure

- `packages/cli/` - CLI that parses Markdown and runs WebSocket server
- `packages/plugin/` - Figma Plugin with UI that connects to CLI
- `examples/` - Sample Markdown files
  - `sample.md` - Basic example
  - `font-sizes.md` - Custom font sizing
  - `slide-numbers.md` - Slide number configuration
  - `figma-links.md` - Figma node embedding
  - `backgrounds.md` - Background styles
  - `rich-formatting.md` - Inline formatting

## Figma Plugin JavaScript Constraints

Figma Plugin runs in a sandboxed JavaScript environment with limited ES version support. The plugin is built with esbuild targeting **ES2018** to ensure compatibility.

Modern syntax automatically transpiled:
- `??` (nullish coalescing) → ternary operator
- `?.` (optional chaining) → explicit checks
- `catch {}` (empty catch) → `catch (_e) {}`

Do not change the `--target=es2018` flag in the plugin build script.
