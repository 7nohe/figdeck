# API Reference

## CLI

### Commands

#### `init` - Create Template

Creates a template `slides.md` with examples of all supported Markdown syntax.

```bash
figdeck init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --out <path>` | Output file path | `slides.md` |
| `-f, --force` | Overwrite existing file | - |
| `-h, --help` | Show help | - |

**Examples:**

```bash
# Create slides.md in current directory
figdeck init

# Create with custom filename
figdeck init -o presentation.md

# Overwrite existing file
figdeck init --force
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

## Type Definitions

### SlideContent

Type representing slide content.

```typescript
interface SlideContent {
  type: "title" | "content";
  title?: string;
  body?: string[];
  bullets?: string[];
  codeBlocks?: CodeBlock[];
  blocks?: SlideBlock[];
  background?: SlideBackground;
  styles?: SlideStyles;
  slideNumber?: SlideNumberConfig;
  align?: HorizontalAlign;
  valign?: VerticalAlign;
}

type HorizontalAlign = "left" | "center" | "right";
type VerticalAlign = "top" | "middle" | "bottom";
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `"title" \| "content"` | Slide type |
| `title` | `string?` | Slide title |
| `body` | `string[]?` | Body text array |
| `bullets` | `string[]?` | Bullet points array |
| `codeBlocks` | `CodeBlock[]?` | Code blocks array |
| `blocks` | `SlideBlock[]?` | Rich content blocks array |
| `background` | `SlideBackground?` | Background settings |
| `styles` | `SlideStyles?` | Font size and color settings |
| `slideNumber` | `SlideNumberConfig?` | Slide number settings |
| `align` | `HorizontalAlign?` | Horizontal alignment (default: left) |
| `valign` | `VerticalAlign?` | Vertical alignment (default: top) |

### SlideBlock

Union type representing content blocks within a slide.

```typescript
type SlideBlock =
  | { kind: "paragraph"; text: string; spans?: TextSpan[] }
  | { kind: "heading"; level: 3 | 4; text: string; spans?: TextSpan[] }
  | { kind: "bullets"; items: string[]; ordered?: boolean; start?: number; itemSpans?: TextSpan[][] }
  | { kind: "code"; language?: string; code: string }
  | { kind: "image"; url: string; alt?: string }
  | { kind: "blockquote"; text: string; spans?: TextSpan[] }
  | { kind: "table"; headers: TextSpan[][]; rows: TextSpan[][][]; align?: TableAlignment[] }
  | { kind: "figma"; link: FigmaSelectionLink }
```

### TextSpan

Text span with inline formatting information.

```typescript
interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}
```

### SlideBackground

Slide background settings.

```typescript
interface SlideBackground {
  solid?: string;              // Solid color (e.g., "#1a1a2e")
  gradient?: {
    stops: GradientStop[];     // Gradient color stops
    angle?: number;            // Angle (degrees)
  };
  templateStyle?: string;      // Figma Paint Style name
  image?: BackgroundImage;     // Background image
}

interface GradientStop {
  color: string;
  position: number;            // 0-1
}

interface BackgroundImage {
  url: string;                 // Image path or URL
  mimeType?: string;           // MIME type
  dataBase64?: string;         // Base64 encoded image data
  source?: "local" | "remote"; // Source type
}
```

**Priority:** templateStyle > gradient > solid > image

### SlideStyles

Font size, color, and font family settings.

```typescript
interface SlideStyles {
  headings?: {
    h1?: TextStyle;
    h2?: TextStyle;
    h3?: TextStyle;
    h4?: TextStyle;
  };
  paragraphs?: TextStyle;
  bullets?: TextStyle;
  code?: TextStyle;
  fonts?: FontConfig;          // Custom font configuration
}

interface TextStyle {
  size?: number;               // Font size (1-200)
  color?: string;              // Color (hex or rgb/rgba)
  x?: number;                  // Absolute X position in pixels (slide is 1920x1080)
  y?: number;                  // Absolute Y position in pixels (slide is 1920x1080)
}
```

### FontConfig

Custom font configuration for text elements.

```typescript
interface FontConfig {
  h1?: FontVariant;            // Font for H1 headings
  h2?: FontVariant;            // Font for H2 headings
  h3?: FontVariant;            // Font for H3 headings
  h4?: FontVariant;            // Font for H4 headings
  body?: FontVariant;          // Font for body paragraphs
  bullets?: FontVariant;       // Font for bullet list items
  code?: FontVariant;          // Font for code blocks and inline code
}

interface FontVariant {
  family: string;              // Font family name (e.g., "Roboto")
  style: string;               // Base font style (default: "Regular")
  bold?: string;               // Bold variant style name (default: "Bold")
  italic?: string;             // Italic variant style name (default: "Italic")
  boldItalic?: string;         // Bold Italic variant style name (default: "Bold Italic")
}
```

### SlideNumberConfig

Slide number settings.

```typescript
interface SlideNumberConfig {
  show?: boolean;
  size?: number;
  color?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  paddingX?: number;
  paddingY?: number;
  format?: string;             // e.g., "{{current}} / {{total}}"
  link?: string;               // Figma Frame/Component link for custom design
  nodeId?: string;             // Figma node ID (auto-extracted from link)
  startFrom?: number;          // Start showing from this slide number (1-indexed). Default: 2
  offset?: number;             // Offset to add to display number. Default: -(startFrom-1)
}
```

**Default Behavior:**

By default, `startFrom: 2` means page numbers are not displayed on the cover (first slide).
The second slide is automatically displayed as "1" (offset is auto-calculated).

**Customization Examples:**

1. **Show from first slide:**
```yaml
slideNumber:
  show: true
  startFrom: 1
```

2. **Hide on individual slide:**
```yaml
---
slideNumber: false  # Hide on this slide
---
# Section Break
```

3. **Show from third slide (skip cover + table of contents):**
```yaml
slideNumber:
  show: true
  startFrom: 3  # Third slide displays as "1"
```

**Using Custom Design:**

When `link` is specified, the designated Frame/Component is duplicated and used as the slide number.
Text nodes within the Frame are dynamically replaced by name:

- Text node named `{{current}}` or `current` → Current slide number
- Text node named `{{total}}` or `total` → Total slide count

### TitlePrefixConfig

Settings for inserting a component before the title.

```typescript
interface TitlePrefixConfig {
  link?: string;               // Figma component link URL
  nodeId?: string;             // Figma node ID (auto-extracted from link)
  spacing?: number;            // Space between prefix and title (default: 16)
}
```

Specifying a Figma selection link (e.g., `https://www.figma.com/design/xxx?node-id=123-456`) in `link` automatically extracts the `nodeId`.

Title prefix can be set as a template default, specified per slide, or disabled. Use `titlePrefix: false` to explicitly disable.

### GenerateSlidesMessage

Message type sent via WebSocket.

```typescript
interface GenerateSlidesMessage {
  type: "generate-slides";
  slides: SlideContent[];
}
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
| `background` | `string` | Background color (hex) |
| `gradient` | `string` | Gradient (`color:pos%,...@angle` format) |
| `template` | `string` | Figma Paint Style name |
| `backgroundImage` | `string` | Background image (local path or URL) |
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

### Endpoint

```
ws://localhost:4141
```

### Message Format

#### CLI → Plugin: generate-slides

```json
{
  "type": "generate-slides",
  "slides": [
    {
      "type": "title",
      "title": "Slide Title",
      "background": { "solid": "#1a1a2e" },
      "styles": {
        "headings": { "h1": { "size": 72, "color": "#ffffff" } }
      }
    },
    {
      "type": "content",
      "title": "Content Title",
      "blocks": [
        { "kind": "paragraph", "text": "Body text", "spans": [{ "text": "Body text" }] },
        { "kind": "bullets", "items": ["Item 1", "Item 2"], "ordered": false }
      ]
    }
  ]
}
```

#### Plugin → CLI: success

```json
{
  "type": "success",
  "count": 4
}
```

#### Plugin → CLI: error

```json
{
  "type": "error",
  "message": "Error message"
}
```

## Internal Functions

### parseMarkdown

Converts a Markdown string to a SlideContent array.

```typescript
function parseMarkdown(markdown: string): SlideContent[]
```

**Parsing Rules:**

- `---` (thematicBreak): Slide separator
- `# H1`: Start title slide
- `## H2`: Start content slide
- `### H3`, `#### H4`: Sub-heading blocks
- Paragraphs: paragraph blocks
- Lists: bullets blocks (ordered/unordered)
- Code blocks: code blocks (with syntax highlighting)
- Quotes: blockquote blocks
- Tables: table blocks (GFM)
- Images: image blocks
- `:::figma`: figma link blocks
- YAML frontmatter: Background and style settings

### startServer

Starts a WebSocket server and waits for Plugin connections.

```typescript
function startServer(
  slides: SlideContent[],
  options: { host: string; port: number }
): Promise<{
  broadcast: (slides: SlideContent[]) => void;
  close: () => void;
}>
```

**Return Value:**

- `broadcast(slides)`: Sends slide data to all connected clients
- `close()`: Stops the server

### generateSlides (Plugin)

Generates Figma Slides from received slide data.

```typescript
async function generateSlides(slides: SlideContent[]): Promise<void>
```

**Generated Nodes:**

- `figma.createSlide()` creates slide nodes
- `figma.createText()` creates text nodes
- `figma.createFrame()` creates code blocks, tables, and quote blocks
- Font: Inter (Regular/Bold/Italic/Bold Italic) by default, or custom fonts via `fonts` configuration

**Supported Languages for Syntax Highlighting:**

TypeScript, JavaScript, Python, Bash, JSON, CSS, HTML, XML, Go, Rust, SQL
