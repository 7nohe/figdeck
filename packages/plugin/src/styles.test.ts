import { describe, expect, it } from "bun:test";
import {
  applyFontFallbacks,
  collectFontNames,
  createFill,
  LAYOUT,
  resolveSlideStyles,
} from "./styles";

type SolidPaint = { type: "SOLID"; color: RGB; opacity?: number };
type RGB = { r: number; g: number; b: number };

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
    expect((fill?.[0] as SolidPaint).color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should create fill from 3-digit hex color", () => {
    const fill = createFill({ color: "#f00" });
    expect(fill).toHaveLength(1);
    expect((fill?.[0] as SolidPaint).color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should create fill from rgba color with opacity", () => {
    const fill = createFill({ color: "rgba(255, 0, 0, 0.5)" });
    expect(fill).toHaveLength(1);
    expect((fill?.[0] as SolidPaint).color).toEqual({ r: 1, g: 0, b: 0 });
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
    expect((styles.h1.fills?.[0] as SolidPaint).color).toEqual({
      r: 1,
      g: 1,
      b: 1,
    });
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
    expect((styles.code.fills?.[0] as SolidPaint).color).toEqual({
      r: 0,
      g: 1,
      b: 0,
    });
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
    expect(LAYOUT.BLOCK_GAP).toBe(24);
  });

  it("should expose slide dimensions and content width", () => {
    expect(LAYOUT.SLIDE_WIDTH).toBe(1920);
    expect(LAYOUT.SLIDE_HEIGHT).toBe(1080);
    expect(LAYOUT.CONTAINER_PADDING).toBe(100);
    expect(LAYOUT.CONTENT_WIDTH).toBe(1720);
  });
});

describe("font resolution", () => {
  it("should return default Inter font when no fonts config provided", () => {
    const styles = resolveSlideStyles(undefined);

    expect(styles.h1.font.family).toBe("Inter");
    expect(styles.h1.font.regular).toBe("Bold"); // headings default to Bold
    expect(styles.h1.font.bold).toBe("Bold");
    expect(styles.h1.font.italic).toBe("Italic");
    expect(styles.h1.font.boldItalic).toBe("Bold Italic");

    expect(styles.paragraph.font.family).toBe("Inter");
    expect(styles.paragraph.font.regular).toBe("Regular");
  });

  it("should apply custom font config for h1", () => {
    const styles = resolveSlideStyles({
      fonts: {
        h1: {
          family: "Roboto",
          style: "Medium",
          bold: "Bold",
          italic: "Italic",
          boldItalic: "Bold Italic",
        },
      },
    });

    expect(styles.h1.font.family).toBe("Roboto");
    expect(styles.h1.font.regular).toBe("Medium");
    expect(styles.h1.font.bold).toBe("Bold");
    // Other styles should still use Inter
    expect(styles.h2.font.family).toBe("Inter");
  });

  it("should apply custom font config for body/bullets/code", () => {
    const styles = resolveSlideStyles({
      fonts: {
        body: { family: "Source Sans Pro", style: "Light", bold: "Semibold" },
        bullets: { family: "Open Sans", style: "Regular" },
      },
    });

    expect(styles.paragraph.font.family).toBe("Source Sans Pro");
    expect(styles.paragraph.font.regular).toBe("Light");
    expect(styles.paragraph.font.bold).toBe("Semibold");

    expect(styles.bullet.font.family).toBe("Open Sans");
  });

  it("should use defaults for unspecified font variants", () => {
    const styles = resolveSlideStyles({
      fonts: {
        h1: { family: "Custom", style: "Regular" },
      },
    });

    // Only family and style are specified, others should use defaults
    expect(styles.h1.font.family).toBe("Custom");
    expect(styles.h1.font.regular).toBe("Regular");
    expect(styles.h1.font.bold).toBe("Bold");
    expect(styles.h1.font.italic).toBe("Italic");
    expect(styles.h1.font.boldItalic).toBe("Bold Italic");
  });
});

describe("collectFontNames", () => {
  it("should collect all unique font variants from styles", () => {
    const styles = resolveSlideStyles({
      fonts: {
        h1: { family: "Roboto", style: "Medium", bold: "Bold" },
        body: { family: "Source Sans Pro", style: "Regular" },
      },
    });

    const fontNames = collectFontNames(styles);

    // Should include unique font/style combinations
    expect(
      fontNames.some((f) => f.family === "Roboto" && f.style === "Medium"),
    ).toBe(true);
    expect(
      fontNames.some((f) => f.family === "Roboto" && f.style === "Bold"),
    ).toBe(true);
    expect(
      fontNames.some(
        (f) => f.family === "Source Sans Pro" && f.style === "Regular",
      ),
    ).toBe(true);
    expect(fontNames.some((f) => f.family === "Inter")).toBe(true); // From other styles
  });

  it("should not duplicate font entries", () => {
    const styles = resolveSlideStyles(undefined);
    const fontNames = collectFontNames(styles);

    // Count Inter/Bold entries (should be exactly 1)
    const interBoldCount = fontNames.filter(
      (f) => f.family === "Inter" && f.style === "Bold",
    ).length;
    expect(interBoldCount).toBe(1);
  });

  it("should include all four variants for each font family", () => {
    const styles = resolveSlideStyles({
      fonts: {
        h1: {
          family: "Custom",
          style: "Regular",
          bold: "Bold",
          italic: "Italic",
          boldItalic: "Bold Italic",
        },
      },
    });

    const fontNames = collectFontNames(styles);

    expect(
      fontNames.some((f) => f.family === "Custom" && f.style === "Regular"),
    ).toBe(true);
    expect(
      fontNames.some((f) => f.family === "Custom" && f.style === "Bold"),
    ).toBe(true);
    expect(
      fontNames.some((f) => f.family === "Custom" && f.style === "Italic"),
    ).toBe(true);
    expect(
      fontNames.some((f) => f.family === "Custom" && f.style === "Bold Italic"),
    ).toBe(true);
  });
});

describe("applyFontFallbacks", () => {
  const interFonts = [
    "Inter|Regular",
    "Inter|Bold",
    "Inter|Italic",
    "Inter|Bold Italic",
  ];

  it("should fall back to Inter when a font variant is unavailable", () => {
    const styles = resolveSlideStyles({
      fonts: {
        h1: { family: "Missing Font", style: "Semibold", italic: "Italic" },
      },
    });

    const availableFonts = new Set<string>(interFonts);
    const resolved = applyFontFallbacks(styles, availableFonts);

    expect(resolved.h1.font.family).toBe("Inter");
    expect(resolved.h1.font.regular).toBe("Bold"); // Semibold → Bold
    expect(resolved.h1.font.italic).toBe("Italic");
    expect(resolved.h1.font.boldItalic).toBe("Bold Italic");
  });

  it("should keep custom fonts when all variants are loaded", () => {
    const styles = resolveSlideStyles({
      fonts: {
        body: {
          family: "Loaded Family",
          style: "Regular",
          bold: "Bold",
          italic: "Italic",
          boldItalic: "Bold Italic",
        },
      },
    });

    const availableFonts = new Set<string>([
      ...interFonts,
      "Loaded Family|Regular",
      "Loaded Family|Bold",
      "Loaded Family|Italic",
      "Loaded Family|Bold Italic",
    ]);

    const resolved = applyFontFallbacks(styles, availableFonts);
    expect(resolved.paragraph.font.family).toBe("Loaded Family");
    expect(resolved.paragraph.font.regular).toBe("Regular");
  });
});
