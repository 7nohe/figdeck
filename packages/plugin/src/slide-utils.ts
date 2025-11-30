import { createGradientTransform, parseColor } from "./colors";
import {
  DEFAULT_SLIDE_NUMBER_FORMAT,
  DEFAULT_SLIDE_NUMBER_PADDING_X,
  DEFAULT_SLIDE_NUMBER_PADDING_Y,
  DEFAULT_SLIDE_NUMBER_POSITION,
  DEFAULT_SLIDE_NUMBER_SIZE,
  SLIDE_NUMBER_NODE_NAME,
} from "./constants";
import type { SlideBackground, SlideNumberConfig } from "./types";

/**
 * Apply background fill to a slide node
 */
export async function applyBackground(
  slideNode: SlideNode,
  background: SlideBackground,
): Promise<void> {
  // Priority: templateStyle > gradient > solid
  if (background.templateStyle) {
    // Try to find local paint style first
    const localStyles = await figma.getLocalPaintStylesAsync();
    const localStyle = localStyles.find(
      (s) => s.name === background.templateStyle,
    );

    if (localStyle) {
      slideNode.fillStyleId = localStyle.id;
      return;
    }

    // Try to import by key (for team library styles)
    try {
      const importedStyle = await figma.importStyleByKeyAsync(
        background.templateStyle,
      );
      if (importedStyle && importedStyle.type === "PAINT") {
        slideNode.fillStyleId = importedStyle.id;
        return;
      }
    } catch (_e) {
      // Style not found, fall through to notify
    }

    figma.notify(`Paint style "${background.templateStyle}" not found`, {
      error: true,
    });
    return;
  }

  if (background.gradient) {
    const { stops, angle = 0 } = background.gradient;
    const gradientStops: ColorStop[] = [];

    for (const stop of stops) {
      const color = parseColor(stop.color);
      if (color) {
        gradientStops.push({
          position: stop.position,
          color: { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 },
        });
      }
    }

    if (gradientStops.length >= 2) {
      const gradientFill: GradientPaint = {
        type: "GRADIENT_LINEAR",
        gradientTransform: createGradientTransform(angle),
        gradientStops,
      };
      slideNode.fills = [gradientFill];
    }
    return;
  }

  if (background.solid) {
    const color = parseColor(background.solid);
    if (color) {
      const solidFill: SolidPaint = {
        type: "SOLID",
        color: { r: color.r, g: color.g, b: color.b },
        opacity: color.a ?? 1,
      };
      slideNode.fills = [solidFill];
    } else {
      figma.notify(`Invalid color "${background.solid}"`, { error: true });
    }
  }
}

/**
 * Format slide number text using template
 */
function formatSlideNumber(
  format: string,
  current: number,
  total: number,
): string {
  return format
    .replace("{{current}}", String(current))
    .replace("{{total}}", String(total));
}

/**
 * Render slide number footer on a slide
 */
export async function renderSlideNumber(
  slideNode: SlideNode,
  config: SlideNumberConfig,
  current: number,
  total: number,
): Promise<void> {
  // Remove existing slide number if present
  for (const child of slideNode.children) {
    if (child.name === SLIDE_NUMBER_NODE_NAME) {
      child.remove();
      break;
    }
  }

  // Check if we should show the slide number
  if (config.show === false) {
    return;
  }

  const size = config.size ?? DEFAULT_SLIDE_NUMBER_SIZE;
  const position = config.position ?? DEFAULT_SLIDE_NUMBER_POSITION;
  const paddingX = config.paddingX ?? DEFAULT_SLIDE_NUMBER_PADDING_X;
  const paddingY = config.paddingY ?? DEFAULT_SLIDE_NUMBER_PADDING_Y;
  const format = config.format ?? DEFAULT_SLIDE_NUMBER_FORMAT;

  const text = formatSlideNumber(format, current, total);

  const textNode = figma.createText();
  textNode.name = SLIDE_NUMBER_NODE_NAME;
  textNode.fontName = { family: "Inter", style: "Regular" };
  textNode.fontSize = size;
  textNode.characters = text;

  // Set color
  if (config.color) {
    const color = parseColor(config.color);
    if (color) {
      textNode.fills = [
        {
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a !== undefined ? color.a : 1,
        },
      ];
    }
  } else {
    // Default: semi-transparent gray
    textNode.fills = [
      {
        type: "SOLID",
        color: { r: 0.5, g: 0.5, b: 0.5 },
        opacity: 0.8,
      },
    ];
  }

  // Get slide dimensions
  const slideWidth = slideNode.width;
  const slideHeight = slideNode.height;
  const textWidth = textNode.width;
  const textHeight = textNode.height;

  // Calculate position
  let x: number;
  let y: number;

  switch (position) {
    case "bottom-right":
      x = slideWidth - paddingX - textWidth;
      y = slideHeight - paddingY - textHeight;
      break;
    case "bottom-left":
      x = paddingX;
      y = slideHeight - paddingY - textHeight;
      break;
    case "top-right":
      x = slideWidth - paddingX - textWidth;
      y = paddingY;
      break;
    case "top-left":
      x = paddingX;
      y = paddingY;
      break;
    default:
      x = slideWidth - paddingX - textWidth;
      y = slideHeight - paddingY - textHeight;
  }

  textNode.x = x;
  textNode.y = y;

  slideNode.appendChild(textNode);
}

/**
 * Clear all content from a slide
 */
export function clearSlideContent(slideNode: SlideNode): void {
  for (const child of [...slideNode.children]) {
    child.remove();
  }
}
