import { parseColor } from "./colors";
import {
  DEFAULT_BULLET_SIZE,
  DEFAULT_CODE_SIZE,
  DEFAULT_H1_SIZE,
  DEFAULT_H2_SIZE,
  DEFAULT_H3_SIZE,
  DEFAULT_H4_SIZE,
  DEFAULT_PARAGRAPH_SIZE,
} from "./constants";
import type { SlideStyles, TextStyle } from "./types";

/**
 * Resolved style bundle for a specific text element
 */
export interface ResolvedTextStyle {
  fontSize: number;
  fills: Paint[] | undefined;
  fontStyle: "Regular" | "Bold" | "Italic" | "Bold Italic";
}

/**
 * Resolved styles for all slide elements
 */
export interface ResolvedSlideStyles {
  h1: ResolvedTextStyle;
  h2: ResolvedTextStyle;
  h3: ResolvedTextStyle;
  h4: ResolvedTextStyle;
  paragraph: ResolvedTextStyle;
  bullet: ResolvedTextStyle;
  code: ResolvedTextStyle;
}

/**
 * Create fill from TextStyle color
 */
export function createFill(style: TextStyle | undefined): Paint[] | undefined {
  if (!style?.color) return undefined;
  const color = parseColor(style.color);
  if (color) {
    return [
      {
        type: "SOLID" as const,
        color: { r: color.r, g: color.g, b: color.b },
        opacity: color.a !== undefined ? color.a : 1,
      },
    ];
  }
  return undefined;
}

/**
 * Resolve a single text style with defaults
 */
function resolveTextStyle(
  style: TextStyle | undefined,
  defaultSize: number,
  defaultFontStyle: ResolvedTextStyle["fontStyle"] = "Regular",
): ResolvedTextStyle {
  return {
    fontSize: style?.size ?? defaultSize,
    fills: createFill(style),
    fontStyle: defaultFontStyle,
  };
}

/**
 * Resolve all styles for a slide, merging user styles with defaults
 */
export function resolveSlideStyles(styles?: SlideStyles): ResolvedSlideStyles {
  const headings = styles?.headings;
  return {
    h1: resolveTextStyle(headings?.h1, DEFAULT_H1_SIZE, "Bold"),
    h2: resolveTextStyle(headings?.h2, DEFAULT_H2_SIZE, "Bold"),
    h3: resolveTextStyle(headings?.h3, DEFAULT_H3_SIZE, "Bold"),
    h4: resolveTextStyle(headings?.h4, DEFAULT_H4_SIZE, "Bold"),
    paragraph: resolveTextStyle(
      styles?.paragraphs,
      DEFAULT_PARAGRAPH_SIZE,
      "Regular",
    ),
    bullet: resolveTextStyle(styles?.bullets, DEFAULT_BULLET_SIZE, "Regular"),
    code: resolveTextStyle(styles?.code, DEFAULT_CODE_SIZE, "Regular"),
  };
}

/**
 * Layout constants
 */
export const LAYOUT = {
  /** Left margin for content */
  LEFT_MARGIN: 100,
  /** Initial y offset for slide content */
  INITIAL_Y_OFFSET: 100,
  /** Spacing after title */
  TITLE_SPACING: 40,
  /** Default spacing after blocks */
  BLOCK_SPACING: 30,
  /** Spacing between bullet items */
  BULLET_ITEM_SPACING: 8,
} as const;
