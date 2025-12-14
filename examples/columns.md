---
figdeck: true
background: "#1a1a2e"
color: "#ffffff"
---

# Multi-Column Layouts

Demonstration of figdeck's column layout feature.

---

## Two-Column Layout (Default)

:::columns
:::column
### Left Column

- Feature A
- Feature B
- Feature C

:::column
### Right Column

- Feature X
- Feature Y
- Feature Z
:::

---

## Three-Column Layout

:::columns
:::column
### Planning

Define requirements and scope.

:::column
### Development

Build and test features.

:::column
### Deployment

Ship to production.
:::

---

## Four-Column Layout

:::columns
:::column
**Q1**

$1.2M
:::column
**Q2**

$1.8M
:::column
**Q3**

$2.1M
:::column
**Q4**

$2.5M
:::

---

## Custom Gap (64px)

:::columns gap=64
:::column
### Wide Gap

More spacing between columns.

:::column
### Better Readability

Columns are further apart.
:::

---

## Custom Width Ratio (1:2)

:::columns width=1fr/2fr
:::column
### Sidebar

Navigation and quick links.

:::column
### Main Content

This column takes up twice the width of the sidebar, giving more space for the primary content of your slide.

- Item 1
- Item 2
- Item 3
:::

---

## Code Side-by-Side

:::columns
:::column
### Before

```js
function add(a, b) {
  return a + b;
}
```

:::column
### After

```ts
function add(a: number, b: number): number {
  return a + b;
}
```
:::

---

## Mixed Content Types

:::columns
:::column
### Text and Lists

This column has regular text.

- Bullet point 1
- Bullet point 2

:::column
### Code Block

```python
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
```
:::

---

## Comparison Layout

:::columns width=1fr/1fr
:::column
### Pros

- Fast performance
- Easy to use
- Great documentation
- Active community

:::column
### Cons

- Learning curve
- Limited plugins
- Newer ecosystem
- Requires setup
:::

---

## Images in Columns

:::columns
:::column
### Screenshot A

![w:100%](./images/sample.jpg)

:::column
### Screenshot B

![w:100%](./images/sample.jpg)
:::

---

## Blockquotes in Columns

:::columns
:::column
> "The best way to predict the future is to invent it."

*Alan Kay*

:::column
> "Simplicity is the ultimate sophistication."

*Leonardo da Vinci*
:::

---
background: "#ffffff"
color: "#1a1a2e"
---
## Tables in Columns

:::columns
:::column
### Team A

| Name | Role |
|------|------|
| Alice | Lead |
| Bob | Dev |

:::column
### Team B

| Name | Role |
|------|------|
| Carol | Lead |
| Dave | Dev |
:::
