import { describe, expect, it } from "bun:test";
import { createFill, LAYOUT, resolveSlideStyles } from "./styles";

describe("createFill", () => {
  it("should return undefined when style is undefined", () => {
    expect(createFill(undefined)).toBeUndefined();
  });

  it("should return undefined when color is undefined", () => {
    expect(createFill({ size: 24 })).toBeUndefined();
  });

  it("should create fill from hex color", () => {
    const fill = createFill({ color: "#ff0000" });
    expect(fill).toHaveLength(1);
    expect(fill?.[0].type).toBe("SOLID");
    expect(fill?.[0].color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should create fill from 3-digit hex color", () => {
    const fill = createFill({ color: "#f00" });
    expect(fill).toHaveLength(1);
    expect(fill?.[0].color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should create fill from rgba color with opacity", () => {
    const fill = createFill({ color: "rgba(255, 0, 0, 0.5)" });
    expect(fill).toHaveLength(1);
    expect(fill?.[0].color).toEqual({ r: 1, g: 0, b: 0 });
    expect(fill?.[0].opacity).toBe(0.5);
  });

  it("should default opacity to 1 when not specified", () => {
    const fill = createFill({ color: "#ffffff" });
    expect(fill?.[0].opacity).toBe(1);
  });

  it("should return undefined for invalid color", () => {
    expect(createFill({ color: "invalid" })).toBeUndefined();
  });
});

describe("resolveSlideStyles", () => {
  it("should return default styles when no styles provided", () => {
    const styles = resolveSlideStyles(undefined);

    expect(styles.h1.fontSize).toBe(64);
    expect(styles.h1.fontStyle).toBe("Bold");
    expect(styles.h1.fills).toBeUndefined();

    expect(styles.h2.fontSize).toBe(48);
    expect(styles.h2.fontStyle).toBe("Bold");

    expect(styles.h3.fontSize).toBe(36);
    expect(styles.h4.fontSize).toBe(28);

    expect(styles.paragraph.fontSize).toBe(24);
    expect(styles.paragraph.fontStyle).toBe("Regular");

    expect(styles.bullet.fontSize).toBe(24);
    expect(styles.code.fontSize).toBe(16);
  });

  it("should override heading sizes from user styles", () => {
    const styles = resolveSlideStyles({
      headings: {
        h1: { size: 80 },
        h2: { size: 60 },
      },
    });

    expect(styles.h1.fontSize).toBe(80);
    expect(styles.h2.fontSize).toBe(60);
    // h3 and h4 should use defaults
    expect(styles.h3.fontSize).toBe(36);
    expect(styles.h4.fontSize).toBe(28);
  });

  it("should apply heading colors", () => {
    const styles = resolveSlideStyles({
      headings: {
        h1: { size: 64, color: "#ffffff" },
      },
    });

    expect(styles.h1.fills).toHaveLength(1);
    expect(styles.h1.fills?.[0].color).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("should override paragraph styles", () => {
    const styles = resolveSlideStyles({
      paragraphs: { size: 20, color: "#333333" },
    });

    expect(styles.paragraph.fontSize).toBe(20);
    expect(styles.paragraph.fills).toHaveLength(1);
  });

  it("should override bullet styles", () => {
    const styles = resolveSlideStyles({
      bullets: { size: 18 },
    });

    expect(styles.bullet.fontSize).toBe(18);
  });

  it("should override code styles", () => {
    const styles = resolveSlideStyles({
      code: { size: 14, color: "#00ff00" },
    });

    expect(styles.code.fontSize).toBe(14);
    expect(styles.code.fills?.[0].color).toEqual({ r: 0, g: 1, b: 0 });
  });

  it("should handle empty styles object", () => {
    const styles = resolveSlideStyles({});

    expect(styles.h1.fontSize).toBe(64);
    expect(styles.paragraph.fontSize).toBe(24);
  });

  it("should handle partial heading styles", () => {
    const styles = resolveSlideStyles({
      headings: {
        h3: { size: 32 },
      },
    });

    expect(styles.h1.fontSize).toBe(64); // default
    expect(styles.h2.fontSize).toBe(48); // default
    expect(styles.h3.fontSize).toBe(32); // overridden
    expect(styles.h4.fontSize).toBe(28); // default
  });
});

describe("LAYOUT constants", () => {
  it("should have correct margin values", () => {
    expect(LAYOUT.LEFT_MARGIN).toBe(100);
    expect(LAYOUT.INITIAL_Y_OFFSET).toBe(100);
  });

  it("should have correct spacing values", () => {
    expect(LAYOUT.TITLE_SPACING).toBe(40);
    expect(LAYOUT.BLOCK_SPACING).toBe(30);
    expect(LAYOUT.BULLET_ITEM_SPACING).toBe(8);
  });
});
