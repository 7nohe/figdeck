import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { BulletItem } from "./types";

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
});
