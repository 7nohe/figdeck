import type {
  BulletItem,
  CalloutType,
  ColumnsBlock,
  FigmaSelectionLink,
  HorizontalAlign,
  SlideBlock,
  SlideBlockItem,
  SlideContent,
  SlideTransitionConfig,
  TextSpan,
  TitlePrefixConfig,
  VerticalAlign,
} from "@figdeck/shared";
import {
  isValidFigmaUrl,
  LAYOUT as SHARED_LAYOUT,
  TRANSITION_CURVE_TO_FIGMA,
  TRANSITION_STYLE_TO_FIGMA,
} from "@figdeck/shared";
import {
  type AlertType,
  renderBlockquote,
  renderBulletList,
  renderCallout,
  renderCodeBlock,
  renderFigmaLink,
  renderFootnotes,
  renderHeading,
  renderImage,
  renderParagraph,
  renderTable,
} from "./block-renderers";
import { PLUGIN_DATA_KEY } from "./constants";
import { djb2Hash } from "./hash";
import { cloneNode, createNodeCache } from "./node-cache";
import {
  applyBackground,
  clearSlideContent,
  renderSlideNumber,
} from "./slide-utils";
import {
  applyFontFallbacks,
  collectFontNames,
  LAYOUT,
  type ResolvedTextStyle,
  resolveSlideStyles,
} from "./styles";

// Security limits
const MAX_SLIDES = 100;
const MAX_BLOCKS_PER_SLIDE = 50;
const MAX_STRING_LENGTH = 100000;
const MAX_SPANS_PER_ELEMENT = 500;
const MAX_BULLET_ITEMS = 100;

// Slide hash cache: maps slide index to { hash, nodeId } for incremental updates
interface SlideHashEntry {
  hash: string;
  nodeId: string;
}
const slideHashCache = new Map<number, SlideHashEntry>();

/**
 * Compute a stable hash for a slide's content.
 * Includes all fields that affect rendering.
 */
function computeSlideHash(slide: SlideContent): string {
  // JSON.stringify provides a stable serialization for comparison
  return djb2Hash(JSON.stringify(slide));
}

// Default spacing between prefix component and title text
const DEFAULT_PREFIX_SPACING = 16;

/**
 * Map CLI's CalloutType (lowercase) to Plugin's AlertType (uppercase)
 */
function calloutTypeToAlertType(type: CalloutType): AlertType {
  const mapping: Record<CalloutType, AlertType> = {
    note: "NOTE",
    tip: "TIP",
    warning: "WARNING",
    caution: "CAUTION",
  };
  return mapping[type];
}

// Back-pressure: track in-flight generateSlides and pending payload
let isGenerating = false;
let pendingSlides: SlideContent[] | null = null;

figma.showUI(__html__, { visible: true, width: 360, height: 420 });

// Node cache for title prefix components
const prefixNodeCache = createNodeCache();

/**
 * Find a node by nodeId that can be cloned for title prefix
 */
async function findCloneableNode(nodeId: string): Promise<SceneNode | null> {
  return prefixNodeCache.findNode(nodeId, {
    notifyOnError: true,
    errorPrefix: "Prefix node",
  });
}

// Cache for loaded fonts to avoid repeated loadFontAsync calls
const loadedFonts = new Set<string>();

/**
 * Load default Inter fonts (used as fallback)
 */
async function loadDefaultFonts() {
  const defaultFonts = [
    { family: "Inter", style: "Regular" },
    { family: "Inter", style: "Bold" },
    { family: "Inter", style: "Italic" },
    { family: "Inter", style: "Bold Italic" },
  ];

  for (const font of defaultFonts) {
    const key = `${font.family}|${font.style}`;
    if (!loadedFonts.has(key)) {
      try {
        await figma.loadFontAsync(font);
        loadedFonts.add(key);
      } catch (e) {
        console.warn(
          `[figdeck] Failed to load font: ${font.family} ${font.style}`,
          e,
        );
      }
    }
  }
}

/**
 * Load fonts required for slide styles
 * Falls back to Inter if a requested font is unavailable
 */
async function loadFontsForStyles(
  fontNames: Array<{ family: string; style: string }>,
): Promise<Set<string>> {
  // Always load default fonts first as fallback
  await loadDefaultFonts();

  // Load custom fonts
  for (const font of fontNames) {
    const key = `${font.family}|${font.style}`;
    if (loadedFonts.has(key)) continue;

    try {
      await figma.loadFontAsync({ family: font.family, style: font.style });
      loadedFonts.add(key);
    } catch (_e) {
      console.warn(
        `[figdeck] Font not available: ${font.family} ${font.style}, using Inter fallback`,
      );
      figma.notify(
        `Font "${font.family} ${font.style}" not available, using Inter`,
        { timeout: 3000 },
      );
    }
  }

  return new Set(loadedFonts);
}

/**
 * Apply slide transition configuration to a SlideNode
 */
function applySlideTransition(
  slideNode: SlideNode,
  config: SlideTransitionConfig | undefined,
): void {
  if (!config || !config.style) return;

  const figmaStyle = TRANSITION_STYLE_TO_FIGMA[config.style];
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
    curve: config.curve ? TRANSITION_CURVE_TO_FIGMA[config.curve] : "EASE_OUT",
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
 * Render a single SlideBlockItem (non-columns block) to a node
 */
async function renderBlockItemToNode(
  block: SlideBlockItem,
  styles: ReturnType<typeof resolveSlideStyles>,
): Promise<SceneNode | null> {
  const codeFont = styles.code.font;

  switch (block.kind) {
    case "paragraph": {
      const result = await renderParagraph(
        block.text,
        block.spans,
        styles.paragraph,
        0,
        0,
        codeFont,
      );
      return result.node;
    }

    case "heading": {
      let style: ReturnType<typeof resolveSlideStyles>["h1"];
      switch (block.level) {
        case 1:
          style = styles.h1;
          break;
        case 2:
          style = styles.h2;
          break;
        case 3:
          style = styles.h3;
          break;
        case 4:
          style = styles.h4;
          break;
      }
      const result = await renderHeading(
        block.text,
        block.spans,
        style,
        0,
        0,
        codeFont,
      );
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
        codeFont,
      );
      return result.node;
    }

    case "code": {
      const result = renderCodeBlock(
        block,
        styles.code.fontSize,
        0,
        0,
        codeFont,
      );
      return result.node;
    }

    case "blockquote": {
      const spans = block.spans || [{ text: block.text }];
      const node = await renderBlockquote(
        spans,
        styles.paragraph.fontSize,
        styles.paragraph.fills,
        0,
        0,
        styles.paragraph.font,
        codeFont,
      );
      return node;
    }

    case "callout": {
      const spans = block.spans || [{ text: block.text }];
      const alertType = calloutTypeToAlertType(block.type);
      const node = await renderCallout(
        { type: alertType, bodySpans: spans },
        styles.paragraph.fontSize,
        styles.paragraph.fills,
        0,
        0,
        styles.paragraph.font,
        codeFont,
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
          size: block.size,
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
        styles.paragraph.font,
      );
      return node;
    }

    case "figma": {
      const node = await renderFigmaLink(block.link, 0, 0);
      return node;
    }

    default: {
      const unknownBlock = block as { kind: string };
      console.warn(`[figdeck] Unknown block item kind: ${unknownBlock.kind}`);
      return null;
    }
  }
}

/**
 * Constrain a node's width for column layouts, enabling proper text wrapping.
 */
export function constrainNodeToWidth(
  node: SceneNode,
  targetWidth: number,
): void {
  if (node.type === "TEXT") {
    // For text nodes in auto-layout: enable wrapping and constrain to column width
    const textNode = node as TextNode;
    // 1. Set layout sizing to FIXED first (prevents auto-layout from overriding width)
    textNode.layoutSizingHorizontal = "FIXED";
    // 2. Set text auto-resize to HEIGHT (enables text wrapping with fixed width)
    textNode.textAutoResize = "HEIGHT";
    // 3. Now resize to target width - text will wrap
    textNode.resize(targetWidth, textNode.height);
  } else if (node.type === "FRAME") {
    // For frame nodes (bullet lists, blockquotes, etc.)
    const frameNode = node as FrameNode;
    if (frameNode.layoutMode !== "NONE") {
      // Auto-layout frame: fill width, hug height, ensure children also fill
      frameNode.layoutSizingHorizontal = "FILL";
      frameNode.layoutSizingVertical = "HUG";
      // Recursively constrain text children for proper wrapping
      constrainTextNodesInFrame(frameNode, targetWidth);
    } else if (node.width > targetWidth) {
      // Non-auto-layout frame, resize maintaining aspect ratio
      const aspectRatio = node.height / node.width;
      frameNode.resize(targetWidth, targetWidth * aspectRatio);
    }
  } else if (
    "resize" in node &&
    typeof (node as { resize?: (w: number, h: number) => void }).resize ===
      "function" &&
    node.width > targetWidth
  ) {
    // For other nodes (images, etc.), constrain width maintaining aspect ratio
    const aspectRatio = node.height / node.width;
    (node as { resize: (w: number, h: number) => void }).resize(
      targetWidth,
      targetWidth * aspectRatio,
    );
  }
}

/**
 * Recursively constrain text nodes within a frame for proper text wrapping.
 */
export function constrainTextNodesInFrame(
  frame: FrameNode,
  maxWidth: number,
): void {
  for (const child of frame.children) {
    if (child.type === "TEXT") {
      const textNode = child as TextNode;
      // 1. Set layout sizing to FIXED first
      textNode.layoutSizingHorizontal = "FIXED";
      // 2. Set text auto-resize to HEIGHT (enables wrapping)
      textNode.textAutoResize = "HEIGHT";
      // 3. Resize to max width
      textNode.resize(maxWidth, textNode.height);
    } else if (child.type === "FRAME") {
      const childFrame = child as FrameNode;
      if (childFrame.layoutMode !== "NONE") {
        childFrame.layoutSizingHorizontal = "FILL";
        childFrame.layoutSizingVertical = "HUG";
        constrainTextNodesInFrame(childFrame, maxWidth);
      }
    }
  }
}

/**
 * Render a columns block as a horizontal auto-layout frame
 */
async function renderColumnsBlock(
  block: ColumnsBlock,
  styles: ReturnType<typeof resolveSlideStyles>,
  availableWidth: number,
): Promise<FrameNode | null> {
  const columnCount = block.columns.length;
  if (columnCount < SHARED_LAYOUT.MIN_COLUMNS) {
    console.warn(
      `[figdeck] Columns block has ${columnCount} columns, minimum is ${SHARED_LAYOUT.MIN_COLUMNS}`,
    );
    return null;
  }

  const gap = Math.min(
    block.gap ?? SHARED_LAYOUT.COLUMN_GAP,
    SHARED_LAYOUT.MAX_COLUMN_GAP,
  );

  // Calculate column widths
  let widths: number[];
  if (block.widths && block.widths.length === columnCount) {
    widths = block.widths;
  } else {
    // Even split: (availableWidth - totalGap) / columnCount
    const totalGap = gap * (columnCount - 1);
    const columnWidth = Math.floor((availableWidth - totalGap) / columnCount);
    widths = Array(columnCount).fill(columnWidth);
  }

  // Check minimum width constraint
  const minWidth = SHARED_LAYOUT.COLUMN_MIN_WIDTH;
  const belowMinimum = widths.some((w) => w < minWidth);
  if (belowMinimum) {
    console.warn(
      `[figdeck] Column width below minimum (${minWidth}px), stacking vertically`,
    );
    // Fallback: render columns stacked vertically
    const stackFrame = figma.createFrame();
    stackFrame.name = "Columns (stacked fallback)";
    stackFrame.layoutMode = "VERTICAL";
    stackFrame.primaryAxisSizingMode = "AUTO";
    stackFrame.counterAxisSizingMode = "FIXED";
    stackFrame.resize(availableWidth, 100);
    stackFrame.itemSpacing = LAYOUT.BLOCK_GAP;
    stackFrame.fills = [];

    for (const column of block.columns) {
      for (const item of column) {
        const node = await renderBlockItemToNode(item, styles);
        if (node) {
          stackFrame.appendChild(node);
        }
      }
    }

    return stackFrame;
  }

  // Create horizontal container for columns
  const columnsFrame = figma.createFrame();
  columnsFrame.name = "Columns";
  columnsFrame.layoutMode = "HORIZONTAL";
  columnsFrame.primaryAxisSizingMode = "FIXED";
  columnsFrame.counterAxisSizingMode = "AUTO";
  columnsFrame.resize(availableWidth, 100);
  columnsFrame.itemSpacing = gap;
  columnsFrame.fills = [];
  columnsFrame.primaryAxisAlignItems = "MIN";
  columnsFrame.counterAxisAlignItems = "MIN";

  // Render each column
  for (let i = 0; i < columnCount; i++) {
    const columnBlocks = block.columns[i];
    const columnWidth = widths[i];

    // Create vertical frame for column content
    const columnFrame = figma.createFrame();
    columnFrame.name = `Column ${i + 1}`;
    columnFrame.layoutMode = "VERTICAL";
    columnFrame.primaryAxisSizingMode = "AUTO";
    columnFrame.counterAxisSizingMode = "FIXED";
    columnFrame.resize(columnWidth, 100);
    columnFrame.itemSpacing = LAYOUT.BLOCK_GAP;
    columnFrame.fills = [];

    // Render each block in the column
    for (const item of columnBlocks) {
      const node = await renderBlockItemToNode(item, styles);
      if (node) {
        columnFrame.appendChild(node);
        // Constrain node width to column width with proper text wrapping
        constrainNodeToWidth(node, columnWidth);
      }
    }

    columnsFrame.appendChild(columnFrame);
  }

  return columnsFrame;
}

/**
 * Render a single block and return the node (for container-based layout)
 */
async function renderBlockToNode(
  block: SlideBlock,
  styles: ReturnType<typeof resolveSlideStyles>,
  availableWidth?: number,
): Promise<SceneNode | null> {
  // Handle columns block specially
  if (block.kind === "columns") {
    const width = availableWidth ?? LAYOUT.CONTENT_WIDTH;
    return renderColumnsBlock(block, styles, width);
  }

  // For non-columns blocks, delegate to renderBlockItemToNode
  return renderBlockItemToNode(block as SlideBlockItem, styles);
}

/**
 * Render title (with optional prefix) for container-based layout
 */
async function renderTitleToNode(
  title: string,
  titleStyle: ReturnType<typeof resolveSlideStyles>["h1"],
  titlePrefix: TitlePrefixConfig | null | undefined,
): Promise<SceneNode> {
  const font = titleStyle.font;

  // If no prefix config, render simple title
  if (!titlePrefix?.nodeId) {
    const titleText = figma.createText();
    titleText.fontName = { family: font.family, style: font.bold };
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
    titleText.fontName = { family: font.family, style: font.bold };
    titleText.fontSize = titleStyle.fontSize;
    titleText.characters = title;
    if (titleStyle.fills) {
      titleText.fills = titleStyle.fills;
    }
    return titleText;
  }

  const prefixClone = cloneNode(prefixNode);

  // If clone failed (node was deleted), fallback to simple title
  if (!prefixClone) {
    prefixNodeCache.clear(); // Clear stale cache
    const titleText = figma.createText();
    titleText.fontName = { family: font.family, style: font.bold };
    titleText.fontSize = titleStyle.fontSize;
    titleText.characters = title;
    if (titleStyle.fills) {
      titleText.fills = titleStyle.fills;
    }
    return titleText;
  }

  // Create title text node
  const titleText = figma.createText();
  titleText.fontName = { family: font.family, style: font.bold };
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
 * Get the resolved style for a specific block kind
 */
function getStyleForBlock(
  kind: string,
  styles: ReturnType<typeof resolveSlideStyles>,
): ResolvedTextStyle | undefined {
  switch (kind) {
    case "paragraph":
    case "blockquote":
      return styles.paragraph;
    case "bullets":
      return styles.bullet;
    case "code":
      return styles.code;
    case "heading":
      // Headings use h3/h4, but for positioning we can use h3 as representative
      return styles.h3;
    default:
      return undefined;
  }
}

/**
 * Fill a slide with content using container-based layout
 */
async function fillSlide(
  slideNode: SlideNode,
  slide: SlideContent,
  availableFonts: Set<string>,
) {
  const styles = applyFontFallbacks(
    resolveSlideStyles(slide.styles),
    availableFonts,
  );

  // Create content container with alignment
  const container = createContentContainer(
    slideNode.width,
    slideNode.height,
    slide.align,
    slide.valign,
  );

  // Collect nodes that need absolute positioning (to be added after container)
  const absoluteNodes: Array<{ node: SceneNode; x: number; y: number }> = [];

  // Track if we've rendered the first title (H1/H2) for prefix support
  let firstTitleRendered = false;

  // Render blocks
  for (const block of slide.blocks) {
    // Handle figma blocks with custom position separately
    if (
      block.kind === "figma" &&
      (block.link.x !== undefined || block.link.y !== undefined)
    ) {
      const figmaNode = await renderFigmaLink(block.link);
      absoluteNodes.push({
        node: figmaNode,
        x: block.link.x ?? 0,
        y: block.link.y ?? 0,
      });
      continue;
    }

    // Handle image blocks with custom position separately
    if (
      block.kind === "image" &&
      block.position &&
      (block.position.x !== undefined || block.position.y !== undefined)
    ) {
      const imageNode = await renderImage({
        url: block.url,
        alt: block.alt,
        mimeType: block.mimeType,
        dataBase64: block.dataBase64,
        source: block.source,
        size: block.size,
      });
      absoluteNodes.push({
        node: imageNode,
        x: block.position.x ?? 0,
        y: block.position.y ?? 0,
      });
      continue;
    }

    // Determine the style for this block kind
    const blockStyle = getStyleForBlock(block.kind, styles);

    // Check if this block has absolute positioning via style
    if (
      blockStyle &&
      (blockStyle.x !== undefined || blockStyle.y !== undefined)
    ) {
      const blockNode = await renderBlockToNode(
        block,
        styles,
        LAYOUT.CONTENT_WIDTH,
      );
      if (blockNode) {
        absoluteNodes.push({
          node: blockNode,
          x: blockStyle.x ?? 0,
          y: blockStyle.y ?? 0,
        });
      }
      continue;
    }

    // Special handling for first H1/H2 heading with titlePrefix
    if (
      block.kind === "heading" &&
      (block.level === 1 || block.level === 2) &&
      !firstTitleRendered &&
      slide.titlePrefix
    ) {
      const titleStyle = block.level === 1 ? styles.h1 : styles.h2;
      const titleNode = await renderTitleToNode(
        block.text,
        titleStyle,
        slide.titlePrefix,
      );
      container.appendChild(titleNode);
      firstTitleRendered = true;
      continue;
    }

    // Mark first H1/H2 as rendered even without prefix
    if (
      block.kind === "heading" &&
      (block.level === 1 || block.level === 2) &&
      !firstTitleRendered
    ) {
      firstTitleRendered = true;
    }

    const blockNode = await renderBlockToNode(
      block,
      styles,
      LAYOUT.CONTENT_WIDTH,
    );
    if (blockNode) {
      container.appendChild(blockNode);
    }
  }

  // Add container to slide and explicitly set position to origin
  // This is necessary because grid view can have coordinate system issues
  // when the container is created before being appended to the slide
  slideNode.appendChild(container);
  container.x = 0;
  container.y = 0;

  // Add absolutely positioned nodes to slide
  for (const { node, x, y } of absoluteNodes) {
    slideNode.appendChild(node);
    node.x = x;
    node.y = y;
  }

  // Render footnotes at the bottom of the slide (outside container)
  if (slide.footnotes && slide.footnotes.length > 0) {
    const footnotesNode = await renderFootnotes(
      slide.footnotes,
      styles.paragraph.fontSize,
      styles.paragraph.fills,
      styles.paragraph.font,
      styles.code.font,
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
  // Collect all unique fonts needed across all slides
  const allFontNames: Array<{ family: string; style: string }> = [];
  const seenFonts = new Set<string>();

  for (const slide of slides) {
    const styles = resolveSlideStyles(slide.styles);
    const fontNames = collectFontNames(styles);
    for (const font of fontNames) {
      const key = `${font.family}|${font.style}`;
      if (!seenFonts.has(key)) {
        seenFonts.add(key);
        allFontNames.push(font);
      }
    }
  }

  // Load all required fonts upfront
  const availableFonts = await loadFontsForStyles(allFontNames);

  const existingSlides = findExistingSlides();
  const totalSlides = slides.length;

  // Track which slides were updated vs skipped for the notification
  let updatedCount = 0;
  let skippedCount = 0;

  // Build set of valid indices for cleanup
  const validIndices = new Set<number>();

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    validIndices.add(i);

    // Compute hash for this slide
    const slideHash = computeSlideHash(slide);
    const cachedEntry = slideHashCache.get(i);

    // Check if slide is unchanged and node still exists
    if (cachedEntry && cachedEntry.hash === slideHash) {
      const existingNode = existingSlides.get(i);
      if (existingNode && existingNode.id === cachedEntry.nodeId) {
        // Slide unchanged - skip regeneration
        existingSlides.delete(i);
        skippedCount++;
        continue;
      }
    }

    // Slide changed or new - regenerate
    const node = getOrCreateSlide(i, existingSlides);
    node.setPluginData(PLUGIN_DATA_KEY, String(i));

    // Apply background before filling content
    if (slide.background) {
      await applyBackground(node, slide.background);
    }

    await fillSlide(node, slide, availableFonts);

    // Render slide number if configured
    if (slide.slideNumber) {
      await renderSlideNumber(node, slide.slideNumber, i + 1, totalSlides);
    }

    // Apply slide transition if configured
    if (slide.transition) {
      applySlideTransition(node, slide.transition);
    }

    // Update hash cache
    slideHashCache.set(i, { hash: slideHash, nodeId: node.id });
    updatedCount++;
  }

  // Remove extra slides that no longer exist in the markdown
  for (const [index, slideNode] of existingSlides) {
    slideNode.remove();
    slideHashCache.delete(index);
  }

  // Clean up hash cache for removed slides
  // Collect indices first to avoid modifying Map during iteration
  const indicesToDelete: number[] = [];
  for (const index of slideHashCache.keys()) {
    if (!validIndices.has(index)) {
      indicesToDelete.push(index);
    }
  }
  for (const index of indicesToDelete) {
    slideHashCache.delete(index);
  }

  // Show notification with update stats
  if (skippedCount > 0) {
    figma.notify(`Updated ${updatedCount} slides (${skippedCount} unchanged)`);
  } else {
    figma.notify(`Updated ${slides.length} slides`);
  }
}

function truncateString(str: string, maxLen: number): string {
  if (str.length > maxLen) {
    return `${str.slice(0, maxLen)}... (truncated)`;
  }
  return str;
}

function sanitizeTextSpans(spans: unknown): TextSpan[] | undefined {
  if (!Array.isArray(spans)) return undefined;

  const sanitizedSpans: TextSpan[] = [];
  // Limit array length to prevent DoS
  const limitedSpans = spans.slice(0, MAX_SPANS_PER_ELEMENT);

  for (const span of limitedSpans) {
    if (!span || typeof span !== "object") continue;

    const { text, ...rest } = span as TextSpan & Record<string, unknown>;
    if (typeof text !== "string") continue;

    sanitizedSpans.push({
      ...rest,
      text: truncateString(text, MAX_STRING_LENGTH),
    } as TextSpan);
  }

  return sanitizedSpans.length > 0 ? sanitizedSpans : undefined;
}

function sanitizeBulletItem(item: unknown): BulletItem | null {
  if (typeof item === "string") {
    return { text: truncateString(item, MAX_STRING_LENGTH) };
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const bulletItem = item as BulletItem;
  const sanitized: BulletItem = {
    text:
      typeof bulletItem.text === "string"
        ? truncateString(bulletItem.text, MAX_STRING_LENGTH)
        : "",
  };

  const spans = sanitizeTextSpans(bulletItem.spans);
  if (spans) {
    sanitized.spans = spans;
  }

  if (typeof bulletItem.childrenOrdered === "boolean") {
    sanitized.childrenOrdered = bulletItem.childrenOrdered;
  }

  if (
    typeof bulletItem.childrenStart === "number" &&
    Number.isFinite(bulletItem.childrenStart)
  ) {
    sanitized.childrenStart = bulletItem.childrenStart;
  }

  if (Array.isArray(bulletItem.children)) {
    const children = bulletItem.children
      .map((child) => sanitizeBulletItem(child))
      .filter((child): child is BulletItem => child !== null);
    if (children.length > 0) {
      sanitized.children = children;
    }
  }

  return sanitized;
}

function sanitizeBulletItems(items: Array<unknown>): string[] | BulletItem[] {
  // Limit array length to prevent DoS
  const limitedItems = items.slice(0, MAX_BULLET_ITEMS);

  const hasBulletObjects = limitedItems.some(
    (item) => item !== null && typeof item === "object",
  );

  if (hasBulletObjects) {
    return limitedItems
      .map((item) => sanitizeBulletItem(item))
      .filter((item): item is BulletItem => item !== null);
  }

  return limitedItems
    .filter((item): item is string => typeof item === "string")
    .map((item) => truncateString(item, MAX_STRING_LENGTH));
}

/**
 * Sanitize a FigmaSelectionLink, including URL validation.
 */
function sanitizeFigmaLink(link: unknown): FigmaSelectionLink | null {
  if (!link || typeof link !== "object") return null;

  const l = link as Record<string, unknown>;
  if (typeof l.url !== "string") return null;

  // Validate Figma URL hostname
  if (!isValidFigmaUrl(l.url)) {
    console.warn(`[figdeck] Rejected invalid Figma URL: ${l.url}`);
    return null;
  }

  const sanitized: FigmaSelectionLink = {
    url: truncateString(l.url, MAX_STRING_LENGTH),
  };

  if (typeof l.nodeId === "string") {
    sanitized.nodeId = truncateString(l.nodeId, 100);
  }
  if (typeof l.fileKey === "string") {
    sanitized.fileKey = truncateString(l.fileKey, 100);
  }
  if (typeof l.x === "number" && Number.isFinite(l.x)) {
    sanitized.x = l.x;
  }
  if (typeof l.y === "number" && Number.isFinite(l.y)) {
    sanitized.y = l.y;
  }

  // Sanitize textOverrides (Record<string, { text: string; spans?: TextSpan[] }>)
  if (l.textOverrides && typeof l.textOverrides === "object") {
    const overrides = l.textOverrides as Record<string, unknown>;
    const sanitizedOverrides: Record<
      string,
      { text: string; spans?: TextSpan[] }
    > = {};
    let count = 0;
    const MAX_TEXT_OVERRIDES = 50;
    for (const [key, value] of Object.entries(overrides)) {
      if (count >= MAX_TEXT_OVERRIDES) break;
      if (typeof key === "string" && value && typeof value === "object") {
        const override = value as { text?: unknown; spans?: unknown };
        if (typeof override.text === "string") {
          const sanitizedOverride: { text: string; spans?: TextSpan[] } = {
            text: truncateString(override.text, MAX_STRING_LENGTH),
          };
          // Sanitize spans if present
          if (Array.isArray(override.spans)) {
            const sanitizedSpans = sanitizeTextSpans(override.spans);
            if (sanitizedSpans && sanitizedSpans.length > 0) {
              sanitizedOverride.spans = sanitizedSpans;
            }
          }
          sanitizedOverrides[truncateString(key, 100)] = sanitizedOverride;
          count++;
        }
      }
    }
    if (Object.keys(sanitizedOverrides).length > 0) {
      sanitized.textOverrides = sanitizedOverrides;
    }
  }

  // Sanitize hideLink boolean
  if (typeof l.hideLink === "boolean") {
    sanitized.hideLink = l.hideLink;
  }

  return sanitized;
}

export function validateAndSanitizeSlides(
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

    // Validate blocks array exists
    if (!Array.isArray(slide.blocks)) {
      return {
        valid: false,
        error: `Slide ${i + 1} is missing blocks array`,
      };
    }

    // Check blocks limit
    if (slide.blocks.length > MAX_BLOCKS_PER_SLIDE) {
      return {
        valid: false,
        error: `Slide ${i + 1} has too many blocks (max: ${MAX_BLOCKS_PER_SLIDE})`,
      };
    }

    // Sanitize strings in blocks (use Object.assign for Figma sandbox compatibility)
    const sanitizedSlide = Object.assign({}, slide) as unknown as SlideContent;

    // Sanitize text content in blocks
    if (Array.isArray(sanitizedSlide.blocks)) {
      const validBlocks: SlideBlock[] = [];

      for (const block of sanitizedSlide.blocks) {
        const sanitizedBlock = Object.assign({}, block);

        // Handle figma blocks with full sanitization including URL validation
        if (sanitizedBlock.kind === "figma" && "link" in sanitizedBlock) {
          const sanitizedLink = sanitizeFigmaLink(sanitizedBlock.link);
          if (sanitizedLink === null) {
            // Skip blocks with invalid Figma URLs
            continue;
          }
          sanitizedBlock.link = sanitizedLink;
          validBlocks.push(sanitizedBlock as SlideBlock);
          continue;
        }

        // Handle columns blocks with nested block sanitization
        if (sanitizedBlock.kind === "columns" && "columns" in sanitizedBlock) {
          const columnsBlock = sanitizedBlock as unknown as ColumnsBlock;
          if (Array.isArray(columnsBlock.columns)) {
            const sanitizedColumns: SlideBlockItem[][] = [];
            for (const column of columnsBlock.columns) {
              if (!Array.isArray(column)) continue;
              const sanitizedColumn: SlideBlockItem[] = [];
              for (const item of column) {
                const sanitizedItem = Object.assign({}, item);
                if (
                  "text" in sanitizedItem &&
                  typeof sanitizedItem.text === "string"
                ) {
                  sanitizedItem.text = truncateString(
                    sanitizedItem.text,
                    MAX_STRING_LENGTH,
                  );
                }
                if ("spans" in sanitizedItem && sanitizedItem.spans) {
                  sanitizedItem.spans = sanitizeTextSpans(sanitizedItem.spans);
                }
                if (
                  "items" in sanitizedItem &&
                  Array.isArray(sanitizedItem.items)
                ) {
                  sanitizedItem.items = sanitizeBulletItems(
                    sanitizedItem.items as Array<unknown>,
                  );
                }
                if (
                  "code" in sanitizedItem &&
                  typeof sanitizedItem.code === "string"
                ) {
                  sanitizedItem.code = truncateString(
                    sanitizedItem.code,
                    MAX_STRING_LENGTH * 10,
                  );
                }
                sanitizedColumn.push(sanitizedItem as SlideBlockItem);
              }
              sanitizedColumns.push(sanitizedColumn);
            }
            columnsBlock.columns = sanitizedColumns;
            // Clamp gap and widths
            if (
              typeof columnsBlock.gap === "number" &&
              Number.isFinite(columnsBlock.gap)
            ) {
              columnsBlock.gap = Math.min(
                Math.max(0, columnsBlock.gap),
                SHARED_LAYOUT.MAX_COLUMN_GAP,
              );
            }
            if (Array.isArray(columnsBlock.widths)) {
              columnsBlock.widths = columnsBlock.widths
                .filter(
                  (w): w is number =>
                    typeof w === "number" && Number.isFinite(w),
                )
                .map((w) => Math.max(0, w));
            }
          }
          validBlocks.push(sanitizedBlock as SlideBlock);
          continue;
        }

        if (
          "text" in sanitizedBlock &&
          typeof sanitizedBlock.text === "string"
        ) {
          sanitizedBlock.text = truncateString(
            sanitizedBlock.text,
            MAX_STRING_LENGTH,
          );
        }
        if ("spans" in sanitizedBlock && sanitizedBlock.spans) {
          sanitizedBlock.spans = sanitizeTextSpans(sanitizedBlock.spans);
        }
        if ("items" in sanitizedBlock && Array.isArray(sanitizedBlock.items)) {
          sanitizedBlock.items = sanitizeBulletItems(
            sanitizedBlock.items as Array<unknown>,
          );
        }
        if (
          "code" in sanitizedBlock &&
          typeof sanitizedBlock.code === "string"
        ) {
          sanitizedBlock.code = truncateString(
            sanitizedBlock.code,
            MAX_STRING_LENGTH * 10,
          );
        }
        validBlocks.push(sanitizedBlock as SlideBlock);
      }

      sanitizedSlide.blocks = validBlocks;
    }

    sanitized.push(sanitizedSlide);
  }

  return { valid: true, slides: sanitized };
}

/**
 * Process the pending slides if any, with back-pressure handling.
 * Only one generateSlides can run at a time; newer payloads replace pending ones.
 *
 * @param slides - The slides to process
 * @param isContinuation - If true, this is a scheduled continuation from pending work
 *                         and should bypass the isGenerating guard
 */
async function processSlides(
  slides: SlideContent[],
  isContinuation = false,
): Promise<void> {
  // If already generating (and not a scheduled continuation), queue this payload
  if (isGenerating && !isContinuation) {
    const hadPending = pendingSlides !== null;
    pendingSlides = slides;
    if (hadPending) {
      console.log("[figdeck] Render skipped - newer payload queued");
    }
    return;
  }

  isGenerating = true;

  try {
    await generateSlides(slides);
    figma.ui.postMessage({
      type: "success",
      count: slides.length,
    });
  } catch (error) {
    console.error("[figdeck] Error generating slides:", error);
    figma.ui.postMessage({ type: "error", message: String(error) });
  } finally {
    // Process pending payload if any
    // NOTE: Keep isGenerating = true until all pending work completes
    // to prevent race conditions with new messages arriving between
    // resetting the flag and the setTimeout callback executing
    if (pendingSlides) {
      const next = pendingSlides;
      pendingSlides = null;
      // Use setTimeout to avoid stack overflow on rapid updates
      setTimeout(() => processSlides(next, true), 0);
    } else {
      isGenerating = false;
    }
  }
}

figma.ui.onmessage = async (msg: { type: string; slides?: unknown }) => {
  if (msg.type === "generate-slides" && msg.slides) {
    const validation = validateAndSanitizeSlides(msg.slides);

    if (!validation.valid) {
      console.error(`[figdeck] Validation error: ${validation.error}`);
      figma.ui.postMessage({ type: "error", message: validation.error });
      return;
    }

    await processSlides(validation.slides);
  }
};
