import { DEFAULT_TEXT_COLOR } from "./constants";

/**
 * Parse a color string (hex or rgba) to Figma RGB/RGBA
 */
export function parseColor(
  color: string,
): { r: number; g: number; b: number; a?: number } | null {
  color = color.trim();

  // Handle hex colors (#rgb or #rrggbb)
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
      const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
      const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
      return { r, g, b };
    }
  }

  // Handle rgba(r,g,b,a)
  const rgbaMatch = color.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i,
  );
  if (rgbaMatch) {
    return {
      r: Number.parseInt(rgbaMatch[1], 10) / 255,
      g: Number.parseInt(rgbaMatch[2], 10) / 255,
      b: Number.parseInt(rgbaMatch[3], 10) / 255,
      a: Number.parseFloat(rgbaMatch[4]),
    };
  }

  // Handle rgb(r,g,b)
  const rgbMatch = color.match(
    /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
  );
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1], 10) / 255,
      g: Number.parseInt(rgbMatch[2], 10) / 255,
      b: Number.parseInt(rgbMatch[3], 10) / 255,
    };
  }

  return null;
}

/**
 * Create default text fill
 */
export function createDefaultTextFill(): Paint[] {
  const parsed = parseColor(DEFAULT_TEXT_COLOR);
  const rgb: RGB = parsed
    ? { r: parsed.r, g: parsed.g, b: parsed.b }
    : { r: 0, g: 0, b: 0 };
  return [{ type: "SOLID", color: rgb }];
}

/**
 * Create a rotation matrix for gradient angle (in degrees)
 * Figma gradients use a 2x3 transform matrix
 */
export function createGradientTransform(angleDegrees: number): Transform {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);

  // Center the rotation at (0.5, 0.5) and apply rotation
  return [
    [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
    [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos],
  ];
}
