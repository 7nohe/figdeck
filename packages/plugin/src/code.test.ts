import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { BulletItem } from "@figdeck/shared";

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
