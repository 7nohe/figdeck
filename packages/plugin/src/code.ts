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

/**
 * Clone a node for use as title prefix
 * Components create instances, other nodes are cloned
 */
function cloneNodeForPrefix(node: SceneNode): SceneNode {
  if (node.type === "COMPONENT") {
    return (node as ComponentNode).createInstance();
  }
  return node.clone();
}

/**
 * Render title with optional prefix component
 * Returns a frame containing prefix instance (if any) and title text
 */
async function renderTitleWithPrefix(
  title: string,
  titleStyle: { fontSize: number; fontStyle: string; fills?: Paint[] },
  titlePrefix: TitlePrefixConfig | null | undefined,
  x: number,
  y: number,
): Promise<{ node: SceneNode; height: number }> {
  // If no prefix or explicitly disabled, render title normally
  if (!titlePrefix || !titlePrefix.nodeId) {
    const heading = figma.createText();
    heading.fontName = { family: "Inter", style: titleStyle.fontStyle };
    heading.fontSize = titleStyle.fontSize;
    heading.characters = title;
    if (titleStyle.fills) {
      heading.fills = titleStyle.fills;
    }
    heading.x = x;
    heading.y = y;
    return { node: heading, height: heading.height };
  }

  // Try to find the prefix node by nodeId
  const prefixNode = await findCloneableNode(titlePrefix.nodeId);

  if (!prefixNode) {
    // Fallback to plain title if node not found
    const heading = figma.createText();
    heading.fontName = { family: "Inter", style: titleStyle.fontStyle };
    heading.fontSize = titleStyle.fontSize;
    heading.characters = title;
    if (titleStyle.fills) {
      heading.fills = titleStyle.fills;
    }
    heading.x = x;
    heading.y = y;
    return { node: heading, height: heading.height };
  }

  // Clone the prefix node (creates instance for components, clone for frames)
  const prefixClone = cloneNodeForPrefix(prefixNode);

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
  container.fills = []; // Transparent background
  container.counterAxisAlignItems = "CENTER";

  // Add prefix and title to container
  container.appendChild(prefixClone);
  container.appendChild(titleText);

  // Position the container
  container.x = x;
  container.y = y;

  return { node: container, height: container.height };
}

async function loadFont() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Italic" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold Italic" });
}

/**
 * Render a single block and return the new y offset
 */
async function renderBlock(
  slideNode: SlideNode,
  block: SlideBlock,
  styles: ReturnType<typeof resolveSlideStyles>,
  yOffset: number,
): Promise<number> {
  const x = LAYOUT.LEFT_MARGIN;
  const spacing = LAYOUT.BLOCK_SPACING;

  switch (block.kind) {
    case "paragraph": {
      const result = await renderParagraph(
        block.text,
        block.spans,
        styles.paragraph,
        x,
        yOffset,
      );
      slideNode.appendChild(result.node);
      return yOffset + result.height + spacing;
    }

    case "heading": {
      const style = block.level === 3 ? styles.h3 : styles.h4;
      const result = await renderHeading(
        block.text,
        block.spans,
        style,
        x,
        yOffset,
      );
      slideNode.appendChild(result.node);
      return yOffset + result.height + spacing;
    }

    case "bullets": {
      const result = await renderBulletList(
        block.items,
        block.itemSpans,
        styles.bullet,
        block.ordered ?? false,
        block.start ?? 1,
        x,
        yOffset,
      );
      slideNode.appendChild(result.node);
      return yOffset + result.height + spacing;
    }

    case "code": {
      const result = renderCodeBlock(block, styles.code.fontSize, x, yOffset);
      slideNode.appendChild(result.node);
      return yOffset + result.height + spacing;
    }

    case "blockquote": {
      const quoteNode = await renderBlockquote(
        block.spans || [{ text: block.text }],
        styles.paragraph.fontSize,
        styles.paragraph.fills,
        x,
        yOffset,
      );
      slideNode.appendChild(quoteNode);
      return yOffset + quoteNode.height + spacing;
    }

    case "image": {
      const imgNode = await renderImage(
        {
          url: block.url,
          alt: block.alt,
          mimeType: block.mimeType,
          dataBase64: block.dataBase64,
          source: block.source,
        },
        x,
        yOffset,
      );
      slideNode.appendChild(imgNode);
      return yOffset + imgNode.height + spacing;
    }

    case "table": {
      const tableNode = await renderTable(
        block.headers,
        block.rows,
        block.align || [],
        styles.paragraph.fontSize * 0.85,
        styles.paragraph.fills,
        x,
        yOffset,
      );
      slideNode.appendChild(tableNode);
      return yOffset + tableNode.height + spacing;
    }

    case "figma": {
      const figmaX = block.link.x !== undefined ? block.link.x : x;
      const figmaY = block.link.y !== undefined ? block.link.y : yOffset;
      const figmaNode = await renderFigmaLink(block.link, figmaX, figmaY);
      slideNode.appendChild(figmaNode);
      // Only advance yOffset if no custom position was specified
      if (block.link.y === undefined) {
        return yOffset + figmaNode.height + spacing;
      }
      return yOffset;
    }

    default: {
      // Guard for unknown block kinds - log and skip
      const unknownBlock = block as { kind: string };
      console.warn(`[figdeck] Unknown block kind: ${unknownBlock.kind}`);
      return yOffset;
    }
  }
}

/**
 * Render legacy content (body, bullets, codeBlocks) for backwards compatibility
 */
async function renderLegacyContent(
  slideNode: SlideNode,
  slide: SlideContent,
  styles: ReturnType<typeof resolveSlideStyles>,
  yOffset: number,
): Promise<number> {
  const x = LAYOUT.LEFT_MARGIN;
  const spacing = LAYOUT.BLOCK_SPACING;

  // Render body paragraphs
  if (slide.body && slide.body.length > 0) {
    const result = await renderParagraph(
      slide.body.join("\n"),
      undefined,
      styles.paragraph,
      x,
      yOffset,
    );
    slideNode.appendChild(result.node);
    yOffset += result.height + spacing;
  }

  // Render bullet list
  if (slide.bullets && slide.bullets.length > 0) {
    const result = await renderBulletList(
      slide.bullets,
      undefined,
      styles.bullet,
      false,
      1,
      x,
      yOffset,
    );
    slideNode.appendChild(result.node);
    yOffset += result.height + spacing;
  }

  // Render code blocks
  if (slide.codeBlocks && slide.codeBlocks.length > 0) {
    for (const codeBlock of slide.codeBlocks) {
      const result = renderCodeBlock(
        codeBlock,
        styles.code.fontSize,
        x,
        yOffset,
      );
      slideNode.appendChild(result.node);
      yOffset += result.height + spacing;
    }
  }

  return yOffset;
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
        const figmaNode = await renderFigmaLink(
          block.link,
          block.link.x ?? 0,
          block.link.y ?? 0,
        );
        slideNode.appendChild(figmaNode);
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

  // Add container to slide
  slideNode.appendChild(container);

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
  }

  // Remove extra slides that no longer exist in the markdown
  for (const [, slideNode] of existingSlides) {
    slideNode.remove();
  }

  figma.notify(`Updated ${slides.length} slides`);
}

function truncateString(str: string, maxLen: number): string {
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + "... (truncated)";
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
