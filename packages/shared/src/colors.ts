/**
 * Color parsing and normalization utilities
 * Environment-agnostic (works in both Node.js and browser/Figma sandbox)
 */

/**
 * RGBA color value with components in 0-1 range (Figma-compatible)
 */
export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Parse a color string to RGBA floats (0-1 range)
 * Supports: #rgb, #rrggbb, rgb(r,g,b), rgba(r,g,b,a)
 * Returns null if the color format is not recognized
 */
export function parseColorToRGBA(color: string): RGBAColor | null {
  color = color.trim();

  // Handle hex colors (#rgb or #rrggbb)
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6 && /^[0-9a-fA-F]{6}$/.test(hex)) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16) / 255,
        g: Number.parseInt(hex.slice(2, 4), 16) / 255,
        b: Number.parseInt(hex.slice(4, 6), 16) / 255,
      };
    }
    return null;
  }

  // Handle rgba(r,g,b,a)
  const rgbaMatch = color.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i,
  );
  if (rgbaMatch) {
    return {
      r: clamp(Number.parseInt(rgbaMatch[1], 10), 0, 255) / 255,
      g: clamp(Number.parseInt(rgbaMatch[2], 10), 0, 255) / 255,
      b: clamp(Number.parseInt(rgbaMatch[3], 10), 0, 255) / 255,
      a: clamp(Number.parseFloat(rgbaMatch[4]), 0, 1),
    };
  }

  // Handle rgb(r,g,b)
  const rgbMatch = color.match(
    /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
  );
  if (rgbMatch) {
    return {
      r: clamp(Number.parseInt(rgbMatch[1], 10), 0, 255) / 255,
      g: clamp(Number.parseInt(rgbMatch[2], 10), 0, 255) / 255,
      b: clamp(Number.parseInt(rgbMatch[3], 10), 0, 255) / 255,
    };
  }

  return null;
}

/**
 * Normalize a color string to a canonical format
 * - #rgb -> #rrggbb (lowercase)
 * - #rrggbb -> #rrggbb (lowercase)
 * - rgb(r,g,b) -> #rrggbb
 * - rgba(r,g,b,a) -> rgba(r,g,b,a) (preserved for alpha)
 * Returns the original string if format is not recognized
 */
export function normalizeColor(color: string): string {
  color = color.trim();

  // Handle #rgb shorthand
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  // Handle #rrggbb
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }

  // Handle rgb(r,g,b) or rgba(r,g,b,a)
  const rgbMatch = color.match(
    /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
  );
  if (rgbMatch) {
    const r = clamp(Number.parseInt(rgbMatch[1], 10), 0, 255);
    const g = clamp(Number.parseInt(rgbMatch[2], 10), 0, 255);
    const b = clamp(Number.parseInt(rgbMatch[3], 10), 0, 255);
    if (rgbMatch[4] !== undefined) {
      const a = clamp(Number.parseFloat(rgbMatch[4]), 0, 1);
      return `rgba(${r},${g},${b},${a})`;
    }
    // Convert to hex
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  return color; // Return as-is if not recognized
}

/**
 * Convert RGBA color to hex string (ignores alpha)
 */
export function rgbaToHex(color: RGBAColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
