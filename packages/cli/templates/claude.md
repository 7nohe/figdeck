---
paths: "{{slidesPath}}, **/*.md"
---

# figdeck Slide Authoring Rules

This repository is a **figdeck (Markdown → Figma Slides)** slide deck. The main file to edit is `{{slidesPath}}`.

Goal: help an AI agent understand figdeck's authoring rules and produce output that renders reliably in Figma Slides.

## Hard rules (common failure points)
- Slide separators are a single line: `---`
- `#` creates a **title slide**, `##` creates a **content slide**
- In-slide headings should use `###` / `####`
- Nested lists must use **2 spaces** indentation
- `:::` directives are only `:::columns` and `:::figma` (other names are ignored)
- Images must be **png/jpg/gif** (WebP/SVG unsupported; local images > 5MB are skipped)

## Editing workflow (recommended)
1. Read `{{slidesPath}}` and match existing tone, structure, and heading hierarchy
2. If a slide gets long, split it by adding `---`
3. Avoid destructive rewrites; keep diffs minimal and scoped
4. Validate with `npx figdeck build {{slidesPath}}`

Plugin validation:
- Run `npx figdeck serve {{slidesPath}}`
- Figma Desktop → Plugins → figdeck (browser cannot connect via WebSocket)

## figdeck quick reference

### YAML frontmatter
- At the top of the file: global defaults
- At the start of a slide: per-slide overrides (after the first slide, it appears right after `---`)

Example:
```md
---
background: "#111827"
color: "#ffffff"
transition: dissolve
---

# Title

---

---
background: "#ffffff"
color: "#111827"
---

## Agenda
```

### `:::columns` (2–4 columns)
```md
:::columns gap=32 width=1fr/2fr
:::column
Left
:::column
Right
:::
```

### `:::figma` (Figma node link cards)
```md
:::figma
link=https://www.figma.com/design/xxx?node-id=1234-5678
text.title=Title override
text.body=Supports **bold**, *italic*, ~~strike~~, [link](https://example.com)
:::
```

### Images
```md
![Local](./images/photo.png)
![w:400 x:100 y:200 Logo](./images/logo.png)
```

## Tips to avoid layout issues
- Keep each slide small; split if content grows
- Keep tables/code/quotes short (split or summarize if needed)
- Specify image size (`w:` / `h:`) for more stable layout
- Use `align` / `valign` to make title slides look consistent (e.g. `align: center`, `valign: middle`)
