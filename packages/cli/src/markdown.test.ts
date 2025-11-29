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
});
