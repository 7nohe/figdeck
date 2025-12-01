import { describe, expect, it } from "bun:test";
import {
  mergeSlideNumberConfig,
  mergeStyles,
  mergeTransitionConfig,
  parseFontSize,
  parseSlideConfig,
  parseTransitionConfig,
  parseTransitionCurve,
  parseTransitionStyle,
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

  describe("titlePrefix parsing", () => {
    it("should parse explicit titlePrefix config with link", () => {
      const result = parseSlideConfig({
        titlePrefix: {
          link: "https://www.figma.com/design/abc?node-id=123-456",
          spacing: 20,
        },
      });
      expect(result.titlePrefix).toEqual({
        link: "https://www.figma.com/design/abc?node-id=123-456",
        nodeId: "123:456",
        spacing: 20,
      });
    });

    it("should parse titlePrefix with nodeId directly", () => {
      const result = parseSlideConfig({
        titlePrefix: {
          nodeId: "789:012",
          spacing: 16,
        },
      });
      expect(result.titlePrefix).toEqual({
        link: undefined,
        nodeId: "789:012",
        spacing: 16,
      });
    });

    it("should set titlePrefix to null when explicitly disabled", () => {
      const result = parseSlideConfig({
        titlePrefix: false,
      });
      expect(result.titlePrefix).toBeNull();
    });

    it("should return undefined titlePrefix when not specified", () => {
      const result = parseSlideConfig({
        background: "#fff",
      });
      expect(result.titlePrefix).toBeUndefined();
    });

    it("should parse titlePrefix with only link", () => {
      const result = parseSlideConfig({
        titlePrefix: {
          link: "https://www.figma.com/design/xyz?node-id=111-222",
        },
      });
      expect(result.titlePrefix).toEqual({
        link: "https://www.figma.com/design/xyz?node-id=111-222",
        nodeId: "111:222",
        spacing: undefined,
      });
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

    it("should parse slideNumber with link", () => {
      const result = parseSlideConfig({
        slideNumber: {
          show: true,
          link: "https://www.figma.com/design/abc?node-id=123-456",
          position: "bottom-right",
        },
      });
      expect(result.slideNumber?.show).toBe(true);
      expect(result.slideNumber?.link).toBe(
        "https://www.figma.com/design/abc?node-id=123-456",
      );
      expect(result.slideNumber?.nodeId).toBe("123:456");
      expect(result.slideNumber?.position).toBe("bottom-right");
    });

    it("should parse slideNumber with direct nodeId", () => {
      const result = parseSlideConfig({
        slideNumber: {
          nodeId: "789:012",
        },
      });
      expect(result.slideNumber?.nodeId).toBe("789:012");
      expect(result.slideNumber?.link).toBeUndefined();
    });

    it("should parse slideNumber with startFrom", () => {
      const result = parseSlideConfig({
        slideNumber: {
          show: true,
          startFrom: 2,
        },
      });
      expect(result.slideNumber?.startFrom).toBe(2);
    });

    it("should parse slideNumber with offset", () => {
      const result = parseSlideConfig({
        slideNumber: {
          show: true,
          offset: -1,
        },
      });
      expect(result.slideNumber?.offset).toBe(-1);
    });

    it("should ignore invalid startFrom values", () => {
      expect(
        parseSlideConfig({ slideNumber: { startFrom: 0 } }).slideNumber
          ?.startFrom,
      ).toBeUndefined();
      expect(
        parseSlideConfig({ slideNumber: { startFrom: -1 } }).slideNumber
          ?.startFrom,
      ).toBeUndefined();
      expect(
        parseSlideConfig({ slideNumber: { startFrom: 1 } }).slideNumber
          ?.startFrom,
      ).toBe(1);
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

describe("align/valign parsing", () => {
  it("should parse horizontal align", () => {
    expect(parseSlideConfig({ align: "left" }).align).toBe("left");
    expect(parseSlideConfig({ align: "center" }).align).toBe("center");
    expect(parseSlideConfig({ align: "right" }).align).toBe("right");
  });

  it("should parse vertical align", () => {
    expect(parseSlideConfig({ valign: "top" }).valign).toBe("top");
    expect(parseSlideConfig({ valign: "middle" }).valign).toBe("middle");
    expect(parseSlideConfig({ valign: "bottom" }).valign).toBe("bottom");
  });

  it("should return undefined for invalid align values", () => {
    expect(parseSlideConfig({ align: "invalid" }).align).toBeUndefined();
    expect(parseSlideConfig({ align: "CENTER" }).align).toBeUndefined();
    expect(parseSlideConfig({ align: "" }).align).toBeUndefined();
  });

  it("should return undefined for invalid valign values", () => {
    expect(parseSlideConfig({ valign: "invalid" }).valign).toBeUndefined();
    expect(parseSlideConfig({ valign: "MIDDLE" }).valign).toBeUndefined();
    expect(parseSlideConfig({ valign: "" }).valign).toBeUndefined();
  });

  it("should return undefined when not specified", () => {
    const result = parseSlideConfig({ background: "#fff" });
    expect(result.align).toBeUndefined();
    expect(result.valign).toBeUndefined();
  });

  it("should parse both align and valign together", () => {
    const result = parseSlideConfig({
      align: "center",
      valign: "middle",
    });
    expect(result.align).toBe("center");
    expect(result.valign).toBe("middle");
  });
});

describe("parseTransitionStyle", () => {
  it("should parse valid transition styles", () => {
    expect(parseTransitionStyle("none")).toBe("none");
    expect(parseTransitionStyle("dissolve")).toBe("dissolve");
    expect(parseTransitionStyle("smart-animate")).toBe("smart-animate");
    expect(parseTransitionStyle("slide-from-left")).toBe("slide-from-left");
    expect(parseTransitionStyle("push-from-right")).toBe("push-from-right");
    expect(parseTransitionStyle("move-out-to-bottom")).toBe(
      "move-out-to-bottom",
    );
  });

  it("should normalize underscore to kebab-case", () => {
    expect(parseTransitionStyle("slide_from_left")).toBe("slide-from-left");
    expect(parseTransitionStyle("smart_animate")).toBe("smart-animate");
    expect(parseTransitionStyle("SLIDE_FROM_RIGHT")).toBe("slide-from-right");
  });

  it("should return undefined for invalid styles", () => {
    expect(parseTransitionStyle("invalid")).toBeUndefined();
    expect(parseTransitionStyle("fade")).toBeUndefined();
    expect(parseTransitionStyle("")).toBeUndefined();
    expect(parseTransitionStyle(undefined)).toBeUndefined();
  });
});

describe("parseTransitionCurve", () => {
  it("should parse valid transition curves", () => {
    expect(parseTransitionCurve("ease-in")).toBe("ease-in");
    expect(parseTransitionCurve("ease-out")).toBe("ease-out");
    expect(parseTransitionCurve("ease-in-and-out")).toBe("ease-in-and-out");
    expect(parseTransitionCurve("linear")).toBe("linear");
    expect(parseTransitionCurve("gentle")).toBe("gentle");
    expect(parseTransitionCurve("quick")).toBe("quick");
    expect(parseTransitionCurve("bouncy")).toBe("bouncy");
    expect(parseTransitionCurve("slow")).toBe("slow");
  });

  it("should normalize underscore to kebab-case", () => {
    expect(parseTransitionCurve("ease_in")).toBe("ease-in");
    expect(parseTransitionCurve("EASE_IN_AND_OUT")).toBe("ease-in-and-out");
  });

  it("should return undefined for invalid curves", () => {
    expect(parseTransitionCurve("invalid")).toBeUndefined();
    expect(parseTransitionCurve("cubic")).toBeUndefined();
    expect(parseTransitionCurve(undefined)).toBeUndefined();
  });
});

describe("parseTransitionConfig", () => {
  it("should parse shorthand style only", () => {
    const result = parseTransitionConfig("dissolve");
    expect(result).toEqual({ style: "dissolve" });
  });

  it("should parse shorthand with duration", () => {
    const result = parseTransitionConfig("slide-from-left 0.5");
    expect(result).toEqual({ style: "slide-from-left", duration: 0.5 });
  });

  it("should parse full object config", () => {
    const result = parseTransitionConfig({
      style: "push-from-right",
      duration: 0.8,
      curve: "ease-in-and-out",
      timing: { type: "after-delay", delay: 2 },
    });
    expect(result).toEqual({
      style: "push-from-right",
      duration: 0.8,
      curve: "ease-in-and-out",
      timing: { type: "after-delay", delay: 2 },
    });
  });

  it("should handle timing shorthand", () => {
    const result = parseTransitionConfig({
      style: "dissolve",
      timing: "on-click",
    });
    expect(result?.timing).toBe("on-click");
  });

  it("should normalize underscore to kebab-case in timing", () => {
    const result = parseTransitionConfig({
      style: "dissolve",
      timing: "after_delay",
    });
    expect(result?.timing).toBe("after-delay");
  });

  it("should validate duration range", () => {
    // Duration below minimum
    expect(parseTransitionConfig({ style: "dissolve", duration: 0 })).toEqual({
      style: "dissolve",
    });
    // Duration above maximum
    expect(parseTransitionConfig({ style: "dissolve", duration: 15 })).toEqual({
      style: "dissolve",
    });
    // Valid duration
    expect(parseTransitionConfig({ style: "dissolve", duration: 5 })).toEqual({
      style: "dissolve",
      duration: 5,
    });
    // Minimum valid duration
    expect(
      parseTransitionConfig({ style: "dissolve", duration: 0.01 }),
    ).toEqual({
      style: "dissolve",
      duration: 0.01,
    });
  });

  it("should validate delay range", () => {
    // Valid delay
    expect(
      parseTransitionConfig({
        style: "dissolve",
        timing: { type: "after-delay", delay: 5 },
      }),
    ).toEqual({
      style: "dissolve",
      timing: { type: "after-delay", delay: 5 },
    });
    // Delay above maximum
    expect(
      parseTransitionConfig({
        style: "dissolve",
        timing: { type: "after-delay", delay: 35 },
      }),
    ).toEqual({
      style: "dissolve",
      timing: { type: "after-delay" },
    });
    // Zero delay is valid
    expect(
      parseTransitionConfig({
        style: "dissolve",
        timing: { type: "after-delay", delay: 0 },
      }),
    ).toEqual({
      style: "dissolve",
      timing: { type: "after-delay", delay: 0 },
    });
  });

  it("should return undefined for invalid style", () => {
    expect(parseTransitionConfig("invalid-style")).toBeUndefined();
  });

  it("should return undefined for undefined config", () => {
    expect(parseTransitionConfig(undefined)).toBeUndefined();
  });

  it("should return undefined for empty object", () => {
    expect(parseTransitionConfig({})).toBeUndefined();
  });
});

describe("mergeTransitionConfig", () => {
  it("should return undefined when both are undefined", () => {
    expect(mergeTransitionConfig(undefined, undefined)).toBeUndefined();
  });

  it("should return slide config when default is undefined", () => {
    const slideConfig = { style: "dissolve" as const };
    expect(mergeTransitionConfig(undefined, slideConfig)).toEqual(slideConfig);
  });

  it("should return default config when slide is undefined", () => {
    const defaultConfig = { style: "dissolve" as const, duration: 0.5 };
    expect(mergeTransitionConfig(defaultConfig, undefined)).toEqual(
      defaultConfig,
    );
  });

  it("should merge configs with slide overriding default", () => {
    const defaultConfig = {
      style: "dissolve" as const,
      duration: 0.3,
      curve: "ease-out" as const,
    };
    const slideConfig = {
      style: "slide-from-right" as const,
      duration: 0.5,
    };

    const result = mergeTransitionConfig(defaultConfig, slideConfig);

    expect(result?.style).toBe("slide-from-right");
    expect(result?.duration).toBe(0.5);
    expect(result?.curve).toBe("ease-out");
  });

  it("should merge timing configs", () => {
    const defaultConfig = {
      style: "dissolve" as const,
      timing: { type: "on-click" as const },
    };
    const slideConfig = {
      timing: { delay: 2 },
    };

    const result = mergeTransitionConfig(defaultConfig, slideConfig);

    expect(result?.timing).toEqual({ type: "on-click", delay: 2 });
  });

  it("should handle timing shorthand in default", () => {
    const defaultConfig = {
      style: "dissolve" as const,
      timing: "on-click" as const,
    };
    const slideConfig = {
      timing: { delay: 3 },
    };

    const result = mergeTransitionConfig(defaultConfig, slideConfig);

    expect(result?.timing).toEqual({ type: "on-click", delay: 3 });
  });
});

describe("transition in parseSlideConfig", () => {
  it("should parse transition shorthand", () => {
    const result = parseSlideConfig({ transition: "dissolve" });
    expect(result.transition).toEqual({ style: "dissolve" });
  });

  it("should parse transition full object", () => {
    const result = parseSlideConfig({
      transition: {
        style: "slide-from-right",
        duration: 0.5,
        curve: "ease-in-and-out",
        timing: { type: "after-delay", delay: 2 },
      },
    });
    expect(result.transition?.style).toBe("slide-from-right");
    expect(result.transition?.duration).toBe(0.5);
    expect(result.transition?.curve).toBe("ease-in-and-out");
    expect(result.transition?.timing).toEqual({
      type: "after-delay",
      delay: 2,
    });
  });

  it("should return undefined transition when not specified", () => {
    const result = parseSlideConfig({ background: "#fff" });
    expect(result.transition).toBeUndefined();
  });
});
