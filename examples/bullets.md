---
background: "#1a1a2e"
color: "#ffffff"
---

# Nested Bullets

Demonstrating nested bullet list support

---

## Basic Nested Lists

- Level 0 item
  - Level 1 item
  - Another level 1 item
    - Level 2 item
    - Another level 2 item
      - Level 3 item
- Back to level 0

---

## Formatted Nested Lists

- **Bold** parent item
  - *Italic* child item
  - `Code` in child
    - [Link](https://example.com) in grandchild
- Normal parent
  - ~~Strikethrough~~ child

---

## Mixed Content

- Introduction
  - Sub-point A
  - Sub-point B
- Main topic
  - Detail 1
    - Sub-detail 1.1
    - Sub-detail 1.2
  - Detail 2
- Conclusion
  - Summary point

---

## Ordered with Nested Unordered

1. First main point
   - Supporting detail A
   - Supporting detail B
2. Second main point
   - Supporting detail C
     - Even deeper detail
3. Third main point

---
bullets:
  spacing: 16
---

## Wide Spacing (16px)

- First item with wide spacing
- Second item
  - Nested item also uses wide spacing
  - Another nested item
- Third item

---
bullets:
  spacing: 4
---

## Compact Spacing (4px)

- Tightly packed item 1
- Tightly packed item 2
- Tightly packed item 3
  - Nested compact item
  - Another nested compact item
- Tightly packed item 4

---
bullets:
  spacing: 24
---

## Native List Spacing (24px)

Simple bullet list without nesting (uses native Figma list):

- Simple bullet one
- Simple bullet two
- Simple bullet three

Ordered list:

1. Ordered item one
2. Ordered item two
3. Ordered item three
