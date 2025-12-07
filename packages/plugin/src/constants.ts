import type { SlideNumberPosition } from "./types";

// Default font sizes
export const DEFAULT_H1_SIZE = 64;
export const DEFAULT_H2_SIZE = 48;
export const DEFAULT_H3_SIZE = 36;
export const DEFAULT_H4_SIZE = 28;
export const DEFAULT_PARAGRAPH_SIZE = 24;
export const DEFAULT_BULLET_SIZE = 24;
export const DEFAULT_CODE_SIZE = 16;

// Default colors
export const DEFAULT_TEXT_COLOR = "#000000";

// Link color
export const LINK_COLOR: RGB = { r: 0.23, g: 0.52, b: 0.93 }; // #3b82f5

// Inline code background
export const INLINE_CODE_BG: RGB = { r: 0.94, g: 0.94, b: 0.94 }; // #f0f0f0

// Figma link card colors
export const FIGMA_CARD_BG: RGB = { r: 0.96, g: 0.96, b: 0.98 };
export const FIGMA_CARD_BORDER: RGB = { r: 0.85, g: 0.85, b: 0.9 };
export const FIGMA_BRAND_COLOR: RGB = { r: 0.64, g: 0.33, b: 0.97 }; // Figma purple

// Max size for cloned node preview (matches slide dimensions)
export const MAX_PREVIEW_WIDTH = 1920;
export const MAX_PREVIEW_HEIGHT = 1080;

// Slide number defaults
export const DEFAULT_SLIDE_NUMBER_SIZE = 14;
export const DEFAULT_SLIDE_NUMBER_POSITION: SlideNumberPosition =
  "bottom-right";
export const DEFAULT_SLIDE_NUMBER_PADDING_X = 32;
export const DEFAULT_SLIDE_NUMBER_PADDING_Y = 24;
export const DEFAULT_SLIDE_NUMBER_FORMAT = "{{current}} / {{total}}";
export const SLIDE_NUMBER_NODE_NAME = "figdeck-slide-number";

// Plugin data key
export const PLUGIN_DATA_KEY = "figdeck-index";
