import {
  type FootnoteItem,
  type HorizontalAlign,
  type ImagePosition,
  type ImageSize,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type SlideBackground,
  type SlideBlock,
  type SlideBlockItem,
  type SlideContent,
  type SlideNumberConfig,
  type SlideStyles,
  type SlideTransitionConfig,
  type TableAlignment,
  type TextSpan,
  type TitlePrefixConfig,
  type VerticalAlign,
} from "@figdeck/shared";
import type {
  Blockquote,
  Code,
  Heading,
  Image,
  List,
  Paragraph,
  PhrasingContent,
  Root,
  Table,
  TableRow,
} from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import {
  type CalloutBlockPlaceholder,
  extractCalloutBlocks,
  matchCalloutPlaceholder,
} from "./callout-block.js";
import {
  type ColumnsBlockPlaceholder,
  createColumnsBlock,
  extractColumnsBlocks,
  matchColumnsPlaceholder,
} from "./columns-block.js";
import {
  mergeSlideNumberConfig,
  mergeStyles,
  mergeTransitionConfig,
  type ParsedConfigResult,
  parseSlideConfig,
  type SlideConfig,
} from "./config.js";
import {
  extractFigmaBlocks,
  type FigmaBlockPlaceholder,
  matchFigmaPlaceholder,
} from "./figma-block.js";
import { isRemoteUrl, readLocalImage } from "./local-image.js";
import {
  extractBlockquoteContent,
  extractBulletItems,
  extractSpans,
  extractTableRow,
  spansToText,
} from "./spans.js";

// Processor instance for parsing markdown with frontmatter and GFM support
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

/**
 * Parse Marp-style size and position specifications from image alt text.
 *
 * Supported patterns:
 * - "w:400" → { width: 400 }
 * - "h:300" → { height: 300 }
 * - "w:400 h:300" → { width: 400, height: 300 }
 * - "w:50%" → { width: 960 } (percentage of slide width)
 * - "x:100" → { x: 100 } (absolute position in px)
 * - "y:200" → { y: 200 } (absolute position in px)
 * - "x:50%" → { x: 960 } (percentage of slide width)
 * - "y:50%" → { y: 540 } (percentage of slide height)
 * - "w:400 x:100 y:200 説明文" → size + position + cleanAlt
 *
 * @returns Object with cleanAlt (alt text without specs), optional size, and optional position
 */
export function parseImageAlt(alt: string): {
  cleanAlt: string;
  size?: ImageSize;
  position?: ImagePosition;
} {
  if (!alt) return { cleanAlt: "" };

  let width: number | undefined;
  let height: number | undefined;
  let x: number | undefined;
  let y: number | undefined;
  let remaining = alt;

  // Parse w:number or w:number%
  const widthMatch = remaining.match(/w:(\d+)(%?)/);
  if (widthMatch) {
    const value = Number.parseInt(widthMatch[1], 10);
    if (value > 0) {
      width =
        widthMatch[2] === "%" ? Math.round((value / 100) * SLIDE_WIDTH) : value;
    }
    remaining = remaining.replace(/w:\d+%?\s*/, "");
  }

  // Parse h:number or h:number%
  const heightMatch = remaining.match(/h:(\d+)(%?)/);
  if (heightMatch) {
    const value = Number.parseInt(heightMatch[1], 10);
    if (value > 0) {
      height =
        heightMatch[2] === "%"
          ? Math.round((value / 100) * SLIDE_HEIGHT)
          : value;
    }
    remaining = remaining.replace(/h:\d+%?\s*/, "");
  }

  // Parse x:number or x:number%
  const xMatch = remaining.match(/x:(\d+)(%?)/);
  if (xMatch) {
    const value = Number.parseInt(xMatch[1], 10);
    if (Number.isFinite(value)) {
      x = xMatch[2] === "%" ? Math.round((value / 100) * SLIDE_WIDTH) : value;
    }
    remaining = remaining.replace(/x:\d+%?\s*/, "");
  }

  // Parse y:number or y:number%
  const yMatch = remaining.match(/y:(\d+)(%?)/);
  if (yMatch) {
    const value = Number.parseInt(yMatch[1], 10);
    if (Number.isFinite(value)) {
      y = yMatch[2] === "%" ? Math.round((value / 100) * SLIDE_HEIGHT) : value;
    }
    remaining = remaining.replace(/y:\d+%?\s*/, "");
  }

  const cleanAlt = remaining.trim();

  const result: {
    cleanAlt: string;
    size?: ImageSize;
    position?: ImagePosition;
  } = { cleanAlt };

  if (width !== undefined || height !== undefined) {
    result.size = { width, height };
  }

  if (x !== undefined || y !== undefined) {
    result.position = { x, y };
  }

  return result;
}

/**
 * Extract frontmatter from the beginning of a slide.
 * Supports:
 * 1) Standard fenced YAML (`--- ... ---`)
 * 2) A block of key/value pairs terminated by `---` without an opening fence
 *    (common mistake when writing per-slide overrides after a separator).
 */
function extractFrontmatter(
  markdown: string,
  basePath?: string,
): {
  body: string;
  config: ParsedConfigResult | null;
} {
  const trimmedStart = markdown.trimStart();

  // Standard fenced YAML
  if (trimmedStart.startsWith("---\n")) {
    const endIndex = trimmedStart.indexOf("\n---", 4);
    if (endIndex !== -1) {
      const yamlBlock = trimmedStart.slice(4, endIndex);
      const rest = trimmedStart.slice(endIndex + 4);
      try {
        const config = parseSlideConfig(parseYaml(yamlBlock) as SlideConfig, {
          basePath,
        });
        return { body: rest, config };
      } catch {
        return { body: markdown, config: null };
      }
    }
  }

  // Implicit frontmatter (no opening fence) terminated by `---`
  // Supports nested YAML like:
  // headings:
  //   h1:
  //     size: 50
  // ---
  const separatorIndex = trimmedStart.indexOf("\n---");
  if (separatorIndex !== -1) {
    const potentialYaml = trimmedStart.slice(0, separatorIndex);
    // Check if it looks like YAML (starts with key: or key:\n)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s*/.test(potentialYaml)) {
      try {
        const config = parseSlideConfig(
          parseYaml(potentialYaml) as SlideConfig,
          { basePath },
        );
        // Check that the line after separator is blank or real content
        const rest = trimmedStart.slice(separatorIndex + 4).trimStart();
        return { body: rest, config };
      } catch {
        // Invalid YAML, fall through
      }
    }
  }

  return { body: markdown, config: null };
}

/**
 * Context for building a slide from AST nodes
 */
interface SlideBuilder {
  blocks: SlideBlock[];
  basePath?: string;
  footnoteDefinitions: Map<string, FootnoteItem>;
}

/**
 * Process a heading node and update builder state
 */
function processHeading(heading: Heading, builder: SlideBuilder): void {
  const spans = extractSpans(heading.children as PhrasingContent[]);
  const text = spansToText(spans);

  if (heading.depth >= 1 && heading.depth <= 4) {
    builder.blocks.push({
      kind: "heading",
      level: heading.depth as 1 | 2 | 3 | 4,
      text,
      spans,
    });
  }
}

/**
 * Process a paragraph node - may be image, figma placeholder, columns placeholder, callout placeholder, or regular text
 */
function processParagraph(
  para: Paragraph,
  builder: SlideBuilder,
  figmaBlocks: FigmaBlockPlaceholder[],
  columnsBlocks: ColumnsBlockPlaceholder[],
  calloutBlocks: CalloutBlockPlaceholder[],
  parseColumnContent: (content: string) => SlideBlockItem[],
): void {
  // Check if paragraph contains only an image
  if (para.children.length === 1 && para.children[0].type === "image") {
    const imgNode = para.children[0] as Image;
    const { cleanAlt, size, position } = parseImageAlt(imgNode.alt || "");

    // Determine if this is a local or remote image
    if (isRemoteUrl(imgNode.url)) {
      // Remote image - just pass URL
      builder.blocks.push({
        kind: "image",
        url: imgNode.url,
        alt: cleanAlt || undefined,
        source: "remote",
        size,
        position,
      });
    } else if (builder.basePath) {
      // Local image - attempt to read and encode
      const localImage = readLocalImage(imgNode.url, builder.basePath);
      if (localImage) {
        builder.blocks.push({
          kind: "image",
          url: imgNode.url,
          alt: cleanAlt || undefined,
          source: "local",
          dataBase64: localImage.dataBase64,
          mimeType: localImage.mimeType,
          size,
          position,
        });
      } else {
        // Failed to read - fallback to placeholder behavior
        builder.blocks.push({
          kind: "image",
          url: imgNode.url,
          alt: cleanAlt || undefined,
          source: "local",
          size,
          position,
        });
      }
    } else {
      // No basePath - treat as remote (backwards compatibility)
      builder.blocks.push({
        kind: "image",
        url: imgNode.url,
        alt: cleanAlt || undefined,
        size,
        position,
      });
    }
    return;
  }

  // Check if paragraph is a figma block placeholder
  const spans = extractSpans(para.children as PhrasingContent[]);
  const text = spansToText(spans).trim();
  const figmaIndex = matchFigmaPlaceholder(text);
  if (figmaIndex !== null) {
    const figmaBlock = figmaBlocks[figmaIndex];
    if (figmaBlock) {
      builder.blocks.push({ kind: "figma", link: figmaBlock.link });
    }
    return;
  }

  // Check if paragraph is a columns block placeholder
  const columnsIndex = matchColumnsPlaceholder(text);
  if (columnsIndex !== null) {
    const columnsPlaceholder = columnsBlocks[columnsIndex];
    if (columnsPlaceholder) {
      const columnsBlock = createColumnsBlock(
        columnsPlaceholder,
        parseColumnContent,
      );
      builder.blocks.push(columnsBlock);
    }
    return;
  }

  // Check if paragraph is a callout block placeholder
  const calloutIndex = matchCalloutPlaceholder(text);
  if (calloutIndex !== null) {
    const calloutBlock = calloutBlocks[calloutIndex];
    if (calloutBlock) {
      builder.blocks.push({
        kind: "callout",
        type: calloutBlock.type,
        text: calloutBlock.content,
        spans: calloutBlock.spans,
      });
    }
    return;
  }

  // Regular paragraph
  builder.blocks.push({ kind: "paragraph", text, spans });
}

/**
 * Process a list node (ordered or unordered)
 */
function processList(listNode: List, builder: SlideBuilder): void {
  const bulletItems = extractBulletItems(listNode);
  builder.blocks.push({
    kind: "bullets",
    items: bulletItems,
    ordered: listNode.ordered || false,
    start: listNode.start ?? 1,
  });
}

/**
 * Process a code block node
 */
function processCode(codeNode: Code, builder: SlideBuilder): void {
  builder.blocks.push({
    kind: "code",
    language: codeNode.lang || undefined,
    code: codeNode.value,
  });
}

/**
 * Process a blockquote node
 */
function processBlockquote(
  blockquote: Blockquote,
  builder: SlideBuilder,
): void {
  const { text, spans } = extractBlockquoteContent(blockquote);
  builder.blocks.push({ kind: "blockquote", text, spans });
}

/**
 * Process a table node
 */
function processTable(tableNode: Table, builder: SlideBuilder): void {
  const align: TableAlignment[] = (tableNode.align || []).map(
    (a) => a as TableAlignment,
  );

  // First row is header
  const headerRow = tableNode.children[0] as TableRow | undefined;
  const headers = headerRow ? extractTableRow(headerRow) : [];

  // Remaining rows are body
  const rows = tableNode.children
    .slice(1)
    .map((row) => extractTableRow(row as TableRow));

  builder.blocks.push({ kind: "table", headers, rows, align });
}

/**
 * mdast footnoteDefinition node type
 */
interface FootnoteDefinitionNode {
  type: "footnoteDefinition";
  identifier: string;
  label?: string;
  children: (Paragraph | PhrasingContent)[];
}

/**
 * Process a footnote definition node
 */
function processFootnoteDefinition(
  node: FootnoteDefinitionNode,
  builder: SlideBuilder,
): void {
  const id = node.identifier;
  const allSpans: TextSpan[] = [];

  // Extract text from footnote definition children
  for (const child of node.children) {
    if (child.type === "paragraph") {
      const para = child as Paragraph;
      allSpans.push(...extractSpans(para.children as PhrasingContent[]));
    } else if ("children" in child) {
      // For other content types with children
      allSpans.push(
        ...extractSpans((child as { children: PhrasingContent[] }).children),
      );
    }
  }

  const content = spansToText(allSpans);
  builder.footnoteDefinitions.set(id, {
    id,
    content,
    spans: allSpans.length > 0 ? allSpans : undefined,
  });
}

/**
 * Parse column content into SlideBlockItems (reusable parser for columns)
 */
function parseColumnContentToBlocks(
  content: string,
  figmaBlocks: FigmaBlockPlaceholder[],
  columnsBlocks: ColumnsBlockPlaceholder[],
  calloutBlocks: CalloutBlockPlaceholder[],
  basePath?: string,
): SlideBlockItem[] {
  // Extract figma and callout blocks from column content
  // (since columns are extracted before figma/callout extraction on main markdown)
  const {
    processedMarkdown: figmaProcessedContent,
    figmaBlocks: localFigmaBlocks,
  } = extractFigmaBlocks(content, { startIndex: figmaBlocks.length });
  const {
    processedMarkdown: processedContent,
    calloutBlocks: localCalloutBlocks,
  } = extractCalloutBlocks(figmaProcessedContent, {
    startIndex: calloutBlocks.length,
  });

  // Merge local blocks with global blocks for matching
  const allFigmaBlocks = [...figmaBlocks, ...localFigmaBlocks];
  const allCalloutBlocks = [...calloutBlocks, ...localCalloutBlocks];

  const tree = processor.parse(processedContent) as Root;
  const builder: SlideBuilder = {
    blocks: [],
    basePath,
    footnoteDefinitions: new Map(),
  };

  // Recursive parseColumnContent for nested columns (though we discourage deep nesting)
  const parseColumnContent = (nestedContent: string): SlideBlockItem[] => {
    return parseColumnContentToBlocks(
      nestedContent,
      allFigmaBlocks,
      columnsBlocks,
      allCalloutBlocks,
      basePath,
    );
  };

  for (const node of tree.children) {
    switch (node.type) {
      case "heading":
        processHeading(node as Heading, builder);
        break;
      case "paragraph":
        processParagraph(
          node as Paragraph,
          builder,
          allFigmaBlocks,
          columnsBlocks,
          allCalloutBlocks,
          parseColumnContent,
        );
        break;
      case "list":
        processList(node as List, builder);
        break;
      case "code":
        processCode(node as Code, builder);
        break;
      case "blockquote":
        processBlockquote(node as Blockquote, builder);
        break;
      case "table":
        processTable(node as Table, builder);
        break;
      case "footnoteDefinition":
        processFootnoteDefinition(node as FootnoteDefinitionNode, builder);
        break;
    }
  }

  // Filter out columns blocks from the result (only SlideBlockItem allowed)
  return builder.blocks.filter(
    (block): block is SlideBlockItem => block.kind !== "columns",
  );
}

/**
 * Parse a single slide's markdown content (may include frontmatter)
 */
function parseSlideMarkdown(
  slideMarkdown: string,
  defaultBackground: SlideBackground | null,
  defaultStyles: SlideStyles,
  defaultSlideNumber: SlideNumberConfig | undefined,
  defaultTitlePrefix: TitlePrefixConfig | null | undefined,
  defaultAlign: HorizontalAlign | undefined,
  defaultValign: VerticalAlign | undefined,
  defaultTransition: SlideTransitionConfig | undefined,
  figmaBlocks: FigmaBlockPlaceholder[],
  columnsBlocks: ColumnsBlockPlaceholder[],
  calloutBlocks: CalloutBlockPlaceholder[],
  basePath?: string,
): SlideContent | null {
  let slideBackground: SlideBackground | null = null;
  let slideStyles: SlideStyles = {};
  let slideSlideNumber: SlideNumberConfig | undefined;
  let slideTitlePrefix: TitlePrefixConfig | null | undefined;
  let slideAlign: HorizontalAlign | undefined;
  let slideValign: VerticalAlign | undefined;
  let slideTransition: SlideTransitionConfig | undefined;

  const { body: slideBody, config: frontmatterConfig } = extractFrontmatter(
    slideMarkdown,
    basePath,
  );

  if (frontmatterConfig) {
    if (frontmatterConfig.background)
      slideBackground = frontmatterConfig.background;
    slideStyles = frontmatterConfig.styles;
    slideSlideNumber = frontmatterConfig.slideNumber;
    slideTitlePrefix = frontmatterConfig.titlePrefix;
    slideAlign = frontmatterConfig.align;
    slideValign = frontmatterConfig.valign;
    slideTransition = frontmatterConfig.transition;
  }

  const tree = processor.parse(slideBody) as Root;
  const builder: SlideBuilder = {
    blocks: [],
    basePath,
    footnoteDefinitions: new Map(),
  };

  // Create parseColumnContent function for this slide context
  const parseColumnContent = (content: string): SlideBlockItem[] => {
    return parseColumnContentToBlocks(
      content,
      figmaBlocks,
      columnsBlocks,
      calloutBlocks,
      basePath,
    );
  };

  // Process each AST node
  for (const node of tree.children) {
    switch (node.type) {
      case "heading":
        processHeading(node as Heading, builder);
        break;
      case "paragraph":
        processParagraph(
          node as Paragraph,
          builder,
          figmaBlocks,
          columnsBlocks,
          calloutBlocks,
          parseColumnContent,
        );
        break;
      case "list":
        processList(node as List, builder);
        break;
      case "code":
        processCode(node as Code, builder);
        break;
      case "blockquote":
        processBlockquote(node as Blockquote, builder);
        break;
      case "table":
        processTable(node as Table, builder);
        break;
      case "footnoteDefinition":
        processFootnoteDefinition(node as FootnoteDefinitionNode, builder);
        break;
      // Other node types (yaml, thematicBreak, etc.) are ignored
    }
  }

  // Return null if no content was found
  if (builder.blocks.length === 0 && builder.footnoteDefinitions.size === 0) {
    return null;
  }

  // Build the slide content
  const slide: SlideContent = {
    blocks: builder.blocks,
    background: slideBackground || defaultBackground || undefined,
    styles: mergeStyles(defaultStyles, slideStyles),
    slideNumber: mergeSlideNumberConfig(defaultSlideNumber, slideSlideNumber),
    align: slideAlign ?? defaultAlign,
    valign: slideValign ?? defaultValign,
    transition: mergeTransitionConfig(defaultTransition, slideTransition),
  };

  // Merge titlePrefix config (slide-specific overrides global defaults)
  // null means explicitly disabled, undefined means use default
  if (slideTitlePrefix === null) {
    slide.titlePrefix = null;
  } else if (slideTitlePrefix !== undefined) {
    slide.titlePrefix = slideTitlePrefix;
  } else if (defaultTitlePrefix !== undefined) {
    slide.titlePrefix = defaultTitlePrefix;
  }

  // Add footnotes if any were defined
  if (builder.footnoteDefinitions.size > 0) {
    slide.footnotes = Array.from(builder.footnoteDefinitions.values());
  }

  return slide;
}

/**
 * Check if lines array has meaningful content (non-empty lines)
 */
function hasMeaningfulContent(lines: string[]): boolean {
  return lines.some((l) => l.trim() !== "");
}

/**
 * Check if lines look like implicit frontmatter (YAML key/value pairs).
 * Supports both inline values (key: value) and nested YAML (key:\n  nested: value).
 */
function looksLikeInlineFrontmatter(lines: string[]): boolean {
  let sawKey = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match key: (with or without inline value)
    if (/^[a-zA-Z][\w-]*:\s*/.test(trimmed)) {
      sawKey = true;
      continue;
    }
    // Match indented lines (nested YAML values)
    if (/^\s+/.test(line) && sawKey) {
      continue;
    }
    return false;
  }
  return sawKey;
}

/**
 * Split markdown content into individual slide texts
 */
function splitIntoSlides(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const slideTexts: string[] = [];
  let currentLines: string[] = [];
  let inFrontmatter = false;
  let codeFence: string | null = null;

  const flushSlide = () => {
    const slideText = currentLines.join("\n").trim();
    if (slideText) {
      slideTexts.push(slideText);
    }
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Track fenced code blocks so we don't split on --- inside code samples
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      if (codeFence === null) {
        codeFence = fenceMatch[1];
      } else if (trimmed.startsWith(codeFence)) {
        codeFence = null;
      }
      currentLines.push(line);
      continue;
    }

    // Do not treat --- as separators while inside a code fence
    if (codeFence !== null) {
      currentLines.push(line);
      continue;
    }

    if (trimmed === "---") {
      if (inFrontmatter) {
        currentLines.push(line);
        inFrontmatter = false;
        continue;
      }

      if (!hasMeaningfulContent(currentLines)) {
        // Treat as start of per-slide frontmatter
        inFrontmatter = true;
        currentLines.push(line);
        continue;
      }

      // Treat as implicit frontmatter closer (no opening fence, only key/value lines so far)
      if (looksLikeInlineFrontmatter(currentLines)) {
        currentLines.push(line);
        continue;
      }

      // Slide separator
      flushSlide();
      inFrontmatter = false;
      continue;
    }

    currentLines.push(line);
  }

  // Flush any remaining content as the last slide
  flushSlide();

  return slideTexts;
}

export interface ParseMarkdownOptions {
  basePath?: string;
}

export function parseMarkdown(
  markdown: string,
  options: ParseMarkdownOptions = {},
): SlideContent[] {
  const { basePath } = options;

  // First, extract :::columns blocks and replace with placeholders
  // This must happen before :::figma extraction to handle columns containing figma blocks
  const { processedMarkdown: columnsProcessed, columnsBlocks } =
    extractColumnsBlocks(markdown);

  // Then, extract :::figma blocks and replace with placeholders
  const { processedMarkdown: figmaProcessed, figmaBlocks } =
    extractFigmaBlocks(columnsProcessed);

  // Then, extract :::note/tip/warning/caution callout blocks
  const { processedMarkdown, calloutBlocks } =
    extractCalloutBlocks(figmaProcessed);

  let globalDefaultBackground: SlideBackground | null = null;
  let globalDefaultStyles: SlideStyles = {};
  let globalDefaultSlideNumber: SlideNumberConfig | undefined;
  let globalDefaultTitlePrefix: TitlePrefixConfig | null | undefined;
  let globalDefaultAlign: HorizontalAlign | undefined;
  let globalDefaultValign: VerticalAlign | undefined;
  let globalDefaultTransition: SlideTransitionConfig | undefined;
  let globalCoverEnabled = true;
  let contentWithoutGlobalFrontmatter = processedMarkdown;
  const slides: SlideContent[] = [];

  // Check for global frontmatter at the very start
  const frontmatterMatch = processedMarkdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatterMatch) {
    try {
      const config = parseYaml(frontmatterMatch[1]) as SlideConfig;
      if (typeof config.cover === "boolean") {
        globalCoverEnabled = config.cover;
      }
      const {
        background,
        styles,
        slideNumber,
        titlePrefix,
        align,
        valign,
        transition,
      } = parseSlideConfig(config, {
        basePath,
      });
      if (background) globalDefaultBackground = background;
      globalDefaultStyles = styles;
      globalDefaultSlideNumber = slideNumber;
      globalDefaultTitlePrefix = titlePrefix;
      globalDefaultAlign = align;
      globalDefaultValign = valign;
      globalDefaultTransition = transition;
    } catch {
      // Invalid YAML, ignore
    }
    contentWithoutGlobalFrontmatter = processedMarkdown.slice(
      frontmatterMatch[0].length,
    );
  }

  // Split the remaining content into slides
  const slideTexts = splitIntoSlides(contentWithoutGlobalFrontmatter);

  for (const slideText of slideTexts) {
    const slide = parseSlideMarkdown(
      slideText,
      globalDefaultBackground,
      globalDefaultStyles,
      globalDefaultSlideNumber,
      globalDefaultTitlePrefix,
      globalDefaultAlign,
      globalDefaultValign,
      globalDefaultTransition,
      figmaBlocks,
      columnsBlocks,
      calloutBlocks,
      basePath,
    );
    if (slide) {
      slides.push(slide);
    }
  }

  if (globalCoverEnabled && slides.length > 0) {
    slides[0].cover = true;
  }

  return slides;
}
