---
figdeck: true
---

# Figma Selection Links Demo

This slide demonstrates the `:::figma` block feature.

:::figma
link=https://www.figma.com/file/xxx/name?node-id=1234-5678
text.title=Cart Feature
text.body=Use this for cart and confirmation flows.
:::


---

## Figma Link Example

Embed link cards to Figma nodes in your slides.

:::figma
link=https://www.figma.com/file/xxx/name?node-id=1234-5678
text.title1=Design
text.body1=Designed based on customer requirements.
text.title2=Implementation
text.body2=Published the implementation code to the repository.
text.title3=Testing
text.body3=Testing confirmed normal operation.
:::

---

## Multiline Text Example

Leave `text.*=` empty and use indentation for multiline text.

:::figma
link=https://www.figma.com/file/xxx/name?node-id=1234-5678
text.head=Confirmation Screen
text.description=Order confirmation flow
text.paragraph=
  This screen displays the order summary before final submission.

  - Verify shipping address and payment method
  - Review item quantities and prices
  - Apply discount codes if available
:::

---

## Rich Text Formatting

Add rich text formatting to `:::figma` blocks.

:::figma
link=https://www.figma.com/file/xxx/name?node-id=1234-5678
text.icon=🗒️
text.title=Confirmation Screen
text.body=
  Use this for **cart** and *confirmation* flows.
  - Variation A: Default state
  - Variation B: Empty cart
:::

---

## Hiding Link Label

Use `hideLink=true` to hide the link label below the preview.

:::figma
link=https://www.figma.com/file/xxx/name?node-id=1234-5678
text.title=No Link
text.body=The link label is hidden.
hideLink=true
:::
