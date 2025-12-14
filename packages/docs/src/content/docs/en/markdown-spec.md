---
title: Markdown Specification
---

This document describes the Markdown syntax supported by figdeck.

## Slide Separator

Use `---` (thematicBreak, horizontal rule) to separate slides.

```markdown
# Slide 1

Content

---

# Slide 2

Content
```

## YAML Frontmatter

YAML frontmatter allows you to configure slide settings. There are two types of configurations:

### Global Settings

Settings at the very beginning of the file (before any content) apply to **all slides** as defaults.

:::note
When using the VSCode extension, add `figdeck: true` to the global frontmatter to enable figdeck features (diagnostics, slide outline, completions). Without this flag, regular markdown files will not be processed by the extension.
:::

```markdown
---
figdeck: true
background: "#1a1a2e"
color: "#ffffff"
transition: dissolve
---

# First Slide

---

## Second Slide
```

In this example, all slides will have the dark background, white text, and dissolve transition.

### Per-Slide Settings

Settings placed immediately after a slide separator (`---`) apply only to **that specific slide**, overriding any global settings.

```markdown
---
background: "#1a1a2e"
transition: dissolve
---

# First Slide

Uses global settings (dark background, dissolve)

---
background: "#ffffff"
color: "#000000"
transition: slide-from-right
---

## Second Slide

This slide has white background, black text, and slides from right

---

## Third Slide

Back to global settings (dark background, dissolve)
```

### Available Settings

| Setting | Description |
|---------|-------------|
| `figdeck` | Enable VSCode extension features (`true`/`false`) |
| `background` | Background color (hex) |
| `gradient` | Gradient background |
| `backgroundImage` | Background image (local path or URL) |
| `template` | Figma paint style name |
| `color` | Base text color |
| `headings` | Heading styles (h1, h2, h3, h4) |
| `paragraphs` | Paragraph styles |
| `bullets` | Bullet point styles |
| `code` | Code block styles |
| `fonts` | Custom font configuration |
| `align` | Horizontal alignment (left, center, right) |
| `valign` | Vertical alignment (top, middle, bottom) |
| `transition` | Slide transition animation |
| `slideNumber` | Slide number configuration |
| `titlePrefix` | Title prefix component |

See specific sections below for detailed configuration options.

## Headings

### H1 (`#`) - Title Slide

Headings starting with `#` create title slides.
Font size is 64px and displayed large.

```markdown
# Presentation Title
```

### H2 (`##`) - Content Slide

Headings starting with `##` create content slides.
Font size is 48px.

```markdown
## Agenda
```

### H3 and below (`###`, `####`, ...)

Headings H3 and below are displayed as sub-headings within the slide content.

## Body Text

Paragraph text is displayed as body content on the slide.
Multiple paragraphs are displayed separated by line breaks.

```markdown
## Slide Title

This is body text.

This is also added to the body.
```

## Bullet Points

Lists (`-`, `*`, `+` or numbers) are displayed as bullet points.

### Unordered List

Displayed with `•` at the beginning.

```markdown
## Features

- Fast
- Simple
- Extensible
```

### Ordered List

Lists starting with numbers are displayed as numbered lists.
You can specify the starting number with the `start` attribute.

```markdown
1. First step
2. Next step
3. Last step
```

### Nested Lists

Lists can be nested by indenting with 2 spaces. Bullet markers change by nesting level:

- Level 0: `•` (U+2022)
- Level 1: `◦` (U+25E6)
- Level 2: `▪` (U+25AA)
- Level 3+: `–` (U+2013)

```markdown
## Nested Example

- Parent item
  - Child item (2 spaces indent)
    - Grandchild item
      - Great-grandchild item
- Back to parent level
```

### Bullet Spacing

You can customize the spacing between bullet items using the `spacing` property in YAML frontmatter:

```yaml
---
bullets:
  spacing: 16  # Gap between bullet items (default: 8px)
---

## Wide Spacing

- Item 1
- Item 2
- Item 3
```

The `spacing` value is in pixels. The default is 8px.

## Inline Formatting

The following formatting can be used within text:

- **Bold**: `**text**` or `__text__`
- *Italic*: `*text*` or `_text_`
- ~~Strikethrough~~: `~~text~~` (GFM)
- `Inline code`: `` `code` ``
- [Link](https://example.com): `[text](URL)`

These can also be combined:

```markdown
This is a test of **bold** and *italic* and ~~strikethrough~~.

`const x = 1` is inline code.

A [link to Figma](https://figma.com).
```

## Blockquote

Lines starting with `>` are displayed as blockquotes.
Displayed with a gray border on the left and slightly muted color.

```markdown
> This is a quoted text.
> It can span multiple lines.
```

## Images

Images can be inserted using `![alt](url)` format.

### Remote Images

```markdown
![Sample image](https://example.com/image.png)
```

Remote URLs (starting with `http://` or `https://`) are fetched by the plugin and displayed via `createImage` (PNG/JPEG/GIF only).

### Local Images

```markdown
![Local image](./images/photo.jpg)
![Absolute path](../assets/logo.png)
```

Local file paths (without URL scheme) are automatically detected by the CLI, read, base64 encoded, and sent to the plugin.
Paths are resolved relative to the Markdown file.

**Supported formats**: `.jpg`, `.jpeg`, `.png`, `.gif` (WebP/SVG are not supported by Figma Slides and will be skipped)

**Size limit**: Default is 5MB. Files exceeding this are skipped with a warning.

### Image Size (Marp-style)

You can specify image dimensions using Marp-compatible syntax in the alt text:

```markdown
![w:400](./image.png)           # Width 400px (height auto-calculated)
![h:300](./image.png)           # Height 300px (width auto-calculated)
![w:400 h:300](./image.png)     # Fixed size 400x300px
![w:50%](./image.png)           # 50% of slide width (960px)
![w:400 Logo](./image.png)      # Size specification + alt text
```

**Behavior**:
- `w:` only: Height is calculated to maintain aspect ratio
- `h:` only: Width is calculated to maintain aspect ratio
- Both specified: Uses exact dimensions (may not preserve aspect ratio)
- Percentage: Calculated based on slide width (1920px)
- No size specified: Default max constraints apply (400x300px)

### Image Position (Absolute Placement)

You can specify absolute x/y coordinates to place images at specific positions on the slide:

```markdown
![x:100 y:200](./image.png)           # Position at (100px, 200px)
![x:50% y:50%](./image.png)           # Center of slide (percentage)
![w:300 x:100 y:200](./image.png)     # Size + position combined
![w:300 x:100 y:200 Product](./image.png)  # Size + position + alt text
```

**Behavior**:
- When `x:` or `y:` is specified, the image is placed at absolute coordinates instead of auto-layout flow
- If only `x:` is specified, `y` defaults to 0 (and vice versa)
- Percentage: `x:` is calculated based on slide width (1920px), `y:` is calculated based on slide height (1080px)
- Example: `x:50%` = 960px, `y:50%` = 540px

**Use cases**:
- Overlay images on backgrounds
- Side-by-side layouts
- Precise logo or icon placement
- Complex multi-image compositions

### Fallback

If image loading fails (file not found, network error, etc.), a placeholder is displayed.
The alt text or URL is shown as a label.

## Figma Selection Link

Using `:::figma` blocks, you can embed link cards to Figma nodes in slides.
For nodes in the same file, clicking jumps directly to that node.

### Basic Syntax

```markdown
:::figma
link=https://www.figma.com/file/xxx/name?node-id=1234-5678
:::
```

### Properties

| Property | Required | Description |
|----------|----------|-------------|
| `link` | Yes | Figma URL (with node-id parameter) |
| `x` | - | Card X coordinate (auto-positioned if omitted) |
| `y` | - | Card Y coordinate (auto-positioned if omitted) |
| `hideLink` | - | Hide the clickable link label below preview (`true`) |
| `text.*` | - | Text layer overrides (see below) |

### Text Layer Overrides

You can override text content in Figma components using `text.*` properties.
The `*` is replaced with the layer name (case-insensitive).

```markdown
:::figma
link=https://www.figma.com/file/xxx?node-id=1234-5678
text.title=Cart Feature
text.body=Use this for cart and confirmation flows.
:::
```

**Rich text formatting** is supported within text overrides:

```markdown
:::figma
link=https://www.figma.com/file/xxx?node-id=1234-5678
text.description=This is **bold** and *italic* text with a [link](https://example.com).
:::
```

**Multiline text** with bullet lists:

```markdown
:::figma
link=https://www.figma.com/file/xxx?node-id=1234-5678
text.content=
  - Variation A
  - Variation B
  - Variation C
:::
```

Supported formatting in text overrides:
- **Bold**: `**text**`
- **Italic**: `*text*`
- **Strikethrough**: `~~text~~`
- **Links**: `[text](url)`
- **Bullet lists**: `- item`
- **Blockquotes**: `> quote` (displayed as quoted italic text)

**Note**: Code blocks are not supported in text overrides due to Figma text layer limitations.

### Position Specification Example

```markdown
:::figma
link=https://www.figma.com/file/xxx?node-id=1234-5678
x=160
y=300
:::
```

### Behavior

- **Same file**: If `node-id` exists in the current file, the component is cloned as a preview with clickable link
- **Other file**: For different files, shows a link card with URL hyperlink
- **Node not found**: If the specified `node-id` is not found, a warning is shown and URL fallback is used
- **Text overrides**: Text layers matching `text.*` layer names are updated with the specified content and formatting

### Supported URL Formats

- `https://www.figma.com/file/<fileKey>/<name>?node-id=<nodeId>`
- `https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>`
- `https://figma.com/file/<fileKey>?node-id=<nodeId>`

The `node-id` parameter supports `1234-5678`, `1234:5678`, or URL-encoded format `1%3A2`.

## Tables (GFM)

GitHub Flavored Markdown table syntax is supported.

```markdown
| Feature | Description |
|---------|-------------|
| Parse | Analyze Markdown |
| Convert | Convert to Figma Slides |
```

Alignment can also be specified:

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| Text | Text | Number |
```

## Multi-Column Layouts

Using `:::columns` blocks, you can create multi-column layouts (2-4 columns).

### Basic Syntax

```markdown
:::columns
:::column
Left column content
:::column
Right column content
:::
```

### Properties

| Property | Default | Description |
|----------|---------|-------------|
| `gap` | 32 | Gap between columns in pixels (max: 200) |
| `width` | even | Column widths (fr, %, or px values separated by `/`) |

### Two-Column Layout

```markdown
:::columns
:::column
### Features

- Fast rendering
- Live preview
- Easy to use

:::column
### Benefits

- Save time
- Consistent design
- Version control friendly
:::
```

### Three-Column Layout

```markdown
:::columns
:::column
**Step 1**

Planning
:::column
**Step 2**

Development
:::column
**Step 3**

Deployment
:::
```

### Four-Column Layout

```markdown
:::columns
:::column
Q1: $1.2M
:::column
Q2: $1.8M
:::column
Q3: $2.1M
:::column
Q4: $2.5M
:::
```

### Custom Gap

```markdown
:::columns gap=64
:::column
More space
:::column
Between columns
:::
```

### Custom Width Ratio

Use `fr` (fractional units), `%` (percentage), or `px` (pixels):

```markdown
:::columns width=1fr/2fr
:::column
### Sidebar (1/3)

Navigation
:::column
### Main Content (2/3)

Primary content area
:::
```

```markdown
:::columns width=30%/70%
:::column
Sidebar
:::column
Main content
:::
```

### Supported Content in Columns

Each column can contain any of the following:

- Paragraphs with inline formatting (**bold**, *italic*, `code`, [links](url))
- Bullet lists (ordered and unordered)
- Code blocks with syntax highlighting
- Images (with size constraints)
- Tables
- Blockquotes
- Headings (H3, H4)

### Fallback Behavior

- If fewer than 2 columns are defined, content renders linearly (no columns)
- If more than 4 columns are defined, only the first 4 are used
- If column widths are below minimum (320px), columns stack vertically

## Footnotes

GFM footnote syntax is supported.
Footnotes are displayed at the bottom of the slide in a smaller font.

### Basic Syntax

```markdown
## Research Results

According to recent research[^1], this is an important finding[^2].

[^1]: Smith et al. (2024) Journal of Science
[^2]: See Appendix A for details
```

### Named Footnotes

You can also use names instead of numbers:

```markdown
This feature is useful[^note].

[^note]: Verified through usability testing
```

### Display Format

- Footnote references in the text are displayed as `[1]` or `[note]` in square brackets (Figma Slides does not support superscript)
- Footnote definitions are displayed at the bottom of the slide, separated by a horizontal line
- Inline formatting like **bold** and *italic* can also be used within footnotes

## Slide Transitions

You can configure transition animations between slides.

### Basic Configuration (Shorthand)

```yaml
---
transition: dissolve
---
```

You can also specify duration:

```yaml
---
transition: slide-from-right 0.5
---
```

### Detailed Configuration

```yaml
---
transition:
  style: slide-from-right   # Animation style
  duration: 0.5             # Duration (seconds) 0.01-10
  curve: ease-out           # Easing curve
  timing:
    type: after-delay       # on-click or after-delay
    delay: 2                # Auto-advance delay (seconds) 0-30
---
```

### Global Configuration

Set a global transition in the frontmatter at the beginning of the file:

```yaml
---
transition:
  style: dissolve
  duration: 0.5
  curve: ease-out
---

# Title Slide

---

## Content Slide
```

In this case, the dissolve transition is applied to all slides.

### Per-Slide Override

You can override the global setting for individual slides:

```yaml
---
transition: dissolve
---

# Title

---
transition: slide-from-right
---
## This slide only slides in from the right
```

Use `transition: none` to disable transitions.

### Available Styles

| Category | Styles |
|----------|--------|
| Basic | `none`, `dissolve`, `smart-animate` |
| Slide In | `slide-from-left`, `slide-from-right`, `slide-from-top`, `slide-from-bottom` |
| Push | `push-from-left`, `push-from-right`, `push-from-top`, `push-from-bottom` |
| Move In | `move-from-left`, `move-from-right`, `move-from-top`, `move-from-bottom` |
| Slide Out | `slide-out-to-left`, `slide-out-to-right`, `slide-out-to-top`, `slide-out-to-bottom` |
| Move Out | `move-out-to-left`, `move-out-to-right`, `move-out-to-top`, `move-out-to-bottom` |

### Available Easing Curves

| Curve | Description |
|-------|-------------|
| `ease-in` | Start slow, accelerate |
| `ease-out` | Decelerate to end |
| `ease-in-and-out` | Start slow, end slow |
| `linear` | Constant speed |
| `gentle` | Smooth |
| `quick` | Fast |
| `bouncy` | Bouncing |
| `slow` | Slow |

### Timing

| Type | Description |
|------|-------------|
| `on-click` | Advance on click (default) |
| `after-delay` | Auto-advance after specified seconds |

**Note**: `after-delay` only works in presentation mode.

## Custom Fonts

You can configure custom font families for different text elements in your slides.

### Basic Configuration

```yaml
---
fonts:
  h1: "Roboto"                    # Shorthand: just family name (uses "Regular" style)
  h2: "Open Sans"
  body: "Source Sans Pro"
  bullets: "Inter"
---
```

### Full Configuration

For complete control over font variants, use the full object syntax:

```yaml
---
fonts:
  h1:
    family: "Roboto"
    style: "Medium"               # Base style (default: "Regular")
    bold: "Bold"                  # Bold variant (default: "Bold")
    italic: "Italic"              # Italic variant (default: "Italic")
    boldItalic: "Bold Italic"     # Bold Italic variant
  body:
    family: "Source Sans Pro"
    style: "Regular"
    bold: "Semibold"              # Custom bold variant
---
```

### Supported Elements

| Element | Description |
|---------|-------------|
| `h1` | H1 headings (title slides) |
| `h2` | H2 headings (content slide titles) |
| `h3` | H3 sub-headings |
| `h4` | H4 sub-headings |
| `body` | Body paragraphs |
| `bullets` | Bullet list items |
| `code` | Code blocks and inline code |

### Font Variants

| Property | Description | Default |
|----------|-------------|---------|
| `family` | Font family name (e.g., "Roboto") | Required |
| `style` | Base font style | "Regular" |
| `bold` | Bold variant style name | "Bold" |
| `italic` | Italic variant style name | "Italic" |
| `boldItalic` | Bold Italic variant style name | "Bold Italic" |

### Fallback Behavior

If a requested font is not available in Figma:
1. A notification warning is displayed
2. The plugin falls back to Inter as the default font
3. The slide continues to render normally

### Per-Slide Override

You can override fonts for individual slides:

```yaml
---
fonts:
  h1: "Roboto"
  body: "Source Sans Pro"
---

# Slides with default fonts

---
fonts:
  h1: "Georgia"
  body: "Times New Roman"
---

# This slide uses different fonts
```

## Code Blocks

Blocks enclosed in ` ``` ` are displayed as code blocks.
Specifying a language enables syntax highlighting.

```markdown
` ```typescript
const message: string = "Hello, World!";
console.log(message);
` ```
```

Supported languages: TypeScript, JavaScript, Python, Bash, JSON, CSS, HTML, XML, Go, Rust, SQL

## Complete Example

```markdown
---
# figdeck Presentation

From Markdown to Figma Slides

---
## Table of Contents

- Overview
- Feature Introduction
- Demo
- Summary

---
## Overview

figdeck is a tool that converts
Markdown files to Figma Slides.

The CLI and Figma Plugin work together.

---
## Features

- Markdown parsing
- WebSocket communication
- Automatic slide generation

---
# Thank You

Any questions?
```

This example generates the following 5 slides:

1. Title slide "figdeck Presentation"
2. Content slide "Table of Contents" (4 bullet items)
3. Content slide "Overview" (2 paragraphs)
4. Content slide "Features" (3 bullet items)
5. Title slide "Thank You"

## Support Status

| Syntax | Status | Notes |
|--------|--------|-------|
| Headings (H1-H4) | Supported | H1/H2 are slide titles |
| Paragraphs | Supported | |
| Bullet points | Supported | Both ordered and unordered |
| **Bold** | Supported | |
| *Italic* | Supported | |
| ~~Strikethrough~~ | Supported | GFM |
| `Inline code` | Supported | With background color |
| Links | Supported | Clickable |
| Blockquotes | Supported | With left border |
| Code blocks | Supported | Syntax highlighting |
| Tables | Supported | GFM, alignment supported |
| Images | Supported | Local and remote |
| Figma links | Supported | `:::figma` blocks |
| align/valign | Supported | Slide alignment settings |
| Footnotes | Supported | GFM, displayed at slide bottom |
| Transitions | Supported | Slide transition animations |
| Custom Fonts | Supported | Per-element font families |
