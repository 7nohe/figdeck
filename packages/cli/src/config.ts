import { normalizeColor, parseGradient } from "./colors.js";
import {
  isRemoteUrl,
  isSupportedImageFormat,
  readLocalImage,
} from "./local-image.js";
import type {
  BackgroundImage,
  TextStyle as ParsedTextStyle,
  SlideBackground,
  SlideNumberConfig,
  SlideNumberPosition,
  SlideStyles,
} from "./types.js";

/**
 * Raw text style from YAML config
 */
interface TextStyle {
  size?: number;
  color?: string;
}

/**
 * Headings configuration from YAML
 */
interface HeadingsConfig {
  h1?: TextStyle;
  h2?: TextStyle;
  h3?: TextStyle;
  h4?: TextStyle;
}

/**
 * Slide number configuration from YAML
 */
interface SlideNumberYamlConfig {
  show?: boolean;
  size?: number;
  color?: string;
  position?: string;
  paddingX?: number;
  paddingY?: number;
  format?: string;
}

/**
 * Full slide configuration from YAML frontmatter
 */
export interface SlideConfig {
  background?: string;
  gradient?: string;
  template?: string;
  backgroundImage?: string;
  color?: string;
  headings?: HeadingsConfig;
  paragraphs?: TextStyle;
  bullets?: TextStyle;
  code?: TextStyle;
  slideNumber?: SlideNumberYamlConfig | boolean;
}

/**
 * Parsed configuration result
 */
export interface ParsedConfigResult {
  background: SlideBackground | null;
  styles: SlideStyles;
  slideNumber: SlideNumberConfig | undefined;
}

/**
 * Parse and validate a font size value (1-200px range)
 */
export function parseFontSize(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const size = Number(value);
  if (!Number.isNaN(size) && size >= 1 && size <= 200) {
    return size;
  }
  return undefined;
}

/**
 * Parse a TextStyle object and normalize colors
 */
function parseTextStyle(
  style: TextStyle | undefined,
): ParsedTextStyle | undefined {
  if (!style) return undefined;
  const result: ParsedTextStyle = {};
  if (style.size !== undefined) {
    result.size = parseFontSize(style.size);
  }
  if (style.color) {
    result.color = normalizeColor(style.color);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse slideNumber config from YAML
 */
function parseSlideNumberConfig(
  config: SlideNumberYamlConfig | boolean | undefined,
): SlideNumberConfig | undefined {
  if (config === undefined) return undefined;

  // Boolean shorthand: true = show, false = hide
  if (typeof config === "boolean") {
    return { show: config };
  }

  const result: SlideNumberConfig = {};

  if (config.show !== undefined) result.show = config.show;
  if (
    config.size !== undefined &&
    typeof config.size === "number" &&
    config.size >= 1 &&
    config.size <= 200
  ) {
    result.size = config.size;
  }
  if (config.color) {
    result.color = normalizeColor(config.color);
  }
  if (config.position) {
    const validPositions: SlideNumberPosition[] = [
      "bottom-right",
      "bottom-left",
      "top-right",
      "top-left",
    ];
    if (validPositions.includes(config.position as SlideNumberPosition)) {
      result.position = config.position as SlideNumberPosition;
    }
  }
  if (config.paddingX !== undefined && typeof config.paddingX === "number") {
    result.paddingX = config.paddingX;
  }
  if (config.paddingY !== undefined && typeof config.paddingY === "number") {
    result.paddingY = config.paddingY;
  }
  if (config.format && typeof config.format === "string") {
    result.format = config.format;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export interface ParseSlideConfigOptions {
  basePath?: string;
}

/**
 * Parse backgroundImage into BackgroundImage
 */
function parseBackgroundImage(
  url: string,
  basePath?: string,
): BackgroundImage | null {
  if (!url) return null;

  // Remote image (http:// or https://)
  if (isRemoteUrl(url)) {
    return {
      url,
      source: "remote",
    };
  }

  // Local image - read and encode
  if (basePath) {
    if (!isSupportedImageFormat(url)) {
      console.warn(`[figdeck] Unsupported background image format: ${url}`);
      return null;
    }
    const result = readLocalImage(url, basePath);
    if (result) {
      return {
        url,
        mimeType: result.mimeType,
        dataBase64: result.dataBase64,
        source: "local",
      };
    }
  }

  // Could not process
  console.warn(`[figdeck] Could not load background image: ${url}`);
  return null;
}

/**
 * Parse slide config from YAML frontmatter
 */
export function parseSlideConfig(
  config: SlideConfig,
  options: ParseSlideConfigOptions = {},
): ParsedConfigResult {
  let background: SlideBackground | null = null;
  const styles: SlideStyles = {};

  const baseColor = config.color ? normalizeColor(config.color) : undefined;
  const applyBaseColor = (
    style: ParsedTextStyle | undefined,
  ): ParsedTextStyle | undefined => {
    if (!baseColor) return style;
    if (style) {
      return style.color ? style : { ...style, color: baseColor };
    }
    return { color: baseColor };
  };

  // Priority: templateStyle > gradient > solid > image
  if (config.template) {
    background = { templateStyle: config.template };
  } else if (config.gradient) {
    const gradient = parseGradient(config.gradient);
    if (gradient) {
      background = { gradient };
    }
  } else if (config.background) {
    background = { solid: normalizeColor(config.background) };
  } else if (config.backgroundImage) {
    const image = parseBackgroundImage(
      config.backgroundImage,
      options.basePath,
    );
    if (image) {
      background = { image };
    }
  }

  // Parse headings
  const headingStyles: NonNullable<SlideStyles["headings"]> = {
    h1: applyBaseColor(parseTextStyle(config.headings?.h1)),
    h2: applyBaseColor(parseTextStyle(config.headings?.h2)),
    h3: applyBaseColor(parseTextStyle(config.headings?.h3)),
    h4: applyBaseColor(parseTextStyle(config.headings?.h4)),
  };
  styles.headings = headingStyles;

  // Parse other text styles
  styles.paragraphs = applyBaseColor(parseTextStyle(config.paragraphs));
  styles.bullets = applyBaseColor(parseTextStyle(config.bullets));
  styles.code = applyBaseColor(parseTextStyle(config.code));

  // Parse slideNumber config
  const slideNumber = parseSlideNumberConfig(config.slideNumber);

  return { background, styles, slideNumber };
}

/**
 * Merge two SlideStyles, with slide styles overriding defaults
 */
export function mergeStyles(
  defaultStyles: SlideStyles,
  slideStyles: SlideStyles,
): SlideStyles {
  return {
    headings: {
      h1: slideStyles.headings?.h1 ?? defaultStyles.headings?.h1,
      h2: slideStyles.headings?.h2 ?? defaultStyles.headings?.h2,
      h3: slideStyles.headings?.h3 ?? defaultStyles.headings?.h3,
      h4: slideStyles.headings?.h4 ?? defaultStyles.headings?.h4,
    },
    paragraphs: slideStyles.paragraphs ?? defaultStyles.paragraphs,
    bullets: slideStyles.bullets ?? defaultStyles.bullets,
    code: slideStyles.code ?? defaultStyles.code,
  };
}

/**
 * Merge SlideNumberConfig, with slide config overriding defaults
 */
export function mergeSlideNumberConfig(
  defaultConfig: SlideNumberConfig | undefined,
  slideConfig: SlideNumberConfig | undefined,
): SlideNumberConfig | undefined {
  if (!defaultConfig && !slideConfig) return undefined;
  if (!defaultConfig) return slideConfig;
  if (!slideConfig) return defaultConfig;

  return {
    show: slideConfig.show ?? defaultConfig.show,
    size: slideConfig.size ?? defaultConfig.size,
    color: slideConfig.color ?? defaultConfig.color,
    position: slideConfig.position ?? defaultConfig.position,
    paddingX: slideConfig.paddingX ?? defaultConfig.paddingX,
    paddingY: slideConfig.paddingY ?? defaultConfig.paddingY,
    format: slideConfig.format ?? defaultConfig.format,
  };
}
