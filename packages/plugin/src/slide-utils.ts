import { base64ToUint8Array } from "./base64";
import { createGradientTransform, parseColor } from "./colors";
import {
  DEFAULT_SLIDE_NUMBER_FORMAT,
  DEFAULT_SLIDE_NUMBER_PADDING_X,
  DEFAULT_SLIDE_NUMBER_PADDING_Y,
  DEFAULT_SLIDE_NUMBER_POSITION,
  DEFAULT_SLIDE_NUMBER_SIZE,
  SLIDE_NUMBER_NODE_NAME,
} from "./constants";
import type {
  BackgroundImage,
  SlideBackground,
  SlideNumberConfig,
} from "./types";

/**
 * Fetch remote image data as bytes for figma.createImage
 */
async function fetchRemoteImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `[figdeck] Remote background image request failed (${response.status}): ${url}`,
      );
      return null;
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (e) {
    console.warn(`[figdeck] Error fetching remote background image: ${url}`, e);
    return null;
  }
}

/**
 * Apply image background to a slide node
 */
async function applyImageBackground(
  slideNode: SlideNode,
  image: BackgroundImage,
): Promise<boolean> {
  try {
    let imageData: Image | null = null;

    if (image.dataBase64) {
      // Local image with base64 data
      const bytes = base64ToUint8Array(image.dataBase64);
      imageData = figma.createImage(bytes);
    } else if (image.source === "remote" && image.url) {
      // Remote image - fetch bytes then use createImage
      const remoteBytes = await fetchRemoteImageBytes(image.url);
      if (remoteBytes) {
        imageData = figma.createImage(remoteBytes);
      }
    }

    if (imageData) {
      const imageFill: ImagePaint = {
        type: "IMAGE",
        imageHash: imageData.hash,
        scaleMode: "FILL",
      };
      slideNode.fills = [imageFill];
      return true;
    }

    return false;
  } catch (e) {
    console.warn(`[figdeck] Error applying background image: ${image.url}`, e);
    return false;
  }
}

/**
 * Apply background fill to a slide node
 */
export async function applyBackground(
  slideNode: SlideNode,
  background: SlideBackground,
): Promise<void> {
  // Priority: templateStyle > gradient > solid > image
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
    return;
  }

  if (background.image) {
    const success = await applyImageBackground(slideNode, background.image);
    if (!success) {
      figma.notify(
        `Failed to load background image "${background.image.url}"`,
        {
          error: true,
        },
      );
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

// Cache for slide number template nodes
const slideNumberNodeCache = new Map<string, SceneNode | null>();
const failedSlideNumberNodeIds = new Set<string>();

/**
 * Find a cloneable node for slide number template
 */
async function findSlideNumberTemplateNode(
  nodeId: string,
): Promise<SceneNode | null> {
  if (slideNumberNodeCache.has(nodeId)) {
    return slideNumberNodeCache.get(nodeId) || null;
  }

  if (failedSlideNumberNodeIds.has(nodeId)) {
    return null;
  }

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      console.warn(
        `[figdeck] Slide number template node "${nodeId}" not found`,
      );
      failedSlideNumberNodeIds.add(nodeId);
      return null;
    }

    if (
      node.type === "FRAME" ||
      node.type === "GROUP" ||
      node.type === "COMPONENT" ||
      node.type === "INSTANCE"
    ) {
      slideNumberNodeCache.set(nodeId, node as SceneNode);
      return node as SceneNode;
    }

    console.warn(
      `[figdeck] Slide number template "${nodeId}" is type "${node.type}", not supported`,
    );
    failedSlideNumberNodeIds.add(nodeId);
    return null;
  } catch (e) {
    console.warn(
      `[figdeck] Failed to find slide number template: ${nodeId}`,
      e,
    );
    failedSlideNumberNodeIds.add(nodeId);
    return null;
  }
}

/**
 * Clone a node for slide number
 */
function cloneSlideNumberNode(node: SceneNode): SceneNode {
  if (node.type === "COMPONENT") {
    return (node as ComponentNode).createInstance();
  }
  return node.clone();
}

/**
 * Recursively find and update text nodes by name within a node
 * Replaces text content based on node name: "{{current}}" or "{{total}}"
 */
async function updateTextNodesByName(
  node: SceneNode,
  current: number,
  total: number,
): Promise<void> {
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    if (textNode.name === "{{current}}" || textNode.name === "current") {
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = String(current);
    } else if (textNode.name === "{{total}}" || textNode.name === "total") {
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = String(total);
    }
  } else if ("children" in node) {
    const container = node as FrameNode | GroupNode | InstanceNode;
    for (const child of container.children) {
      await updateTextNodesByName(child, current, total);
    }
  }
}

/**
 * Render slide number using Frame template
 */
async function renderSlideNumberFromTemplate(
  slideNode: SlideNode,
  config: SlideNumberConfig,
  current: number,
  total: number,
): Promise<boolean> {
  if (!config.nodeId) return false;

  const templateNode = await findSlideNumberTemplateNode(config.nodeId);
  if (!templateNode) {
    figma.notify(`Slide number template not found: ${config.nodeId}`, {
      error: true,
    });
    return false;
  }

  // Clone the template
  const clonedNode = cloneSlideNumberNode(templateNode);
  clonedNode.name = SLIDE_NUMBER_NODE_NAME;

  // Update text nodes by name
  await updateTextNodesByName(clonedNode, current, total);

  // Position the cloned node
  const position = config.position ?? DEFAULT_SLIDE_NUMBER_POSITION;
  const paddingX = config.paddingX ?? DEFAULT_SLIDE_NUMBER_PADDING_X;
  const paddingY = config.paddingY ?? DEFAULT_SLIDE_NUMBER_PADDING_Y;

  const slideWidth = slideNode.width;
  const slideHeight = slideNode.height;
  const nodeWidth = clonedNode.width;
  const nodeHeight = clonedNode.height;

  let x: number;
  let y: number;

  switch (position) {
    case "bottom-right":
      x = slideWidth - paddingX - nodeWidth;
      y = slideHeight - paddingY - nodeHeight;
      break;
    case "bottom-left":
      x = paddingX;
      y = slideHeight - paddingY - nodeHeight;
      break;
    case "top-right":
      x = slideWidth - paddingX - nodeWidth;
      y = paddingY;
      break;
    case "top-left":
      x = paddingX;
      y = paddingY;
      break;
    default:
      x = slideWidth - paddingX - nodeWidth;
      y = slideHeight - paddingY - nodeHeight;
  }

  clonedNode.x = x;
  clonedNode.y = y;

  slideNode.appendChild(clonedNode);
  return true;
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

  // Check startFrom - skip slides before this number (default: 2 to skip cover)
  const startFrom = config.startFrom ?? 2;
  if (current < startFrom) {
    return;
  }

  // Apply offset to displayed number
  // Default offset makes the first displayed slide show as "1"
  // e.g., startFrom=2 means slide 2 displays as "1", so offset = -(startFrom - 1) = -1
  const defaultOffset = -(startFrom - 1);
  const offset = config.offset ?? defaultOffset;
  const displayedCurrent = current + offset;
  // Total is adjusted to not count skipped slides
  const displayedTotal = total - (startFrom - 1) + (config.offset ?? 0);

  // If nodeId is specified, use Frame-based rendering
  if (config.nodeId) {
    const success = await renderSlideNumberFromTemplate(
      slideNode,
      config,
      displayedCurrent,
      displayedTotal,
    );
    if (success) return;
    // Fall through to default text rendering if template fails
  }

  const size = config.size ?? DEFAULT_SLIDE_NUMBER_SIZE;
  const position = config.position ?? DEFAULT_SLIDE_NUMBER_POSITION;
  const paddingX = config.paddingX ?? DEFAULT_SLIDE_NUMBER_PADDING_X;
  const paddingY = config.paddingY ?? DEFAULT_SLIDE_NUMBER_PADDING_Y;
  const format = config.format ?? DEFAULT_SLIDE_NUMBER_FORMAT;

  const text = formatSlideNumber(format, displayedCurrent, displayedTotal);

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
