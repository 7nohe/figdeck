import type { CalloutType, TextSpan } from "@figdeck/shared";
import type {
  Root as MdastRoot,
  Paragraph,
  PhrasingContent,
  Text,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { extractSpans } from "./spans.js";

/**
 * Placeholder for a :::note/tip/warning/caution block during AST processing
 */
export interface CalloutBlockPlaceholder {
  id: string;
  type: CalloutType;
  content: string;
  spans: TextSpan[];
}

/**
 * Valid callout types
 */
const CALLOUT_TYPES: CalloutType[] = ["note", "tip", "warning", "caution"];

/**
 * Check if a string is a valid callout type
 */
function isCalloutType(type: string): type is CalloutType {
  return CALLOUT_TYPES.includes(type as CalloutType);
}

/**
 * Parse content to extract spans with inline formatting
 */
function parseContentSpans(content: string): TextSpan[] {
  if (!content.trim()) {
    return [];
  }

  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(content) as MdastRoot;

  // Collect all inline content from paragraphs
  const spans: TextSpan[] = [];

  for (const node of tree.children) {
    if (node.type === "paragraph") {
      const para = node as Paragraph;
      const paraSpans = extractSpans(para.children as PhrasingContent[]);
      if (spans.length > 0 && paraSpans.length > 0) {
        // Add space between paragraphs
        spans.push({ text: " " });
      }
      spans.push(...paraSpans);
    } else if (node.type === "text") {
      spans.push({ text: (node as Text).value });
    }
  }

  return spans;
}

/**
 * Extract :::note/tip/warning/caution blocks from markdown text and return the modified text
 * with placeholders that can be replaced after AST parsing.
 *
 * Block format:
 * :::note
 * This is a note with **bold** and *italic* text.
 * :::
 *
 * :::tip
 * A helpful tip for users.
 * :::
 *
 * :::warning
 * Be careful with this feature.
 * :::
 *
 * :::caution
 * This action is irreversible.
 * :::
 */
export function extractCalloutBlocks(
  markdown: string,
  options: { startIndex?: number } = {},
): {
  processedMarkdown: string;
  calloutBlocks: CalloutBlockPlaceholder[];
} {
  const calloutBlocks: CalloutBlockPlaceholder[] = [];
  let nextIndex = options.startIndex ?? 0;

  // Match :::note/tip/warning/caution ... ::: blocks
  // The pattern matches the opening directive, captures the type and content, and matches the closing :::
  const calloutBlockRegex =
    /^:::(note|tip|warning|caution)\s*\n([\s\S]*?)\n:::\s*$/gm;

  const processedMarkdown = markdown.replace(
    calloutBlockRegex,
    (_match, typeStr: string, content: string) => {
      const type = typeStr.toLowerCase();

      if (!isCalloutType(type)) {
        // Should not happen due to regex, but safety check
        console.warn(`[figdeck] Unknown callout type: ${type}, skipping`);
        return _match;
      }

      const trimmedContent = content.trim();
      const spans = parseContentSpans(trimmedContent);

      const id = `FIGDECK_CALLOUT_BLOCK_${nextIndex++}_PLACEHOLDER`;
      calloutBlocks.push({
        id,
        type,
        content: trimmedContent,
        spans,
      });

      // Return a placeholder paragraph that we can identify after parsing
      return `\n${id}\n`;
    },
  );

  return { processedMarkdown, calloutBlocks };
}

/**
 * Check if a text matches a callout block placeholder pattern
 * Returns the block index if matched, or null otherwise
 */
export function matchCalloutPlaceholder(text: string): number | null {
  const match = text.match(/^FIGDECK_CALLOUT_BLOCK_(\d+)_PLACEHOLDER$/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return null;
}
