export interface GradientStop {
  color: string;
  position: number;
}

export interface SlideBackground {
  solid?: string;
  gradient?: {
    stops: GradientStop[];
    angle?: number;
  };
  templateStyle?: string;
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
}

export interface TextStyle {
  size?: number;
  color?: string;
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
}

export type TableAlignment = "left" | "center" | "right" | null;

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

export type SlideBlock =
  | { kind: "paragraph"; text: string; spans?: TextSpan[] }
  | { kind: "heading"; level: 3 | 4; text: string; spans?: TextSpan[] }
  | {
      kind: "bullets";
      items: string[];
      ordered?: boolean;
      start?: number;
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
    }
  | { kind: "blockquote"; text: string; spans?: TextSpan[] }
  | {
      kind: "table";
      headers: TextSpan[][];
      rows: TextSpan[][][];
      align?: TableAlignment[];
    }
  | { kind: "figma"; link: FigmaSelectionLink };

export interface SlideContent {
  type: "title" | "content";
  title?: string;
  body?: string[];
  bullets?: string[];
  codeBlocks?: CodeBlock[];
  blocks?: SlideBlock[];
  background?: SlideBackground;
  styles?: SlideStyles;
  slideNumber?: SlideNumberConfig;
}

export interface GenerateSlidesMessage {
  type: "generate-slides";
  slides: SlideContent[];
}

export interface PluginMessage {
  type: string;
  [key: string]: unknown;
}
