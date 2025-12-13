import { describe, expect, it } from "bun:test";
import { extractCalloutBlocks, matchCalloutPlaceholder } from "./callout-block";

describe("extractCalloutBlocks", () => {
  it("should extract :::note block", () => {
    const markdown = `Some text

:::note
This is a note.
:::

More text`;

    const { processedMarkdown, calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    expect(calloutBlocks[0].type).toBe("note");
    expect(calloutBlocks[0].content).toBe("This is a note.");
    expect(processedMarkdown).toContain("FIGDECK_CALLOUT_BLOCK_0_PLACEHOLDER");
    expect(processedMarkdown).not.toContain(":::note");
  });

  it("should extract :::tip block", () => {
    const markdown = `:::tip
A helpful tip.
:::`;

    const { calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    expect(calloutBlocks[0].type).toBe("tip");
    expect(calloutBlocks[0].content).toBe("A helpful tip.");
  });

  it("should extract :::warning block", () => {
    const markdown = `:::warning
Be careful with this.
:::`;

    const { calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    expect(calloutBlocks[0].type).toBe("warning");
    expect(calloutBlocks[0].content).toBe("Be careful with this.");
  });

  it("should extract :::caution block", () => {
    const markdown = `:::caution
This action is irreversible.
:::`;

    const { calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    expect(calloutBlocks[0].type).toBe("caution");
    expect(calloutBlocks[0].content).toBe("This action is irreversible.");
  });

  it("should extract multiple callout blocks", () => {
    const markdown = `:::note
First note.
:::

:::tip
A tip here.
:::

:::warning
A warning.
:::`;

    const { processedMarkdown, calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(3);
    expect(calloutBlocks[0].type).toBe("note");
    expect(calloutBlocks[1].type).toBe("tip");
    expect(calloutBlocks[2].type).toBe("warning");
    expect(processedMarkdown).toContain("FIGDECK_CALLOUT_BLOCK_0_PLACEHOLDER");
    expect(processedMarkdown).toContain("FIGDECK_CALLOUT_BLOCK_1_PLACEHOLDER");
    expect(processedMarkdown).toContain("FIGDECK_CALLOUT_BLOCK_2_PLACEHOLDER");
  });

  it("should support startIndex option", () => {
    const markdown = `:::note
First note.
:::

:::tip
Second tip.
:::`;

    const { processedMarkdown, calloutBlocks } = extractCalloutBlocks(
      markdown,
      {
        startIndex: 5,
      },
    );

    expect(calloutBlocks).toHaveLength(2);
    expect(calloutBlocks[0].id).toBe("FIGDECK_CALLOUT_BLOCK_5_PLACEHOLDER");
    expect(calloutBlocks[1].id).toBe("FIGDECK_CALLOUT_BLOCK_6_PLACEHOLDER");
    expect(processedMarkdown).toContain("FIGDECK_CALLOUT_BLOCK_5_PLACEHOLDER");
    expect(processedMarkdown).toContain("FIGDECK_CALLOUT_BLOCK_6_PLACEHOLDER");
  });

  it("should preserve inline formatting in spans", () => {
    const markdown = `:::note
This has **bold** and *italic* text.
:::`;

    const { calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    expect(calloutBlocks[0].spans).toBeDefined();
    expect(calloutBlocks[0].spans.length).toBeGreaterThan(0);

    // Check that spans contain the formatting
    const spans = calloutBlocks[0].spans;
    const boldSpan = spans.find((s) => s.bold);
    const italicSpan = spans.find((s) => s.italic);

    expect(boldSpan).toBeDefined();
    expect(boldSpan?.text).toBe("bold");
    expect(italicSpan).toBeDefined();
    expect(italicSpan?.text).toBe("italic");
  });

  it("should handle multiline content", () => {
    const markdown = `:::note
Line 1.
Line 2.
Line 3.
:::`;

    const { calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    expect(calloutBlocks[0].content).toBe("Line 1.\nLine 2.\nLine 3.");
  });

  it("should not affect non-callout content", () => {
    const markdown = `# Heading

Regular paragraph.

\`\`\`code
some code
\`\`\``;

    const { processedMarkdown, calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(0);
    expect(processedMarkdown).toBe(markdown);
  });

  it("should handle links in callout content", () => {
    const markdown = `:::tip
Check out [this link](https://example.com) for more info.
:::`;

    const { calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    const linkSpan = calloutBlocks[0].spans.find((s) => s.href);
    expect(linkSpan).toBeDefined();
    expect(linkSpan?.href).toBe("https://example.com");
    expect(linkSpan?.text).toBe("this link");
  });

  it("should handle inline code in callout content", () => {
    const markdown = `:::note
Use \`console.log()\` for debugging.
:::`;

    const { calloutBlocks } = extractCalloutBlocks(markdown);

    expect(calloutBlocks).toHaveLength(1);
    const codeSpan = calloutBlocks[0].spans.find((s) => s.code);
    expect(codeSpan).toBeDefined();
    expect(codeSpan?.text).toBe("console.log()");
  });
});

describe("matchCalloutPlaceholder", () => {
  it("should match valid placeholder and return index", () => {
    expect(matchCalloutPlaceholder("FIGDECK_CALLOUT_BLOCK_0_PLACEHOLDER")).toBe(
      0,
    );
    expect(matchCalloutPlaceholder("FIGDECK_CALLOUT_BLOCK_5_PLACEHOLDER")).toBe(
      5,
    );
    expect(
      matchCalloutPlaceholder("FIGDECK_CALLOUT_BLOCK_123_PLACEHOLDER"),
    ).toBe(123);
  });

  it("should return null for non-matching text", () => {
    expect(matchCalloutPlaceholder("Some random text")).toBeNull();
    expect(
      matchCalloutPlaceholder("FIGDECK_CALLOUT_BLOCK_PLACEHOLDER"),
    ).toBeNull();
    expect(
      matchCalloutPlaceholder("FIGDECK_CALLOUT_BLOCK_abc_PLACEHOLDER"),
    ).toBeNull();
    expect(
      matchCalloutPlaceholder("FIGDECK_FIGMA_BLOCK_0_PLACEHOLDER"),
    ).toBeNull();
  });
});
