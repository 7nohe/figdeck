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
  mergeSlideNumberConfig,
  mergeStyles,
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
  extractListItemSpans,
  extractSpans,
  extractTableRow,
  spansToText,
} from "./spans.js";
import type {
  HorizontalAlign,
  SlideBackground,
  SlideBlock,
  SlideContent,
  SlideNumberConfig,
  SlideStyles,
  TableAlignment,
  TitlePrefixConfig,
  VerticalAlign,
} from "./types.js";

// Processor instance for parsing markdown with frontmatter and GFM support
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

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
 * Ensure a slide object exists with at least content type
 */
function ensureSlide(slide: SlideContent | null): SlideContent {
  return slide ?? { type: "content" };
}

/**
 * Context for building a slide from AST nodes
 */
interface SlideBuilder {
  slide: SlideContent | null;
  blocks: SlideBlock[];
  basePath?: string;
}

/**
 * Process a heading node and update builder state
 */
function processHeading(heading: Heading, builder: SlideBuilder): void {
  const spans = extractSpans(heading.children as PhrasingContent[]);
  const text = spansToText(spans);

  if (heading.depth === 1) {
    if (!builder.slide) {
      builder.slide = { type: "title", title: text };
    }
  } else if (heading.depth === 2) {
    if (!builder.slide) {
      builder.slide = { type: "content", title: text };
    }
  } else if (heading.depth === 3 || heading.depth === 4) {
    builder.slide = ensureSlide(builder.slide);
    builder.blocks.push({
      kind: "heading",
      level: heading.depth as 3 | 4,
      text,
      spans,
    });
  }
}

/**
 * Process a paragraph node - may be image, figma placeholder, or regular text
 */
function processParagraph(
  para: Paragraph,
  builder: SlideBuilder,
  figmaBlocks: FigmaBlockPlaceholder[],
): void {
  // Check if paragraph contains only an image
  if (para.children.length === 1 && para.children[0].type === "image") {
    const imgNode = para.children[0] as Image;
    builder.slide = ensureSlide(builder.slide);

    // Determine if this is a local or remote image
    if (isRemoteUrl(imgNode.url)) {
      // Remote image - just pass URL
      builder.blocks.push({
        kind: "image",
        url: imgNode.url,
        alt: imgNode.alt || undefined,
        source: "remote",
      });
    } else if (builder.basePath) {
      // Local image - attempt to read and encode
      const localImage = readLocalImage(imgNode.url, builder.basePath);
      if (localImage) {
        builder.blocks.push({
          kind: "image",
          url: imgNode.url,
          alt: imgNode.alt || undefined,
          source: "local",
          dataBase64: localImage.dataBase64,
          mimeType: localImage.mimeType,
        });
      } else {
        // Failed to read - fallback to placeholder behavior
        builder.blocks.push({
          kind: "image",
          url: imgNode.url,
          alt: imgNode.alt || undefined,
          source: "local",
        });
      }
    } else {
      // No basePath - treat as remote (backwards compatibility)
      builder.blocks.push({
        kind: "image",
        url: imgNode.url,
        alt: imgNode.alt || undefined,
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
      builder.slide = ensureSlide(builder.slide);
      builder.blocks.push({ kind: "figma", link: figmaBlock.link });
    }
    return;
  }

  // Regular paragraph
  builder.slide = ensureSlide(builder.slide);
  if (!builder.slide.body) builder.slide.body = [];
  builder.slide.body.push(text);
  builder.blocks.push({ kind: "paragraph", text, spans });
}

/**
 * Process a list node (ordered or unordered)
 */
function processList(listNode: List, builder: SlideBuilder): void {
  builder.slide = ensureSlide(builder.slide);
  const { texts, spans: itemSpans } = extractListItemSpans(listNode);
  if (!builder.slide.bullets) builder.slide.bullets = [];
  builder.slide.bullets.push(...texts);
  builder.blocks.push({
    kind: "bullets",
    items: texts,
    ordered: listNode.ordered || false,
    start: listNode.start ?? 1,
    itemSpans,
  });
}

/**
 * Process a code block node
 */
function processCode(codeNode: Code, builder: SlideBuilder): void {
  builder.slide = ensureSlide(builder.slide);
  if (!builder.slide.codeBlocks) builder.slide.codeBlocks = [];
  builder.slide.codeBlocks.push({
    language: codeNode.lang || undefined,
    code: codeNode.value,
  });
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
  builder.slide = ensureSlide(builder.slide);
  const { text, spans } = extractBlockquoteContent(blockquote);
  builder.blocks.push({ kind: "blockquote", text, spans });
}

/**
 * Process a table node
 */
function processTable(tableNode: Table, builder: SlideBuilder): void {
  builder.slide = ensureSlide(builder.slide);
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
  figmaBlocks: FigmaBlockPlaceholder[],
  basePath?: string,
): SlideContent | null {
  let slideBackground: SlideBackground | null = null;
  let slideStyles: SlideStyles = {};
  let slideSlideNumber: SlideNumberConfig | undefined;
  let slideTitlePrefix: TitlePrefixConfig | null | undefined;
  let slideAlign: HorizontalAlign | undefined;
  let slideValign: VerticalAlign | undefined;

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
  }

  const tree = processor.parse(slideBody) as Root;
  const builder: SlideBuilder = { slide: null, blocks: [], basePath };

  // Process each AST node
  for (const node of tree.children) {
    switch (node.type) {
      case "heading":
        processHeading(node as Heading, builder);
        break;
      case "paragraph":
        processParagraph(node as Paragraph, builder, figmaBlocks);
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
      // Other node types (yaml, thematicBreak, etc.) are ignored
    }
  }

  if (builder.slide) {
    // Apply slide-specific or default background
    builder.slide.background =
      slideBackground || defaultBackground || undefined;
    // Merge styles (slide-specific overrides global defaults)
    builder.slide.styles = mergeStyles(defaultStyles, slideStyles);
    // Merge slideNumber config (slide-specific overrides global defaults)
    builder.slide.slideNumber = mergeSlideNumberConfig(
      defaultSlideNumber,
      slideSlideNumber,
    );
    // Merge titlePrefix config (slide-specific overrides global defaults)
    // null means explicitly disabled, undefined means use default
    if (slideTitlePrefix === null) {
      builder.slide.titlePrefix = null;
    } else if (slideTitlePrefix !== undefined) {
      builder.slide.titlePrefix = slideTitlePrefix;
    } else if (defaultTitlePrefix !== undefined) {
      builder.slide.titlePrefix = defaultTitlePrefix;
    }
    // Merge align/valign (slide-specific overrides global defaults)
    builder.slide.align = slideAlign ?? defaultAlign;
    builder.slide.valign = slideValign ?? defaultValign;

    if (builder.blocks.length > 0) {
      builder.slide.blocks = builder.blocks;
    }
  }

  return builder.slide;
}

/**
 * Check if lines array has meaningful content (non-empty lines)
 */
function hasMeaningfulContent(lines: string[]): boolean {
  return lines.some((l) => l.trim() !== "");
}

/**
 * Check if lines look like implicit frontmatter (only key: value pairs)
 */
function looksLikeInlineFrontmatter(lines: string[]): boolean {
  let sawKey = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[a-zA-Z][\w-]*:\s*.+$/.test(trimmed)) {
      sawKey = true;
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

  // First, extract :::figma blocks and replace with placeholders
  const { processedMarkdown, figmaBlocks } = extractFigmaBlocks(markdown);

  let globalDefaultBackground: SlideBackground | null = null;
  let globalDefaultStyles: SlideStyles = {};
  let globalDefaultSlideNumber: SlideNumberConfig | undefined;
  let globalDefaultTitlePrefix: TitlePrefixConfig | null | undefined;
  let globalDefaultAlign: HorizontalAlign | undefined;
  let globalDefaultValign: VerticalAlign | undefined;
  let contentWithoutGlobalFrontmatter = processedMarkdown;
  const slides: SlideContent[] = [];

  // Check for global frontmatter at the very start
  const frontmatterMatch = processedMarkdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatterMatch) {
    try {
      const config = parseYaml(frontmatterMatch[1]) as SlideConfig;
      const { background, styles, slideNumber, titlePrefix, align, valign } =
        parseSlideConfig(config, {
          basePath,
        });
      if (background) globalDefaultBackground = background;
      globalDefaultStyles = styles;
      globalDefaultSlideNumber = slideNumber;
      globalDefaultTitlePrefix = titlePrefix;
      globalDefaultAlign = align;
      globalDefaultValign = valign;
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
      figmaBlocks,
      basePath,
    );
    if (slide) {
      slides.push(slide);
    }
  }

  return slides;
}
