import { describe, expect, it } from "bun:test";
import {
  mergeSlideNumberConfig,
  mergeStyles,
  parseFontSize,
  parseSlideConfig,
} from "./config";

describe("parseFontSize", () => {
  it("should return valid font sizes within range", () => {
    expect(parseFontSize(12)).toBe(12);
    expect(parseFontSize(1)).toBe(1);
    expect(parseFontSize(200)).toBe(200);
    expect(parseFontSize(72.5)).toBe(72.5);
  });

  it("should return undefined for out-of-range values", () => {
    expect(parseFontSize(0)).toBeUndefined();
    expect(parseFontSize(-1)).toBeUndefined();
    expect(parseFontSize(201)).toBeUndefined();
  });

  it("should return undefined for non-numeric values", () => {
    expect(parseFontSize(undefined)).toBeUndefined();
    expect(parseFontSize(null)).toBeUndefined();
    expect(parseFontSize("12px")).toBeUndefined();
    expect(parseFontSize(Number.NaN)).toBeUndefined();
  });

  it("should parse string numbers", () => {
    expect(parseFontSize("24")).toBe(24);
    expect(parseFontSize("100")).toBe(100);
  });
});

describe("parseSlideConfig", () => {
  describe("background parsing", () => {
    it("should parse solid background", () => {
      const result = parseSlideConfig({ background: "#1a1a2e" });
      expect(result.background).toEqual({ solid: "#1a1a2e" });
    });

    it("should parse gradient background", () => {
      const result = parseSlideConfig({
        gradient: "#000:0%,#fff:100%@45",
      });
      expect(result.background?.gradient?.stops).toHaveLength(2);
      expect(result.background?.gradient?.angle).toBe(45);
    });

    it("should parse template style", () => {
      const result = parseSlideConfig({ template: "Dark Mode" });
      expect(result.background).toEqual({ templateStyle: "Dark Mode" });
    });

    it("should prioritize template over gradient over solid", () => {
      const result = parseSlideConfig({
        background: "#fff",
        gradient: "#000:0%,#fff:100%",
        template: "Custom",
      });
      expect(result.background).toEqual({ templateStyle: "Custom" });
    });

    it("should parse remote background image URL", () => {
      const result = parseSlideConfig({
        backgroundImage: "https://example.com/bg.png",
      });
      expect(result.background).toEqual({
        image: {
          url: "https://example.com/bg.png",
          source: "remote",
        },
      });
    });

    it("should prioritize solid over image", () => {
      const result = parseSlideConfig({
        background: "#fff",
        backgroundImage: "https://example.com/bg.png",
      });
      expect(result.background).toEqual({ solid: "#ffffff" });
    });

    it("should prioritize gradient over image", () => {
      const result = parseSlideConfig({
        gradient: "#000:0%,#fff:100%",
        backgroundImage: "https://example.com/bg.png",
      });
      expect(result.background?.gradient).toBeDefined();
      expect(result.background?.image).toBeUndefined();
    });

    it("should return null for unsupported local image format without basePath", () => {
      const result = parseSlideConfig({
        backgroundImage: "./bg.svg",
      });
      // SVG is not supported, and no basePath provided
      expect(result.background).toBeNull();
    });
  });

  describe("text styles parsing", () => {
    it("should parse heading styles", () => {
      const result = parseSlideConfig({
        headings: {
          h1: { size: 72, color: "#fff" },
          h2: { size: 56 },
        },
      });
      expect(result.styles.headings?.h1?.size).toBe(72);
      expect(result.styles.headings?.h1?.color).toBe("#ffffff");
      expect(result.styles.headings?.h2?.size).toBe(56);
    });

    it("should parse paragraph/bullet/code styles", () => {
      const result = parseSlideConfig({
        paragraphs: { size: 24, color: "#ccc" },
        bullets: { size: 20 },
        code: { size: 14 },
      });
      expect(result.styles.paragraphs?.size).toBe(24);
      expect(result.styles.paragraphs?.color).toBe("#cccccc");
      expect(result.styles.bullets?.size).toBe(20);
      expect(result.styles.code?.size).toBe(14);
    });

    it("should apply base color to all text styles", () => {
      const result = parseSlideConfig({
        color: "#ffffff",
        headings: { h1: { size: 64 } },
        paragraphs: { size: 24 },
      });
      expect(result.styles.headings?.h1?.color).toBe("#ffffff");
      expect(result.styles.paragraphs?.color).toBe("#ffffff");
    });

    it("should not override explicit colors with base color", () => {
      const result = parseSlideConfig({
        color: "#ffffff",
        headings: { h1: { size: 64, color: "#ff0000" } },
      });
      expect(result.styles.headings?.h1?.color).toBe("#ff0000");
    });
  });

  describe("slide number parsing", () => {
    it("should parse boolean shorthand", () => {
      expect(parseSlideConfig({ slideNumber: true }).slideNumber).toEqual({
        show: true,
      });
      expect(parseSlideConfig({ slideNumber: false }).slideNumber).toEqual({
        show: false,
      });
    });

    it("should parse full slide number config", () => {
      const result = parseSlideConfig({
        slideNumber: {
          show: true,
          size: 14,
          color: "#888",
          position: "bottom-right",
          format: "{{current}} / {{total}}",
        },
      });
      expect(result.slideNumber?.show).toBe(true);
      expect(result.slideNumber?.size).toBe(14);
      expect(result.slideNumber?.color).toBe("#888888");
      expect(result.slideNumber?.position).toBe("bottom-right");
      expect(result.slideNumber?.format).toBe("{{current}} / {{total}}");
    });

    it("should ignore invalid position values", () => {
      const result = parseSlideConfig({
        slideNumber: { position: "invalid" as never },
      });
      expect(result.slideNumber?.position).toBeUndefined();
    });

    it("should validate slide number size range", () => {
      expect(
        parseSlideConfig({ slideNumber: { size: 0 } }).slideNumber?.size,
      ).toBeUndefined();
      expect(
        parseSlideConfig({ slideNumber: { size: 201 } }).slideNumber?.size,
      ).toBeUndefined();
      expect(
        parseSlideConfig({ slideNumber: { size: 14 } }).slideNumber?.size,
      ).toBe(14);
    });
  });
});

describe("mergeStyles", () => {
  it("should use slide styles when available", () => {
    const defaultStyles = {
      headings: { h1: { size: 64 }, h2: { size: 48 } },
      paragraphs: { size: 24 },
    };
    const slideStyles = {
      headings: { h1: { size: 72 } },
    };

    const result = mergeStyles(defaultStyles, slideStyles);

    expect(result.headings?.h1?.size).toBe(72);
    expect(result.headings?.h2?.size).toBe(48);
    expect(result.paragraphs?.size).toBe(24);
  });

  it("should fall back to default styles", () => {
    const defaultStyles = {
      paragraphs: { size: 24, color: "#fff" },
    };
    const slideStyles = {};

    const result = mergeStyles(defaultStyles, slideStyles);

    expect(result.paragraphs?.size).toBe(24);
    expect(result.paragraphs?.color).toBe("#fff");
  });
});

describe("mergeSlideNumberConfig", () => {
  it("should return undefined when both are undefined", () => {
    expect(mergeSlideNumberConfig(undefined, undefined)).toBeUndefined();
  });

  it("should return slide config when default is undefined", () => {
    const slideConfig = { show: true, size: 16 };
    expect(mergeSlideNumberConfig(undefined, slideConfig)).toEqual(slideConfig);
  });

  it("should return default config when slide is undefined", () => {
    const defaultConfig = { show: true, size: 14 };
    expect(mergeSlideNumberConfig(defaultConfig, undefined)).toEqual(
      defaultConfig,
    );
  });

  it("should merge configs with slide overriding default", () => {
    const defaultConfig = {
      show: true,
      size: 14,
      position: "bottom-right" as const,
    };
    const slideConfig = { size: 16, color: "#fff" };

    const result = mergeSlideNumberConfig(defaultConfig, slideConfig);

    expect(result?.show).toBe(true);
    expect(result?.size).toBe(16);
    expect(result?.position).toBe("bottom-right");
    expect(result?.color).toBe("#fff");
  });
});
