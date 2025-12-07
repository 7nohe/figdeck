/**
 * Bullet markers for different nesting levels
 * Level 0: • (U+2022)
 * Level 1: ◦ (U+25E6)
 * Level 2: ▪ (U+25AA)
 * Level 3+: – (U+2013)
 */
export const BULLET_MARKERS = ["•", "◦", "▪", "–"] as const;

/**
 * Get bullet marker for a given nesting depth
 */
export function getBulletMarker(depth: number): string {
  return BULLET_MARKERS[Math.min(depth, BULLET_MARKERS.length - 1)];
}
