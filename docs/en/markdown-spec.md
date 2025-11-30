# Markdown Specification

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

## Headings

### H1 (`#`) - Title Slide

Headings starting with `#` are treated as title slides (`type: "title"`).
Font size is 64px and displayed large.

```markdown
# Presentation Title
```

### H2 (`##`) - Content Slide

Headings starting with `##` are treated as content slides (`type: "content"`).
Font size is 48px.

```markdown
## Agenda
```

### H3 and below (`###`, `####`, ...)

Headings H3 and below are treated as body text (`body`).

## Body Text

Paragraph text is added to the body (`body` array).
Multiple paragraphs are displayed separated by line breaks.

```markdown
## Slide Title

This is body text.

This is also added to the body.
```

## Bullet Points

Lists (`-`, `*`, `+` or numbers) are treated as bullet points (`bullets` array).

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

### Position Specification Example

```markdown
:::figma
link=https://www.figma.com/file/xxx?node-id=1234-5678
x=160
y=300
:::
```

### Behavior

- **Same file**: If `node-id` exists in the current file, clicking jumps directly to that node (`type: "NODE"` hyperlink)
- **Other file**: For different files, opens as a URL link (`type: "URL"` hyperlink)
- **Node not found**: If the specified `node-id` is not found, a warning is shown and URL fallback is used

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

## SlideContent Type

Parsed results are converted to the following type:

```typescript
interface SlideContent {
  type: "title" | "content";
  title?: string;      // Heading text
  body?: string[];     // Body text array
  bullets?: string[];  // Bullet points array
  align?: HorizontalAlign;   // Horizontal alignment: "left" | "center" | "right"
  valign?: VerticalAlign;    // Vertical alignment: "top" | "middle" | "bottom"
}
```

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
