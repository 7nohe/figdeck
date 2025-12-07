import { describe, expect, it } from "bun:test";
import {
  extractFigmaBlocks,
  isValidFigmaHostname,
  matchFigmaPlaceholder,
  parseFigmaUrl,
} from "./figma-block";

describe("parseFigmaUrl", () => {
  describe("valid URLs", () => {
    it("should parse /file/ URL with node-id", () => {
      const result = parseFigmaUrl(
        "https://www.figma.com/file/abc123/MyFile?node-id=1234-5678",
      );
      expect(result.fileKey).toBe("abc123");
      expect(result.nodeId).toBe("1234:5678");
    });

    it("should parse /design/ URL", () => {
      const result = parseFigmaUrl(
        "https://www.figma.com/design/xyz789/Design?node-id=42-100",
      );
      expect(result.fileKey).toBe("xyz789");
      expect(result.nodeId).toBe("42:100");
    });

    it("should parse /slides/ URL", () => {
      const result = parseFigmaUrl(
        "https://figma.com/slides/slideKey/Presentation?node-id=10-20",
      );
      expect(result.fileKey).toBe("slideKey");
      expect(result.nodeId).toBe("10:20");
    });

    it("should handle URL-encoded node-id", () => {
      const result = parseFigmaUrl(
        "https://www.figma.com/file/abc/Name?node-id=1%3A2",
      );
      expect(result.nodeId).toBe("1:2");
    });

    it("should handle URL without node-id", () => {
      const result = parseFigmaUrl("https://www.figma.com/file/abc/MyFile");
      expect(result.fileKey).toBe("abc");
      expect(result.nodeId).toBeUndefined();
    });
  });

  describe("invalid URLs", () => {
    it("should return empty object for non-Figma URLs", () => {
      const result = parseFigmaUrl("https://example.com/file/abc?node-id=1-2");
      expect(result.fileKey).toBeUndefined();
      expect(result.nodeId).toBeUndefined();
    });

    it("should return empty object for invalid URLs", () => {
      const result = parseFigmaUrl("not-a-valid-url");
      expect(result.fileKey).toBeUndefined();
      expect(result.nodeId).toBeUndefined();
    });

    it("should return empty object for URLs without file/design/slides path", () => {
      const result = parseFigmaUrl(
        "https://www.figma.com/community/plugin/abc",
      );
      expect(result.fileKey).toBeUndefined();
    });
  });
});

describe("extractFigmaBlocks", () => {
  it("should extract a simple figma block with link= prefix", () => {
    const markdown = `## Test

:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
:::`;

    const { processedMarkdown, figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    expect(figmaBlocks[0].link.url).toBe(
      "https://www.figma.com/file/abc/Name?node-id=1-2",
    );
    expect(figmaBlocks[0].link.fileKey).toBe("abc");
    expect(figmaBlocks[0].link.nodeId).toBe("1:2");
    expect(processedMarkdown).toContain("FIGDECK_FIGMA_BLOCK_0_PLACEHOLDER");
    expect(processedMarkdown).not.toContain(":::figma");
  });

  it("should extract figma block with bare URL (no link= prefix)", () => {
    const markdown = `## Test

:::figma
https://www.figma.com/file/abc/Name?node-id=1-2
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    expect(figmaBlocks[0].link.url).toBe(
      "https://www.figma.com/file/abc/Name?node-id=1-2",
    );
  });

  it("should extract figma block with position", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
x=160
y=300
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks[0].link.x).toBe(160);
    expect(figmaBlocks[0].link.y).toBe(300);
  });

  it("should continue parsing properties after blank lines", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2

x=160
y=300

text.title=Hello
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks[0].link.x).toBe(160);
    expect(figmaBlocks[0].link.y).toBe(300);
    expect(figmaBlocks[0].link.textOverrides?.title?.text).toBe("Hello");
  });

  it("should extract multiple figma blocks", () => {
    const markdown = `## Slide

:::figma
link=https://www.figma.com/file/a/A?node-id=1-1
:::

Some text

:::figma
link=https://www.figma.com/file/b/B?node-id=2-2
:::`;

    const { processedMarkdown, figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(2);
    expect(figmaBlocks[0].link.fileKey).toBe("a");
    expect(figmaBlocks[1].link.fileKey).toBe("b");
    expect(processedMarkdown).toContain("FIGDECK_FIGMA_BLOCK_0_PLACEHOLDER");
    expect(processedMarkdown).toContain("FIGDECK_FIGMA_BLOCK_1_PLACEHOLDER");
  });

  it("should skip figma block without link", () => {
    const markdown = `:::figma
x=100
y=200
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);
    expect(figmaBlocks).toHaveLength(0);
  });

  it("should reject invalid Figma URL", () => {
    const markdown = `:::figma
link=not-a-valid-url
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    // Invalid URLs are now rejected for security
    expect(figmaBlocks).toHaveLength(0);
  });
});

describe("matchFigmaPlaceholder", () => {
  it("should match valid placeholder and return index", () => {
    expect(matchFigmaPlaceholder("FIGDECK_FIGMA_BLOCK_0_PLACEHOLDER")).toBe(0);
    expect(matchFigmaPlaceholder("FIGDECK_FIGMA_BLOCK_5_PLACEHOLDER")).toBe(5);
    expect(matchFigmaPlaceholder("FIGDECK_FIGMA_BLOCK_123_PLACEHOLDER")).toBe(
      123,
    );
  });

  it("should return null for non-matching text", () => {
    expect(matchFigmaPlaceholder("Some random text")).toBeNull();
    expect(matchFigmaPlaceholder("FIGDECK_FIGMA_BLOCK_PLACEHOLDER")).toBeNull();
    expect(
      matchFigmaPlaceholder("FIGDECK_FIGMA_BLOCK_abc_PLACEHOLDER"),
    ).toBeNull();
  });
});

describe("isValidFigmaHostname", () => {
  describe("valid hostnames", () => {
    it("should accept figma.com", () => {
      expect(isValidFigmaHostname("figma.com")).toBe(true);
    });

    it("should accept www.figma.com", () => {
      expect(isValidFigmaHostname("www.figma.com")).toBe(true);
    });

    it("should accept subdomains of figma.com", () => {
      expect(isValidFigmaHostname("api.figma.com")).toBe(true);
      expect(isValidFigmaHostname("staging.figma.com")).toBe(true);
    });
  });

  describe("invalid hostnames (security)", () => {
    it("should reject evilfigma.com (suffix attack)", () => {
      expect(isValidFigmaHostname("evilfigma.com")).toBe(false);
    });

    it("should reject sub.evilfigma.com", () => {
      expect(isValidFigmaHostname("sub.evilfigma.com")).toBe(false);
    });

    it("should reject figma.com.evil.com", () => {
      expect(isValidFigmaHostname("figma.com.evil.com")).toBe(false);
    });

    it("should reject notfigma.com", () => {
      expect(isValidFigmaHostname("notfigma.com")).toBe(false);
    });

    it("should reject figma.org", () => {
      expect(isValidFigmaHostname("figma.org")).toBe(false);
    });
  });
});

describe("extractFigmaBlocks security", () => {
  it("should reject figma blocks with spoofed hostname", () => {
    const markdown = `:::figma
https://evilfigma.com/file/abc/Name?node-id=1-2
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);
    expect(figmaBlocks).toHaveLength(0);
  });

  it("should reject figma blocks with invalid URL format", () => {
    const markdown = `:::figma
not-a-valid-url
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);
    expect(figmaBlocks).toHaveLength(0);
  });
});

describe("extractFigmaBlocks textOverrides", () => {
  it("should extract text.* properties as textOverrides with text and optional spans", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
text.title=Cart Feature
text.body=Use this for cart and confirmation flows.
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    expect(figmaBlocks[0].link.textOverrides).toBeDefined();
    expect(figmaBlocks[0].link.textOverrides?.title?.text).toBe("Cart Feature");
    expect(figmaBlocks[0].link.textOverrides?.body?.text).toBe(
      "Use this for cart and confirmation flows.",
    );
  });

  it("should support multiline text.* values with indentation", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
text.description=
  Line 1
  Line 2
  Line 3
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    // Each line becomes a separate paragraph, joined with double newlines
    expect(figmaBlocks[0].link.textOverrides?.description?.text).toBe(
      "Line 1\nLine 2\nLine 3",
    );
  });

  it("should convert bullet lists in multiline text to plain text bullets", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
text.content=
  - Variation A
  - Variation B
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    const content = figmaBlocks[0].link.textOverrides?.content?.text;
    expect(content).toContain("• Variation A");
    expect(content).toContain("• Variation B");
  });

  it("should convert blockquotes in multiline text to quoted text", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
text.note=
  > This is a note.
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    expect(figmaBlocks[0].link.textOverrides?.note?.text).toBe(
      '"This is a note."',
    );
  });

  it("should handle nested bullet lists with different markers", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
text.list=
  - Level 0
    - Level 1
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    const list = figmaBlocks[0].link.textOverrides?.list?.text;
    expect(list).toContain("• Level 0");
    expect(list).toContain("◦ Level 1");
  });

  it("should include spans for rich text formatting", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
text.formatted=This is **bold** and *italic*.
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    const formatted = figmaBlocks[0].link.textOverrides?.formatted;
    expect(formatted?.text).toBe("This is bold and italic.");
    expect(formatted?.spans).toBeDefined();
    // Check that spans contain bold and italic formatting
    const boldSpan = formatted?.spans?.find((s) => s.bold);
    const italicSpan = formatted?.spans?.find((s) => s.italic);
    expect(boldSpan?.text).toBe("bold");
    expect(italicSpan?.text).toBe("italic");
  });

  it("should support hideLink option", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
hideLink=true
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    expect(figmaBlocks[0].link.hideLink).toBe(true);
  });

  it("should not set hideLink when not specified", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    expect(figmaBlocks[0].link.hideLink).toBeUndefined();
  });

  it("should preserve existing behavior for blocks without textOverrides", () => {
    const markdown = `:::figma
link=https://www.figma.com/file/abc/Name?node-id=1-2
x=100
y=200
:::`;

    const { figmaBlocks } = extractFigmaBlocks(markdown);

    expect(figmaBlocks).toHaveLength(1);
    expect(figmaBlocks[0].link.url).toBe(
      "https://www.figma.com/file/abc/Name?node-id=1-2",
    );
    expect(figmaBlocks[0].link.x).toBe(100);
    expect(figmaBlocks[0].link.y).toBe(200);
    expect(figmaBlocks[0].link.textOverrides).toBeUndefined();
  });
});
