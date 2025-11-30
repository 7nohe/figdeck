import { describe, expect, it } from "bun:test";
import { normalizeColor, parseGradient } from "./colors";

describe("normalizeColor", () => {
  describe("hex colors", () => {
    it("should expand #rgb shorthand to #rrggbb", () => {
      expect(normalizeColor("#abc")).toBe("#aabbcc");
      expect(normalizeColor("#fff")).toBe("#ffffff");
      expect(normalizeColor("#000")).toBe("#000000");
    });

    it("should normalize #rrggbb to lowercase", () => {
      expect(normalizeColor("#AABBCC")).toBe("#aabbcc");
      expect(normalizeColor("#AbCdEf")).toBe("#abcdef");
      expect(normalizeColor("#123456")).toBe("#123456");
    });

    it("should trim whitespace", () => {
      expect(normalizeColor("  #fff  ")).toBe("#ffffff");
      expect(normalizeColor("\t#abc\n")).toBe("#aabbcc");
    });
  });

  describe("rgb/rgba colors", () => {
    it("should convert rgb() to hex", () => {
      expect(normalizeColor("rgb(255, 255, 255)")).toBe("#ffffff");
      expect(normalizeColor("rgb(0, 0, 0)")).toBe("#000000");
      expect(normalizeColor("rgb(171, 205, 239)")).toBe("#abcdef");
    });

    it("should preserve rgba() format", () => {
      expect(normalizeColor("rgba(255, 255, 255, 0.5)")).toBe(
        "rgba(255,255,255,0.5)",
      );
      expect(normalizeColor("rgba(0, 0, 0, 1)")).toBe("rgba(0,0,0,1)");
    });

    it("should clamp values to valid range", () => {
      // normalizeColor clamps RGB values to 0-255 and alpha to 0-1
      expect(normalizeColor("rgb(300,0,128)")).toBe("#ff0080");
      expect(normalizeColor("rgba(255,255,255,1.5)")).toBe(
        "rgba(255,255,255,1)",
      );
    });

    it("should handle compact spacing", () => {
      expect(normalizeColor("rgb(255,128,0)")).toBe("#ff8000");
      expect(normalizeColor("RGB(255,128,0)")).toBe("#ff8000");
    });
  });

  describe("unrecognized formats", () => {
    it("should return unrecognized colors as-is", () => {
      expect(normalizeColor("red")).toBe("red");
      expect(normalizeColor("transparent")).toBe("transparent");
      expect(normalizeColor("invalid")).toBe("invalid");
    });
  });
});

describe("parseGradient", () => {
  it("should parse a simple two-stop gradient", () => {
    const result = parseGradient("#000:0%,#fff:100%");
    expect(result).not.toBeNull();
    expect(result?.stops).toHaveLength(2);
    expect(result?.stops[0]).toEqual({ color: "#000000", position: 0 });
    expect(result?.stops[1]).toEqual({ color: "#ffffff", position: 1 });
    expect(result?.angle).toBe(0);
  });

  it("should parse gradient with angle", () => {
    const result = parseGradient("#000:0%,#fff:100%@45");
    expect(result?.angle).toBe(45);
  });

  it("should parse gradient with multiple stops", () => {
    const result = parseGradient("#0d1117:0%,#1f2937:50%,#58a6ff:100%@90");
    expect(result?.stops).toHaveLength(3);
    expect(result?.stops[0].position).toBe(0);
    expect(result?.stops[1].position).toBe(0.5);
    expect(result?.stops[2].position).toBe(1);
    expect(result?.angle).toBe(90);
  });

  it("should handle decimal positions", () => {
    const result = parseGradient("#000:0%,#888:33.3%,#fff:100%");
    expect(result?.stops[1].position).toBeCloseTo(0.333, 2);
  });

  it("should normalize colors in gradient stops", () => {
    // parseGradient splits by comma, so only hex colors work reliably in gradient strings
    const result = parseGradient("#abc:0%,#ff8000:100%");
    expect(result?.stops[0].color).toBe("#aabbcc");
    expect(result?.stops[1].color).toBe("#ff8000");
  });

  it("should return null for invalid gradients", () => {
    expect(parseGradient("")).toBeNull();
    expect(parseGradient("#fff:100%")).toBeNull(); // Only one stop
  });

  it("should handle position without % suffix", () => {
    const result = parseGradient("#000:0,#fff:100");
    expect(result?.stops[0].position).toBe(0);
    expect(result?.stops[1].position).toBe(1);
  });
});
