import type { SlideBackground } from "./types.js";

/**
 * Parse a color string (hex or rgb/rgba) and normalize to hex or rgba string
 * Supports: #rgb, #rrggbb, rgb(r,g,b), rgba(r,g,b,a)
 */
export function normalizeColor(color: string): string {
  color = color.trim();

  // Handle #rgb shorthand
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
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
    const r = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[3], 10)));
    if (rgbMatch[4] !== undefined) {
      const a = Math.min(1, Math.max(0, Number.parseFloat(rgbMatch[4])));
      return `rgba(${r},${g},${b},${a})`;
    }
    // Convert to hex
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  return color; // Return as-is if not recognized
}

/**
 * Parse gradient string: "color1:pos1%,color2:pos2%,...@angle"
 * Example: "#0d1117:0%,#1f2937:50%,#58a6ff:100%@45"
 */
export function parseGradient(
  gradientStr: string,
): SlideBackground["gradient"] | null {
  const [stopsStr, angleStr] = gradientStr.split("@");
  if (!stopsStr) return null;

  const stopParts = stopsStr.split(",");
  const stops: { color: string; position: number }[] = [];

  for (const part of stopParts) {
    const match = part.trim().match(/^(.+):(\d+(?:\.\d+)?)%?$/);
    if (match) {
      stops.push({
        color: normalizeColor(match[1]),
        position: Number.parseFloat(match[2]) / 100,
      });
    }
  }

  if (stops.length < 2) return null;

  return {
    stops,
    angle: angleStr ? Number.parseFloat(angleStr) : 0,
  };
}
