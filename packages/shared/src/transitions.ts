import type { SlideTransitionCurve, SlideTransitionStyle } from "./types.js";

/**
 * Valid transition styles (kebab-case for user-friendly YAML)
 */
export const VALID_TRANSITION_STYLES: readonly SlideTransitionStyle[] = [
  "none",
  "dissolve",
  "smart-animate",
  "slide-from-left",
  "slide-from-right",
  "slide-from-top",
  "slide-from-bottom",
  "push-from-left",
  "push-from-right",
  "push-from-top",
  "push-from-bottom",
  "move-from-left",
  "move-from-right",
  "move-from-top",
  "move-from-bottom",
  "slide-out-to-left",
  "slide-out-to-right",
  "slide-out-to-top",
  "slide-out-to-bottom",
  "move-out-to-left",
  "move-out-to-right",
  "move-out-to-top",
  "move-out-to-bottom",
] as const;

/**
 * Valid transition curves (kebab-case)
 */
export const VALID_TRANSITION_CURVES: readonly SlideTransitionCurve[] = [
  "ease-in",
  "ease-out",
  "ease-in-and-out",
  "linear",
  "gentle",
  "quick",
  "bouncy",
  "slow",
] as const;

/**
 * Map from kebab-case transition style to Figma API UPPER_SNAKE_CASE
 */
export const TRANSITION_STYLE_TO_FIGMA: Record<SlideTransitionStyle, string> = {
  none: "NONE",
  dissolve: "DISSOLVE",
  "smart-animate": "SMART_ANIMATE",
  "slide-from-left": "SLIDE_FROM_LEFT",
  "slide-from-right": "SLIDE_FROM_RIGHT",
  "slide-from-top": "SLIDE_FROM_TOP",
  "slide-from-bottom": "SLIDE_FROM_BOTTOM",
  "push-from-left": "PUSH_FROM_LEFT",
  "push-from-right": "PUSH_FROM_RIGHT",
  "push-from-top": "PUSH_FROM_TOP",
  "push-from-bottom": "PUSH_FROM_BOTTOM",
  "move-from-left": "MOVE_FROM_LEFT",
  "move-from-right": "MOVE_FROM_RIGHT",
  "move-from-top": "MOVE_FROM_TOP",
  "move-from-bottom": "MOVE_FROM_BOTTOM",
  "slide-out-to-left": "SLIDE_OUT_TO_LEFT",
  "slide-out-to-right": "SLIDE_OUT_TO_RIGHT",
  "slide-out-to-top": "SLIDE_OUT_TO_TOP",
  "slide-out-to-bottom": "SLIDE_OUT_TO_BOTTOM",
  "move-out-to-left": "MOVE_OUT_TO_LEFT",
  "move-out-to-right": "MOVE_OUT_TO_RIGHT",
  "move-out-to-top": "MOVE_OUT_TO_TOP",
  "move-out-to-bottom": "MOVE_OUT_TO_BOTTOM",
};

/**
 * Map from kebab-case easing curve to Figma API UPPER_SNAKE_CASE
 */
export const TRANSITION_CURVE_TO_FIGMA: Record<SlideTransitionCurve, string> = {
  "ease-in": "EASE_IN",
  "ease-out": "EASE_OUT",
  "ease-in-and-out": "EASE_IN_AND_OUT",
  linear: "LINEAR",
  gentle: "GENTLE",
  quick: "QUICK",
  bouncy: "BOUNCY",
  slow: "SLOW",
};

/**
 * Check if a string is a valid transition style
 */
export function isValidTransitionStyle(
  value: string,
): value is SlideTransitionStyle {
  return VALID_TRANSITION_STYLES.includes(value as SlideTransitionStyle);
}

/**
 * Check if a string is a valid transition curve
 */
export function isValidTransitionCurve(
  value: string,
): value is SlideTransitionCurve {
  return VALID_TRANSITION_CURVES.includes(value as SlideTransitionCurve);
}

/**
 * Normalize transition style input (handles underscore variant)
 */
export function normalizeTransitionStyle(
  value: string,
): SlideTransitionStyle | undefined {
  const normalized = value.toLowerCase().replace(/_/g, "-");
  return isValidTransitionStyle(normalized) ? normalized : undefined;
}

/**
 * Normalize transition curve input (handles underscore variant)
 */
export function normalizeTransitionCurve(
  value: string,
): SlideTransitionCurve | undefined {
  const normalized = value.toLowerCase().replace(/_/g, "-");
  return isValidTransitionCurve(normalized) ? normalized : undefined;
}
