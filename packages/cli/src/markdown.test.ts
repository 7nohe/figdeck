import { describe, expect, it } from "bun:test";
import { parseImageAlt, parseMarkdown } from "./markdown.js";

describe("parseMarkdown", () => {
  describe("inline formatting", () => {
    it("should parse bold text", () => {
      const result = parseMarkdown("## Test\n\nThis is **bold** text.");
      expect(result).toHaveLength(1);
      // blocks[0] is heading, blocks[1] is paragraph
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("paragraph");
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "bold", bold: true });
      }
    });

    it("should parse italic text", () => {
      const result = parseMarkdown("## Test\n\nThis is *italic* text.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "italic", italic: true });
      }
    });

    it("should parse strikethrough text", () => {
      const result = parseMarkdown("## Test\n\nThis is ~~deleted~~ text.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "deleted", strike: true });
      }
    });

    it("should parse inline code", () => {
      const result = parseMarkdown("## Test\n\nUse `code` here.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "code", code: true });
      }
    });

    it("should parse links", () => {
      const result = parseMarkdown(
        "## Test\n\nVisit [Figma](https://figma.com).",
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({
          text: "Figma",
          href: "https://figma.com",
        });
      }
    });

    it("should parse combined formatting", () => {
      const result = parseMarkdown("## Test\n\n***bold italic***");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({
          text: "bold italic",
          bold: true,
          italic: true,
        });
      }
    });
  });

  describe("ordered lists", () => {
    it("should parse ordered list with correct start", () => {
      const result = parseMarkdown("## Test\n\n1. First\n2. Second\n3. Third");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("bullets");
      if (block?.kind === "bullets") {
        expect(block.ordered).toBe(true);
        expect(block.start).toBe(1);
        expect(block.items).toHaveLength(3);
        // Items are now BulletItem[] with text and spans
        const items = block.items as Array<{ text: string }>;
        expect(items[0].text).toBe("First");
        expect(items[1].text).toBe("Second");
        expect(items[2].text).toBe("Third");
      }
    });

    it("should preserve custom start number", () => {
      const result = parseMarkdown("## Test\n\n5. Fifth\n6. Sixth");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "bullets") {
        expect(block.ordered).toBe(true);
        expect(block.start).toBe(5);
      }
    });
  });

  describe("blockquote", () => {
    it("should parse blockquote", () => {
      const result = parseMarkdown("## Test\n\n> This is a quote.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("blockquote");
      if (block?.kind === "blockquote") {
        expect(block.text).toBe("This is a quote.");
      }
    });

    it("should parse blockquote with formatting", () => {
      const result = parseMarkdown("## Test\n\n> Quote with **bold**.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "blockquote" && block.spans) {
        expect(block.spans).toContainEqual({ text: "bold", bold: true });
      }
    });
  });

  describe("images", () => {
    it("should parse image block", () => {
      const result = parseMarkdown(
        "## Test\n\n![Alt text](https://example.com/img.png)",
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("image");
      if (block?.kind === "image") {
        expect(block.url).toBe("https://example.com/img.png");
        expect(block.alt).toBe("Alt text");
      }
    });
  });

  describe("tables", () => {
    it("should parse GFM table", () => {
      const result = parseMarkdown(`## Test

| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("table");
      if (block?.kind === "table") {
        expect(block.headers).toHaveLength(2);
        expect(block.rows).toHaveLength(2);
      }
    });

    it("should parse table alignment", () => {
      const result = parseMarkdown(`## Test

| Left | Center | Right |
|:-----|:------:|------:|
| a | b | c |`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "table") {
        expect(block.align).toEqual(["left", "center", "right"]);
      }
    });

    it("should parse table with formatting in cells", () => {
      const result = parseMarkdown(`## Test

| Feature |
|---------|
| **bold** |`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "table") {
        expect(block.rows[0][0]).toContainEqual({ text: "bold", bold: true });
      }
    });
  });

  describe("code blocks", () => {
    it("should preserve code block language", () => {
      const result = parseMarkdown(`## Test

\`\`\`typescript
const x = 1;
\`\`\``);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("code");
      if (block?.kind === "code") {
        expect(block.language).toBe("typescript");
        expect(block.code).toBe("const x = 1;");
      }
    });

    it("should handle code block without language", () => {
      const result = parseMarkdown(`## Test

\`\`\`
no language
\`\`\``);

      expect(result).toHaveLength(1);
      const codeBlock = result[0].blocks[1];
      expect(codeBlock?.kind).toBe("code");
      if (codeBlock?.kind === "code") {
        expect(codeBlock.language).toBeUndefined();
        expect(codeBlock.code).toBe("no language");
      }
    });
  });

  describe("figma blocks", () => {
    it("should parse :::figma block with valid URL", () => {
      const result = parseMarkdown(`## Test

:::figma
link=https://www.figma.com/file/abc123/MyFile?node-id=1234-5678
:::`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("figma");
      if (block?.kind === "figma") {
        expect(block.link.url).toBe(
          "https://www.figma.com/file/abc123/MyFile?node-id=1234-5678",
        );
        expect(block.link.fileKey).toBe("abc123");
        expect(block.link.nodeId).toBe("1234:5678");
      }
    });

    it("should parse :::figma block with design URL", () => {
      const result = parseMarkdown(`## Test

:::figma
link=https://www.figma.com/design/xyz789/Design?node-id=42-100
:::`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "figma") {
        expect(block.link.fileKey).toBe("xyz789");
        expect(block.link.nodeId).toBe("42:100");
      }
    });

    it("should parse :::figma block with URL-encoded node-id", () => {
      const result = parseMarkdown(`## Test

:::figma
link=https://www.figma.com/file/abc/Name?node-id=1%3A2
:::`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "figma") {
        expect(block.link.nodeId).toBe("1:2");
      }
    });

    it("should parse :::figma block with position", () => {
      const result = parseMarkdown(`## Test

:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
x=160
y=300
:::`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "figma") {
        expect(block.link.x).toBe(160);
        expect(block.link.y).toBe(300);
      }
    });

    it("should handle :::figma block without node-id", () => {
      const result = parseMarkdown(`## Test

:::figma
link=https://www.figma.com/file/abc/Name
:::`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "figma") {
        expect(block.link.url).toBe("https://www.figma.com/file/abc/Name");
        expect(block.link.fileKey).toBe("abc");
        expect(block.link.nodeId).toBeUndefined();
      }
    });

    it("should handle invalid URL gracefully", () => {
      const result = parseMarkdown(`## Test

:::figma
link=not-a-valid-url
:::`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "figma") {
        expect(block.link.url).toBe("not-a-valid-url");
        expect(block.link.fileKey).toBeUndefined();
        expect(block.link.nodeId).toBeUndefined();
      }
    });

    it("should skip :::figma block without link property", () => {
      const result = parseMarkdown(`## Test

:::figma
x=100
:::`);
      expect(result).toHaveLength(1);
      // Only heading block, figma block was skipped
      expect(result[0].blocks).toHaveLength(1);
      expect(result[0].blocks[0].kind).toBe("heading");
    });

    it("should parse multiple figma blocks", () => {
      const result = parseMarkdown(`## Test

:::figma
link=https://www.figma.com/file/a/Name?node-id=1-1
:::

Some text

:::figma
link=https://www.figma.com/file/b/Name?node-id=2-2
:::`);
      expect(result).toHaveLength(1);
      const blocks = result[0].blocks;
      expect(blocks).toHaveLength(4); // heading, figma, paragraph, figma
      expect(blocks[0].kind).toBe("heading");
      expect(blocks[1].kind).toBe("figma");
      expect(blocks[2].kind).toBe("paragraph");
      expect(blocks[3].kind).toBe("figma");
    });
  });

  describe("frontmatter colors", () => {
    it("applies global color to all text styles", () => {
      const result = parseMarkdown(`---
background: "#1a1a2e"
color: "#ffffff"
---

## Slide

Body text.`);

      expect(result).toHaveLength(1);
      const slide = result[0];
      expect(slide.styles?.paragraphs?.color).toBe("#ffffff");
      expect(slide.styles?.headings?.h2?.color).toBe("#ffffff");
    });

    it("allows per-slide color override", () => {
      const result = parseMarkdown(`---
color: "#ffffff"
---

---
color: "#111111"
---
## Override
Text`);

      expect(result).toHaveLength(1);
      const slide = result[0];
      expect(slide.styles?.paragraphs?.color).toBe("#111111");
      expect(slide.styles?.headings?.h2?.color).toBe("#111111");
    });
  });

  describe("slide builder pattern", () => {
    it("should handle slide with only heading (no content blocks)", () => {
      const result = parseMarkdown("# Title Only");
      expect(result).toHaveLength(1);
      expect(result[0].blocks).toHaveLength(1);
      const heading = result[0].blocks[0];
      expect(heading.kind).toBe("heading");
      if (heading.kind === "heading") {
        expect(heading.level).toBe(1);
        expect(heading.text).toBe("Title Only");
      }
    });

    it("should build slide with multiple block types", () => {
      const result = parseMarkdown(`## Mixed Content

Paragraph text.

- Bullet 1
- Bullet 2

\`\`\`js
code();
\`\`\`

> A quote`);

      expect(result).toHaveLength(1);
      const blocks = result[0].blocks;
      expect(blocks).toHaveLength(5); // heading + 4 content blocks
      expect(blocks[0].kind).toBe("heading");
      expect(blocks[1].kind).toBe("paragraph");
      expect(blocks[2].kind).toBe("bullets");
      expect(blocks[3].kind).toBe("code");
      expect(blocks[4].kind).toBe("blockquote");
    });

    it("should process h3 and h4 as content blocks", () => {
      const result = parseMarkdown(`## Main Title

### Sub Heading

#### Sub-sub Heading`);

      expect(result).toHaveLength(1);
      const blocks = result[0].blocks;
      expect(blocks).toHaveLength(3); // h2 + h3 + h4

      if (blocks[0].kind === "heading") {
        expect(blocks[0].level).toBe(2);
        expect(blocks[0].text).toBe("Main Title");
      }
      if (blocks[1].kind === "heading") {
        expect(blocks[1].level).toBe(3);
        expect(blocks[1].text).toBe("Sub Heading");
      }
      if (blocks[2].kind === "heading") {
        expect(blocks[2].level).toBe(4);
        expect(blocks[2].text).toBe("Sub-sub Heading");
      }
    });

    it("should create slide from paragraph without heading", () => {
      const result = parseMarkdown("Just a paragraph without heading.");
      expect(result).toHaveLength(1);
      expect(result[0].blocks[0].kind).toBe("paragraph");
    });

    it("should process images within paragraphs", () => {
      const result = parseMarkdown(`## Images

![Screenshot](https://example.com/img.png)

![Another](https://example.com/other.jpg)`);

      expect(result).toHaveLength(1);
      const blocks = result[0].blocks;
      expect(blocks).toHaveLength(3); // heading + 2 images
      expect(blocks[1].kind).toBe("image");
      expect(blocks[2].kind).toBe("image");

      if (blocks[1].kind === "image") {
        expect(blocks[1].url).toBe("https://example.com/img.png");
        expect(blocks[1].alt).toBe("Screenshot");
      }
    });

    it("should handle complex nested list formatting", () => {
      const result = parseMarkdown(`## List Test

- **Bold** item
- *Italic* item
- \`code\` item
- [Link](https://example.com) item`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("bullets");

      if (block?.kind === "bullets") {
        expect(block.items).toHaveLength(4);
        // Items are now BulletItem[] with text and spans
        const items = block.items as Array<{
          text: string;
          spans?: Array<{
            text: string;
            bold?: boolean;
            italic?: boolean;
            code?: boolean;
            href?: string;
          }>;
        }>;
        // Check that spans contain formatting
        expect(items[0].spans).toContainEqual({ text: "Bold", bold: true });
        expect(items[1].spans).toContainEqual({
          text: "Italic",
          italic: true,
        });
        expect(items[2].spans).toContainEqual({ text: "code", code: true });
        expect(items[3].spans).toContainEqual({
          text: "Link",
          href: "https://example.com",
        });
      }
    });

    it("should process multiple slides with different heading levels", () => {
      const result = parseMarkdown(`# Title Slide

---

## Content Slide

Body text

---

## Another Content

- Bullet`);

      expect(result).toHaveLength(3);
      // First slide: H1
      expect(result[0].blocks[0].kind).toBe("heading");
      if (result[0].blocks[0].kind === "heading") {
        expect(result[0].blocks[0].level).toBe(1);
      }
      // Second slide: H2 + paragraph
      expect(result[1].blocks[0].kind).toBe("heading");
      if (result[1].blocks[0].kind === "heading") {
        expect(result[1].blocks[0].level).toBe(2);
      }
      // Third slide: H2 + bullets
      expect(result[2].blocks[0].kind).toBe("heading");
      expect(result[2].blocks[1].kind).toBe("bullets");
    });
  });

  describe("code block processing", () => {
    it("should handle multiple code blocks", () => {
      const result = parseMarkdown(`## Test

\`\`\`js
const a = 1;
\`\`\`

\`\`\`ts
const b: number = 2;
\`\`\``);

      expect(result).toHaveLength(1);
      // heading + 2 code blocks
      expect(result[0].blocks).toHaveLength(3);
      expect(result[0].blocks[1].kind).toBe("code");
      expect(result[0].blocks[2].kind).toBe("code");
    });
  });

  describe("table processing", () => {
    it("should handle table without alignment", () => {
      const result = parseMarkdown(`## Test

| A | B |
|---|---|
| 1 | 2 |`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "table") {
        // No alignment specified, should default to nulls
        expect(block.align).toEqual([null, null]);
      }
    });

    it("should process table headers with formatting", () => {
      const result = parseMarkdown(`## Test

| **Bold Header** |
|-----------------|
| data |`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "table") {
        expect(block.headers[0]).toContainEqual({
          text: "Bold Header",
          bold: true,
        });
      }
    });
  });

  describe("blockquote processing", () => {
    it("should handle multi-line blockquote", () => {
      const result = parseMarkdown(`## Test

> Line 1
> Line 2`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "blockquote") {
        expect(block.text).toContain("Line 1");
        expect(block.text).toContain("Line 2");
      }
    });

    it("should extract spans from blockquote", () => {
      const result = parseMarkdown(`## Test

> This has **bold** and *italic*.`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "blockquote") {
        expect(block.spans).toContainEqual({ text: "bold", bold: true });
        expect(block.spans).toContainEqual({ text: "italic", italic: true });
      }
    });
  });

  describe("bare URL figma blocks", () => {
    it("should parse :::figma block with bare URL (no link= prefix)", () => {
      const result = parseMarkdown(`## Test

:::figma
https://www.figma.com/file/abc123/Name?node-id=1-2
x=100
y=200
:::`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("figma");
      if (block?.kind === "figma") {
        expect(block.link.url).toBe(
          "https://www.figma.com/file/abc123/Name?node-id=1-2",
        );
        expect(block.link.fileKey).toBe("abc123");
        expect(block.link.nodeId).toBe("1:2");
        expect(block.link.x).toBe(100);
        expect(block.link.y).toBe(200);
      }
    });
  });

  describe("image blocks", () => {
    it("should parse remote image as source=remote", () => {
      const result = parseMarkdown(
        `## Test\n\n![Alt text](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("image");
      if (block?.kind === "image") {
        expect(block.url).toBe("https://example.com/image.png");
        expect(block.alt).toBe("Alt text");
        expect(block.source).toBe("remote");
        expect(block.dataBase64).toBeUndefined();
      }
    });

    it("should parse local image path without basePath as no source", () => {
      // Without basePath option, local paths don't get marked as local
      const result = parseMarkdown(`## Test\n\n![Logo](./images/logo.png)`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("image");
      if (block?.kind === "image") {
        expect(block.url).toBe("./images/logo.png");
        expect(block.alt).toBe("Logo");
        // Without basePath, source is undefined (backward compat)
        expect(block.source).toBeUndefined();
      }
    });

    it("should parse local image with basePath as source=local", () => {
      // With basePath option but file doesn't exist
      const result = parseMarkdown(`## Test\n\n![Logo](./nonexistent.png)`, {
        basePath: "/fake/path",
      });
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("image");
      if (block?.kind === "image") {
        expect(block.url).toBe("./nonexistent.png");
        expect(block.alt).toBe("Logo");
        expect(block.source).toBe("local");
        // File doesn't exist, so no dataBase64
        expect(block.dataBase64).toBeUndefined();
      }
    });

    it("should preserve alt text for images", () => {
      const result = parseMarkdown(
        `## Test\n\n![Detailed description of the image](https://example.com/photo.jpg)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "image") {
        expect(block.alt).toBe("Detailed description of the image");
      }
    });

    it("should handle image without alt text", () => {
      const result = parseMarkdown(
        `## Test\n\n![](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "image") {
        expect(block.alt).toBeUndefined();
      }
    });

    it("should parse Marp-style width specification", () => {
      const result = parseMarkdown(
        `## Test\n\n![w:400](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("image");
      if (block?.kind === "image") {
        expect(block.alt).toBeUndefined();
        expect(block.size).toEqual({ width: 400, height: undefined });
      }
    });

    it("should parse Marp-style height specification", () => {
      const result = parseMarkdown(
        `## Test\n\n![h:300](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "image") {
        expect(block.size).toEqual({ width: undefined, height: 300 });
      }
    });

    it("should parse both width and height", () => {
      const result = parseMarkdown(
        `## Test\n\n![w:400 h:300](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "image") {
        expect(block.size).toEqual({ width: 400, height: 300 });
      }
    });

    it("should parse percentage width as pixels", () => {
      const result = parseMarkdown(
        `## Test\n\n![w:50%](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "image") {
        expect(block.size).toEqual({ width: 960, height: undefined });
      }
    });

    it("should preserve alt text with size specification", () => {
      const result = parseMarkdown(
        `## Test\n\n![w:400 Logo image](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      if (block?.kind === "image") {
        expect(block.alt).toBe("Logo image");
        expect(block.size).toEqual({ width: 400, height: undefined });
      }
    });
  });

  describe("align/valign frontmatter", () => {
    it("should apply global align/valign to all slides", () => {
      const result = parseMarkdown(`---
align: center
valign: middle
---

# Title Slide

---

## Content Slide

Body text.`);

      expect(result).toHaveLength(2);
      expect(result[0].align).toBe("center");
      expect(result[0].valign).toBe("middle");
      expect(result[1].align).toBe("center");
      expect(result[1].valign).toBe("middle");
    });

    it("should allow per-slide align/valign override", () => {
      const result = parseMarkdown(`---
align: center
valign: middle
---

# Centered Title

---
align: left
valign: top
---
## Left-aligned Content

Body text.`);

      expect(result).toHaveLength(2);
      expect(result[0].align).toBe("center");
      expect(result[0].valign).toBe("middle");
      expect(result[1].align).toBe("left");
      expect(result[1].valign).toBe("top");
    });

    it("should handle align without valign", () => {
      const result = parseMarkdown(`---
align: right
---

## Right-aligned

Text`);

      expect(result).toHaveLength(1);
      expect(result[0].align).toBe("right");
      expect(result[0].valign).toBeUndefined();
    });

    it("should handle valign without align", () => {
      const result = parseMarkdown(`---
valign: bottom
---

## Bottom-aligned

Text`);

      expect(result).toHaveLength(1);
      expect(result[0].align).toBeUndefined();
      expect(result[0].valign).toBe("bottom");
    });

    it("should ignore invalid align/valign values", () => {
      const result = parseMarkdown(`---
align: invalid
valign: wrong
---

## Slide

Text`);

      expect(result).toHaveLength(1);
      expect(result[0].align).toBeUndefined();
      expect(result[0].valign).toBeUndefined();
    });
  });

  describe("footnotes", () => {
    it("parses footnote references in text", () => {
      const result = parseMarkdown(`## Test

Text with a footnote[^1].

[^1]: This is the footnote content.`);

      expect(result).toHaveLength(1);
      expect(result[0].footnotes).toHaveLength(1);
      expect(result[0].footnotes?.[0].id).toBe("1");
      expect(result[0].footnotes?.[0].content).toBe(
        "This is the footnote content.",
      );
    });

    it("displays footnote reference as [id] with superscript style", () => {
      const result = parseMarkdown(`## Test

Text[^1] here.

[^1]: Footnote.`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks[1];
      expect(block?.kind).toBe("paragraph");
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "[1]", superscript: true });
      }
    });

    it("handles multiple footnotes", () => {
      const result = parseMarkdown(`## Test

First[^1] and second[^2].

[^1]: First footnote.
[^2]: Second footnote.`);

      expect(result).toHaveLength(1);
      expect(result[0].footnotes).toHaveLength(2);
      expect(result[0].footnotes?.[0].id).toBe("1");
      expect(result[0].footnotes?.[1].id).toBe("2");
    });

    it("handles named footnotes", () => {
      const result = parseMarkdown(`## Test

Text[^note].

[^note]: Named footnote content.`);

      expect(result).toHaveLength(1);
      expect(result[0].footnotes).toHaveLength(1);
      expect(result[0].footnotes?.[0].id).toBe("note");
      expect(result[0].footnotes?.[0].content).toBe("Named footnote content.");
    });

    it("preserves footnote order", () => {
      const result = parseMarkdown(`## Test

A[^a] B[^b] C[^c].

[^a]: Alpha
[^b]: Beta
[^c]: Gamma`);

      expect(result).toHaveLength(1);
      expect(result[0].footnotes).toHaveLength(3);
      expect(result[0].footnotes?.[0].id).toBe("a");
      expect(result[0].footnotes?.[1].id).toBe("b");
      expect(result[0].footnotes?.[2].id).toBe("c");
    });

    it("extracts spans from footnote content", () => {
      const result = parseMarkdown(`## Test

Text[^1].

[^1]: Footnote with **bold** text.`);

      expect(result).toHaveLength(1);
      const footnote = result[0].footnotes?.[0];
      expect(footnote?.spans).toContainEqual({ text: "bold", bold: true });
    });

    it("handles footnote without definition gracefully", () => {
      const result = parseMarkdown(`## Test

Text with undefined reference[^undefined].`);

      expect(result).toHaveLength(1);
      // Without a matching definition, remark-gfm keeps the raw text as-is
      const block = result[0].blocks[1];
      if (block?.kind === "paragraph" && block.spans) {
        // The text contains [^undefined] literally since no definition exists
        expect(block.spans[0].text).toContain("[^undefined]");
      }
      // No footnotes defined
      expect(result[0].footnotes).toBeUndefined();
    });

    it("handles footnotes per slide independently", () => {
      const result = parseMarkdown(`## Slide 1

Text[^1].

[^1]: Slide 1 footnote.

---

## Slide 2

Text[^1].

[^1]: Slide 2 footnote.`);

      expect(result).toHaveLength(2);
      expect(result[0].footnotes).toHaveLength(1);
      expect(result[0].footnotes?.[0].content).toBe("Slide 1 footnote.");
      expect(result[1].footnotes).toHaveLength(1);
      expect(result[1].footnotes?.[0].content).toBe("Slide 2 footnote.");
    });
  });

  describe("transitions", () => {
    it("applies global transition to all slides", () => {
      const result = parseMarkdown(`---
transition: dissolve
---

# Title

---

## Slide 2

Body text.`);

      expect(result).toHaveLength(2);
      expect(result[0].transition?.style).toBe("dissolve");
      expect(result[1].transition?.style).toBe("dissolve");
    });

    it("allows per-slide transition override", () => {
      const result = parseMarkdown(`---
transition: dissolve
---

# Title

---
transition: slide-from-right
---
## Slide 2

Body text.`);

      expect(result).toHaveLength(2);
      expect(result[0].transition?.style).toBe("dissolve");
      expect(result[1].transition?.style).toBe("slide-from-right");
    });

    it("disables transition with none", () => {
      const result = parseMarkdown(`---
transition: dissolve
---

# Title

---
transition: none
---
## Slide 2

Body text.`);

      expect(result).toHaveLength(2);
      expect(result[0].transition?.style).toBe("dissolve");
      expect(result[1].transition?.style).toBe("none");
    });

    it("parses full transition config from global frontmatter", () => {
      const result = parseMarkdown(`---
transition:
  style: slide-from-right
  duration: 0.5
  curve: ease-in-and-out
  timing:
    type: after-delay
    delay: 2
---

# Title`);

      expect(result).toHaveLength(1);
      expect(result[0].transition?.style).toBe("slide-from-right");
      expect(result[0].transition?.duration).toBe(0.5);
      expect(result[0].transition?.curve).toBe("ease-in-and-out");
      expect(result[0].transition?.timing).toEqual({
        type: "after-delay",
        delay: 2,
      });
    });

    it("merges transition properties from global and per-slide", () => {
      const result = parseMarkdown(`---
transition:
  style: dissolve
  duration: 0.3
  curve: ease-out
---

# Title

---
---
transition: slide-from-right
---
## Slide 2

Body text.`);

      expect(result).toHaveLength(2);
      // First slide uses global transition
      expect(result[0].transition?.style).toBe("dissolve");
      expect(result[0].transition?.duration).toBe(0.3);
      expect(result[0].transition?.curve).toBe("ease-out");
      // Second slide overrides style but inherits other props
      expect(result[1].transition?.style).toBe("slide-from-right");
      expect(result[1].transition?.duration).toBe(0.3);
      expect(result[1].transition?.curve).toBe("ease-out");
    });

    it("handles transition shorthand with duration", () => {
      const result = parseMarkdown(`---
transition: push-from-bottom 0.8
---

# Title`);

      expect(result).toHaveLength(1);
      expect(result[0].transition?.style).toBe("push-from-bottom");
      expect(result[0].transition?.duration).toBe(0.8);
    });

    it("returns undefined transition when not specified", () => {
      const result = parseMarkdown(`# Title

Some content.`);

      expect(result).toHaveLength(1);
      expect(result[0].transition).toBeUndefined();
    });
  });

  describe("h1 and h2 in same slide", () => {
    it("should include both h1 and h2 as blocks when in same slide", () => {
      const result = parseMarkdown(`# Main Title

## Subtitle`);

      expect(result).toHaveLength(1);
      expect(result[0].blocks).toHaveLength(2);

      const h1Block = result[0].blocks[0];
      const h2Block = result[0].blocks[1];

      expect(h1Block.kind).toBe("heading");
      expect(h2Block.kind).toBe("heading");

      if (h1Block.kind === "heading") {
        expect(h1Block.level).toBe(1);
        expect(h1Block.text).toBe("Main Title");
      }
      if (h2Block.kind === "heading") {
        expect(h2Block.level).toBe(2);
        expect(h2Block.text).toBe("Subtitle");
      }
    });

    it("should include h2 then h1 in order when h2 comes first", () => {
      const result = parseMarkdown(`## Subtitle First

# Then Title`);

      expect(result).toHaveLength(1);
      expect(result[0].blocks).toHaveLength(2);

      const firstBlock = result[0].blocks[0];
      const secondBlock = result[0].blocks[1];

      if (firstBlock.kind === "heading") {
        expect(firstBlock.level).toBe(2);
        expect(firstBlock.text).toBe("Subtitle First");
      }
      if (secondBlock.kind === "heading") {
        expect(secondBlock.level).toBe(1);
        expect(secondBlock.text).toBe("Then Title");
      }
    });

    it("should handle multiple h1 and h2 headings", () => {
      const result = parseMarkdown(`# First H1

## First H2

# Second H1

## Second H2`);

      expect(result).toHaveLength(1);
      expect(result[0].blocks).toHaveLength(4);

      const levels = result[0].blocks.map((b) =>
        b.kind === "heading" ? b.level : null,
      );
      expect(levels).toEqual([1, 2, 1, 2]);
    });
  });
});

describe("parseImageAlt", () => {
  it("should parse width only", () => {
    const result = parseImageAlt("w:400");
    expect(result).toEqual({
      cleanAlt: "",
      size: { width: 400, height: undefined },
    });
  });

  it("should parse height only", () => {
    const result = parseImageAlt("h:300");
    expect(result).toEqual({
      cleanAlt: "",
      size: { width: undefined, height: 300 },
    });
  });

  it("should parse both dimensions", () => {
    const result = parseImageAlt("w:400 h:300");
    expect(result).toEqual({ cleanAlt: "", size: { width: 400, height: 300 } });
  });

  it("should parse percentage width", () => {
    const result = parseImageAlt("w:50%");
    expect(result).toEqual({
      cleanAlt: "",
      size: { width: 960, height: undefined },
    });
  });

  it("should parse percentage height", () => {
    const result = parseImageAlt("h:25%");
    expect(result).toEqual({
      cleanAlt: "",
      size: { width: undefined, height: 270 },
    });
  });

  it("should preserve alt text after size", () => {
    const result = parseImageAlt("w:400 ロゴ画像");
    expect(result).toEqual({
      cleanAlt: "ロゴ画像",
      size: { width: 400, height: undefined },
    });
  });

  it("should preserve alt text with both dimensions", () => {
    const result = parseImageAlt("w:400 h:300 説明文");
    expect(result).toEqual({
      cleanAlt: "説明文",
      size: { width: 400, height: 300 },
    });
  });

  it("should return original alt when no size specified", () => {
    const result = parseImageAlt("通常のalt");
    expect(result).toEqual({ cleanAlt: "通常のalt" });
  });

  it("should handle empty alt", () => {
    const result = parseImageAlt("");
    expect(result).toEqual({ cleanAlt: "" });
  });

  it("should strip invalid zero values from alt text", () => {
    const result = parseImageAlt("w:0 h:0");
    // Zero values are invalid and stripped from alt text
    expect(result).toEqual({ cleanAlt: "" });
  });

  it("should handle size in middle of alt text", () => {
    const result = parseImageAlt("logo w:200 image");
    expect(result).toEqual({
      cleanAlt: "logo image",
      size: { width: 200, height: undefined },
    });
  });

  // Position parsing tests
  it("should parse x position only", () => {
    const result = parseImageAlt("x:100");
    expect(result).toEqual({
      cleanAlt: "",
      position: { x: 100, y: undefined },
    });
  });

  it("should parse y position only", () => {
    const result = parseImageAlt("y:200");
    expect(result).toEqual({
      cleanAlt: "",
      position: { x: undefined, y: 200 },
    });
  });

  it("should parse both x and y positions", () => {
    const result = parseImageAlt("x:100 y:200");
    expect(result).toEqual({
      cleanAlt: "",
      position: { x: 100, y: 200 },
    });
  });

  it("should parse percentage x position (based on SLIDE_WIDTH 1920)", () => {
    const result = parseImageAlt("x:50%");
    expect(result).toEqual({
      cleanAlt: "",
      position: { x: 960, y: undefined },
    });
  });

  it("should parse percentage y position (based on SLIDE_HEIGHT 1080)", () => {
    const result = parseImageAlt("y:50%");
    expect(result).toEqual({
      cleanAlt: "",
      position: { x: undefined, y: 540 },
    });
  });

  it("should parse size and position together", () => {
    const result = parseImageAlt("w:400 h:300 x:100 y:200");
    expect(result).toEqual({
      cleanAlt: "",
      size: { width: 400, height: 300 },
      position: { x: 100, y: 200 },
    });
  });

  it("should parse size, position and alt text", () => {
    const result = parseImageAlt("w:400 x:100 y:200 Product shot");
    expect(result).toEqual({
      cleanAlt: "Product shot",
      size: { width: 400, height: undefined },
      position: { x: 100, y: 200 },
    });
  });

  it("should handle tokens in any order", () => {
    const result = parseImageAlt("y:200 w:400 x:100 h:300 説明");
    expect(result).toEqual({
      cleanAlt: "説明",
      size: { width: 400, height: 300 },
      position: { x: 100, y: 200 },
    });
  });

  it("should handle x:0 and y:0 as valid positions", () => {
    const result = parseImageAlt("x:0 y:0");
    expect(result).toEqual({
      cleanAlt: "",
      position: { x: 0, y: 0 },
    });
  });
});

describe("columns blocks", () => {
  it("should parse basic 2-column layout", () => {
    const result = parseMarkdown(`## Two Columns

:::columns
:::column
Left content

- Item 1
- Item 2
:::column
Right content

Some paragraph.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(2); // heading + columns

    const columnsBlock = blocks[1];
    expect(columnsBlock.kind).toBe("columns");
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns).toHaveLength(2);
      // Left column should have paragraph + bullets
      expect(columnsBlock.columns[0]).toHaveLength(2);
      expect(columnsBlock.columns[0][0].kind).toBe("paragraph");
      expect(columnsBlock.columns[0][1].kind).toBe("bullets");
      // Right column should have paragraph + paragraph
      expect(columnsBlock.columns[1]).toHaveLength(2);
      expect(columnsBlock.columns[1][0].kind).toBe("paragraph");
      expect(columnsBlock.columns[1][1].kind).toBe("paragraph");
    }
  });

  it("should parse 3-column layout", () => {
    const result = parseMarkdown(`## Three Columns

:::columns
:::column
Column 1
:::column
Column 2
:::column
Column 3
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    expect(columnsBlock.kind).toBe("columns");
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns).toHaveLength(3);
    }
  });

  it("should parse 4-column layout", () => {
    const result = parseMarkdown(`## Four Columns

:::columns
:::column
A
:::column
B
:::column
C
:::column
D
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns).toHaveLength(4);
    }
  });

  it("should parse gap attribute", () => {
    const result = parseMarkdown(`## With Gap

:::columns gap=64
:::column
Left
:::column
Right
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.gap).toBe(64);
    }
  });

  it("should clamp gap to maximum", () => {
    const result = parseMarkdown(`## Max Gap

:::columns gap=500
:::column
Left
:::column
Right
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.gap).toBe(200); // MAX_COLUMN_GAP
    }
  });

  it("should parse fr width specification", () => {
    const result = parseMarkdown(`## FR Widths

:::columns width=1fr/2fr
:::column
Narrow
:::column
Wide
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.widths).toBeDefined();
      expect(columnsBlock.widths).toHaveLength(2);
      // 1fr/2fr with default gap=32, available width = 1600 - 32 = 1568
      // 1fr = 1568 / 3 ≈ 523, 2fr = 1568 * 2/3 ≈ 1045
      if (columnsBlock.widths) {
        expect(columnsBlock.widths[0]).toBeLessThan(columnsBlock.widths[1]);
      }
    }
  });

  it("should fallback with mismatched width count", () => {
    const result = parseMarkdown(`## Mismatched Widths

:::columns width=1fr/2fr/3fr
:::column
Left
:::column
Right
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      // Width count (3) doesn't match column count (2), should fallback to undefined
      expect(columnsBlock.widths).toBeUndefined();
    }
  });

  it("should handle columns with code blocks", () => {
    const result = parseMarkdown(`## Code Columns

:::columns
:::column
\`\`\`js
const a = 1;
\`\`\`
:::column
\`\`\`ts
const b: number = 2;
\`\`\`
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns[0][0].kind).toBe("code");
      expect(columnsBlock.columns[1][0].kind).toBe("code");
    }
  });

  it("should handle columns with headings", () => {
    const result = parseMarkdown(`## Main Title

:::columns
:::column
### Left Section

Content
:::column
### Right Section

More content
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns[0][0].kind).toBe("heading");
      if (columnsBlock.columns[0][0].kind === "heading") {
        expect(columnsBlock.columns[0][0].level).toBe(3);
      }
    }
  });

  it("should handle columns with images", () => {
    const result = parseMarkdown(`## Images

:::columns
:::column
![w:400](https://example.com/img1.png)
:::column
![w:400](https://example.com/img2.png)
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns[0][0].kind).toBe("image");
      expect(columnsBlock.columns[1][0].kind).toBe("image");
    }
  });

  it("should handle columns with blockquotes", () => {
    const result = parseMarkdown(`## Quotes

:::columns
:::column
> First quote
:::column
> Second quote
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns[0][0].kind).toBe("blockquote");
      expect(columnsBlock.columns[1][0].kind).toBe("blockquote");
    }
  });

  it("should handle columns with tables", () => {
    const result = parseMarkdown(`## Tables

:::columns
:::column
| A | B |
|---|---|
| 1 | 2 |
:::column
| C | D |
|---|---|
| 3 | 4 |
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      expect(columnsBlock.columns[0][0].kind).toBe("table");
      expect(columnsBlock.columns[1][0].kind).toBe("table");
    }
  });

  it("should preserve inline formatting in columns", () => {
    const result = parseMarkdown(`## Formatted

:::columns
:::column
This has **bold** and *italic*.
:::column
This has \`code\` and [links](https://example.com).
:::`);

    expect(result).toHaveLength(1);
    const columnsBlock = result[0].blocks[1];
    if (columnsBlock.kind === "columns") {
      const leftPara = columnsBlock.columns[0][0];
      if (leftPara.kind === "paragraph" && leftPara.spans) {
        expect(leftPara.spans).toContainEqual({ text: "bold", bold: true });
        expect(leftPara.spans).toContainEqual({ text: "italic", italic: true });
      }
    }
  });

  it("should render content linearly when fewer than 2 columns", () => {
    const result = parseMarkdown(`## Single Column

:::columns
:::column
Only one column
:::`);

    expect(result).toHaveLength(1);
    // With < 2 columns, content should be rendered linearly (fallback)
    // The blocks array should not contain a columns block
    const blocks = result[0].blocks;
    const hasColumnsBlock = blocks.some((b) => b.kind === "columns");
    expect(hasColumnsBlock).toBe(false);
  });

  it("should handle multiple columns blocks in one slide", () => {
    const result = parseMarkdown(`## Multiple Columns Blocks

:::columns
:::column
First left
:::column
First right
:::

Middle content

:::columns
:::column
Second left
:::column
Second right
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    // heading + columns + paragraph + columns = 4 blocks
    expect(blocks).toHaveLength(4);
    expect(blocks[0].kind).toBe("heading");
    expect(blocks[1].kind).toBe("columns");
    expect(blocks[2].kind).toBe("paragraph");
    expect(blocks[3].kind).toBe("columns");
  });

  it("should not collide figma placeholders between global and columns", () => {
    const result = parseMarkdown(`## Slide

:::figma
link=https://www.figma.com/file/outside/Name?node-id=1-2
:::

:::columns
:::column
:::figma
link=https://www.figma.com/file/inside/Name?node-id=3-4
:::
:::column
Regular text.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(3); // heading + figma + columns

    expect(blocks[1].kind).toBe("figma");
    if (blocks[1].kind === "figma") {
      expect(blocks[1].link.fileKey).toBe("outside");
    }

    expect(blocks[2].kind).toBe("columns");
    if (blocks[2].kind === "columns") {
      const leftColumn = blocks[2].columns[0];
      expect(leftColumn[0].kind).toBe("figma");
      if (leftColumn[0].kind === "figma") {
        expect(leftColumn[0].link.fileKey).toBe("inside");
      }
    }
  });
});

describe("Callout blocks", () => {
  it("should parse :::note block", () => {
    const result = parseMarkdown(`## Slide

:::note
This is a note.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(2); // heading + callout
    expect(blocks[1].kind).toBe("callout");
    if (blocks[1].kind === "callout") {
      expect(blocks[1].type).toBe("note");
      expect(blocks[1].text).toBe("This is a note.");
    }
  });

  it("should parse :::tip block", () => {
    const result = parseMarkdown(`## Slide

:::tip
A helpful tip.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1].kind).toBe("callout");
    if (blocks[1].kind === "callout") {
      expect(blocks[1].type).toBe("tip");
    }
  });

  it("should parse :::warning block", () => {
    const result = parseMarkdown(`## Slide

:::warning
Be careful!
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1].kind).toBe("callout");
    if (blocks[1].kind === "callout") {
      expect(blocks[1].type).toBe("warning");
    }
  });

  it("should parse :::caution block", () => {
    const result = parseMarkdown(`## Slide

:::caution
This is irreversible.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1].kind).toBe("callout");
    if (blocks[1].kind === "callout") {
      expect(blocks[1].type).toBe("caution");
    }
  });

  it("should preserve inline formatting in callout blocks", () => {
    const result = parseMarkdown(`## Slide

:::note
This has **bold** and *italic* text.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1].kind).toBe("callout");
    if (blocks[1].kind === "callout") {
      expect(blocks[1].spans).toBeDefined();
      const spans = blocks[1].spans ?? [];
      const boldSpan = spans.find((s) => s.bold);
      const italicSpan = spans.find((s) => s.italic);
      expect(boldSpan?.text).toBe("bold");
      expect(italicSpan?.text).toBe("italic");
    }
  });

  it("should parse multiple callout blocks in same slide", () => {
    const result = parseMarkdown(`## Slide

:::note
A note.
:::

:::tip
A tip.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(3); // heading + 2 callouts
    expect(blocks[1].kind).toBe("callout");
    expect(blocks[2].kind).toBe("callout");
    if (blocks[1].kind === "callout" && blocks[2].kind === "callout") {
      expect(blocks[1].type).toBe("note");
      expect(blocks[2].type).toBe("tip");
    }
  });

  it("should work with callout inside columns", () => {
    const result = parseMarkdown(`## Slide

:::columns
:::column
:::note
Note in column.
:::
:::column
Regular text.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(2); // heading + columns
    expect(blocks[1].kind).toBe("columns");
    if (blocks[1].kind === "columns") {
      const leftColumn = blocks[1].columns[0];
      expect(leftColumn[0].kind).toBe("callout");
      if (leftColumn[0].kind === "callout") {
        expect(leftColumn[0].type).toBe("note");
      }
    }
  });

  it("should not collide callout placeholders between global and columns", () => {
    const result = parseMarkdown(`## Slide

:::note
Outside note.
:::

:::columns
:::column
:::tip
Tip in column.
:::
:::column
Regular text.
:::`);

    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    expect(blocks).toHaveLength(3); // heading + callout + columns

    expect(blocks[1].kind).toBe("callout");
    if (blocks[1].kind === "callout") {
      expect(blocks[1].type).toBe("note");
      expect(blocks[1].text).toBe("Outside note.");
    }

    expect(blocks[2].kind).toBe("columns");
    if (blocks[2].kind === "columns") {
      const leftColumn = blocks[2].columns[0];
      expect(leftColumn[0].kind).toBe("callout");
      if (leftColumn[0].kind === "callout") {
        expect(leftColumn[0].type).toBe("tip");
        expect(leftColumn[0].text).toBe("Tip in column.");
      }
    }
  });
});
