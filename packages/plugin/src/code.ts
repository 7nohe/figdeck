import {
  renderBlockquote,
  renderBulletList,
  renderCodeBlock,
  renderFigmaLink,
  renderFootnotes,
  renderHeading,
  renderImage,
  renderParagraph,
  renderTable,
} from "./block-renderers";
import { PLUGIN_DATA_KEY } from "./constants";
import {
  applyBackground,
  clearSlideContent,
  renderSlideNumber,
} from "./slide-utils";
import { LAYOUT, resolveSlideStyles } from "./styles";
import type {
  HorizontalAlign,
  SlideBlock,
  SlideContent,
  SlideTransitionConfig,
  SlideTransitionCurve,
  SlideTransitionStyle,
  TitlePrefixConfig,
  VerticalAlign,
} from "./types";

// Security limits
const MAX_SLIDES = 100;
const MAX_BLOCKS_PER_SLIDE = 50;
const MAX_STRING_LENGTH = 100000;

// Cache to track failed node lookups
const failedNodeIds = new Set<string>();

// Default spacing between prefix component and title text
const DEFAULT_PREFIX_SPACING = 16;

figma.showUI(__html__, { visible: true, width: 360, height: 420 });

// Cache for cloneable nodes (Frame, Component, etc.)
const nodeCache = new Map<string, SceneNode | null>();

/**
 * Find a node by nodeId that can be cloned for title prefix
 * Supports FRAME, COMPONENT, COMPONENT_SET, and INSTANCE nodes
 * Returns null if not found, with caching
 */
async function findCloneableNode(nodeId: string): Promise<SceneNode | null> {
  // Check cache first
  if (nodeCache.has(nodeId)) {
    return nodeCache.get(nodeId) || null;
  }

  // Skip if already known to fail
  if (failedNodeIds.has(nodeId)) {
    return null;
  }

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      console.warn(`[figdeck] Node "${nodeId}" not found`);
      failedNodeIds.add(nodeId);
      figma.notify(`Node not found: ${nodeId}`, { error: true });
      return null;
    }

    // Frame - can be cloned directly
    if (node.type === "FRAME" || node.type === "GROUP") {
      nodeCache.set(nodeId, node as SceneNode);
      return node as SceneNode;
    }

    // Direct component - can create instance
    if (node.type === "COMPONENT") {
      nodeCache.set(nodeId, node as SceneNode);
      return node as SceneNode;
    }

    // Component set - use default variant
    if (node.type === "COMPONENT_SET") {
      const componentSet = node as ComponentSetNode;
      const defaultVariant = componentSet.defaultVariant;
      if (defaultVariant) {
        nodeCache.set(nodeId, defaultVariant);
        return defaultVariant;
      }
      const firstChild = componentSet.children[0];
      if (firstChild && firstChild.type === "COMPONENT") {
        nodeCache.set(nodeId, firstChild as SceneNode);
        return firstChild as SceneNode;
      }
    }

    // Instance - can be cloned directly
    if (node.type === "INSTANCE") {
      nodeCache.set(nodeId, node as SceneNode);
      return node as SceneNode;
    }

    console.warn(
      `[figdeck] Node "${nodeId}" is type "${node.type}", cannot be used as prefix`,
    );
    failedNodeIds.add(nodeId);
    figma.notify(`Cannot use as prefix: ${nodeId} (${node.type})`, {
      error: true,
    });
    return null;
  } catch (e) {
    console.warn(`[figdeck] Failed to find node: ${nodeId}`, e);
    failedNodeIds.add(nodeId);
    figma.notify(`Node not found: ${nodeId}`, { error: true });
    return null;
  }
}

async function loadFont() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Italic" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold Italic" });
}

/**
 * Map from kebab-case transition style to Figma API UPPER_SNAKE_CASE
 */
const TRANSITION_STYLE_MAP: Record<SlideTransitionStyle, string> = {
  none: "NONE",
  dissolve: "DISSOLVE",
  "smart-animate": "SMART_ANIMATE",
  "slide-from-left": "SLIDE_FROM_LEFT",
  "slide-from-right": "SLIDE_FROM_RIGHT",
  "slide-from-top": "SLIDE_FROM_TOP",
  "slide-from-bottom": "SLIDE_FROM_BOTTOM",
  "push-from-left": "PUSH_FROM_LEFT",
  "push-from-right": "PUSH_FROM_RIGHT",
  "push-from-top": "PUSH_FROM_TOP",
  "push-from-bottom": "PUSH_FROM_BOTTOM",
  "move-from-left": "MOVE_FROM_LEFT",
  "move-from-right": "MOVE_FROM_RIGHT",
  "move-from-top": "MOVE_FROM_TOP",
  "move-from-bottom": "MOVE_FROM_BOTTOM",
  "slide-out-to-left": "SLIDE_OUT_TO_LEFT",
  "slide-out-to-right": "SLIDE_OUT_TO_RIGHT",
  "slide-out-to-top": "SLIDE_OUT_TO_TOP",
  "slide-out-to-bottom": "SLIDE_OUT_TO_BOTTOM",
  "move-out-to-left": "MOVE_OUT_TO_LEFT",
  "move-out-to-right": "MOVE_OUT_TO_RIGHT",
  "move-out-to-top": "MOVE_OUT_TO_TOP",
  "move-out-to-bottom": "MOVE_OUT_TO_BOTTOM",
};

/**
 * Map from kebab-case easing curve to Figma API UPPER_SNAKE_CASE
 */
const CURVE_MAP: Record<SlideTransitionCurve, string> = {
  "ease-in": "EASE_IN",
  "ease-out": "EASE_OUT",
  "ease-in-and-out": "EASE_IN_AND_OUT",
  linear: "LINEAR",
  gentle: "GENTLE",
  quick: "QUICK",
  bouncy: "BOUNCY",
  slow: "SLOW",
};

/**
 * Apply slide transition configuration to a SlideNode
 */
function applySlideTransition(
  slideNode: SlideNode,
  config: SlideTransitionConfig | undefined,
): void {
  if (!config || !config.style) return;

  const figmaStyle = TRANSITION_STYLE_MAP[config.style];
  if (!figmaStyle) return;

  // Normalize timing config
  let timingType: "ON_CLICK" | "AFTER_DELAY" = "ON_CLICK";
  let timingDelay = 0;

  if (config.timing) {
    if (typeof config.timing === "string") {
      timingType = config.timing === "after-delay" ? "AFTER_DELAY" : "ON_CLICK";
    } else {
      timingType =
        config.timing.type === "after-delay" ? "AFTER_DELAY" : "ON_CLICK";
      if (config.timing.delay !== undefined) {
        timingDelay = config.timing.delay;
      }
    }
  }

  // Build transition object compatible with Figma API
  // Use type assertion as Figma's TypeScript types may not include slides-specific types
  const transition = {
    style: figmaStyle,
    duration: config.duration !== undefined ? config.duration : 0.3,
    curve: config.curve ? CURVE_MAP[config.curve] : "EASE_OUT",
    timing: {
      type: timingType,
      delay: timingDelay,
    },
  };

  // setSlideTransition is available on SlideNode
  // @ts-expect-error - setSlideTransition may not be in types yet
  slideNode.setSlideTransition(transition);
}

/**
 * Create content container frame with alignment settings
 */
function createContentContainer(
  width: number,
  height: number,
  align: HorizontalAlign | undefined,
  valign: VerticalAlign | undefined,
): FrameNode {
  const container = figma.createFrame();
  container.name = "Slide Content";
  container.layoutMode = "VERTICAL";
  container.resize(width, height);
  container.fills = [];
  container.paddingLeft = LAYOUT.CONTAINER_PADDING;
  container.paddingRight = LAYOUT.CONTAINER_PADDING;
  container.paddingTop = LAYOUT.CONTAINER_PADDING;
  container.paddingBottom = LAYOUT.CONTAINER_PADDING;
  container.itemSpacing = LAYOUT.BLOCK_SPACING;

  // Horizontal alignment (counter axis for vertical layout)
  switch (align ?? "left") {
    case "left":
      container.counterAxisAlignItems = "MIN";
      break;
    case "center":
      container.counterAxisAlignItems = "CENTER";
      break;
    case "right":
      container.counterAxisAlignItems = "MAX";
      break;
  }

  // Vertical alignment (primary axis for vertical layout)
  switch (valign ?? "top") {
    case "top":
      container.primaryAxisAlignItems = "MIN";
      break;
    case "middle":
      container.primaryAxisAlignItems = "CENTER";
      break;
    case "bottom":
      container.primaryAxisAlignItems = "MAX";
      break;
  }

  return container;
}

/**
 * Render a single block and return the node (for container-based layout)
 */
async function renderBlockToNode(
  block: SlideBlock,
  styles: ReturnType<typeof resolveSlideStyles>,
): Promise<SceneNode | null> {
  switch (block.kind) {
    case "paragraph": {
      const result = await renderParagraph(
        block.text,
        block.spans,
        styles.paragraph,
        0,
        0,
      );
      return result.node;
    }

    case "heading": {
      const style = block.level === 3 ? styles.h3 : styles.h4;
      const result = await renderHeading(block.text, block.spans, style, 0, 0);
      return result.node;
    }

    case "bullets": {
      const result = await renderBulletList(
        block.items,
        block.itemSpans,
        styles.bullet,
        block.ordered ?? false,
        block.start ?? 1,
        0,
        0,
      );
      return result.node;
    }

    case "code": {
      const result = renderCodeBlock(block, styles.code.fontSize, 0, 0);
      return result.node;
    }

    case "blockquote": {
      const node = await renderBlockquote(
        block.spans || [{ text: block.text }],
        styles.paragraph.fontSize,
        styles.paragraph.fills,
        0,
        0,
      );
      return node;
    }

    case "image": {
      const node = await renderImage(
        {
          url: block.url,
          alt: block.alt,
          mimeType: block.mimeType,
          dataBase64: block.dataBase64,
          source: block.source,
        },
        0,
        0,
      );
      return node;
    }

    case "table": {
      const node = await renderTable(
        block.headers,
        block.rows,
        block.align || [],
        styles.paragraph.fontSize * 0.85,
        styles.paragraph.fills,
        0,
        0,
      );
      return node;
    }

    case "figma": {
      // Figma blocks with custom position are handled separately
      const node = await renderFigmaLink(block.link, 0, 0);
      return node;
    }

    default: {
      const unknownBlock = block as { kind: string };
      console.warn(`[figdeck] Unknown block kind: ${unknownBlock.kind}`);
      return null;
    }
  }
}

/**
 * Render title (with optional prefix) for container-based layout
 */
async function renderTitleToNode(
  title: string,
  titleStyle: ReturnType<typeof resolveSlideStyles>["h1"],
  titlePrefix: TitlePrefixConfig | null | undefined,
): Promise<SceneNode> {
  // If no prefix config, render simple title
  if (!titlePrefix?.nodeId) {
    const titleText = figma.createText();
    titleText.fontName = { family: "Inter", style: titleStyle.fontStyle };
    titleText.fontSize = titleStyle.fontSize;
    titleText.characters = title;
    if (titleStyle.fills) {
      titleText.fills = titleStyle.fills;
    }
    return titleText;
  }

  // Find and clone prefix node
  const prefixNode = await findCloneableNode(titlePrefix.nodeId);
  if (!prefixNode) {
    // Fallback to simple title if prefix not found
    const titleText = figma.createText();
    titleText.fontName = { family: "Inter", style: titleStyle.fontStyle };
    titleText.fontSize = titleStyle.fontSize;
    titleText.characters = title;
    if (titleStyle.fills) {
      titleText.fills = titleStyle.fills;
    }
    return titleText;
  }

  const prefixClone = prefixNode.clone();

  // Create title text node
  const titleText = figma.createText();
  titleText.fontName = { family: "Inter", style: titleStyle.fontStyle };
  titleText.fontSize = titleStyle.fontSize;
  titleText.characters = title;
  if (titleStyle.fills) {
    titleText.fills = titleStyle.fills;
  }

  // Create horizontal auto-layout frame
  const container = figma.createFrame();
  container.name = "Title with Prefix";
  container.layoutMode = "HORIZONTAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "AUTO";
  container.itemSpacing = titlePrefix.spacing ?? DEFAULT_PREFIX_SPACING;
  container.fills = [];
  container.counterAxisAlignItems = "CENTER";

  container.appendChild(prefixClone);
  container.appendChild(titleText);

  return container;
}

/**
 * Fill a slide with content using container-based layout
 */
async function fillSlide(slideNode: SlideNode, slide: SlideContent) {
  const styles = resolveSlideStyles(slide.styles);

  // Create content container with alignment
  const container = createContentContainer(
    slideNode.width,
    slideNode.height,
    slide.align,
    slide.valign,
  );

  // Render title if present
  if (slide.title) {
    const titleStyle = slide.type === "title" ? styles.h1 : styles.h2;
    const titleNode = await renderTitleToNode(
      slide.title,
      titleStyle,
      slide.titlePrefix,
    );
    container.appendChild(titleNode);
  }

  // Render blocks
  if (slide.blocks && slide.blocks.length > 0) {
    for (const block of slide.blocks) {
      // Handle figma blocks with custom position separately
      if (
        block.kind === "figma" &&
        (block.link.x !== undefined || block.link.y !== undefined)
      ) {
        const figmaNode = await renderFigmaLink(block.link);
        slideNode.appendChild(figmaNode);
        // Set position after appending to ensure correct coordinate system
        figmaNode.x = block.link.x ?? 0;
        figmaNode.y = block.link.y ?? 0;
        continue;
      }

      const blockNode = await renderBlockToNode(block, styles);
      if (blockNode) {
        container.appendChild(blockNode);
      }
    }
  } else {
    // Render legacy content
    if (slide.body && slide.body.length > 0) {
      const result = await renderParagraph(
        slide.body.join("\n"),
        undefined,
        styles.paragraph,
        0,
        0,
      );
      container.appendChild(result.node);
    }

    if (slide.bullets && slide.bullets.length > 0) {
      const result = await renderBulletList(
        slide.bullets,
        undefined,
        styles.bullet,
        false,
        1,
        0,
        0,
      );
      container.appendChild(result.node);
    }

    if (slide.codeBlocks && slide.codeBlocks.length > 0) {
      for (const codeBlock of slide.codeBlocks) {
        const result = renderCodeBlock(codeBlock, styles.code.fontSize, 0, 0);
        container.appendChild(result.node);
      }
    }
  }

  // Add container to slide and explicitly set position to origin
  // This is necessary because grid view can have coordinate system issues
  // when the container is created before being appended to the slide
  slideNode.appendChild(container);
  container.x = 0;
  container.y = 0;

  // Render footnotes at the bottom of the slide (outside container)
  if (slide.footnotes && slide.footnotes.length > 0) {
    const footnotesNode = await renderFootnotes(
      slide.footnotes,
      styles.paragraph.fontSize,
      styles.paragraph.fills,
    );
    // Position at bottom-left with margin
    footnotesNode.x = LAYOUT.CONTAINER_PADDING;
    footnotesNode.y = slideNode.height - footnotesNode.height - 40;
    slideNode.appendChild(footnotesNode);
  }
}

function findExistingSlides(): Map<number, SlideNode> {
  const slideMap = new Map<number, SlideNode>();
  const grid = figma.getSlideGrid();

  if (grid) {
    for (const row of grid) {
      for (const slide of row) {
        const indexData = slide.getPluginData(PLUGIN_DATA_KEY);
        if (indexData) {
          const index = Number.parseInt(indexData, 10);
          if (Number.isFinite(index)) {
            slideMap.set(index, slide);
          }
        }
      }
    }
  }

  return slideMap;
}

/**
 * Get or create a slide node for the given index
 */
function getOrCreateSlide(
  index: number,
  existingSlides: Map<number, SlideNode>,
): SlideNode {
  const existing = existingSlides.get(index);
  if (existing) {
    clearSlideContent(existing);
    existingSlides.delete(index);
    return existing;
  }
  return figma.createSlide();
}

async function generateSlides(slides: SlideContent[]) {
  await loadFont();

  const existingSlides = findExistingSlides();
  const totalSlides = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const node = getOrCreateSlide(i, existingSlides);

    node.setPluginData(PLUGIN_DATA_KEY, String(i));

    // Apply background before filling content
    if (slide.background) {
      await applyBackground(node, slide.background);
    }

    await fillSlide(node, slide);

    // Render slide number if configured
    if (slide.slideNumber) {
      await renderSlideNumber(node, slide.slideNumber, i + 1, totalSlides);
    }

    // Apply slide transition if configured
    if (slide.transition) {
      applySlideTransition(node, slide.transition);
    }
  }

  // Remove extra slides that no longer exist in the markdown
  for (const [, slideNode] of existingSlides) {
    slideNode.remove();
  }

  figma.notify(`Updated ${slides.length} slides`);
}

function truncateString(str: string, maxLen: number): string {
  if (str.length > maxLen) {
    return `${str.slice(0, maxLen)}... (truncated)`;
  }
  return str;
}

function validateAndSanitizeSlides(
  slides: unknown,
): { valid: true; slides: SlideContent[] } | { valid: false; error: string } {
  if (!Array.isArray(slides)) {
    return { valid: false, error: "Slides must be an array" };
  }

  if (slides.length === 0) {
    return { valid: false, error: "Slides array is empty" };
  }

  if (slides.length > MAX_SLIDES) {
    return { valid: false, error: `Too many slides (max: ${MAX_SLIDES})` };
  }

  const sanitized: SlideContent[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i] as Record<string, unknown>;

    if (!slide || typeof slide !== "object") {
      return { valid: false, error: `Slide ${i + 1} is not an object` };
    }

    if (slide.type !== "title" && slide.type !== "content") {
      return {
        valid: false,
        error: `Slide ${i + 1} has invalid type (must be "title" or "content")`,
      };
    }

    // Check blocks limit
    if (
      slide.blocks &&
      Array.isArray(slide.blocks) &&
      slide.blocks.length > MAX_BLOCKS_PER_SLIDE
    ) {
      return {
        valid: false,
        error: `Slide ${i + 1} has too many blocks (max: ${MAX_BLOCKS_PER_SLIDE})`,
      };
    }

    // Sanitize strings (use Object.assign for Figma sandbox compatibility)
    const sanitizedSlide = Object.assign({}, slide) as unknown as SlideContent;

    if (typeof sanitizedSlide.title === "string") {
      sanitizedSlide.title = truncateString(
        sanitizedSlide.title,
        MAX_STRING_LENGTH,
      );
    }

    if (Array.isArray(sanitizedSlide.body)) {
      sanitizedSlide.body = sanitizedSlide.body.map((item) =>
        typeof item === "string" ? truncateString(item, MAX_STRING_LENGTH) : "",
      );
    }

    if (Array.isArray(sanitizedSlide.bullets)) {
      sanitizedSlide.bullets = sanitizedSlide.bullets.map((item) =>
        typeof item === "string" ? truncateString(item, MAX_STRING_LENGTH) : "",
      );
    }

    sanitized.push(sanitizedSlide);
  }

  return { valid: true, slides: sanitized };
}

figma.ui.onmessage = async (msg: { type: string; slides?: unknown }) => {
  if (msg.type === "generate-slides" && msg.slides) {
    const validation = validateAndSanitizeSlides(msg.slides);

    if (!validation.valid) {
      console.error(`[figdeck] Validation error: ${validation.error}`);
      figma.ui.postMessage({ type: "error", message: validation.error });
      return;
    }

    try {
      await generateSlides(validation.slides);
      figma.ui.postMessage({
        type: "success",
        count: validation.slides.length,
      });
    } catch (error) {
      console.error("[figdeck] Error generating slides:", error);
      figma.ui.postMessage({ type: "error", message: String(error) });
    }
  }
};
