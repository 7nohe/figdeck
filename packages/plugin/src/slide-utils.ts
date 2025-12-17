import type {
  BackgroundComponent,
  BackgroundImage,
  SlideBackground,
  SlideNumberConfig,
} from "@figdeck/shared";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@figdeck/shared";
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
import { djb2HashSampled } from "./hash";
import { cloneNode, createNodeCache } from "./node-cache";

// Image cache: maps hash key (base64 hash or URL) to Figma imageHash
const imageHashCache = new Map<string, string>();

// Paint style cache: maps style name to style ID
const paintStyleCache = new Map<string, string>();

// Deduplicate concurrent style lookups
const pendingPaintStyleLookups = new Map<string, Promise<string | null>>();

// Track styles we've already notified about to avoid repeated toasts
const missingPaintStyleNotifications = new Set<string>();

// Node cache for slide number templates
const slideNumberNodeCache = createNodeCache();

// Node cache for background component templates
const backgroundComponentNodeCache = createNodeCache();

// Track background component nodes we've already notified about
const missingBackgroundComponentNotifications = new Set<string>();

/** Background component node name for cleanup */
const BACKGROUND_COMPONENT_NODE_NAME = "__figdeck_background_component__";

async function resolvePaintStyleId(styleName: string): Promise<string | null> {
  const cachedId = paintStyleCache.get(styleName);
  if (cachedId) {
    return cachedId;
  }

  const pendingLookup = pendingPaintStyleLookups.get(styleName);
  if (pendingLookup) {
    return await pendingLookup;
  }

  const lookupPromise = (async (): Promise<string | null> => {
    try {
      // Check if getLocalPaintStylesAsync is available
      if (typeof figma.getLocalPaintStylesAsync === "function") {
        const localStyles = await figma.getLocalPaintStylesAsync();
        const localStyle = localStyles.find(
          (style) => style.name === styleName,
        );

        if (localStyle) {
          return localStyle.id;
        }
      }

      // Try importing by key (only if the API is available)
      if (typeof figma.importStyleByKeyAsync === "function") {
        const importedStyle = await figma.importStyleByKeyAsync(styleName);
        if (importedStyle && importedStyle.type === "PAINT") {
          return importedStyle.id;
        }
      }
    } catch (_e) {
      // Paint style APIs may not be available in all contexts
    }

    return null;
  })();

  pendingPaintStyleLookups.set(styleName, lookupPromise);

  const resolvedId = await lookupPromise;
  pendingPaintStyleLookups.delete(styleName);

  if (resolvedId) {
    paintStyleCache.set(styleName, resolvedId);
  }

  return resolvedId;
}

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
 * Uses cache to avoid re-creating images that have already been uploaded
 */
async function applyImageBackground(
  slideNode: SlideNode,
  image: BackgroundImage,
): Promise<boolean> {
  try {
    let cachedHash: string | undefined;
    let cacheKey: string | undefined;

    if (image.dataBase64) {
      // Local image with base64 data - use hash of data as cache key
      cacheKey = `base64:${djb2HashSampled(image.dataBase64)}`;
      cachedHash = imageHashCache.get(cacheKey);

      if (!cachedHash) {
        // Not in cache - create image
        const bytes = base64ToUint8Array(image.dataBase64);
        const imageData = figma.createImage(bytes);
        cachedHash = imageData.hash;
        imageHashCache.set(cacheKey, cachedHash);
      }
    } else if (image.source === "remote" && image.url) {
      // Remote image - use URL as cache key
      cacheKey = `url:${image.url}`;
      cachedHash = imageHashCache.get(cacheKey);

      if (!cachedHash) {
        // Not in cache - fetch and create image
        const remoteBytes = await fetchRemoteImageBytes(image.url);
        if (remoteBytes) {
          const imageData = figma.createImage(remoteBytes);
          cachedHash = imageData.hash;
          imageHashCache.set(cacheKey, cachedHash);
        }
      }
    }

    if (cachedHash) {
      const imageFill: ImagePaint = {
        type: "IMAGE",
        imageHash: cachedHash,
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
 * Apply background component (Figma Component/Frame) to slide
 * The component is rendered as a layer on top of the base background
 */
async function applyBackgroundComponent(
  slideNode: SlideNode,
  component: BackgroundComponent,
): Promise<boolean> {
  const { nodeId, fit = "cover", align = "center", opacity = 1 } = component;

  // Guard against missing nodeId
  if (!nodeId) {
    return false;
  }

  // Find the source node
  const sourceNode = await backgroundComponentNodeCache.findNode(nodeId, {
    allowedTypes: ["COMPONENT", "COMPONENT_SET", "FRAME", "INSTANCE"],
    errorPrefix: "Background component",
  });

  if (!sourceNode) {
    if (!missingBackgroundComponentNotifications.has(nodeId)) {
      figma.notify(`Background component not found: ${nodeId}`, {
        error: true,
      });
      missingBackgroundComponentNotifications.add(nodeId);
    }
    return false;
  }

  // Clone the node
  const clonedNode = cloneNode(sourceNode);
  if (!clonedNode) {
    backgroundComponentNodeCache.clear();
    return false;
  }

  clonedNode.name = BACKGROUND_COMPONENT_NODE_NAME;

  // Calculate scale based on fit mode
  const sourceWidth = sourceNode.width;
  const sourceHeight = sourceNode.height;
  const targetWidth = SLIDE_WIDTH;
  const targetHeight = SLIDE_HEIGHT;

  let scaleX = 1;
  let scaleY = 1;

  if (fit === "stretch") {
    // Stretch: scale to exactly fill the slide (non-uniform)
    scaleX = targetWidth / sourceWidth;
    scaleY = targetHeight / sourceHeight;
  } else if (fit === "cover") {
    // Cover: scale uniformly to cover entire slide (may crop)
    const scale = Math.max(
      targetWidth / sourceWidth,
      targetHeight / sourceHeight,
    );
    scaleX = scale;
    scaleY = scale;
  } else if (fit === "contain") {
    // Contain: scale uniformly to fit within slide (may have empty space)
    const scale = Math.min(
      targetWidth / sourceWidth,
      targetHeight / sourceHeight,
    );
    scaleX = scale;
    scaleY = scale;
  }

  // Apply scale by resizing
  const newWidth = sourceWidth * scaleX;
  const newHeight = sourceHeight * scaleY;

  // Check if the node supports resize
  if ("resize" in clonedNode) {
    (clonedNode as FrameNode | ComponentNode | InstanceNode).resize(
      newWidth,
      newHeight,
    );
  } else if ("rescale" in clonedNode) {
    // Fallback for nodes without resize - use scale transform
    (clonedNode as SceneNode & { rescale: (scale: number) => void }).rescale(
      scaleX,
    );
  }

  // Calculate position based on alignment
  let x = 0;
  let y = 0;

  // For cover/contain, center by default or use specified alignment
  if (fit !== "stretch") {
    const offsetX = (targetWidth - newWidth) / 2;
    const offsetY = (targetHeight - newHeight) / 2;

    switch (align) {
      case "center":
        x = offsetX;
        y = offsetY;
        break;
      case "top-left":
        x = 0;
        y = 0;
        break;
      case "top-right":
        x = targetWidth - newWidth;
        y = 0;
        break;
      case "bottom-left":
        x = 0;
        y = targetHeight - newHeight;
        break;
      case "bottom-right":
        x = targetWidth - newWidth;
        y = targetHeight - newHeight;
        break;
      default:
        x = offsetX;
        y = offsetY;
    }
  }

  // Apply opacity if not 1
  if (opacity < 1 && "opacity" in clonedNode) {
    (clonedNode as SceneNode & { opacity: number }).opacity = opacity;
  }

  // Insert at the back (index 0 = bottommost layer)
  slideNode.insertChild(0, clonedNode);

  // Set position after inserting
  clonedNode.x = x;
  clonedNode.y = y;

  // Use absolute positioning to avoid auto-layout interference
  // Only needed if the parent has auto-layout (layoutMode !== "NONE")
  if (
    "layoutPositioning" in clonedNode &&
    "layoutMode" in slideNode &&
    slideNode.layoutMode !== "NONE"
  ) {
    (clonedNode as FrameNode | InstanceNode).layoutPositioning = "ABSOLUTE";
  }

  // Clear the notification set since we successfully used the node
  missingBackgroundComponentNotifications.delete(nodeId);

  return true;
}

/**
 * Apply background fill to a slide node
 * Background component can be combined with base fill (solid/gradient/image)
 * The component is rendered as a layer on top of the base fill
 */
export async function applyBackground(
  slideNode: SlideNode,
  background: SlideBackground,
): Promise<void> {
  // Remove any existing background component first
  // Check if slideNode has children (some slide types may not)
  if (slideNode.children && slideNode.children.length > 0) {
    // Iterate backwards since we're potentially removing items
    for (let i = slideNode.children.length - 1; i >= 0; i--) {
      const child = slideNode.children[i];
      if (child && child.name === BACKGROUND_COMPONENT_NODE_NAME) {
        child.remove();
      }
    }
  }

  let baseFillApplied = false;

  // Priority for base fill: templateStyle > gradient > solid > image
  if (background.templateStyle) {
    const styleName = background.templateStyle;
    const styleId = await resolvePaintStyleId(styleName);

    if (styleId) {
      missingPaintStyleNotifications.delete(styleName);
      slideNode.fillStyleId = styleId;
      baseFillApplied = true;
    } else {
      if (!missingPaintStyleNotifications.has(styleName)) {
        figma.notify(`Paint style "${styleName}" not found`, { error: true });
        missingPaintStyleNotifications.add(styleName);
      }
      // Don't return - still try to apply component if present
    }
  } else if (background.gradient) {
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
      baseFillApplied = true;
    }
  } else if (background.solid) {
    const color = parseColor(background.solid);
    if (color) {
      const solidFill: SolidPaint = {
        type: "SOLID",
        color: { r: color.r, g: color.g, b: color.b },
        opacity: color.a ?? 1,
      };
      slideNode.fills = [solidFill];
      baseFillApplied = true;
    } else {
      figma.notify(`Invalid color "${background.solid}"`, { error: true });
    }
  } else if (background.image) {
    const success = await applyImageBackground(slideNode, background.image);
    if (success) {
      baseFillApplied = true;
    } else {
      figma.notify(
        `Failed to load background image "${background.image.url}"`,
        {
          error: true,
        },
      );
    }
  }

  // Apply background component if present (layer on top of base fill)
  if (background.component) {
    const success = await applyBackgroundComponent(
      slideNode,
      background.component,
    );
    if (!success && !baseFillApplied) {
      // Both component and base fill failed - no background applied
      console.warn("[figdeck] No background could be applied");
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
 * Find a cloneable node for slide number template
 */
async function findSlideNumberTemplateNode(
  nodeId: string,
): Promise<SceneNode | null> {
  return slideNumberNodeCache.findNode(nodeId, {
    allowedTypes: ["FRAME", "GROUP", "COMPONENT", "INSTANCE"],
    errorPrefix: "Slide number template",
  });
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
 * Calculate position and append node to slide
 * Appends first, then sets position to avoid constraints affecting placement
 */
function appendNodeAtPosition(
  slideNode: SlideNode,
  node: SceneNode,
  config: Pick<SlideNumberConfig, "position" | "paddingX" | "paddingY">,
): void {
  const position = config.position ?? DEFAULT_SLIDE_NUMBER_POSITION;
  const paddingX = config.paddingX ?? DEFAULT_SLIDE_NUMBER_PADDING_X;
  const paddingY = config.paddingY ?? DEFAULT_SLIDE_NUMBER_PADDING_Y;

  const slideWidth = slideNode.width;
  const slideHeight = slideNode.height;
  const nodeWidth = node.width;
  const nodeHeight = node.height;

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

  // Append first, then set position (constraints may affect position during appendChild)
  slideNode.appendChild(node);
  node.x = x;
  node.y = y;
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
  const clonedNode = cloneNode(templateNode);
  if (!clonedNode) {
    // Node was deleted, clear cache and notify
    slideNumberNodeCache.clear();
    figma.notify(`Slide number template was deleted: ${config.nodeId}`, {
      error: true,
    });
    return false;
  }
  clonedNode.name = SLIDE_NUMBER_NODE_NAME;

  // Update text nodes by name
  await updateTextNodesByName(clonedNode, current, total);

  // Position and append the cloned node
  appendNodeAtPosition(slideNode, clonedNode, config);

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

  // Position and append the text node
  appendNodeAtPosition(slideNode, textNode, config);
}

/**
 * Clear all content from a slide
 */
export function clearSlideContent(slideNode: SlideNode): void {
  // Use Array.from instead of spread operator for Figma sandbox compatibility
  for (const child of Array.from(slideNode.children)) {
    child.remove();
  }
}
