---
background: "#ffffff"
# Font configuration for slides
# Supports per-element font families with style variants
fonts:
  # H1 with custom font family
  h1:
    family: "Roboto"
    style: "Medium"
    bold: "Bold"
    italic: "Italic"
    boldItalic: "Bold Italic"
  # H2 using shorthand (family name only, uses "Regular" style)
  h2: "Open Sans"
  # Body text with full configuration
  body:
    family: "Source Sans Pro"
    style: "Regular"
    bold: "Semibold"
    italic: "Italic"
---

# Custom Fonts Demo

This presentation demonstrates custom font configuration.

---

## Slide with Custom Fonts

This body text uses the configured font family (Source Sans Pro).

- Bullet points also use the fonts config
- **Bold text** uses the specified bold variant
- *Italic text* uses the specified italic variant

---
# Per-Slide Font Override
fonts:
  h1:
    family: "Georgia"
    style: "Regular"
    bold: "Bold"
  body:
    family: "Times New Roman"
    style: "Regular"
---

# Different Fonts for This Slide

This slide overrides the default fonts with Georgia for headings and Times New Roman for body text.

---

## Font Fallback

If a requested font is not available in Figma, the plugin will:

1. Show a notification warning
2. Fall back to Inter as the default font
3. Continue rendering the slide normally

This ensures your slides always render, even with missing fonts.
