import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { BulletItem } from "@figdeck/shared";

// Mock for TextNode
function createMockTextNode(overrides: Partial<TextNode> = {}): TextNode {
  return {
    type: "TEXT",
    width: 800,
    height: 20,
    layoutSizingHorizontal: "HUG",
    textAutoResize: "WIDTH_AND_HEIGHT",
    resize: mock(() => {}),
    ...overrides,
  } as unknown as TextNode;
}

// Mock for FrameNode
function createMockFrameNode(
  overrides: Partial<FrameNode> & { children?: SceneNode[] } = {},
): FrameNode {
  const children = overrides.children || [];
  return {
    type: "FRAME",
    width: 400,
    height: 100,
    layoutMode: "VERTICAL",
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    children: children,
    ...overrides,
  } as unknown as FrameNode;
}

// Minimal figma + __html__ stubs for importing the plugin entrypoint
beforeEach(() => {
  (globalThis as { __html__?: string }).__html__ = "";
  (globalThis as { figma?: unknown }).figma = {
    showUI: mock(() => {}),
    ui: { postMessage: mock(() => {}), onmessage: null },
    notify: mock(() => {}),
  };
});

describe("validateAndSanitizeSlides", () => {
  it("preserves cover flag when boolean", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    const result = validateAndSanitizeSlides([
      {
        cover: true,
        blocks: [{ kind: "paragraph", text: "Cover" }],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.slides[0].cover).toBe(true);
  });

  it("drops cover flag when not boolean", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    const result = validateAndSanitizeSlides([
      {
        cover: "true",
        blocks: [{ kind: "paragraph", text: "Not cover" }],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.slides[0].cover).toBeUndefined();
  });

  it("preserves BulletItem hierarchy while sanitizing text", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    const result = validateAndSanitizeSlides([
      {
        blocks: [
          {
            kind: "bullets",
            items: [
              {
                text: "Parent item",
                spans: [{ text: "Parent span", bold: true }],
                children: [
                  { text: "Child item" },
                  {
                    text: "Child with grandchild",
                    children: [{ text: "Grandchild item" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    const block = result.slides[0].blocks[0];
    expect(block.kind).toBe("bullets");
    if (block.kind !== "bullets") return;

    const items = block.items as BulletItem[];
    expect(typeof items[0]).toBe("object");
    expect(items[0]?.text).toBe("Parent item");
    expect(items[0]?.spans?.[0].text).toBe("Parent span");
    expect(items[0]?.children?.[0].text).toBe("Child item");
    expect(items[0]?.children?.[1].text).toBe("Child with grandchild");
    expect(items[0]?.children?.[1].children?.[0].text).toBe("Grandchild item");
  });

  it("keeps nested list ordering metadata", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    const result = validateAndSanitizeSlides([
      {
        blocks: [
          {
            kind: "bullets",
            items: [
              {
                text: "Parent",
                childrenOrdered: true,
                childrenStart: 4,
                children: [{ text: "Child" }],
              },
            ],
          },
        ],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    const block = result.slides[0].blocks[0];
    if (block.kind !== "bullets") return;

    const bulletItems = block.items as BulletItem[];
    expect(bulletItems[0].childrenOrdered).toBe(true);
    expect(bulletItems[0].childrenStart).toBe(4);
  });

  it("rejects figma blocks with invalid URLs", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    const result = validateAndSanitizeSlides([
      {
        blocks: [
          {
            kind: "figma",
            link: { url: "https://evilfigma.com/file/abc/Name?node-id=1-2" },
          },
          { kind: "paragraph", text: "Valid content" },
        ],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    // The invalid figma block should be filtered out
    expect(result.slides[0].blocks.length).toBe(1);
    expect(result.slides[0].blocks[0].kind).toBe("paragraph");
  });

  it("accepts figma blocks with valid figma.com URLs", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    const result = validateAndSanitizeSlides([
      {
        blocks: [
          {
            kind: "figma",
            link: { url: "https://www.figma.com/file/abc/Name?node-id=1-2" },
          },
        ],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.slides[0].blocks.length).toBe(1);
    expect(result.slides[0].blocks[0].kind).toBe("figma");
  });

  it("limits TextSpan array length", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    // Create a block with excessive spans
    const manySpans = Array.from({ length: 1000 }, (_, i) => ({
      text: `span ${i}`,
    }));

    const result = validateAndSanitizeSlides([
      {
        blocks: [
          {
            kind: "paragraph",
            text: "Test",
            spans: manySpans,
          },
        ],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    const block = result.slides[0].blocks[0];
    if (block.kind !== "paragraph") return;

    // Should be limited to MAX_SPANS_PER_ELEMENT (500)
    expect(block.spans?.length).toBeLessThanOrEqual(500);
  });

  it("limits bullet items array length", async () => {
    const { validateAndSanitizeSlides } = await import("./code");

    // Create excessive bullet items
    const manyItems = Array.from({ length: 200 }, (_, i) => `Item ${i}`);

    const result = validateAndSanitizeSlides([
      {
        blocks: [
          {
            kind: "bullets",
            items: manyItems,
          },
        ],
      },
    ]);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    const block = result.slides[0].blocks[0];
    if (block.kind !== "bullets") return;

    // Should be limited to MAX_BULLET_ITEMS (100)
    expect(block.items.length).toBeLessThanOrEqual(100);
  });
});

describe("constrainNodeToWidth", () => {
  it("sets text node properties for wrapping", async () => {
    const { constrainNodeToWidth } = await import("./code");

    const textNode = createMockTextNode();
    constrainNodeToWidth(textNode as unknown as SceneNode, 400);

    expect(textNode.layoutSizingHorizontal).toBe("FIXED");
    expect(textNode.textAutoResize).toBe("HEIGHT");
    expect(textNode.resize).toHaveBeenCalledWith(400, 20);
  });

  it("sets frame node properties and processes children", async () => {
    const { constrainNodeToWidth } = await import("./code");

    const childText = createMockTextNode();
    const frameNode = createMockFrameNode({
      layoutMode: "VERTICAL",
      children: [childText as unknown as SceneNode],
    });

    constrainNodeToWidth(frameNode as unknown as SceneNode, 400);

    expect(frameNode.layoutSizingHorizontal).toBe("FILL");
    expect(frameNode.layoutSizingVertical).toBe("HUG");
    // Child text node should also be constrained
    expect(childText.layoutSizingHorizontal).toBe("FIXED");
    expect(childText.textAutoResize).toBe("HEIGHT");
  });

  it("does not modify non-auto-layout frames", async () => {
    const { constrainNodeToWidth } = await import("./code");

    const frameNode = createMockFrameNode({
      layoutMode: "NONE",
      width: 300,
    });

    constrainNodeToWidth(frameNode as unknown as SceneNode, 400);

    // Should not change layoutSizingHorizontal for non-auto-layout frames
    expect(frameNode.layoutSizingHorizontal).toBe("HUG");
  });
});

describe("constrainTextNodesInFrame", () => {
  it("constrains all text nodes in frame", async () => {
    const { constrainTextNodesInFrame } = await import("./code");

    const textNode1 = createMockTextNode();
    const textNode2 = createMockTextNode();
    const frameNode = createMockFrameNode({
      children: [
        textNode1 as unknown as SceneNode,
        textNode2 as unknown as SceneNode,
      ],
    });

    constrainTextNodesInFrame(frameNode, 350);

    expect(textNode1.layoutSizingHorizontal).toBe("FIXED");
    expect(textNode1.textAutoResize).toBe("HEIGHT");
    expect(textNode1.resize).toHaveBeenCalledWith(350, 20);

    expect(textNode2.layoutSizingHorizontal).toBe("FIXED");
    expect(textNode2.textAutoResize).toBe("HEIGHT");
    expect(textNode2.resize).toHaveBeenCalledWith(350, 20);
  });

  it("recursively processes nested frames", async () => {
    const { constrainTextNodesInFrame } = await import("./code");

    const nestedText = createMockTextNode();
    const nestedFrame = createMockFrameNode({
      layoutMode: "VERTICAL",
      children: [nestedText as unknown as SceneNode],
    });
    const outerFrame = createMockFrameNode({
      children: [nestedFrame as unknown as SceneNode],
    });

    constrainTextNodesInFrame(outerFrame, 300);

    // Nested frame should be configured
    expect(nestedFrame.layoutSizingHorizontal).toBe("FILL");
    expect(nestedFrame.layoutSizingVertical).toBe("HUG");

    // Text inside nested frame should be constrained
    expect(nestedText.layoutSizingHorizontal).toBe("FIXED");
    expect(nestedText.textAutoResize).toBe("HEIGHT");
  });
});
