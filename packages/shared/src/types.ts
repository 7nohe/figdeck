export interface GradientStop {
  color: string;
  position: number;
}

export interface BackgroundImage {
  url: string;
  mimeType?: string;
  dataBase64?: string;
  source?: "local" | "remote";
}

/**
 * Fit mode for background component
 * - cover: Scale to cover entire slide, cropping if necessary
 * - contain: Scale to fit within slide, may have empty space
 * - stretch: Stretch to fill slide, ignoring aspect ratio
 */
export type BackgroundComponentFit = "cover" | "contain" | "stretch";

/**
 * Alignment for background component positioning
 */
export type BackgroundComponentAlign =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * Background component configuration for using a Figma Component/Frame as background
 */
export interface BackgroundComponent {
  /** Figma URL link to the component/frame */
  link?: string;
  /** Figma node ID (extracted from link or specified directly) */
  nodeId: string;
  /** Figma file key (extracted from link) */
  fileKey?: string;
  /** How the component should be scaled to fit the slide (default: cover) */
  fit?: BackgroundComponentFit;
  /** Position alignment when component doesn't fill the slide (default: center) */
  align?: BackgroundComponentAlign;
  /** Opacity of the background component (0-1, default: 1) */
  opacity?: number;
}

export interface SlideBackground {
  solid?: string;
  gradient?: {
    stops: GradientStop[];
    angle?: number;
  };
  templateStyle?: string;
  image?: BackgroundImage;
  /** Figma Component/Frame used as background layer */
  component?: BackgroundComponent;
}

export interface CodeBlock {
  language?: string;
  code: string;
}

/**
 * Inline text span with formatting marks
 */
export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
  /** Display as superscript-style (smaller, raised) */
  superscript?: boolean;
}

export interface TextStyle {
  size?: number;
  color?: string;
  /** Absolute X position in pixels (slide is 1920x1080) */
  x?: number;
  /** Absolute Y position in pixels (slide is 1920x1080) */
  y?: number;
  /** Spacing between items in pixels (for bullet lists) */
  spacing?: number;
}

/**
 * Font variant definition for a specific style
 * family: font family name (e.g., "Inter", "Roboto")
 * style: base font style (e.g., "Regular", "Medium")
 */
export interface FontVariant {
  family: string;
  style: string;
  /** Override for bold variant (e.g., "Bold", "SemiBold") */
  bold?: string;
  /** Override for italic variant (e.g., "Italic", "Light Italic") */
  italic?: string;
  /** Override for bold italic variant (e.g., "Bold Italic") */
  boldItalic?: string;
}

/**
 * Font configuration for all text elements in slides
 */
export interface FontConfig {
  /** Font for H1 headings */
  h1?: FontVariant;
  /** Font for H2 headings */
  h2?: FontVariant;
  /** Font for H3 headings */
  h3?: FontVariant;
  /** Font for H4 headings */
  h4?: FontVariant;
  /** Font for body paragraphs */
  body?: FontVariant;
  /** Font for bullet list items */
  bullets?: FontVariant;
  /** Font for code blocks and inline code */
  code?: FontVariant;
}

export interface HeadingStyles {
  h1?: TextStyle;
  h2?: TextStyle;
  h3?: TextStyle;
  h4?: TextStyle;
}

export interface SlideStyles {
  headings?: HeadingStyles;
  paragraphs?: TextStyle;
  bullets?: TextStyle;
  code?: TextStyle;
  /** Font configuration for all text elements */
  fonts?: FontConfig;
}

export type SlideNumberPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export interface SlideNumberConfig {
  show?: boolean;
  size?: number;
  color?: string;
  position?: SlideNumberPosition;
  paddingX?: number;
  paddingY?: number;
  format?: string;
  /** Figma URL to a Frame/Component for custom slide number design */
  link?: string;
  /** Figma node ID (extracted from link or specified directly) */
  nodeId?: string;
  /** Start displaying slide numbers from this slide (1-indexed). Default: 1 */
  startFrom?: number;
  /** Offset to add to the displayed slide number. Default: 0 */
  offset?: number;
}

/**
 * Title prefix configuration for inserting a component instance before the title
 * Uses Figma URL or nodeId to reference a component in the current file
 */
export interface TitlePrefixConfig {
  link?: string;
  nodeId?: string;
  spacing?: number;
}

export type TableAlignment = "left" | "center" | "right" | null;

/**
 * Nested bullet item with optional children
 */
export interface BulletItem {
  text: string;
  spans?: TextSpan[];
  childrenOrdered?: boolean;
  childrenStart?: number;
  children?: BulletItem[];
}

/**
 * Footnote item for slide footnotes
 */
export interface FootnoteItem {
  id: string;
  content: string;
  spans?: TextSpan[];
}

/**
 * Horizontal alignment for slide content
 */
export type HorizontalAlign = "left" | "center" | "right";

/**
 * Vertical alignment for slide content
 */
export type VerticalAlign = "top" | "middle" | "bottom";

/**
 * Slide transition styles (kebab-case for user-friendly YAML)
 */
export type SlideTransitionStyle =
  | "none"
  | "dissolve"
  | "smart-animate"
  | "slide-from-left"
  | "slide-from-right"
  | "slide-from-top"
  | "slide-from-bottom"
  | "push-from-left"
  | "push-from-right"
  | "push-from-top"
  | "push-from-bottom"
  | "move-from-left"
  | "move-from-right"
  | "move-from-top"
  | "move-from-bottom"
  | "slide-out-to-left"
  | "slide-out-to-right"
  | "slide-out-to-top"
  | "slide-out-to-bottom"
  | "move-out-to-left"
  | "move-out-to-right"
  | "move-out-to-top"
  | "move-out-to-bottom";

/**
 * Easing curves for transitions
 */
export type SlideTransitionCurve =
  | "ease-in"
  | "ease-out"
  | "ease-in-and-out"
  | "linear"
  | "gentle"
  | "quick"
  | "bouncy"
  | "slow";

/**
 * Timing type for transitions
 */
export type SlideTransitionTimingType = "on-click" | "after-delay";

/**
 * Transition timing configuration
 */
export interface SlideTransitionTiming {
  type?: SlideTransitionTimingType;
  delay?: number; // 0 - 30 seconds
}

/**
 * Slide transition configuration
 */
export interface SlideTransitionConfig {
  style?: SlideTransitionStyle;
  duration?: number; // 0.01 - 10 seconds
  curve?: SlideTransitionCurve;
  timing?: SlideTransitionTiming | SlideTransitionTimingType; // Supports shorthand
}

/**
 * Callout/alert types for :::note, :::tip, :::warning, :::caution blocks
 */
export type CalloutType = "note" | "tip" | "warning" | "caution";

/**
 * Figma selection link extracted from :::figma block
 */
export interface FigmaSelectionLink {
  url: string;
  nodeId?: string;
  fileKey?: string;
  x?: number;
  y?: number;
  /** Text layer overrides: key is layer name, value is text with optional spans for rich formatting */
  textOverrides?: Record<string, { text: string; spans?: TextSpan[] }>;
  /** Hide the clickable link label below the preview */
  hideLink?: boolean;
}

/** Image size specification (parsed from Marp-style alt text) */
export interface ImageSize {
  width?: number; // px (percentages are pre-converted)
  height?: number; // px
}

/** Image position specification for absolute placement (parsed from Marp-style alt text) */
export interface ImagePosition {
  x?: number; // px (percentages are pre-converted based on SLIDE_WIDTH)
  y?: number; // px (percentages are pre-converted based on SLIDE_HEIGHT)
}

/**
 * Individual slide block types (excluding columns to avoid circular reference)
 */
export type SlideBlockItem =
  | { kind: "paragraph"; text: string; spans?: TextSpan[] }
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string; spans?: TextSpan[] }
  | {
      kind: "bullets";
      items: string[] | BulletItem[];
      ordered?: boolean;
      start?: number;
      /** @deprecated Use BulletItem[] with spans instead */
      itemSpans?: TextSpan[][];
    }
  | { kind: "code"; language?: string; code: string }
  | {
      kind: "image";
      url: string;
      alt?: string;
      mimeType?: string;
      dataBase64?: string;
      source?: "local" | "remote";
      size?: ImageSize;
      position?: ImagePosition;
    }
  | { kind: "blockquote"; text: string; spans?: TextSpan[] }
  | {
      kind: "table";
      headers: TextSpan[][];
      rows: TextSpan[][][];
      align?: TableAlignment[];
    }
  | { kind: "figma"; link: FigmaSelectionLink }
  | { kind: "footnotes"; items: FootnoteItem[] }
  | { kind: "callout"; type: CalloutType; text: string; spans?: TextSpan[] };

/**
 * Column layout block for multi-column slide layouts (2-4 columns)
 */
export interface ColumnsBlock {
  kind: "columns";
  /** Array of columns, each containing an array of SlideBlockItems */
  columns: SlideBlockItem[][];
  /** Gap between columns in pixels (default: 32, clamped to 0-200) */
  gap?: number;
  /** Column widths in pixels (default: even split) */
  widths?: number[];
}

export type SlideBlock = SlideBlockItem | ColumnsBlock;

/**
 * Default slide canvas dimensions and padding
 */
export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
export const CONTAINER_PADDING = 100;
export const CONTENT_WIDTH = SLIDE_WIDTH - CONTAINER_PADDING * 2;

/**
 * Layout constants for column layouts
 */
export const LAYOUT = {
  /** Default gap between columns in pixels */
  COLUMN_GAP: 32,
  /** Minimum width per column in pixels */
  COLUMN_MIN_WIDTH: 320,
  /** Maximum number of columns allowed */
  MAX_COLUMNS: 4,
  /** Minimum number of columns */
  MIN_COLUMNS: 2,
  /** Maximum gap between columns in pixels */
  MAX_COLUMN_GAP: 200,
} as const;

export interface SlideContent {
  blocks: SlideBlock[];
  background?: SlideBackground;
  styles?: SlideStyles;
  slideNumber?: SlideNumberConfig;
  titlePrefix?: TitlePrefixConfig | null;
  /** Treat this slide as a cover slide (typically the first slide). */
  cover?: boolean;
  /** Horizontal alignment of slide content */
  align?: HorizontalAlign;
  /** Vertical alignment of slide content */
  valign?: VerticalAlign;
  /** Footnotes for this slide */
  footnotes?: FootnoteItem[];
  /** Slide transition configuration */
  transition?: SlideTransitionConfig;
}

export interface GenerateSlidesMessage {
  type: "generate-slides";
  slides: SlideContent[];
}

/**
 * Protocol version for CLI-Plugin communication.
 * Increment only when breaking changes are made to the message format.
 */
export const PROTOCOL_VERSION = "1";

/**
 * Hello message sent by CLI to Plugin upon connection.
 * Used for version compatibility checking.
 */
export interface HelloMessage {
  type: "hello";
  protocolVersion: string;
  cliVersion: string;
}

/**
 * Hello response sent by Plugin to CLI.
 */
export interface HelloResponseMessage {
  type: "hello";
  protocolVersion: string;
  pluginVersion: string;
}

/**
 * Auth message sent by Plugin to CLI.
 */
export interface AuthMessage {
  type: "auth";
  secret: string;
}

/**
 * Auth success response from CLI.
 */
export interface AuthOkMessage {
  type: "auth-ok";
}

/**
 * Auth error response from CLI.
 */
export interface AuthErrorMessage {
  type: "auth-error";
  message: string;
}

/**
 * Generic plugin message (used by plugin UI)
 */
export interface PluginMessage {
  type: string;
  [key: string]: unknown;
}
