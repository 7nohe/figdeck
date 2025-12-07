import type {
  Blockquote,
  Heading,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { extractSpans, spansToText } from "./spans.js";
import type { FigmaSelectionLink, TextSpan } from "./types.js";

/**
 * Parse a Figma URL and extract fileKey and nodeId
 * Supports formats:
 * - https://www.figma.com/file/<fileKey>/<name>?node-id=<nodeId>
 * - https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>
 * - https://www.figma.com/slides/<fileKey>/<name>?node-id=<nodeId>
 * - https://figma.com/file/<fileKey>?node-id=<nodeId>
 */
export function isValidFigmaHostname(hostname: string): boolean {
  return hostname === "figma.com" || hostname.endsWith(".figma.com");
}

export function parseFigmaUrl(url: string): {
  fileKey?: string;
  nodeId?: string;
} {
  try {
    const parsed = new URL(url);
    if (!isValidFigmaHostname(parsed.hostname)) {
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
 * Placeholder for a :::figma block during AST processing
 */
export interface FigmaBlockPlaceholder {
  id: string;
  link: FigmaSelectionLink;
}

/** Remark processor for parsing markdown content */
const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

/** Bullet markers for different nesting levels */
const BULLET_MARKERS = ["•", "◦", "▪", "–"];

/**
 * Extract plain text from a blockquote
 */
function extractBlockquoteText(blockquote: Blockquote): string {
  const parts: string[] = [];
  for (const child of blockquote.children) {
    if (child.type === "paragraph") {
      const para = child as Paragraph;
      const spans = extractSpans(para.children as PhrasingContent[]);
      parts.push(spansToText(spans));
    }
  }
  return parts.join("\n");
}

/**
 * Parse markdown string into text with TextSpan[] for rich formatting.
 * Preserves list formatting with bullet markers and handles inline styles.
 */
function parseMarkdownToSpans(markdown: string): {
  text: string;
  spans?: TextSpan[];
} {
  if (!markdown.trim()) return { text: "" };

  const tree = markdownProcessor.parse(markdown) as Root;
  const allSpans: TextSpan[] = [];
  let currentOffset = 0;

  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i];

    // Add paragraph separator for non-first blocks
    if (i > 0 && currentOffset > 0) {
      allSpans.push({ text: "\n\n" });
      currentOffset += 2;
    }

    switch (node.type) {
      case "paragraph": {
        const para = node as Paragraph;
        const spans = extractSpans(para.children as PhrasingContent[]);
        for (const span of spans) {
          allSpans.push(span);
          currentOffset += span.text.length;
        }
        break;
      }
      case "heading": {
        const heading = node as Heading;
        const spans = extractSpans(heading.children as PhrasingContent[]);
        for (const span of spans) {
          // Make heading text bold
          allSpans.push({ ...span, bold: true });
          currentOffset += span.text.length;
        }
        break;
      }
      case "list": {
        const list = node as List;
        const listSpans = formatListToSpans(list, 0);
        for (const span of listSpans) {
          allSpans.push(span);
          currentOffset += span.text.length;
        }
        break;
      }
      case "blockquote": {
        const blockquote = node as Blockquote;
        const text = extractBlockquoteText(blockquote);
        if (text.trim()) {
          allSpans.push({ text: `"${text.trim()}"`, italic: true });
          currentOffset += text.trim().length + 2;
        }
        break;
      }
      default:
        break;
    }
  }

  // Combine spans into text
  const text = allSpans.map((s) => s.text).join("");

  // Check if any spans have formatting
  const hasFormatting = allSpans.some(
    (s) => s.bold || s.italic || s.strike || s.code || s.href,
  );

  return {
    text,
    spans: hasFormatting ? allSpans : undefined,
  };
}

/**
 * Format a list to TextSpan[] with bullet markers and rich formatting
 */
function formatListToSpans(
  list: List,
  depth: number,
  startNum = 1,
): TextSpan[] {
  const spans: TextSpan[] = [];
  const marker = list.ordered
    ? null
    : BULLET_MARKERS[Math.min(depth, BULLET_MARKERS.length - 1)];
  const indent = "  ".repeat(depth);
  let num = startNum;
  let isFirstItem = true;

  for (const item of list.children) {
    const listItem = item as ListItem;
    const prefix = list.ordered ? `${num}.` : marker;

    for (const child of listItem.children) {
      if (child.type === "paragraph") {
        const para = child as Paragraph;
        const itemSpans = extractSpans(para.children as PhrasingContent[]);

        // Add newline before non-first items
        if (!isFirstItem) {
          spans.push({ text: "\n" });
        }
        isFirstItem = false;

        // Add indent and bullet marker
        spans.push({ text: `${indent}${prefix} ` });

        // Add formatted content
        for (const span of itemSpans) {
          spans.push(span);
        }
      } else if (child.type === "list") {
        // Nested list
        if (!isFirstItem) {
          spans.push({ text: "\n" });
        }
        isFirstItem = false;
        const nestedSpans = formatListToSpans(
          child as List,
          depth + 1,
          (child as List).start ?? 1,
        );
        spans.push(...nestedSpans);
      }
    }
    num++;
  }

  return spans;
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
 *
 * Or with bare URL (without link= prefix):
 * :::figma
 * https://www.figma.com/file/xxx?node-id=1234-5678
 * x=160
 * y=300
 * :::
 *
 * Extended format with rich content:
 * :::figma
 * link=https://www.figma.com/file/xxx?node-id=1234-5678
 * body=Use this for cart and confirmation flows.
 *
 * - Variation A
 * - Variation B
 *
 * ```js
 * // short code sample
 * ```
 * :::
 */
export function extractFigmaBlocks(markdown: string): {
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
      const lines = content.split("\n");
      const props: Record<string, string> = {};
      const contentLines: string[] = [];
      let inContentSection = false;
      let currentMultilineKey: string | null = null;
      let multilineValue: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Once we hit content section, collect remaining lines
        if (inContentSection) {
          contentLines.push(line);
          continue;
        }

        // Check if this is a continuation of multiline value (indented line)
        if (currentMultilineKey !== null) {
          // Check if line is indented (starts with spaces/tabs)
          if (line.match(/^[ \t]/) || trimmedLine === "") {
            // Continue multiline value - preserve relative indentation
            multilineValue.push(line.replace(/^[ \t]{1,2}/, "")); // Remove up to 2 spaces of indent
            continue;
          }
          // Not indented - end multiline value and process this line normally
          props[currentMultilineKey] = multilineValue.join("\n").trim();
          currentMultilineKey = null;
          multilineValue = [];
        }

        // Check for bare URL first (before checking for key=value)
        if (
          trimmedLine.startsWith("http://") ||
          trimmedLine.startsWith("https://")
        ) {
          // Support bare URL without link= prefix
          props.link = trimmedLine;
        } else if (trimmedLine === "") {
          // Allow blank lines between properties without ending prop parsing
        } else {
          const eqIndex = trimmedLine.indexOf("=");
          if (eqIndex > 0) {
            const key = trimmedLine.slice(0, eqIndex).trim();
            const value = trimmedLine.slice(eqIndex + 1).trim();

            // Check if this is a multiline property (text.* with empty or single-line value)
            if (key.startsWith("text.") && value === "") {
              // Start multiline mode
              currentMultilineKey = key;
              multilineValue = [];
            } else {
              props[key] = value;
            }
          } else {
            // Non-empty line without = is content
            inContentSection = true;
            contentLines.push(line);
          }
        }
      }

      // Finalize any remaining multiline value
      if (currentMultilineKey !== null) {
        props[currentMultilineKey] = multilineValue.join("\n").trim();
      }

      if (!props.link) {
        console.warn(
          "[figdeck] :::figma block missing 'link' property, skipping",
        );
        return "";
      }

      // Validate hostname before processing
      let hostname: string | null = null;
      try {
        hostname = new URL(props.link).hostname;
      } catch {
        console.warn(`[figdeck] Invalid URL format: ${props.link}`);
        return "";
      }

      if (!isValidFigmaHostname(hostname)) {
        console.warn(
          `[figdeck] Rejected Figma URL with invalid hostname "${hostname}": ${props.link}`,
        );
        return "";
      }

      const { fileKey, nodeId } = parseFigmaUrl(props.link);
      if (!fileKey) {
        console.warn(
          `[figdeck] Invalid Figma URL (missing fileKey): ${props.link}`,
        );
      }

      // Extract text.* properties for text layer overrides with rich formatting
      const textOverrides: Record<
        string,
        { text: string; spans?: TextSpan[] }
      > = {};
      for (const [key, value] of Object.entries(props)) {
        if (key.startsWith("text.") && value) {
          const layerName = key.slice(5); // Remove "text." prefix
          if (layerName) {
            // Parse markdown to get text with optional TextSpan[] for rich formatting
            const parsed = parseMarkdownToSpans(value);
            if (parsed.text) {
              textOverrides[layerName] = parsed;
            }
          }
        }
      }

      const link: FigmaSelectionLink = {
        url: props.link,
        fileKey,
        nodeId,
        x: props.x ? Number.parseFloat(props.x) : undefined,
        y: props.y ? Number.parseFloat(props.y) : undefined,
        textOverrides:
          Object.keys(textOverrides).length > 0 ? textOverrides : undefined,
        hideLink: props.hideLink === "true" ? true : undefined,
      };

      const id = `FIGDECK_FIGMA_BLOCK_${blockId++}_PLACEHOLDER`;
      figmaBlocks.push({ id, link });

      // Return a placeholder paragraph that we can identify after parsing
      return `\n${id}\n`;
    },
  );

  return { processedMarkdown, figmaBlocks };
}

/**
 * Check if a text matches a Figma block placeholder pattern
 * Returns the block index if matched, or null otherwise
 */
export function matchFigmaPlaceholder(text: string): number | null {
  const match = text.match(/^FIGDECK_FIGMA_BLOCK_(\d+)_PLACEHOLDER$/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return null;
}
