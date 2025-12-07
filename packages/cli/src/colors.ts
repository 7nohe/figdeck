import type { SlideBackground } from "@figdeck/shared";
import { normalizeColor } from "@figdeck/shared";

// Re-export normalizeColor for backward compatibility
export { normalizeColor } from "@figdeck/shared";

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
