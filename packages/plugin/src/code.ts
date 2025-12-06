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
import type {
  BulletItem,
  HorizontalAlign,
  SlideBlock,
  SlideContent,
  SlideTransitionConfig,
  SlideTransitionCurve,
  SlideTransitionStyle,
  TextSpan,
  TitlePrefixConfig,
  VerticalAlign,
} from "./types";

// Security limits
const MAX_SLIDES = 100;
const MAX_BLOCKS_PER_SLIDE = 50;
const MAX_STRING_LENGTH = 100000;

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
      const node = await renderBlockquote(
        block.spans || [{ text: block.text }],
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

    // Determine the style for this block kind
    const blockStyle = getStyleForBlock(block.kind, styles);

    // Check if this block has absolute positioning via style
    if (
      blockStyle &&
      (blockStyle.x !== undefined || blockStyle.y !== undefined)
    ) {
      const blockNode = await renderBlockToNode(block, styles);
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

    const blockNode = await renderBlockToNode(block, styles);
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

  for (const span of spans) {
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
  const hasBulletObjects = items.some(
    (item) => item !== null && typeof item === "object",
  );

  if (hasBulletObjects) {
    return items
      .map((item) => sanitizeBulletItem(item))
      .filter((item): item is BulletItem => item !== null);
  }

  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => truncateString(item, MAX_STRING_LENGTH));
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
      sanitizedSlide.blocks = sanitizedSlide.blocks.map((block) => {
        const sanitizedBlock = Object.assign({}, block);
        if (
          "text" in sanitizedBlock &&
          typeof sanitizedBlock.text === "string"
        ) {
          sanitizedBlock.text = truncateString(
            sanitizedBlock.text,
            MAX_STRING_LENGTH,
          );
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
        return sanitizedBlock;
      });
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
