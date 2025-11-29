import type {
  Blockquote,
  Code,
  Content,
  Delete,
  Emphasis,
  Heading,
  Image,
  InlineCode,
  Link,
  List,
  Paragraph,
  PhrasingContent,
  Root,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
} from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import type {
  FigmaSelectionLink,
  TextStyle as ParsedTextStyle,
  SlideBackground,
  SlideBlock,
  SlideContent,
  SlideNumberConfig,
  SlideNumberPosition,
  SlideStyles,
  TableAlignment,
  TextSpan,
} from "./types.js";

// Processor instance for parsing markdown with frontmatter and GFM support
const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

interface TextStyle {
  size?: number;
  color?: string;
}

interface HeadingsConfig {
  h1?: TextStyle;
  h2?: TextStyle;
  h3?: TextStyle;
  h4?: TextStyle;
}

interface SlideNumberYamlConfig {
  show?: boolean;
  size?: number;
  color?: string;
  position?: string;
  paddingX?: number;
  paddingY?: number;
  format?: string;
}

interface SlideConfig {
  background?: string;
  gradient?: string;
  template?: string;
  color?: string;
  headings?: HeadingsConfig;
  paragraphs?: TextStyle;
  bullets?: TextStyle;
  code?: TextStyle;
  slideNumber?: SlideNumberYamlConfig | boolean;
}

/**
 * Parse and validate a font size value (1-200px range)
 */
function parseFontSize(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const size = Number(value);
  if (!Number.isNaN(size) && size >= 1 && size <= 200) {
    return size;
  }
  return undefined;
}

/**
 * Parse a TextStyle object and normalize colors
 */
function parseTextStyle(
  style: TextStyle | undefined,
): ParsedTextStyle | undefined {
  if (!style) return undefined;
  const result: ParsedTextStyle = {};
  if (style.size !== undefined) {
    result.size = parseFontSize(style.size);
  }
  if (style.color) {
    result.color = normalizeColor(style.color);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse slideNumber config from YAML
 */
function parseSlideNumberConfig(
  config: SlideNumberYamlConfig | boolean | undefined,
): SlideNumberConfig | undefined {
  if (config === undefined) return undefined;

  // Boolean shorthand: true = show, false = hide
  if (typeof config === "boolean") {
    return { show: config };
  }

  const result: SlideNumberConfig = {};

  if (config.show !== undefined) result.show = config.show;
  if (
    config.size !== undefined &&
    typeof config.size === "number" &&
    config.size >= 1 &&
    config.size <= 200
  ) {
    result.size = config.size;
  }
  if (config.color) {
    result.color = normalizeColor(config.color);
  }
  if (config.position) {
    const validPositions: SlideNumberPosition[] = [
      "bottom-right",
      "bottom-left",
      "top-right",
      "top-left",
    ];
    if (validPositions.includes(config.position as SlideNumberPosition)) {
      result.position = config.position as SlideNumberPosition;
    }
  }
  if (config.paddingX !== undefined && typeof config.paddingX === "number") {
    result.paddingX = config.paddingX;
  }
  if (config.paddingY !== undefined && typeof config.paddingY === "number") {
    result.paddingY = config.paddingY;
  }
  if (config.format && typeof config.format === "string") {
    result.format = config.format;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse slide config from YAML frontmatter
 */
function parseSlideConfig(config: SlideConfig): {
  background: SlideBackground | null;
  styles: SlideStyles;
  slideNumber: SlideNumberConfig | undefined;
} {
  let background: SlideBackground | null = null;
  const styles: SlideStyles = {};

  const baseColor = config.color ? normalizeColor(config.color) : undefined;
  const applyBaseColor = (
    style: ParsedTextStyle | undefined,
  ): ParsedTextStyle | undefined => {
    if (!baseColor) return style;
    if (style) {
      return style.color ? style : { ...style, color: baseColor };
    }
    return { color: baseColor };
  };

  if (config.template) {
    background = { templateStyle: config.template };
  } else if (config.gradient) {
    const gradient = parseGradient(config.gradient);
    if (gradient) {
      background = { gradient };
    }
  } else if (config.background) {
    background = { solid: normalizeColor(config.background) };
  }

  // Parse headings
  const headingStyles: NonNullable<SlideStyles["headings"]> = {
    h1: applyBaseColor(parseTextStyle(config.headings?.h1)),
    h2: applyBaseColor(parseTextStyle(config.headings?.h2)),
    h3: applyBaseColor(parseTextStyle(config.headings?.h3)),
    h4: applyBaseColor(parseTextStyle(config.headings?.h4)),
  };
  styles.headings = headingStyles;

  // Parse other text styles
  styles.paragraphs = applyBaseColor(parseTextStyle(config.paragraphs));
  styles.bullets = applyBaseColor(parseTextStyle(config.bullets));
  styles.code = applyBaseColor(parseTextStyle(config.code));

  // Parse slideNumber config
  const slideNumber = parseSlideNumberConfig(config.slideNumber);

  return { background, styles, slideNumber };
}

/**
 * Parse a color string (hex or rgb/rgba) and normalize to hex or rgba string
 * Supports: #rgb, #rrggbb, rgb(r,g,b), rgba(r,g,b,a)
 */
function normalizeColor(color: string): string {
  color = color.trim();

  // Handle #rgb shorthand
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // Handle #rrggbb
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }

  // Handle rgb(r,g,b) or rgba(r,g,b,a)
  const rgbMatch = color.match(
    /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[3], 10)));
    if (rgbMatch[4] !== undefined) {
      const a = Math.min(1, Math.max(0, Number.parseFloat(rgbMatch[4])));
      return `rgba(${r},${g},${b},${a})`;
    }
    // Convert to hex
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  return color; // Return as-is if not recognized
}

/**
 * Parse gradient string: "color1:pos1%,color2:pos2%,...@angle"
 * Example: "#0d1117:0%,#1f2937:50%,#58a6ff:100%@45"
 */
function parseGradient(
  gradientStr: string,
): SlideBackground["gradient"] | null {
  const [stopsStr, angleStr] = gradientStr.split("@");
  if (!stopsStr) return null;

  const stopParts = stopsStr.split(",");
  const stops: { color: string; position: number }[] = [];

  for (const part of stopParts) {
    const match = part.trim().match(/^(.+):(\d+(?:\.\d+)?)%?$/);
    if (match) {
      stops.push({
        color: normalizeColor(match[1]),
        position: Number.parseFloat(match[2]) / 100,
      });
    }
  }

  if (stops.length < 2) return null;

  return {
    stops,
    angle: angleStr ? Number.parseFloat(angleStr) : 0,
  };
}

/**
 * Parse a Figma URL and extract fileKey and nodeId
 * Supports formats:
 * - https://www.figma.com/file/<fileKey>/<name>?node-id=<nodeId>
 * - https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>
 * - https://www.figma.com/slides/<fileKey>/<name>?node-id=<nodeId>
 * - https://figma.com/file/<fileKey>?node-id=<nodeId>
 */
function parseFigmaUrl(url: string): { fileKey?: string; nodeId?: string } {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("figma.com")) {
      return {};
    }

    // Extract fileKey from path: /file/<fileKey>/... or /design/<fileKey>/... or /slides/<fileKey>/...
    const pathMatch = parsed.pathname.match(/^\/(file|design|slides)\/([^/]+)/);
    const fileKey = pathMatch ? pathMatch[2] : undefined;

    // Extract node-id from query params
    const nodeIdParam = parsed.searchParams.get("node-id");
    // URL-decode and normalize: 1%3A2 -> 1:2, 1234-5678 -> 1234:5678
    const nodeId = nodeIdParam
      ? decodeURIComponent(nodeIdParam).replace(/-/g, ":")
      : undefined;

    return { fileKey, nodeId };
  } catch {
    return {};
  }
}

/**
 * Extract :::figma blocks from markdown text and return the modified text
 * with placeholders that can be replaced after AST parsing.
 *
 * Block format:
 * :::figma
 * link=https://www.figma.com/file/xxx?node-id=1234-5678
 * x=160
 * y=300
 * :::
 */
interface FigmaBlockPlaceholder {
  id: string;
  link: FigmaSelectionLink;
}

function extractFigmaBlocks(markdown: string): {
  processedMarkdown: string;
  figmaBlocks: FigmaBlockPlaceholder[];
} {
  const figmaBlocks: FigmaBlockPlaceholder[] = [];
  let blockId = 0;

  // Match :::figma ... ::: blocks
  const figmaBlockRegex = /^:::figma\s*\n([\s\S]*?)\n:::\s*$/gm;

  const processedMarkdown = markdown.replace(
    figmaBlockRegex,
    (_match, content: string) => {
      const lines = content.trim().split("\n");
      const props: Record<string, string> = {};

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Check for bare URL first (before checking for key=value)
        if (
          trimmedLine.startsWith("http://") ||
          trimmedLine.startsWith("https://")
        ) {
          // Support bare URL without link= prefix
          props.link = trimmedLine;
        } else {
          const eqIndex = trimmedLine.indexOf("=");
          if (eqIndex > 0) {
            const key = trimmedLine.slice(0, eqIndex).trim();
            const value = trimmedLine.slice(eqIndex + 1).trim();
            props[key] = value;
          }
        }
      }

      if (!props.link) {
        console.warn(
          "[figdeck] :::figma block missing 'link' property, skipping",
        );
        return "";
      }

      const { fileKey, nodeId } = parseFigmaUrl(props.link);
      if (!fileKey) {
        console.warn(`[figdeck] Invalid Figma URL: ${props.link}`);
      }

      const link: FigmaSelectionLink = {
        url: props.link,
        fileKey,
        nodeId,
        x: props.x ? Number.parseFloat(props.x) : undefined,
        y: props.y ? Number.parseFloat(props.y) : undefined,
      };

      const id = `FIGDECK_FIGMA_BLOCK_${blockId++}_PLACEHOLDER`;
      figmaBlocks.push({ id, link });

      // Return a placeholder paragraph that we can identify after parsing
      return `\n${id}\n`;
    },
  );

  return { processedMarkdown, figmaBlocks };
}

function extractText(node: Content): string {
  if (node.type === "text") {
    return node.value;
  }
  if ("children" in node) {
    return (node.children as Content[]).map(extractText).join("");
  }
  return "";
}

/**
 * Current inline formatting state during span extraction
 */
interface InlineMarks {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}

/**
 * Extract inline formatting from mdast phrasing content into TextSpan[]
 * Handles: text, strong, emphasis, delete (strikethrough), inlineCode, link
 */
function extractSpans(
  nodes: PhrasingContent[],
  marks: InlineMarks = {},
): TextSpan[] {
  const spans: TextSpan[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text": {
        const textNode = node as Text;
        const span: TextSpan = { text: textNode.value };
        if (marks.bold) span.bold = true;
        if (marks.italic) span.italic = true;
        if (marks.strike) span.strike = true;
        if (marks.code) span.code = true;
        if (marks.href) span.href = marks.href;
        spans.push(span);
        break;
      }
      case "strong": {
        const strongNode = node as Strong;
        const childSpans = extractSpans(
          strongNode.children as PhrasingContent[],
          {
            ...marks,
            bold: true,
          },
        );
        spans.push(...childSpans);
        break;
      }
      case "emphasis": {
        const emNode = node as Emphasis;
        const childSpans = extractSpans(emNode.children as PhrasingContent[], {
          ...marks,
          italic: true,
        });
        spans.push(...childSpans);
        break;
      }
      case "delete": {
        const delNode = node as Delete;
        const childSpans = extractSpans(delNode.children as PhrasingContent[], {
          ...marks,
          strike: true,
        });
        spans.push(...childSpans);
        break;
      }
      case "inlineCode": {
        const codeNode = node as InlineCode;
        const span: TextSpan = { text: codeNode.value, code: true };
        if (marks.bold) span.bold = true;
        if (marks.italic) span.italic = true;
        if (marks.strike) span.strike = true;
        if (marks.href) span.href = marks.href;
        spans.push(span);
        break;
      }
      case "link": {
        const linkNode = node as Link;
        const childSpans = extractSpans(
          linkNode.children as PhrasingContent[],
          {
            ...marks,
            href: linkNode.url,
          },
        );
        spans.push(...childSpans);
        break;
      }
      default:
        // For other node types with children (e.g., html), try to extract text
        if ("children" in node) {
          const childSpans = extractSpans(
            (node as { children: PhrasingContent[] }).children,
            marks,
          );
          spans.push(...childSpans);
        } else if ("value" in node) {
          // For raw values (html, etc.), treat as plain text
          const span: TextSpan = {
            text: String((node as { value: unknown }).value),
          };
          if (marks.bold) span.bold = true;
          if (marks.italic) span.italic = true;
          if (marks.strike) span.strike = true;
          if (marks.code) span.code = true;
          if (marks.href) span.href = marks.href;
          spans.push(span);
        }
        break;
    }
  }

  return spans;
}

/**
 * Convert TextSpan[] to plain text (for legacy compatibility)
 */
function spansToText(spans: TextSpan[]): string {
  return spans.map((s) => s.text).join("");
}

/**
 * Extract list items with their TextSpan[] for rich formatting
 */
function extractListItemSpans(list: List): {
  texts: string[];
  spans: TextSpan[][];
} {
  const texts: string[] = [];
  const spans: TextSpan[][] = [];

  for (const item of list.children) {
    if (item.type === "listItem" && item.children.length > 0) {
      // Collect spans from all paragraph children
      const itemSpans: TextSpan[] = [];
      for (const child of item.children) {
        if (child.type === "paragraph") {
          const para = child as Paragraph;
          itemSpans.push(...extractSpans(para.children as PhrasingContent[]));
        } else {
          // For non-paragraph content, extract plain text
          const text = extractText(child as Content);
          if (text) {
            itemSpans.push({ text });
          }
        }
      }
      if (itemSpans.length > 0) {
        spans.push(itemSpans);
        texts.push(spansToText(itemSpans));
      }
    }
  }

  return { texts, spans };
}

/**
 * Extract table cells from a table row
 */
function extractTableRow(row: TableRow): TextSpan[][] {
  return row.children.map((cell: TableCell) => {
    return extractSpans(cell.children as PhrasingContent[]);
  });
}

/**
 * Extract blockquote content (flatten child paragraphs)
 */
function extractBlockquoteContent(blockquote: Blockquote): {
  text: string;
  spans: TextSpan[];
} {
  const allSpans: TextSpan[] = [];

  for (const child of blockquote.children) {
    if (child.type === "paragraph") {
      const para = child as Paragraph;
      allSpans.push(...extractSpans(para.children as PhrasingContent[]));
    } else {
      // Fallback: extract plain text from other content types
      const text = extractText(child as Content);
      if (text) {
        allSpans.push({ text });
      }
    }
    // Add line break between paragraphs inside blockquote
    if (child !== blockquote.children[blockquote.children.length - 1]) {
      allSpans.push({ text: "\n" });
    }
  }

  return { text: spansToText(allSpans), spans: allSpans };
}

interface ParsedConfigResult {
  background: SlideBackground | null;
  styles: SlideStyles;
  slideNumber: SlideNumberConfig | undefined;
}

/**
 * Merge two SlideStyles, with slide styles overriding defaults
 */
function mergeStyles(
  defaultStyles: SlideStyles,
  slideStyles: SlideStyles,
): SlideStyles {
  return {
    headings: {
      h1: slideStyles.headings?.h1 ?? defaultStyles.headings?.h1,
      h2: slideStyles.headings?.h2 ?? defaultStyles.headings?.h2,
      h3: slideStyles.headings?.h3 ?? defaultStyles.headings?.h3,
      h4: slideStyles.headings?.h4 ?? defaultStyles.headings?.h4,
    },
    paragraphs: slideStyles.paragraphs ?? defaultStyles.paragraphs,
    bullets: slideStyles.bullets ?? defaultStyles.bullets,
    code: slideStyles.code ?? defaultStyles.code,
  };
}

/**
 * Merge SlideNumberConfig, with slide config overriding defaults
 */
function mergeSlideNumberConfig(
  defaultConfig: SlideNumberConfig | undefined,
  slideConfig: SlideNumberConfig | undefined,
): SlideNumberConfig | undefined {
  if (!defaultConfig && !slideConfig) return undefined;
  if (!defaultConfig) return slideConfig;
  if (!slideConfig) return defaultConfig;

  return {
    show: slideConfig.show ?? defaultConfig.show,
    size: slideConfig.size ?? defaultConfig.size,
    color: slideConfig.color ?? defaultConfig.color,
    position: slideConfig.position ?? defaultConfig.position,
    paddingX: slideConfig.paddingX ?? defaultConfig.paddingX,
    paddingY: slideConfig.paddingY ?? defaultConfig.paddingY,
    format: slideConfig.format ?? defaultConfig.format,
  };
}

/**
 * Parse a single slide's markdown content (may include frontmatter)
 */
function parseSlideMarkdown(
  slideMarkdown: string,
  defaultBackground: SlideBackground | null,
  defaultStyles: SlideStyles,
  defaultSlideNumber: SlideNumberConfig | undefined,
  figmaBlocks: FigmaBlockPlaceholder[],
): SlideContent | null {
  let slideBackground: SlideBackground | null = null;
  let slideStyles: SlideStyles = {};
  let slideSlideNumber: SlideNumberConfig | undefined;
  const blocks: SlideBlock[] = [];

  /**
   * Extract frontmatter from the beginning of the slide.
   * Supports:
   * 1) Standard fenced YAML (`--- ... ---`)
   * 2) A block of key/value pairs terminated by `---` without an opening fence
   *    (common mistake when writing per-slide overrides after a separator).
   */
  function extractFrontmatter(markdown: string): {
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
          const config = parseSlideConfig(parseYaml(yamlBlock) as SlideConfig);
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

  const { body: slideBody, config: frontmatterConfig } =
    extractFrontmatter(slideMarkdown);

  if (frontmatterConfig) {
    if (frontmatterConfig.background)
      slideBackground = frontmatterConfig.background;
    slideStyles = frontmatterConfig.styles;
    slideSlideNumber = frontmatterConfig.slideNumber;
  }

  const tree = processor.parse(slideBody) as Root;

  let slide: SlideContent | null = null;

  for (const node of tree.children) {
    if (node.type === "heading") {
      const heading = node as Heading;
      const spans = extractSpans(heading.children as PhrasingContent[]);
      const text = spansToText(spans);

      if (heading.depth === 1) {
        if (!slide) {
          slide = { type: "title", title: text };
        }
      } else if (heading.depth === 2) {
        if (!slide) {
          slide = { type: "content", title: text };
        }
      } else if (heading.depth === 3 || heading.depth === 4) {
        if (!slide) {
          slide = { type: "content" };
        }
        blocks.push({
          kind: "heading",
          level: heading.depth as 3 | 4,
          text,
          spans,
        });
      }
      continue;
    }

    if (node.type === "paragraph") {
      // Check if paragraph contains only an image
      const para = node as Paragraph;
      if (para.children.length === 1 && para.children[0].type === "image") {
        const imgNode = para.children[0] as Image;
        if (!slide) {
          slide = { type: "content" };
        }
        blocks.push({
          kind: "image",
          url: imgNode.url,
          alt: imgNode.alt || undefined,
        });
        continue;
      }

      // Check if paragraph is a figma block placeholder
      const spans = extractSpans(para.children as PhrasingContent[]);
      const text = spansToText(spans).trim();
      const figmaMatch = text.match(/^FIGDECK_FIGMA_BLOCK_(\d+)_PLACEHOLDER$/);
      if (figmaMatch) {
        const blockIndex = Number.parseInt(figmaMatch[1], 10);
        const figmaBlock = figmaBlocks[blockIndex];
        if (figmaBlock) {
          if (!slide) {
            slide = { type: "content" };
          }
          blocks.push({ kind: "figma", link: figmaBlock.link });
        }
        continue;
      }

      if (!slide) {
        slide = { type: "content" };
      }
      if (!slide.body) slide.body = [];
      slide.body.push(text);
      blocks.push({ kind: "paragraph", text, spans });
      continue;
    }

    if (node.type === "list") {
      if (!slide) {
        slide = { type: "content" };
      }
      const listNode = node as List;
      const { texts, spans: itemSpans } = extractListItemSpans(listNode);
      if (!slide.bullets) slide.bullets = [];
      slide.bullets.push(...texts);
      blocks.push({
        kind: "bullets",
        items: texts,
        ordered: listNode.ordered || false,
        start: listNode.start ?? 1,
        itemSpans,
      });
      continue;
    }

    if (node.type === "code") {
      if (!slide) {
        slide = { type: "content" };
      }
      const codeNode = node as Code;
      if (!slide.codeBlocks) slide.codeBlocks = [];
      slide.codeBlocks.push({
        language: codeNode.lang || undefined,
        code: codeNode.value,
      });
      blocks.push({
        kind: "code",
        language: codeNode.lang || undefined,
        code: codeNode.value,
      });
      continue;
    }

    if (node.type === "blockquote") {
      if (!slide) {
        slide = { type: "content" };
      }
      const { text, spans } = extractBlockquoteContent(node as Blockquote);
      blocks.push({ kind: "blockquote", text, spans });
      continue;
    }

    if (node.type === "table") {
      if (!slide) {
        slide = { type: "content" };
      }
      const tableNode = node as Table;
      const align: TableAlignment[] = (tableNode.align || []).map(
        (a) => a as TableAlignment,
      );

      // First row is header
      const headerRow = tableNode.children[0] as TableRow | undefined;
      const headers = headerRow ? extractTableRow(headerRow) : [];

      // Remaining rows are body
      const rows: TextSpan[][][] = [];
      for (let i = 1; i < tableNode.children.length; i++) {
        rows.push(extractTableRow(tableNode.children[i] as TableRow));
      }

      blocks.push({ kind: "table", headers, rows, align });
    }
  }

  if (slide) {
    // Apply slide-specific or default background
    slide.background = slideBackground || defaultBackground || undefined;
    // Merge styles (slide-specific overrides global defaults)
    slide.styles = mergeStyles(defaultStyles, slideStyles);
    // Merge slideNumber config (slide-specific overrides global defaults)
    slide.slideNumber = mergeSlideNumberConfig(
      defaultSlideNumber,
      slideSlideNumber,
    );
    if (blocks.length > 0) {
      slide.blocks = blocks;
    }
  }

  return slide;
}

export function parseMarkdown(markdown: string): SlideContent[] {
  // First, extract :::figma blocks and replace with placeholders
  const { processedMarkdown, figmaBlocks } = extractFigmaBlocks(markdown);

  let globalDefaultBackground: SlideBackground | null = null;
  let globalDefaultStyles: SlideStyles = {};
  let globalDefaultSlideNumber: SlideNumberConfig | undefined;
  let contentWithoutGlobalFrontmatter = processedMarkdown;
  const slides: SlideContent[] = [];

  // Check for global frontmatter at the very start
  const frontmatterMatch = processedMarkdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatterMatch) {
    try {
      const config = parseYaml(frontmatterMatch[1]) as SlideConfig;
      const { background, styles, slideNumber } = parseSlideConfig(config);
      if (background) globalDefaultBackground = background;
      globalDefaultStyles = styles;
      globalDefaultSlideNumber = slideNumber;
    } catch {
      // Invalid YAML, ignore
    }
    contentWithoutGlobalFrontmatter = processedMarkdown.slice(
      frontmatterMatch[0].length,
    );
  }

  // Split the remaining content into slides while preserving per-slide frontmatter
  const lines = contentWithoutGlobalFrontmatter.split(/\r?\n/);
  const slideTexts: string[] = [];
  let currentLines: string[] = [];
  let inFrontmatter = false;
  let codeFence: string | null = null;

  const hasMeaningfulContent = (lines: string[]) =>
    lines.some((l) => l.trim() !== "");

  const looksLikeInlineFrontmatter = (lines: string[]) => {
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
  };

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

  for (const slideText of slideTexts) {
    const slide = parseSlideMarkdown(
      slideText,
      globalDefaultBackground,
      globalDefaultStyles,
      globalDefaultSlideNumber,
      figmaBlocks,
    );
    if (slide) {
      slides.push(slide);
    }
  }

  return slides;
}
