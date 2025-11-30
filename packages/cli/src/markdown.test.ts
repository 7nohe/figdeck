import { describe, expect, it } from "bun:test";
import { parseMarkdown } from "./markdown.js";

describe("parseMarkdown", () => {
  describe("inline formatting", () => {
    it("should parse bold text", () => {
      const result = parseMarkdown("## Test\n\nThis is **bold** text.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
      expect(block?.kind).toBe("paragraph");
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "bold", bold: true });
      }
    });

    it("should parse italic text", () => {
      const result = parseMarkdown("## Test\n\nThis is *italic* text.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "italic", italic: true });
      }
    });

    it("should parse strikethrough text", () => {
      const result = parseMarkdown("## Test\n\nThis is ~~deleted~~ text.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "deleted", strike: true });
      }
    });

    it("should parse inline code", () => {
      const result = parseMarkdown("## Test\n\nUse `code` here.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
      if (block?.kind === "paragraph" && block.spans) {
        expect(block.spans).toContainEqual({ text: "code", code: true });
      }
    });

    it("should parse links", () => {
      const result = parseMarkdown(
        "## Test\n\nVisit [Figma](https://figma.com).",
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
      expect(block?.kind).toBe("bullets");
      if (block?.kind === "bullets") {
        expect(block.ordered).toBe(true);
        expect(block.start).toBe(1);
        expect(block.items).toEqual(["First", "Second", "Third"]);
      }
    });

    it("should preserve custom start number", () => {
      const result = parseMarkdown("## Test\n\n5. Fifth\n6. Sixth");
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
      expect(block?.kind).toBe("blockquote");
      if (block?.kind === "blockquote") {
        expect(block.text).toBe("This is a quote.");
      }
    });

    it("should parse blockquote with formatting", () => {
      const result = parseMarkdown("## Test\n\n> Quote with **bold**.");
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
      expect(block?.kind).toBe("code");
      if (block?.kind === "code") {
        expect(block.language).toBe("typescript");
        expect(block.code).toBe("const x = 1;");
      }
    });
  });

  describe("legacy compatibility", () => {
    it("should populate body array for paragraphs", () => {
      const result = parseMarkdown("## Test\n\nParagraph text.");
      expect(result).toHaveLength(1);
      expect(result[0].body).toEqual(["Paragraph text."]);
    });

    it("should populate bullets array for lists", () => {
      const result = parseMarkdown("## Test\n\n- Item 1\n- Item 2");
      expect(result).toHaveLength(1);
      expect(result[0].bullets).toEqual(["Item 1", "Item 2"]);
    });
  });

  describe("figma blocks", () => {
    it("should parse :::figma block with valid URL", () => {
      const result = parseMarkdown(`## Test

:::figma
link=https://www.figma.com/file/abc123/MyFile?node-id=1234-5678
:::`);
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      // Block should not be added since link is missing
      expect(result[0].blocks).toBeUndefined();
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
      expect(blocks).toHaveLength(3); // figma, paragraph, figma
      expect(blocks?.[0]?.kind).toBe("figma");
      expect(blocks?.[1]?.kind).toBe("paragraph");
      expect(blocks?.[2]?.kind).toBe("figma");
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
      expect(result[0].type).toBe("title");
      expect(result[0].title).toBe("Title Only");
      expect(result[0].blocks).toBeUndefined();
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
      expect(blocks).toHaveLength(4);
      expect(blocks?.[0]?.kind).toBe("paragraph");
      expect(blocks?.[1]?.kind).toBe("bullets");
      expect(blocks?.[2]?.kind).toBe("code");
      expect(blocks?.[3]?.kind).toBe("blockquote");
    });

    it("should process h3 and h4 as content blocks", () => {
      const result = parseMarkdown(`## Main Title

### Sub Heading

#### Sub-sub Heading`);

      expect(result).toHaveLength(1);
      const blocks = result[0].blocks;
      expect(blocks).toHaveLength(2);

      if (blocks?.[0]?.kind === "heading") {
        expect(blocks[0].level).toBe(3);
        expect(blocks[0].text).toBe("Sub Heading");
      }
      if (blocks?.[1]?.kind === "heading") {
        expect(blocks[1].level).toBe(4);
        expect(blocks[1].text).toBe("Sub-sub Heading");
      }
    });

    it("should create content slide from paragraph without heading", () => {
      const result = parseMarkdown("Just a paragraph without heading.");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("content");
      expect(result[0].title).toBeUndefined();
      expect(result[0].blocks?.[0]?.kind).toBe("paragraph");
    });

    it("should process images within paragraphs", () => {
      const result = parseMarkdown(`## Images

![Screenshot](https://example.com/img.png)

![Another](https://example.com/other.jpg)`);

      expect(result).toHaveLength(1);
      const blocks = result[0].blocks;
      expect(blocks).toHaveLength(2);
      expect(blocks?.[0]?.kind).toBe("image");
      expect(blocks?.[1]?.kind).toBe("image");

      if (blocks?.[0]?.kind === "image") {
        expect(blocks[0].url).toBe("https://example.com/img.png");
        expect(blocks[0].alt).toBe("Screenshot");
      }
    });

    it("should handle complex nested list formatting", () => {
      const result = parseMarkdown(`## List Test

- **Bold** item
- *Italic* item
- \`code\` item
- [Link](https://example.com) item`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
      expect(block?.kind).toBe("bullets");

      if (block?.kind === "bullets" && block.itemSpans) {
        expect(block.items).toHaveLength(4);
        expect(block.itemSpans).toHaveLength(4);
        // Check that spans contain formatting
        expect(block.itemSpans[0]).toContainEqual({ text: "Bold", bold: true });
        expect(block.itemSpans[1]).toContainEqual({
          text: "Italic",
          italic: true,
        });
        expect(block.itemSpans[2]).toContainEqual({ text: "code", code: true });
        expect(block.itemSpans[3]).toContainEqual({
          text: "Link",
          href: "https://example.com",
        });
      }
    });

    it("should process multiple slides with different types", () => {
      const result = parseMarkdown(`# Title Slide

---

## Content Slide

Body text

---

## Another Content

- Bullet`);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("title");
      expect(result[1].type).toBe("content");
      expect(result[2].type).toBe("content");
    });
  });

  describe("code block processing", () => {
    it("should populate codeBlocks array for legacy compatibility", () => {
      const result = parseMarkdown(`## Test

\`\`\`python
print("hello")
\`\`\``);

      expect(result).toHaveLength(1);
      expect(result[0].codeBlocks).toHaveLength(1);
      expect(result[0].codeBlocks?.[0].language).toBe("python");
      expect(result[0].codeBlocks?.[0].code).toBe('print("hello")');
    });

    it("should handle multiple code blocks", () => {
      const result = parseMarkdown(`## Test

\`\`\`js
const a = 1;
\`\`\`

\`\`\`ts
const b: number = 2;
\`\`\``);

      expect(result).toHaveLength(1);
      expect(result[0].codeBlocks).toHaveLength(2);
      expect(result[0].blocks).toHaveLength(2);
    });

    it("should handle code block without language", () => {
      const result = parseMarkdown(`## Test

\`\`\`
no language
\`\`\``);

      expect(result).toHaveLength(1);
      const codeBlock = result[0].codeBlocks?.[0];
      expect(codeBlock?.language).toBeUndefined();
      expect(codeBlock?.code).toBe("no language");
    });
  });

  describe("table processing", () => {
    it("should handle table without alignment", () => {
      const result = parseMarkdown(`## Test

| A | B |
|---|---|
| 1 | 2 |`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
      if (block?.kind === "blockquote") {
        expect(block.text).toContain("Line 1");
        expect(block.text).toContain("Line 2");
      }
    });

    it("should extract spans from blockquote", () => {
      const result = parseMarkdown(`## Test

> This has **bold** and *italic*.`);

      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
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
      const block = result[0].blocks?.[0];
      if (block?.kind === "image") {
        expect(block.alt).toBe("Detailed description of the image");
      }
    });

    it("should handle image without alt text", () => {
      const result = parseMarkdown(
        `## Test\n\n![](https://example.com/image.png)`,
      );
      expect(result).toHaveLength(1);
      const block = result[0].blocks?.[0];
      if (block?.kind === "image") {
        expect(block.alt).toBeUndefined();
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
});
