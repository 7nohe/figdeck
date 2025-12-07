// Types

// Bullets
export { BULLET_MARKERS, getBulletMarker } from "./bullets.js";
// Color utilities
export type { RGBAColor } from "./colors.js";
export {
  normalizeColor,
  parseColorToRGBA,
  rgbaToHex,
} from "./colors.js";

// Figma URL utilities
export {
  extractHostname,
  isValidFigmaHostname,
  isValidFigmaUrl,
  parseFigmaUrl,
} from "./figma.js";
// Transitions
export {
  isValidTransitionCurve,
  isValidTransitionStyle,
  normalizeTransitionCurve,
  normalizeTransitionStyle,
  TRANSITION_CURVE_TO_FIGMA,
  TRANSITION_STYLE_TO_FIGMA,
  VALID_TRANSITION_CURVES,
  VALID_TRANSITION_STYLES,
} from "./transitions.js";
export * from "./types.js";
