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
// Shared between CLI and Plugin
interface SlideContent {
  type: "title" | "content";
  title?: string;
  body?: string[];
  bullets?: string[];
}
```

## Markdown Parsing Rules

- `---` (thematicBreak): slide separator
- `# H1`: creates title slide (`type: "title"`)
- `## H2`: creates content slide (`type: "content"`)
- Paragraphs: added to `body[]`
- Lists: added to `bullets[]`

## Package Structure

- `packages/cli/` - CLI that parses Markdown and runs WebSocket server
- `packages/plugin/` - Figma Plugin with UI that connects to CLI
- `examples/` - Sample Markdown files

## Figma Plugin JavaScript Constraints

Figma Plugin runs in a sandboxed JavaScript environment with limited ES version support. The plugin is built with esbuild targeting **ES2018** to ensure compatibility.

Modern syntax automatically transpiled:
- `??` (nullish coalescing) → ternary operator
- `?.` (optional chaining) → explicit checks
- `catch {}` (empty catch) → `catch (_e) {}`

Do not change the `--target=es2018` flag in the plugin build script.
