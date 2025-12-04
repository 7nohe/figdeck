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
import type { FontVariant, SlideStyles, TextStyle } from "./types";

/**
 * Default font family and style
 */
const DEFAULT_FONT_FAMILY = "Inter";

/**
 * Default fallback font (Inter) used when a requested font cannot be loaded
 */
const FALLBACK_FONT: ResolvedFontName = {
  family: DEFAULT_FONT_FAMILY,
  regular: "Regular",
  bold: "Bold",
  italic: "Italic",
  boldItalic: "Bold Italic",
};

/**
 * Resolved font names for a text element
 */
export interface ResolvedFontName {
  family: string;
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
}

/**
 * Resolved style bundle for a specific text element
 */
export interface ResolvedTextStyle {
  fontSize: number;
  fills: Paint[] | undefined;
  fontStyle: "Regular" | "Bold" | "Italic" | "Bold Italic";
  /** Absolute X position in pixels (if specified) */
  x?: number;
  /** Absolute Y position in pixels (if specified) */
  y?: number;
  /** Resolved font names for this element */
  font: ResolvedFontName;
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
 * Resolve font names from a FontVariant config
 */
function resolveFontName(
  variant: FontVariant | undefined,
  defaultStyle: string,
): ResolvedFontName {
  const family = variant?.family || DEFAULT_FONT_FAMILY;
  const regular = variant?.style || defaultStyle;
  const bold = variant?.bold || "Bold";
  const italic = variant?.italic || "Italic";
  const boldItalic = variant?.boldItalic || "Bold Italic";

  return { family, regular, bold, italic, boldItalic };
}

/**
 * Resolve a single text style with defaults
 */
function resolveTextStyle(
  style: TextStyle | undefined,
  defaultSize: number,
  defaultFontStyle: ResolvedTextStyle["fontStyle"] = "Regular",
  fontVariant?: FontVariant,
): ResolvedTextStyle {
  return {
    fontSize: style?.size ?? defaultSize,
    fills: createFill(style),
    fontStyle: defaultFontStyle,
    x: style?.x,
    y: style?.y,
    font: resolveFontName(fontVariant, defaultFontStyle),
  };
}

/**
 * Resolve all styles for a slide, merging user styles with defaults
 */
export function resolveSlideStyles(styles?: SlideStyles): ResolvedSlideStyles {
  const headings = styles?.headings;
  const fonts = styles?.fonts;
  return {
    h1: resolveTextStyle(headings?.h1, DEFAULT_H1_SIZE, "Bold", fonts?.h1),
    h2: resolveTextStyle(headings?.h2, DEFAULT_H2_SIZE, "Bold", fonts?.h2),
    h3: resolveTextStyle(headings?.h3, DEFAULT_H3_SIZE, "Bold", fonts?.h3),
    h4: resolveTextStyle(headings?.h4, DEFAULT_H4_SIZE, "Bold", fonts?.h4),
    paragraph: resolveTextStyle(
      styles?.paragraphs,
      DEFAULT_PARAGRAPH_SIZE,
      "Regular",
      fonts?.body,
    ),
    bullet: resolveTextStyle(
      styles?.bullets,
      DEFAULT_BULLET_SIZE,
      "Regular",
      fonts?.bullets,
    ),
    code: resolveTextStyle(
      styles?.code,
      DEFAULT_CODE_SIZE,
      "Regular",
      fonts?.code,
    ),
  };
}

/**
 * Collect all unique FontName objects needed for a slide's styles
 */
export function collectFontNames(
  styles: ResolvedSlideStyles,
): Array<{ family: string; style: string }> {
  const fontSet = new Map<string, { family: string; style: string }>();

  const addFont = (family: string, style: string) => {
    const key = `${family}|${style}`;
    if (!fontSet.has(key)) {
      fontSet.set(key, { family, style });
    }
  };

  const addAllVariants = (font: ResolvedFontName) => {
    addFont(font.family, font.regular);
    addFont(font.family, font.bold);
    addFont(font.family, font.italic);
    addFont(font.family, font.boldItalic);
  };

  // Collect fonts from all style types
  addAllVariants(styles.h1.font);
  addAllVariants(styles.h2.font);
  addAllVariants(styles.h3.font);
  addAllVariants(styles.h4.font);
  addAllVariants(styles.paragraph.font);
  addAllVariants(styles.bullet.font);
  addAllVariants(styles.code.font);

  return Array.from(fontSet.values());
}

/**
 * Map an arbitrary font style string to a safe fallback style available in Inter
 */
function mapToFallbackStyle(style: string): string {
  const normalized = style.toLowerCase();
  const isItalic =
    normalized.includes("italic") || normalized.includes("oblique");
  const isBold =
    normalized.includes("bold") ||
    normalized.includes("black") ||
    normalized.includes("heavy") ||
    normalized.includes("semi") ||
    normalized.includes("demi") ||
    normalized.includes("medium");

  if (isBold && isItalic) return "Bold Italic";
  if (isBold) return "Bold";
  if (isItalic) return "Italic";
  return "Regular";
}

/**
 * Apply font fallbacks to resolved styles based on loaded font availability.
 * Any text style whose family/style combinations are missing will fall back to Inter.
 */
export function applyFontFallbacks(
  styles: ResolvedSlideStyles,
  availableFonts: Set<string>,
): ResolvedSlideStyles {
  const resolveFallbackFont = (font: ResolvedFontName): ResolvedFontName => {
    const variants = [font.regular, font.bold, font.italic, font.boldItalic];
    const missingVariant = variants.some(
      (style) => !availableFonts.has(`${font.family}|${style}`),
    );

    if (!missingVariant) return font;

    return {
      family: FALLBACK_FONT.family,
      regular: mapToFallbackStyle(font.regular),
      bold: mapToFallbackStyle(font.bold),
      italic: mapToFallbackStyle(font.italic),
      boldItalic: mapToFallbackStyle(font.boldItalic),
    };
  };

  return {
    h1: Object.assign({}, styles.h1, {
      font: resolveFallbackFont(styles.h1.font),
    }),
    h2: Object.assign({}, styles.h2, {
      font: resolveFallbackFont(styles.h2.font),
    }),
    h3: Object.assign({}, styles.h3, {
      font: resolveFallbackFont(styles.h3.font),
    }),
    h4: Object.assign({}, styles.h4, {
      font: resolveFallbackFont(styles.h4.font),
    }),
    paragraph: Object.assign({}, styles.paragraph, {
      font: resolveFallbackFont(styles.paragraph.font),
    }),
    bullet: Object.assign({}, styles.bullet, {
      font: resolveFallbackFont(styles.bullet.font),
    }),
    code: Object.assign({}, styles.code, {
      font: resolveFallbackFont(styles.code.font),
    }),
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
  /** Padding inside content container */
  CONTAINER_PADDING: 100,
} as const;
