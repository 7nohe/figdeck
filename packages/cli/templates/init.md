---
background: "#1a1a2e"
color: "#ffffff"
headings:
  h1:
    size: 72
  h2:
    size: 48
  h3:
    size: 32
  h4:
    size: 24
paragraphs:
  size: 20
bullets:
  size: 18
code:
  size: 14
slideNumber:
  show: true
  position: bottom-right
  startFrom: 2
---

# figdeck

Markdown to Figma Slides

---

## Agenda

- Inline Formatting
- Lists
- Code Blocks
- Blockquotes & Tables
- Images
- Backgrounds & Fonts
- Transitions
- Other Features

---

## Inline Formatting

Apply various styles to text.

- **Bold** with `**text**`
- *Italic* with `*text*`
- ~~Strikethrough~~ with `~~text~~`
- `Inline code` with \`code\`
- [Links](https://figma.com) with `[text](url)`

Combine them: **bold with `code`** or *italic [link](https://example.com)*

---

## Lists

### Unordered List

- Item 1
- Item 2
- Item 3

### Ordered List

1. First item
2. Second item
3. Third item

---

## Code Blocks

Specify language for syntax highlighting.

```typescript
interface Slide {
  type: "title" | "content";
  title?: string;
  body?: string[];
  bullets?: string[];
}

const slides: Slide[] = parseMarkdown(content);
```

---

## Blockquotes

> Blockquotes start with `>`.
> They can span multiple lines.

Regular text follows the quote.

---

## Tables

| Feature | Status | Notes |
|:--------|:------:|------:|
| Bold | Y | **Supported** |
| Italic | Y | *Supported* |
| Code | Y | `Supported` |
| Links | Y | Clickable |

Column alignment: left `:---`, center `:---:`, right `---:`

---

## Images

Images are inserted as placeholders.

![figdeck logo](https://github.com/7nohe/figdeck/raw/main/images/logo.svg)

Syntax: `![alt text](image-url)`

---

## Subheadings

### H3 Heading

Use subheadings to divide sections within a slide.

#### H4 Heading

Even smaller headings are available.

Combine with text for structured content.

---
---
background: "#16213e"
---

## Background Styles

This slide has a custom background color.

Set via YAML frontmatter:

```yaml
---
background: "#16213e"              # Solid color
gradient: "#000:0%,#fff:100%@45"   # Gradient
backgroundImage: "./bg.png"        # Image
---
```

---
---
headings:
  h2:
    size: 56
    color: "#58a6ff"
paragraphs:
  size: 24
---

## Font Sizes

This slide has custom font sizes.

Configurable items:
- `headings.h1` ~ `headings.h4`
- `paragraphs`
- `bullets`
- `code`

---
---
slideNumber:
  show: true
  format: "{{current}} / {{total}}"
  position: bottom-left
---

## Slide Numbers

Customize slide number display.

- `show`: Show/hide
- `position`: `bottom-right`, `bottom-left`, `top-right`, `top-left`
- `format`: Display format (`{{current}}`, `{{total}}`)
- `startFrom`: Starting slide number

---
---
transition:
  style: slide-from-right
  duration: 0.5
  curve: ease-out
---

## Transitions

Set slide transition animations.

**Styles**: `dissolve`, `slide-from-*`, `push-from-*`, `move-from-*`, `smart-animate`, `none`

**Curves**: `ease-in`, `ease-out`, `ease-in-and-out`, `linear`, `bouncy`

---

## Figma Links

Reference Figma nodes directly.

```markdown
:::figma
https://www.figma.com/design/xxxxx?node-id=123-456
:::
```

With position:

```markdown
:::figma
link=https://www.figma.com/design/xxxxx?node-id=123-456
x=500
y=300
:::
```

---
---
align: center
valign: middle
---

## Alignment

This slide is centered.

`align`: `left`, `center`, `right`

`valign`: `top`, `middle`, `bottom`

---

# Thank You!

Any questions?
