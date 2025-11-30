import {
  renderBlockquote,
  renderBulletList,
  renderCodeBlock,
  renderFigmaLink,
  renderHeading,
  renderImagePlaceholder,
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
import type { SlideBlock, SlideContent } from "./types";

// Security limits
const MAX_SLIDES = 100;
const MAX_BLOCKS_PER_SLIDE = 50;
const MAX_STRING_LENGTH = 100000;

figma.showUI(__html__, { visible: true, width: 360, height: 420 });

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
      const imgNode = renderImagePlaceholder(block.url, block.alt, x, yOffset);
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
 * Fill a slide with content
 */
async function fillSlide(slideNode: SlideNode, slide: SlideContent) {
  let yOffset: number = LAYOUT.INITIAL_Y_OFFSET;
  const styles = resolveSlideStyles(slide.styles);

  // Render title if present
  if (slide.title) {
    const titleStyle = slide.type === "title" ? styles.h1 : styles.h2;
    const result = await renderHeading(
      slide.title,
      undefined,
      titleStyle,
      LAYOUT.LEFT_MARGIN,
      yOffset,
    );
    slideNode.appendChild(result.node);
    yOffset = yOffset + result.height + LAYOUT.TITLE_SPACING;
  }

  // Render blocks or legacy content
  if (slide.blocks && slide.blocks.length > 0) {
    for (const block of slide.blocks) {
      yOffset = await renderBlock(slideNode, block, styles, yOffset);
    }
  } else {
    yOffset = await renderLegacyContent(slideNode, slide, styles, yOffset);
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
    const sanitizedSlide = Object.assign({}, slide) as SlideContent;

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
      figma.ui.postMessage({ type: "success", count: validation.slides.length });
    } catch (error) {
      console.error("[figdeck] Error generating slides:", error);
      figma.ui.postMessage({ type: "error", message: String(error) });
    }
  }
};
