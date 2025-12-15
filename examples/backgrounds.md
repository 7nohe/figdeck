---
figdeck: true
background: "#1a1a2e"
color: "#ffffff"
---

# Background & Text Color Examples

This presentation demonstrates background and text color options.

All slides use dark background with white text by default.

---

## Default Background Applied

This slide uses the global settings from YAML frontmatter.

No per-slide frontmatter needed!

---

---

## background: "#16213e"

## Override with Different Color

- This slide overrides the default with its own frontmatter
- Per-slide settings take priority over global defaults

---

---

## gradient: "#0d1117:0%,#1f2937:50%,#3b82f6:100%@45"

# Gradient Override

Gradients also override the default background.

---

## Back to Default

This slide has no frontmatter, so it uses the global default again.

---
background: "#f0f4f8"
color: "#020202"
---

## Light Theme Slide

This slide uses light background with dark text.

---
backgroundImage: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop"
color: "#ffffff"
---

## Remote Background Image

This slide uses a remote image URL as background.

The image is fetched by the Figma plugin.

---

---
backgroundImage: "./local-bg.png"
color: "#ffffff"
---

## Local Background Image

This slide uses a local image file.

The CLI reads and embeds the image as base64.

---

## Summary

YAML frontmatter format:

```yaml
---
background: "#1a1a2e"           # Solid color
gradient: "#0d1117:0%,#58a6ff:100%@45"  # Gradient
backgroundImage: "./bg.png"     # Local image
backgroundImage: "https://..."  # Remote image URL
color: "#ffffff"                # Text color
---
```

Global (file start) sets defaults, per-slide overrides.

Priority: template > gradient > solid > image
