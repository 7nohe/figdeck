---
figdeck: true
background: "#1a1a2e"
color: "#ffffff"
---

# Background Examples

This presentation demonstrates all background options.

All slides use dark background with white text by default.

---

## Default Background Applied

This slide uses the global settings from YAML frontmatter.

No per-slide frontmatter needed!

---
background: "#16213e"
---

## Override with Different Color

- This slide overrides the default with its own frontmatter
- Per-slide settings take priority over global defaults

---
background: "#0d1117:0%,#1f2937:50%,#3b82f6:100%@45"
---

# Gradient Background

Gradients are auto-detected from the string format.

---
background: "#f0f4f8"
color: "#020202"
---

## Light Theme Slide

This slide uses light background with dark text.

---
background: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop"
color: "#ffffff"
---

## Remote Background Image

This slide uses a remote image URL as background.

URLs are auto-detected as images.

---
background: "./local-bg.png"
color: "#ffffff"
---

## Local Background Image

This slide uses a local image file.

The CLI reads and embeds the image as base64.

---
background:
  template: "Inter"
---

## Template Style

Use a Figma paint style by name.

---
background: "https://figma.com/...?node-id=123-456"
---

## Figma Component (URL Shorthand)

Copy a Figma link with node-id from your Component or Frame.

The component will be scaled to cover the slide by default.

---
background:
  component:
    link: "https://figma.com/...?node-id=123-456"
    fit: "contain"
    align: "center"
---

## Figma Component Options

- `fit`: cover (default), contain, stretch
- `align`: center (default), top-left, top-right, bottom-left, bottom-right
- `opacity`: 0-1

---
background:
  color: "#1a1a2e"
  component:
    link: "https://figma.com/...?node-id=123-456"
    fit: "cover"
    opacity: 0.8
---

## Combined Background

Component can be combined with color/gradient/image.

The component renders as a layer on top of the base fill.

---

## Summary

```yaml
---
# String format (auto-detect)
background: "#1a1a2e"           # Solid color
background: "#000:0%,#fff:100%" # Gradient
background: "./bg.png"          # Local image
background: "https://..."       # Remote image
background: "https://figma.com/...?node-id=123-456"  # Figma component

# Object format (explicit)
background:
  color: "#1a1a2e"
  gradient: "#000:0%,#fff:100%@45"
  template: "Style Name"
  image: "./bg.png"
  component:
    link: "https://figma.com/...?node-id=123-456"
    fit: "cover"        # cover | contain | stretch
    align: "center"     # center | top-left | ...
    opacity: 0.8        # 0-1
---
```

Priority: template > gradient > color > image

Component works with same-file nodes only (MVP limitation).
