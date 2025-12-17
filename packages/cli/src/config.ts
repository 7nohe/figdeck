import type {
  BackgroundComponent,
  BackgroundComponentAlign,
  BackgroundComponentFit,
  BackgroundImage,
  FontConfig,
  FontVariant,
  HorizontalAlign,
  TextStyle as ParsedTextStyle,
  SlideBackground,
  SlideNumberConfig,
  SlideNumberPosition,
  SlideStyles,
  SlideTransitionConfig,
  SlideTransitionCurve,
  SlideTransitionStyle,
  SlideTransitionTiming,
  SlideTransitionTimingType,
  TitlePrefixConfig,
  VerticalAlign,
} from "@figdeck/shared";
import {
  normalizeTransitionCurve,
  normalizeTransitionStyle,
} from "@figdeck/shared";
import { normalizeColor, parseGradient } from "./colors.js";
import { parseFigmaUrl } from "./figma-block.js";
import {
  isRemoteUrl,
  isSupportedImageFormat,
  readLocalImage,
} from "./local-image.js";
import { getTemplateDefaults } from "./templates.js";

/**
 * Raw text style from YAML config
 */
interface TextStyle {
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  spacing?: number;
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
  link?: string;
  nodeId?: string;
  startFrom?: number;
  offset?: number;
}

/**
 * Title prefix configuration from YAML
 * Accepts either a Figma URL (link) or direct nodeId
 */
interface TitlePrefixYamlConfig {
  link?: string;
  nodeId?: string;
  spacing?: number;
}

/**
 * Transition timing configuration from YAML
 */
interface TransitionTimingYamlConfig {
  type?: string;
  delay?: number;
}

/**
 * Transition configuration from YAML
 */
interface TransitionYamlConfig {
  style?: string;
  duration?: number;
  curve?: string;
  timing?: TransitionTimingYamlConfig | string;
}

/**
 * Font variant configuration from YAML
 * Supports both shorthand (just family string) and full object
 */
interface FontVariantYamlConfig {
  family?: string;
  style?: string;
  bold?: string;
  italic?: string;
  boldItalic?: string;
}

/**
 * Fonts configuration from YAML
 */
interface FontsYamlConfig {
  h1?: FontVariantYamlConfig | string;
  h2?: FontVariantYamlConfig | string;
  h3?: FontVariantYamlConfig | string;
  h4?: FontVariantYamlConfig | string;
  body?: FontVariantYamlConfig | string;
  bullets?: FontVariantYamlConfig | string;
  code?: FontVariantYamlConfig | string;
}

/**
 * Background component configuration from YAML
 * Accepts URL string or object with link and fit/align/opacity options
 */
interface BackgroundComponentYamlConfig {
  link?: string;
  fit?: string;
  align?: string;
  opacity?: number;
}

/**
 * Unified background configuration from YAML
 * Can be a string (auto-detected) or object with explicit properties
 */
interface BackgroundYamlConfig {
  /** Solid color (hex or CSS color) */
  color?: string;
  /** Gradient string (e.g., "#000:0%,#fff:100%@45") */
  gradient?: string;
  /** Figma paint style name */
  template?: string;
  /** Image path or URL */
  image?: string;
  /** Figma component/frame (URL string or config object) */
  component?: string | BackgroundComponentYamlConfig;
}

/**
 * Full slide configuration from YAML frontmatter
 */
export interface SlideConfig {
  /**
   * Treat the first slide as a cover slide (global frontmatter only).
   * Default: true
   */
  cover?: boolean;
  /**
   * Background configuration - unified property that accepts:
   * - String: auto-detected as color, gradient, image, or Figma component
   * - Object: explicit configuration with color/gradient/template/image/component
   */
  background?: string | BackgroundYamlConfig;
  color?: string;
  headings?: HeadingsConfig;
  paragraphs?: TextStyle;
  bullets?: TextStyle;
  code?: TextStyle;
  slideNumber?: SlideNumberYamlConfig | boolean;
  titlePrefix?: TitlePrefixYamlConfig | false;
  align?: string;
  valign?: string;
  transition?: TransitionYamlConfig | string;
  fonts?: FontsYamlConfig;
}

/**
 * Parsed configuration result
 */
export interface ParsedConfigResult {
  background: SlideBackground | null;
  styles: SlideStyles;
  slideNumber: SlideNumberConfig | undefined;
  titlePrefix: TitlePrefixConfig | null | undefined;
  align: HorizontalAlign | undefined;
  valign: VerticalAlign | undefined;
  transition: SlideTransitionConfig | undefined;
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
  if (style.x !== undefined) {
    result.x = style.x;
  }
  if (style.y !== undefined) {
    result.y = style.y;
  }
  if (style.spacing !== undefined) {
    const spacing = Number(style.spacing);
    if (!Number.isNaN(spacing) && spacing >= 0) {
      result.spacing = spacing;
    }
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

  // Parse link/nodeId for custom Frame-based slide number
  if (config.link || config.nodeId) {
    let nodeId = config.nodeId;
    if (!nodeId && config.link) {
      const parsed = parseFigmaUrl(config.link);
      nodeId = parsed.nodeId;
    }
    if (nodeId) {
      result.link = config.link;
      result.nodeId = nodeId;
    }
  }

  // Parse startFrom (1-indexed slide number to start displaying from)
  if (
    config.startFrom !== undefined &&
    typeof config.startFrom === "number" &&
    config.startFrom >= 1
  ) {
    result.startFrom = config.startFrom;
  }

  // Parse offset (number to add to displayed slide number)
  if (config.offset !== undefined && typeof config.offset === "number") {
    result.offset = config.offset;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export interface ParseSlideConfigOptions {
  basePath?: string;
}

/**
 * Parse background image URL/path into BackgroundImage
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
 * Validate and normalize backgroundComponent fit option
 */
function parseBackgroundComponentFit(
  value: string | undefined,
): BackgroundComponentFit | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (
    normalized === "cover" ||
    normalized === "contain" ||
    normalized === "stretch"
  ) {
    return normalized;
  }
  console.warn(
    `[figdeck] Invalid backgroundComponent fit: ${value}. Using default "cover".`,
  );
  return undefined;
}

/**
 * Validate and normalize backgroundComponent align option
 */
function parseBackgroundComponentAlign(
  value: string | undefined,
): BackgroundComponentAlign | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/_/g, "-");
  const validAligns: BackgroundComponentAlign[] = [
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];
  if (validAligns.includes(normalized as BackgroundComponentAlign)) {
    return normalized as BackgroundComponentAlign;
  }
  console.warn(
    `[figdeck] Invalid backgroundComponent align: ${value}. Using default "center".`,
  );
  return undefined;
}

/**
 * Validate backgroundComponent opacity (0-1)
 */
function parseBackgroundComponentOpacity(
  value: number | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  const opacity = Number(value);
  if (!Number.isNaN(opacity) && opacity >= 0 && opacity <= 1) {
    return opacity;
  }
  console.warn(
    `[figdeck] Invalid backgroundComponent opacity: ${value}. Must be 0-1.`,
  );
  return undefined;
}

/**
 * Parse backgroundComponent from YAML config
 * Accepts either a Figma URL string or object with link and options
 */
function parseBackgroundComponent(
  config: string | BackgroundComponentYamlConfig | undefined,
): BackgroundComponent | null {
  if (!config) return null;

  // Shorthand: just a Figma URL
  if (typeof config === "string") {
    const parsed = parseFigmaUrl(config);
    if (!parsed.nodeId) {
      console.warn(
        `[figdeck] backgroundComponent URL must include node-id: ${config}`,
      );
      return null;
    }
    return {
      link: config,
      nodeId: parsed.nodeId,
      fileKey: parsed.fileKey,
    };
  }

  // Object form - requires link
  if (!config.link) {
    console.warn("[figdeck] backgroundComponent requires link with node-id");
    return null;
  }

  const parsed = parseFigmaUrl(config.link);
  if (!parsed.nodeId) {
    console.warn(
      `[figdeck] backgroundComponent URL must include node-id: ${config.link}`,
    );
    return null;
  }

  const result: BackgroundComponent = {
    link: config.link,
    nodeId: parsed.nodeId,
    fileKey: parsed.fileKey,
  };

  const fit = parseBackgroundComponentFit(config.fit);
  if (fit) {
    result.fit = fit;
  }

  const align = parseBackgroundComponentAlign(config.align);
  if (align) {
    result.align = align;
  }

  const opacity = parseBackgroundComponentOpacity(config.opacity);
  if (opacity !== undefined) {
    result.opacity = opacity;
  }

  return result;
}

/**
 * Check if a string looks like a color (hex or CSS color name)
 */
function looksLikeColor(value: string): boolean {
  // Hex colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return true;
  // rgb/rgba/hsl/hsla
  if (/^(rgb|hsl)a?\s*\(/.test(value)) return true;
  // Named colors (basic check - normalize will handle validation)
  if (/^[a-zA-Z]+$/.test(value)) return true;
  return false;
}

/**
 * Check if a string looks like a gradient (contains color stops with positions)
 */
function looksLikeGradient(value: string): boolean {
  // Gradient format: #color:position%,#color:position%[@angle]
  return /^#?[0-9a-fA-F]{3,8}:\d+%/.test(value);
}

/**
 * Check if a string is a Figma URL with node-id
 */
function isFigmaComponentUrl(value: string): boolean {
  return (
    /^https?:\/\/(?:www\.)?figma\.com\//.test(value) &&
    /[?&]node-id=/.test(value)
  );
}

/**
 * Parse unified background configuration
 * Handles both string (auto-detect) and object formats
 */
function parseUnifiedBackground(
  config: string | BackgroundYamlConfig | undefined,
  basePath?: string,
): { background: SlideBackground | null; templateName?: string } {
  if (!config) return { background: null };

  // String format - auto-detect type
  if (typeof config === "string") {
    // Check if it's a Figma component URL
    if (isFigmaComponentUrl(config)) {
      const component = parseBackgroundComponent(config);
      if (component) {
        return { background: { component } };
      }
      return { background: null };
    }

    // Check if it's a gradient
    if (looksLikeGradient(config)) {
      const gradient = parseGradient(config);
      if (gradient) {
        return { background: { gradient } };
      }
    }

    // Check if it's a color
    if (looksLikeColor(config)) {
      return { background: { solid: normalizeColor(config) } };
    }

    // Otherwise treat as image path/URL
    const image = parseBackgroundImage(config, basePath);
    if (image) {
      return { background: { image } };
    }

    return { background: null };
  }

  // Object format - explicit configuration
  let background: SlideBackground | null = null;
  let templateName: string | undefined;

  // Priority: template > gradient > color > image
  if (config.template) {
    background = { templateStyle: config.template };
    templateName = config.template;
  } else if (config.gradient) {
    const gradient = parseGradient(config.gradient);
    if (gradient) {
      background = { gradient };
    }
  } else if (config.color) {
    background = { solid: normalizeColor(config.color) };
  } else if (config.image) {
    const image = parseBackgroundImage(config.image, basePath);
    if (image) {
      background = { image };
    }
  }

  // Component can be combined with other backgrounds
  if (config.component) {
    const component = parseBackgroundComponent(config.component);
    if (component) {
      if (background) {
        background.component = component;
      } else {
        background = { component };
      }
    }
  }

  return { background, templateName };
}

/**
 * Parse slide config from YAML frontmatter
 */
export function parseSlideConfig(
  config: SlideConfig,
  options: ParseSlideConfigOptions = {},
): ParsedConfigResult {
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

  // Parse unified background
  const { background, templateName } = parseUnifiedBackground(
    config.background,
    options.basePath,
  );

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

  // Parse fonts config
  const fonts = parseFontsConfig(config.fonts);
  if (fonts) {
    styles.fonts = fonts;
  }

  // Parse slideNumber config
  const slideNumber = parseSlideNumberConfig(config.slideNumber);

  // Parse titlePrefix config
  let titlePrefix: TitlePrefixConfig | null | undefined;
  if (config.titlePrefix === false) {
    // Explicitly disabled
    titlePrefix = null;
  } else if (
    config.titlePrefix &&
    (config.titlePrefix.link || config.titlePrefix.nodeId)
  ) {
    // Explicit config - extract nodeId from link if provided
    let nodeId = config.titlePrefix.nodeId;
    if (!nodeId && config.titlePrefix.link) {
      const parsed = parseFigmaUrl(config.titlePrefix.link);
      nodeId = parsed.nodeId;
    }
    if (nodeId) {
      titlePrefix = {
        link: config.titlePrefix.link,
        nodeId,
        spacing: config.titlePrefix.spacing,
      };
    }
  } else if (templateName) {
    // Look up template defaults
    const templateDefaults = getTemplateDefaults(templateName);
    if (templateDefaults?.titlePrefix) {
      titlePrefix = templateDefaults.titlePrefix;
    }
  }

  // Parse align/valign config
  const align = parseHorizontalAlign(config.align);
  const valign = parseVerticalAlign(config.valign);

  // Parse transition config
  const transition = parseTransitionConfig(config.transition);

  return {
    background,
    styles,
    slideNumber,
    titlePrefix,
    align,
    valign,
    transition,
  };
}

/**
 * Parse and validate horizontal alignment
 */
function parseHorizontalAlign(
  value: string | undefined,
): HorizontalAlign | undefined {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return undefined;
}

/**
 * Parse and validate vertical alignment
 */
function parseVerticalAlign(
  value: string | undefined,
): VerticalAlign | undefined {
  if (value === "top" || value === "middle" || value === "bottom") {
    return value;
  }
  return undefined;
}

/**
 * Parse and validate transition style (kebab-case, also accepts underscore)
 */
export function parseTransitionStyle(
  value: string | undefined,
): SlideTransitionStyle | undefined {
  if (!value) return undefined;
  return normalizeTransitionStyle(value);
}

/**
 * Parse and validate transition curve
 */
export function parseTransitionCurve(
  value: string | undefined,
): SlideTransitionCurve | undefined {
  if (!value) return undefined;
  return normalizeTransitionCurve(value);
}

/**
 * Parse and validate transition timing type
 */
function parseTransitionTimingType(
  value: string | undefined,
): SlideTransitionTimingType | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/_/g, "-");
  if (normalized === "on-click" || normalized === "after-delay") {
    return normalized;
  }
  return undefined;
}

/**
 * Parse transition config from YAML (supports shorthand and full object)
 */
export function parseTransitionConfig(
  config: TransitionYamlConfig | string | undefined,
): SlideTransitionConfig | undefined {
  if (!config) return undefined;

  // Shorthand: "dissolve" or "slide-from-left 0.5"
  if (typeof config === "string") {
    const parts = config.trim().split(/\s+/);
    const style = parseTransitionStyle(parts[0]);
    if (!style) return undefined;

    const result: SlideTransitionConfig = { style };
    if (parts[1]) {
      const duration = Number.parseFloat(parts[1]);
      if (!Number.isNaN(duration) && duration >= 0.01 && duration <= 10) {
        result.duration = duration;
      }
    }
    return result;
  }

  // Full object format
  const result: SlideTransitionConfig = {};

  if (config.style) {
    result.style = parseTransitionStyle(config.style);
  }

  if (config.duration !== undefined) {
    const d = Number(config.duration);
    if (!Number.isNaN(d) && d >= 0.01 && d <= 10) {
      result.duration = d;
    }
  }

  if (config.curve) {
    result.curve = parseTransitionCurve(config.curve);
  }

  // Parse timing config
  if (config.timing) {
    if (typeof config.timing === "string") {
      // Shorthand: "on-click" or "after-delay"
      const type = parseTransitionTimingType(config.timing);
      if (type) {
        result.timing = type;
      }
    } else {
      const timing: SlideTransitionTiming = {};
      if (config.timing.type) {
        timing.type = parseTransitionTimingType(config.timing.type);
      }
      if (config.timing.delay !== undefined) {
        const delay = Number(config.timing.delay);
        if (!Number.isNaN(delay) && delay >= 0 && delay <= 30) {
          timing.delay = delay;
        }
      }
      if (Object.keys(timing).length > 0) {
        result.timing = timing;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse a single FontVariant from YAML config
 * Supports both shorthand (just family string) and full object
 */
function parseFontVariant(
  config: FontVariantYamlConfig | string | undefined,
): FontVariant | undefined {
  if (!config) return undefined;

  // Shorthand: just family name with "Regular" style
  if (typeof config === "string") {
    return {
      family: config,
      style: "Regular",
    };
  }

  // Full object form
  if (!config.family) return undefined;

  return {
    family: config.family,
    style: config.style || "Regular",
    bold: config.bold,
    italic: config.italic,
    boldItalic: config.boldItalic,
  };
}

/**
 * Parse fonts config from YAML
 */
function parseFontsConfig(
  config: FontsYamlConfig | undefined,
): FontConfig | undefined {
  if (!config) return undefined;

  const result: FontConfig = {};

  if (config.h1) result.h1 = parseFontVariant(config.h1);
  if (config.h2) result.h2 = parseFontVariant(config.h2);
  if (config.h3) result.h3 = parseFontVariant(config.h3);
  if (config.h4) result.h4 = parseFontVariant(config.h4);
  if (config.body) result.body = parseFontVariant(config.body);
  if (config.bullets) result.bullets = parseFontVariant(config.bullets);
  if (config.code) result.code = parseFontVariant(config.code);

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Merge two FontVariant objects
 */
function mergeFontVariant(
  defaultVariant: FontVariant | undefined,
  slideVariant: FontVariant | undefined,
): FontVariant | undefined {
  if (!defaultVariant && !slideVariant) return undefined;
  if (!defaultVariant) return slideVariant;
  if (!slideVariant) return defaultVariant;

  return {
    family: slideVariant.family ?? defaultVariant.family,
    style: slideVariant.style ?? defaultVariant.style,
    bold: slideVariant.bold ?? defaultVariant.bold,
    italic: slideVariant.italic ?? defaultVariant.italic,
    boldItalic: slideVariant.boldItalic ?? defaultVariant.boldItalic,
  };
}

/**
 * Merge FontConfig, with slide config overriding defaults
 */
export function mergeFontsConfig(
  defaultConfig: FontConfig | undefined,
  slideConfig: FontConfig | undefined,
): FontConfig | undefined {
  if (!defaultConfig && !slideConfig) return undefined;
  if (!defaultConfig) return slideConfig;
  if (!slideConfig) return defaultConfig;

  const result: FontConfig = {};

  const merged = {
    h1: mergeFontVariant(defaultConfig.h1, slideConfig.h1),
    h2: mergeFontVariant(defaultConfig.h2, slideConfig.h2),
    h3: mergeFontVariant(defaultConfig.h3, slideConfig.h3),
    h4: mergeFontVariant(defaultConfig.h4, slideConfig.h4),
    body: mergeFontVariant(defaultConfig.body, slideConfig.body),
    bullets: mergeFontVariant(defaultConfig.bullets, slideConfig.bullets),
    code: mergeFontVariant(defaultConfig.code, slideConfig.code),
  };

  if (merged.h1) result.h1 = merged.h1;
  if (merged.h2) result.h2 = merged.h2;
  if (merged.h3) result.h3 = merged.h3;
  if (merged.h4) result.h4 = merged.h4;
  if (merged.body) result.body = merged.body;
  if (merged.bullets) result.bullets = merged.bullets;
  if (merged.code) result.code = merged.code;

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Merge two SlideStyles, with slide styles overriding defaults
 */
/**
 * Merge two TextStyle objects, with slide-specific values taking precedence
 */
function mergeTextStyle(
  defaultStyle: ParsedTextStyle | undefined,
  slideStyle: ParsedTextStyle | undefined,
): ParsedTextStyle | undefined {
  if (!defaultStyle && !slideStyle) return undefined;
  if (!defaultStyle) return slideStyle;
  if (!slideStyle) return defaultStyle;
  return {
    size: slideStyle.size ?? defaultStyle.size,
    color: slideStyle.color ?? defaultStyle.color,
    x: slideStyle.x ?? defaultStyle.x,
    y: slideStyle.y ?? defaultStyle.y,
    spacing: slideStyle.spacing ?? defaultStyle.spacing,
  };
}

export function mergeStyles(
  defaultStyles: SlideStyles,
  slideStyles: SlideStyles,
): SlideStyles {
  const result: SlideStyles = {
    headings: {
      h1: mergeTextStyle(defaultStyles.headings?.h1, slideStyles.headings?.h1),
      h2: mergeTextStyle(defaultStyles.headings?.h2, slideStyles.headings?.h2),
      h3: mergeTextStyle(defaultStyles.headings?.h3, slideStyles.headings?.h3),
      h4: mergeTextStyle(defaultStyles.headings?.h4, slideStyles.headings?.h4),
    },
    paragraphs: mergeTextStyle(
      defaultStyles.paragraphs,
      slideStyles.paragraphs,
    ),
    bullets: mergeTextStyle(defaultStyles.bullets, slideStyles.bullets),
    code: mergeTextStyle(defaultStyles.code, slideStyles.code),
  };

  // Merge fonts config
  const mergedFonts = mergeFontsConfig(defaultStyles.fonts, slideStyles.fonts);
  if (mergedFonts) {
    result.fonts = mergedFonts;
  }

  return result;
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
    link: slideConfig.link ?? defaultConfig.link,
    nodeId: slideConfig.nodeId ?? defaultConfig.nodeId,
    startFrom: slideConfig.startFrom ?? defaultConfig.startFrom,
    offset: slideConfig.offset ?? defaultConfig.offset,
  };
}

/**
 * Merge SlideTransitionConfig, with slide config overriding defaults
 */
export function mergeTransitionConfig(
  defaultConfig: SlideTransitionConfig | undefined,
  slideConfig: SlideTransitionConfig | undefined,
): SlideTransitionConfig | undefined {
  if (!defaultConfig && !slideConfig) return undefined;
  if (!defaultConfig) return slideConfig;
  if (!slideConfig) return defaultConfig;

  const result: SlideTransitionConfig = {
    style: slideConfig.style ?? defaultConfig.style,
    duration: slideConfig.duration ?? defaultConfig.duration,
    curve: slideConfig.curve ?? defaultConfig.curve,
  };

  // Merge timing config
  const defaultTiming =
    typeof defaultConfig.timing === "string"
      ? { type: defaultConfig.timing as SlideTransitionTimingType }
      : defaultConfig.timing;
  const slideTiming =
    typeof slideConfig.timing === "string"
      ? { type: slideConfig.timing as SlideTransitionTimingType }
      : slideConfig.timing;

  if (defaultTiming || slideTiming) {
    result.timing = {
      type: slideTiming?.type ?? defaultTiming?.type,
      delay: slideTiming?.delay ?? defaultTiming?.delay,
    };
  }

  return result;
}
