import { createDefaultTextFill } from "./colors";
import { INLINE_CODE_BG, LINK_COLOR } from "./constants";
import type { ResolvedFontName } from "./styles";
import type { TextSpan } from "./types";

const DEFAULT_TEXT_FILL = createDefaultTextFill();

/**
 * Default font config (Inter)
 */
const DEFAULT_FONT: ResolvedFontName = {
  family: "Inter",
  regular: "Regular",
  bold: "Bold",
  italic: "Italic",
  boldItalic: "Bold Italic",
};

/**
 * Get font name for a specific style variant
 */
function getFontForStyle(
  font: ResolvedFontName,
  bold: boolean,
  italic: boolean,
): FontName {
  let style: string;
  if (bold && italic) {
    style = font.boldItalic;
  } else if (bold) {
    style = font.bold;
  } else if (italic) {
    style = font.italic;
  } else {
    style = font.regular;
  }
  return { family: font.family, style };
}

/**
 * Check if a URL is valid for hyperlinks
 */
export function isValidHyperlinkUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Safely set hyperlink on a text node range
 */
export function safeSetRangeHyperlink(
  node: TextNode,
  start: number,
  end: number,
  target: HyperlinkTarget,
): boolean {
  try {
    node.setRangeHyperlink(start, end, target);
    return true;
  } catch (error) {
    console.warn("[figdeck] Failed to set hyperlink", error);
    return false;
  }
}

/**
 * Render TextSpan[] to a Figma text node with formatting
 * Returns the created text node
 */
export async function renderSpansToText(
  spans: TextSpan[],
  baseSize: number,
  baseFills?: Paint[],
  font?: ResolvedFontName,
): Promise<TextNode> {
  const textNode = figma.createText();
  const fullText = spans.map((s) => s.text).join("");
  textNode.characters = fullText;
  const resolvedFont = font || DEFAULT_FONT;

  let charIndex = 0;
  for (const span of spans) {
    if (span.text.length === 0) continue;

    const start = charIndex;
    const end = charIndex + span.text.length;

    // Determine font style and apply font name
    const fontName = getFontForStyle(
      resolvedFont,
      span.bold === true,
      span.italic === true,
    );
    textNode.setRangeFontName(start, end, fontName);

    // Set font size (smaller for superscript)
    const fontSize = span.superscript ? Math.round(baseSize * 0.7) : baseSize;
    textNode.setRangeFontSize(start, end, fontSize);

    // Determine fill color
    let fill: Paint[];
    if (span.href) {
      fill = [{ type: "SOLID", color: LINK_COLOR }];
    } else if (span.superscript) {
      // Muted gray for footnote references
      fill = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
    } else if (baseFills) {
      fill = baseFills;
    } else {
      fill = DEFAULT_TEXT_FILL;
    }
    textNode.setRangeFills(start, end, fill);

    // Strikethrough
    if (span.strike) {
      textNode.setRangeTextDecoration(start, end, "STRIKETHROUGH");
    }

    // Hyperlink (only if the URL is valid to avoid runtime errors)
    if (span.href && isValidHyperlinkUrl(span.href)) {
      const ok = safeSetRangeHyperlink(textNode, start, end, {
        type: "URL",
        value: span.href,
      });
      if (ok) {
        textNode.setRangeTextDecoration(start, end, "UNDERLINE");
      }
    }

    charIndex = end;
  }

  return textNode;
}

/**
 * Render inline code spans with monospace font look (using Inter with background)
 * Since Figma doesn't support per-character background, we use a wrapper frame approach
 */
export async function renderSpansWithInlineCode(
  spans: TextSpan[],
  baseSize: number,
  baseFills?: Paint[],
  x?: number,
  y?: number,
  font?: ResolvedFontName,
  codeFont?: ResolvedFontName,
): Promise<FrameNode | TextNode> {
  // Check if any spans have inline code
  const hasInlineCode = spans.some((s) => s.code);

  if (!hasInlineCode) {
    // Simple case: no inline code, just render text
    const textNode = await renderSpansToText(spans, baseSize, baseFills, font);
    if (x !== undefined) textNode.x = x;
    if (y !== undefined) textNode.y = y;
    return textNode;
  }

  // Complex case: has inline code, create a horizontal auto-layout frame
  const frame = figma.createFrame();
  frame.name = "Text with inline code";
  frame.layoutMode = "HORIZONTAL";
  frame.layoutWrap = "WRAP";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.itemSpacing = 0;
  frame.fills = [];
  if (x !== undefined) frame.x = x;
  if (y !== undefined) frame.y = y;

  // Group consecutive spans by whether they are code or not
  type SpanGroup = { isCode: boolean; spans: TextSpan[] };
  const groups: SpanGroup[] = [];

  for (const span of spans) {
    const isCode = span.code === true;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.isCode === isCode) {
      lastGroup.spans.push(span);
    } else {
      groups.push({ isCode, spans: [span] });
    }
  }

  for (const group of groups) {
    if (group.isCode) {
      // Create inline code box
      const codeFrame = figma.createFrame();
      codeFrame.name = "inline-code";
      codeFrame.fills = [{ type: "SOLID", color: INLINE_CODE_BG }];
      codeFrame.cornerRadius = 4;
      codeFrame.paddingLeft = 4;
      codeFrame.paddingRight = 4;
      codeFrame.paddingTop = 2;
      codeFrame.paddingBottom = 2;
      codeFrame.layoutMode = "HORIZONTAL";
      codeFrame.primaryAxisSizingMode = "AUTO";
      codeFrame.counterAxisSizingMode = "AUTO";

      // Render code text (slightly smaller) with code font
      const codeTextNode = await renderSpansToText(
        group.spans,
        baseSize * 0.9,
        baseFills,
        codeFont,
      );
      codeFrame.appendChild(codeTextNode);
      frame.appendChild(codeFrame);
    } else {
      // Render normal text group
      const textNode = await renderSpansToText(
        group.spans,
        baseSize,
        baseFills,
        font,
      );
      frame.appendChild(textNode);
    }
  }

  return frame;
}
