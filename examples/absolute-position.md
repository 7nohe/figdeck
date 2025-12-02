# Absolute Positioning Example

This example demonstrates how to use absolute x/y positioning for text elements.

---

## Basic Positioning

```yaml
---
headings:
  h1:
    size: 96
    color: "#ffffff"
paragraphs:
  size: 24
  color: "#cccccc"
  x: 960
  y: 800
background: "#1a1a2e"
align: center
valign: middle
---
```

---
headings:
  h1:
    size: 96
    color: "#ffffff"
paragraphs:
  size: 24
  color: "#cccccc"
  x: 960
  y: 800
background: "#1a1a2e"
align: center
valign: middle
---

# Title Centered

This paragraph is positioned at x=960, y=800 (bottom center of the slide).

---

## Multiple Element Positioning

```yaml
---
headings:
  h2:
    size: 48
paragraphs:
  x: 1400
  y: 300
bullets:
  x: 100
  y: 500
---
```

---
headings:
  h2:
    size: 48
paragraphs:
  x: 1400
  y: 300
bullets:
  x: 100
  y: 500
---

## Layout Demo

This text is positioned at top-right.

- Bullet 1
- Bullet 2
- Bullet 3

---

## Coordinate Reference

Slide dimensions are **1920 x 1080** pixels.

| Position | X | Y |
|----------|---|---|
| Top-left | 0 | 0 |
| Top-right | 1920 | 0 |
| Center | 960 | 540 |
| Bottom-left | 0 | 1080 |
| Bottom-right | 1920 | 1080 |
