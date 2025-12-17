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
# Initialize a new slides.md template with all syntax examples
bun run packages/cli/dist/index.js init
bun run packages/cli/dist/index.js init -o my-slides.md  # custom filename
bun run packages/cli/dist/index.js init --force          # overwrite existing

# WebSocket mode: Start CLI server (waits for Plugin connection on port 4141)
# Watch mode is enabled by default - auto-reloads on file changes
bun run packages/cli/dist/index.js serve examples/sample.md

# WebSocket options (default host is 127.0.0.1 for security)
bun run packages/cli/dist/index.js serve slides.md --host 127.0.0.1 --port 4141

# Disable watch mode
bun run packages/cli/dist/index.js serve slides.md --no-watch

# Remote access (requires explicit flag for non-loopback hosts)
bun run packages/cli/dist/index.js serve slides.md --host 0.0.0.0 --allow-remote

# Authentication (auto-generated secret shown in CLI output for remote connections)
bun run packages/cli/dist/index.js serve slides.md --secret my-secret

# JSON output mode: Parse Markdown and output JSON (no server)
bun run packages/cli/dist/index.js build examples/sample.md              # stdout
bun run packages/cli/dist/index.js build examples/sample.md -o out.json  # file
```

## Architecture

```
CLI (WebSocket Server)  <--->  Figma Plugin (WebSocket Client)
      port 4141                      ui.html connects
```

**WebSocket Data Flow:**
1. CLI reads Markdown file
2. remark parses to AST, converts to `SlideContent[]`
3. CLI starts WebSocket server on port 4141
4. Plugin UI connects via WebSocket
5. CLI sends `{ type: "generate-slides", slides: [...] }`
6. Plugin creates slides via `figma.createSlide()`

**JSON Import Flow (CLI-free):**
1. CLI `build` command outputs JSON to file or stdout
2. User loads JSON in Plugin via "Import JSON" tab (paste or file picker)
3. Plugin validates JSON schema and sends to code.ts
4. Plugin creates slides via `figma.createSlide()`

**Note:** The original plan had Plugin as WebSocket server, but Figma Plugin sandbox constraints required inverting this - CLI is server, Plugin is client.

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
  align?: HorizontalAlign;        // "left" | "center" | "right"
  valign?: VerticalAlign;         // "top" | "middle" | "bottom"
  transition?: SlideTransitionConfig;  // Slide transition animation
}

interface BulletItem {
  text: string;
  spans?: TextSpan[];
  children?: BulletItem[];  // Nested bullet items
}

type SlideBlockItem =
  | { kind: "paragraph"; text: string; spans?: TextSpan[] }
  | { kind: "heading"; level: 3 | 4; text: string; spans?: TextSpan[] }
  | { kind: "bullets"; items: BulletItem[]; ordered?: boolean; start?: number }
  | { kind: "code"; language?: string; code: string }
  | { kind: "image"; url: string; alt?: string; size?: { width?: number; height?: number }; position?: { x?: number; y?: number } }
  | { kind: "blockquote"; text: string; spans?: TextSpan[] }
  | { kind: "table"; headers: TextSpan[][]; rows: TextSpan[][][]; align?: TableAlignment[] }
  | { kind: "figma"; link: FigmaSelectionLink }

interface ColumnsBlock {
  kind: "columns";
  columns: SlideBlockItem[][];  // Array of columns, each containing blocks
  gap?: number;                  // Gap between columns (default: 32, max: 200)
  widths?: number[];             // Column widths in pixels
}

type SlideBlock = SlideBlockItem | ColumnsBlock

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
  - Supports nested lists with different bullet markers per level
- `### H3`, `#### H4`: sub-headings within slides
- Code blocks (``` with language): syntax highlighted
- Images `![alt](url)`: rendered with actual image data
- Blockquotes `>`: styled with left border
- Tables (GFM): rendered with headers and alignment
- Columns: multi-column layouts (2-4 columns) via `:::columns` blocks
- Callouts: styled message boxes via `:::note`, `:::tip`, `:::warning`, `:::caution`

### Nested Bullet Lists
```markdown
- Level 0 item
  - Level 1 item (indented with 2 spaces)
    - Level 2 item
      - Level 3 item
- Back to level 0
```

Bullet markers change by nesting level:
- Level 0: `•` (U+2022)
- Level 1: `◦` (U+25E6)
- Level 2: `▪` (U+25AA)
- Level 3+: `–` (U+2013)

### Image Size and Position (Marp-style)
```markdown
![w:400](./image.png)           # Width 400px (height auto)
![h:300](./image.png)           # Height 300px (width auto)
![w:400 h:300](./image.png)     # Fixed size 400x300px
![w:50%](./image.png)           # 50% of slide width (960px)
![w:400 Logo](./image.png)      # Size + alt text
![x:100 y:200](./image.png)     # Absolute position (100px, 200px)
![x:50% y:50%](./image.png)     # Percentage position (center of slide)
![w:300 x:100 y:200](./image.png)  # Size + position combined
```

When x or y is specified, the image is placed at absolute coordinates instead of auto-layout flow.
Percentages use slide dimensions (1920x1080): x:50% = 960px, y:50% = 540px.

### Multi-Column Layouts
```markdown
:::columns [gap=32 width=1fr/2fr]
:::column
Left column content
- Item 1
- Item 2
:::column
Right column content
:::
```

- 2-4 columns supported
- `gap`: pixels between columns (default: 32, max: 200)
- `width`: fr/percentage/px values separated by `/`
- Each column can contain paragraphs, lists, code, images, tables, blockquotes, headings, callouts
- Minimum column width: 320px (falls back to vertical stacking if below)

### Callouts
```markdown
:::note
This is a note with helpful information.
:::

:::tip
A helpful tip for users.
:::

:::warning
Be careful with this feature.
:::

:::caution
This action is irreversible!
:::
```

Callout types and colors:
- **note** (blue): General information
- **tip** (green): Helpful suggestions
- **warning** (orange): Important warnings
- **caution** (red): Critical warnings

Supports inline formatting (bold, italic, links, code).

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
figdeck: true                   # Required for VSCode extension to recognize file
background: "#1a1a2e"           # Solid color (auto-detect)
background: "#0d1117:0%,#58a6ff:100%@45"  # Gradient (auto-detect)
background: "./bg.png"          # Local image (auto-detect)
background: "https://figma.com/...?node-id=123-456"  # Figma component (auto-detect)
background:                     # Object format (explicit)
  color: "#1a1a2e"              # Solid color
  gradient: "#0d1117:0%,#58a6ff:100%@45"  # Gradient with angle
  template: "Style Name"        # Figma paint style name
  image: "./bg.png"             # Local image (PNG, JPEG, GIF) or URL
  component:                    # Figma Component/Frame as background
    link: "https://www.figma.com/design/xxx?node-id=123-456"
    fit: "cover"                # cover | contain | stretch
    align: "center"             # center | top-left | top-right | bottom-left | bottom-right
    opacity: 0.8                # 0-1
color: "#ffffff"                # Base text color for all elements
headings:
  h1: { size: 72, color: "#fff" }
  h2: { size: 56 }
paragraphs: { size: 24, color: "#ccc", x: 100, y: 400 }  # Absolute position (slide is 1920x1080)
bullets: { size: 20, x: 100, y: 600, spacing: 12 }  # spacing: gap between bullet items
fonts:                              # Custom font configuration
  h1:                               # Full font variant config
    family: "Roboto"
    style: "Medium"                 # Base style (default: "Regular")
    bold: "Bold"                    # Bold variant (default: "Bold")
    italic: "Italic"                # Italic variant (default: "Italic")
    boldItalic: "Bold Italic"       # Bold Italic variant
  h2: "Open Sans"                   # Shorthand: just family name (uses "Regular")
  body:
    family: "Source Sans Pro"
    style: "Regular"
    bold: "Semibold"                # Custom bold variant
  bullets:
    family: "Inter"
    style: "Regular"
code: { size: 14 }
slideNumber:
  show: true
  position: bottom-right        # bottom-right, bottom-left, top-right, top-left
  size: 14
  color: "#888"
  format: "{{current}} / {{total}}"
  link: "https://www.figma.com/design/xxx?node-id=789-012"  # Custom Frame design (optional)
  startFrom: 2                  # Start showing from slide 2 (default: 2, skips cover)
  # offset is auto-calculated so slide 2 displays as "1"
titlePrefix:
  link: "https://www.figma.com/design/xxx?node-id=123-456"  # Figma component link
  spacing: 16                   # Gap between prefix and title (default: 16)
titlePrefix: false              # Disable inherited prefix for this slide
align: center                   # Horizontal: left, center, right (default: left)
valign: middle                  # Vertical: top, middle, bottom (default: top)
transition: dissolve            # Shorthand: style only
transition: slide-from-right 0.5  # Shorthand: style and duration
transition:                     # Full configuration
  style: slide-from-right       # Animation style (see list below)
  duration: 0.5                 # Duration in seconds (0.01-10)
  curve: ease-out               # Easing curve
  timing:
    type: after-delay           # on-click (default) or after-delay
    delay: 3                    # Auto-advance delay in seconds (0-30)
---
```

**Background Priority (object format):** template > gradient > color > image

**Transition Styles:** `none`, `dissolve`, `smart-animate`, `slide-from-*`, `push-from-*`, `move-from-*`, `slide-out-to-*`, `move-out-to-*` (where * = left, right, top, bottom)

**Transition Curves:** `ease-in`, `ease-out`, `ease-in-and-out`, `linear`, `gentle`, `quick`, `bouncy`, `slow`

### Figma Link Block

Embed references to Figma nodes:

```markdown
:::figma
link=https://www.figma.com/design/xxx?node-id=1234-5678
x=160
y=300
:::
```

With text layer overrides (supports rich formatting):

```markdown
:::figma
link=https://www.figma.com/design/xxx?node-id=1234-5678
text.title=Cart Feature
text.body=Use this for **cart** and *confirmation* flows.
text.list=
  - Variation A
  - Variation B
hideLink=true
:::
```

Supported text override formatting: **bold**, *italic*, ~~strikethrough~~, [links](url), bullet lists, blockquotes. Code blocks are NOT supported due to Figma text layer limitations.

## Package Structure

- `packages/cli/` - CLI that parses Markdown and runs WebSocket server
- `packages/plugin/` - Figma Plugin with UI that connects to CLI
- `examples/` - Sample Markdown files
  - `sample.md` - Basic example
  - `font-sizes.md` - Custom font sizing
  - `fonts.md` - Custom font family configuration
  - `slide-numbers.md` - Slide number configuration
  - `figma-links.md` - Figma node embedding
  - `backgrounds.md` - All background types (color, gradient, image, template, Figma component)
  - `rich-formatting.md` - Inline formatting
  - `transitions.md` - Slide transition animations
  - `images.md` - Image size and position specifications (Marp-style)
  - `bullets.md` - Nested bullet lists
  - `columns.md` - Multi-column layouts (2-4 columns)
  - `callouts.md` - Note, tip, warning, caution callout blocks

## Figma Plugin JavaScript Constraints

Figma Plugin runs in a sandboxed JavaScript environment with limited ES version support. The plugin is built with esbuild targeting **ES2016** to ensure compatibility.

Modern syntax automatically transpiled:
- `{ ...obj }` (object spread) → `Object.assign()`
- `[...arr]` (array spread in certain contexts) → `Array.prototype.slice.call()`
- `??` (nullish coalescing) → ternary operator
- `?.` (optional chaining) → explicit checks
- `catch {}` (empty catch) → `catch (_e) {}`

Do not change the `--target=es2016` flag in the plugin build script.

## Security

The CLI and Plugin implement security hardening for network exposure:

**CLI (serve command):**
- Default host is `127.0.0.1` (loopback only)
- `--allow-remote` flag required for non-loopback hosts (e.g., `0.0.0.0`)
- `--secret <secret>` enables authentication handshake
- Auto-generates secret for remote connections (displayed in CLI output)
- `--no-auth` disables authentication (not recommended for remote)
- WebSocket `maxPayload` limited to 10MB

**Plugin UI:**
- Default host is `127.0.0.1`
- Secret input field for authentication
- Warning banner displayed for non-loopback connections
- Payload validation: max 100 slides, max 50 blocks per slide
- Log entries capped at 100 to prevent memory growth

**Figma URL validation:**
- Strict hostname check: must be `figma.com` or `*.figma.com`
- Blocks spoofed hostnames like `evilfigma.com`

## Development Guidelines

### Backward Compatibility

When modifying files, always consider backward compatibility:

- Avoid breaking changes to existing APIs and interfaces
- When changing function signatures, maintain support for the old signature if possible
- When renaming exports, keep old names as aliases
- Document any breaking changes clearly
- Consider migration paths for users of the existing code

### Documentation Updates

Always keep documentation in sync with code changes:

- Update relevant markdown files in `packages/docs/src/content/docs/` when features change
- Update `CLAUDE.md` when architecture or commands change
- Update example files in `examples/` when syntax changes
- Update type definitions and comments when APIs change
