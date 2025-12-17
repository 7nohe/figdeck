## Files
- `{{slidesPath}}`: the slide deck Markdown
- `images/` (optional): local images

## Local validation (recommended)
- Generate JSON and validate structure: `npx figdeck build {{slidesPath}}`
- Generate via the plugin: `npx figdeck serve {{slidesPath}}` → Figma Desktop → Plugins → figdeck

> WebSocket integration requires **Figma Desktop** (the browser version cannot connect).

## figdeck Markdown rules (important)

### Slide separators
- A single line containing `---` (thematic break) separates slides
- If a slide is getting long, split it (rule of thumb: 3–6 bullets or ≤2 short paragraphs per slide)

### YAML frontmatter (global vs per-slide)
- **Global settings**: frontmatter at the very beginning of the file applies to all slides
- **Per-slide settings**: frontmatter at the beginning of a slide overrides only that slide
  - After the first slide, per-slide frontmatter appears immediately after a slide separator, so you'll see two `---` blocks back-to-back

Example:
```md
---
background: "#111827"
color: "#ffffff"
transition: dissolve
---

# Title Slide

---

---
background: "#ffffff"
color: "#111827"
---

## Content Slide
```

Common settings:
- `background` (hex like `"#111827"`, gradient like `"#000:0%,#fff:100%@45"`, image path/URL, or Figma component URL)
- `color` (prefer hex like `"#RRGGBB"`)
- `align: left|center|right`, `valign: top|middle|bottom`
- `transition` (e.g. `dissolve`, `slide-from-right 0.5`, or the detailed object form)
- `fonts` (falls back to Inter if unavailable)
- `slideNumber` (show/position/startFrom)

### Heading roles
- `#` (H1): **title slide**
- `##` (H2): **content slide**
- `###` / `####`: sub-headings inside a slide

### Lists (nested lists use 2 spaces)
```md
- Level 0
  - Level 1 (2 spaces)
    - Level 2
```

### Common supported elements
- Paragraphs, **bold**, *italic*, ~~strike~~, inline `code`, [links](https://example.com)
- Bullet lists (ordered/unordered, nested)
- Blockquotes `>`, tables (GFM)
- Code blocks (```lang)
- Images (local/remote)
- Footnotes (GFM)

## Directives (`:::`)
`:::` is reserved for figdeck directives. **Unknown directive names are ignored.**

### `:::columns` (2–4 columns)
```md
:::columns gap=32 width=1fr/2fr
:::column
Left column
:::column
Right column
:::
```
- `gap`: default 32px (max 200)
- `width`: `fr` / `%` / `px` values separated by `/`

### `:::figma` (Figma node link cards)
```md
:::figma
link=https://www.figma.com/design/xxx?node-id=1234-5678
text.title=Cart Feature
text.body=Use **bold** and *italic* in overrides.
:::
```
- Properties are `key=value`
- `link` is required (must include `node-id`)
- `text.*` overrides text layers (rich text supported; code blocks are not)

## Images (important: format limits)
- Local images: `![alt](./images/pic.png)` (resolved relative to the Markdown file)
  - Supported: `.jpg`, `.jpeg`, `.png`, `.gif`
  - **WebP/SVG are not supported**
  - Files over 5MB are skipped (warning)
- Remote images: `https://...` (fetched by the plugin; PNG/JPEG/GIF)

Marp-compatible size/position syntax (in alt text):
```md
![w:400](./image.png)
![h:300](./image.png)
![w:300 x:100 y:200 Logo](./image.png)
```
- Percentages are based on 1920×1080 (e.g. `x:50%` → 960px)

## Change checklist
- Slide separators `---` are intact
- Frontmatter appears only at the start of the file or the start of a slide
- New slides begin with `#` or `##`
- Nested lists are indented with 2 spaces
- `:::columns` / `:::figma` blocks are properly closed with `:::`
- Images use supported formats (png/jpg/gif) and valid paths
