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

export interface SlideBackground {
  solid?: string;
  gradient?: {
    stops: GradientStop[];
    angle?: number;
  };
  templateStyle?: string;
  image?: BackgroundImage;
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
 * Figma selection link extracted from :::figma block
 */
export interface FigmaSelectionLink {
  url: string;
  nodeId?: string;
  fileKey?: string;
  x?: number;
  y?: number;
}

/** Image size specification (parsed from Marp-style alt text) */
export interface ImageSize {
  width?: number; // px (percentages are pre-converted)
  height?: number; // px
}

export type SlideBlock =
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
    }
  | { kind: "blockquote"; text: string; spans?: TextSpan[] }
  | {
      kind: "table";
      headers: TextSpan[][];
      rows: TextSpan[][][];
      align?: TableAlignment[];
    }
  | { kind: "figma"; link: FigmaSelectionLink }
  | { kind: "footnotes"; items: FootnoteItem[] };

export interface SlideContent {
  blocks: SlideBlock[];
  background?: SlideBackground;
  styles?: SlideStyles;
  slideNumber?: SlideNumberConfig;
  titlePrefix?: TitlePrefixConfig | null;
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
