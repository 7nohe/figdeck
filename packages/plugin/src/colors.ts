import { parseColorToRGBA } from "@figdeck/shared";
import { DEFAULT_TEXT_COLOR } from "./constants";

/**
 * Parse a color string (hex or rgba) to Figma RGB/RGBA
 * Uses shared parseColorToRGBA for consistent parsing
 */
export function parseColor(
  color: string,
): { r: number; g: number; b: number; a?: number } | null {
  return parseColorToRGBA(color);
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
