---
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

## Summary

YAML frontmatter format:

```yaml
---
background: "#1a1a2e"
color: "#ffffff"
---
```

Global (file start) sets defaults, per-slide overrides.
