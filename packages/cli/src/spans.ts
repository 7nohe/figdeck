import type {
  Blockquote,
  Content,
  Delete,
  Emphasis,
  InlineCode,
  Link,
  List,
  Paragraph,
  PhrasingContent,
  Strong,
  TableCell,
  TableRow,
  Text,
} from "mdast";
import type { TextSpan } from "./types.js";

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
 * Extract plain text from a mdast Content node
 */
export function extractText(node: Content): string {
  if (node.type === "text") {
    return node.value;
  }
  if ("children" in node) {
    return (node.children as Content[]).map(extractText).join("");
  }
  return "";
}

/**
 * Extract inline formatting from mdast phrasing content into TextSpan[]
 * Handles: text, strong, emphasis, delete (strikethrough), inlineCode, link
 */
export function extractSpans(
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
      case "footnoteReference": {
        // Display footnote reference as superscript-style [id]
        // Using smaller text to simulate superscript (Figma doesn't support actual superscript)
        const refNode = node as { identifier: string };
        const span: TextSpan = {
          text: `[${refNode.identifier}]`,
          superscript: true,
        };
        if (marks.bold) span.bold = true;
        if (marks.italic) span.italic = true;
        if (marks.strike) span.strike = true;
        if (marks.href) span.href = marks.href;
        spans.push(span);
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
export function spansToText(spans: TextSpan[]): string {
  return spans.map((s) => s.text).join("");
}

/**
 * Extract list items with their TextSpan[] for rich formatting
 */
export function extractListItemSpans(list: List): {
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
export function extractTableRow(row: TableRow): TextSpan[][] {
  return row.children.map((cell: TableCell) => {
    return extractSpans(cell.children as PhrasingContent[]);
  });
}

/**
 * Extract blockquote content (flatten child paragraphs)
 */
export function extractBlockquoteContent(blockquote: Blockquote): {
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
