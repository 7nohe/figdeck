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
 * Check if a URL is valid for hyperlinks.
 * Note: Figma Plugin sandbox doesn't have the URL class, so we use regex.
 */
export function isValidHyperlinkUrl(url?: string): boolean {
  if (!url) return false;
  // Match http://, https://, mailto:, or tel: protocols
  return /^(https?:\/\/|mailto:|tel:)/i.test(url);
}

/**
 * Normalize a URL for use as a hyperlink.
 * - If the URL already has a valid protocol, return as-is.
 * - If the URL looks like a domain (contains a dot), prepend "https://".
 * - Returns undefined if the URL cannot be normalized.
 *
 * Note: Figma Plugin sandbox doesn't have the URL class, so we use regex.
 */
export function normalizeHyperlinkUrl(url?: string): string | undefined {
  if (!url) return undefined;

  // Already has a valid protocol
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
    return url;
  }

  // Try adding https:// for URLs that look like domains
  // e.g., "example.com", "www.example.com/path"
  // Validation rules:
  // - Must contain a dot (for domain separation)
  // - No spaces allowed
  // - Must start with alphanumeric character
  // - Domain part (before any path) must end with alphanumeric character
  // - Domain labels (dot-separated) must not start or end with hyphens (RFC 1035)
  if (url.includes(".") && !url.includes(" ") && /^[a-zA-Z0-9]/.test(url)) {
    const domainPart = url.split("/")[0];

    // Check domain ends with alphanumeric
    if (!/[a-zA-Z0-9]$/.test(domainPart)) {
      return undefined;
    }

    // Check each domain label doesn't start/end with hyphen or be empty
    const labels = domainPart.split(".");
    for (const label of labels) {
      if (
        label.length === 0 ||
        label.startsWith("-") ||
        label.endsWith("-")
      ) {
        return undefined;
      }
    }

    return `https://${url}`;
  }

  return undefined;
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
  const resolvedFont = font || DEFAULT_FONT;

  // Load required fonts before setting characters
  // We need regular, bold, italic, and bold-italic variants
  const fontsToLoad = [
    { family: resolvedFont.family, style: resolvedFont.regular },
    { family: resolvedFont.family, style: resolvedFont.bold },
    { family: resolvedFont.family, style: resolvedFont.italic },
    { family: resolvedFont.family, style: resolvedFont.boldItalic },
  ];

  for (const fontName of fontsToLoad) {
    try {
      await figma.loadFontAsync(fontName);
    } catch {
      // Fallback to Inter if font not available
      const interFallback = fontName.style.includes("Bold")
        ? fontName.style.includes("Italic")
          ? "Bold Italic"
          : "Bold"
        : fontName.style.includes("Italic")
          ? "Italic"
          : "Regular";
      try {
        await figma.loadFontAsync({ family: "Inter", style: interFallback });
      } catch {
        // Last resort: load Inter Regular
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      }
    }
  }

  textNode.characters = fullText;

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

    // Determine fill color and text decoration
    // Note: Figma only supports one decoration at a time (UNDERLINE or STRIKETHROUGH).
    // When both href and strike are present, strikethrough takes precedence since it's
    // an explicit formatting choice, but we still apply link color and hyperlink.
    let fill: Paint[];
    if (span.href) {
      // Apply link styling for valid URLs
      const normalizedUrl = normalizeHyperlinkUrl(span.href);
      if (normalizedUrl) {
        fill = [{ type: "SOLID", color: LINK_COLOR }];
        textNode.setRangeFills(start, end, fill);
        // Apply strikethrough if set, otherwise underline for links
        if (span.strike) {
          textNode.setRangeTextDecoration(start, end, "STRIKETHROUGH");
        } else {
          textNode.setRangeTextDecoration(start, end, "UNDERLINE");
        }
        // Try to set hyperlink (may fail in Figma Slides)
        safeSetRangeHyperlink(textNode, start, end, {
          type: "URL",
          value: normalizedUrl,
        });
      } else {
        // Invalid URL format - use default color, no underline
        console.warn(
          `[figdeck] Invalid URL format, skipping hyperlink: "${span.href}"`,
        );
        fill = baseFills || DEFAULT_TEXT_FILL;
        textNode.setRangeFills(start, end, fill);
        // Still apply strikethrough if set
        if (span.strike) {
          textNode.setRangeTextDecoration(start, end, "STRIKETHROUGH");
        }
      }
    } else if (span.superscript) {
      // Muted gray for footnote references
      fill = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
      textNode.setRangeFills(start, end, fill);
      if (span.strike) {
        textNode.setRangeTextDecoration(start, end, "STRIKETHROUGH");
      }
    } else if (baseFills) {
      textNode.setRangeFills(start, end, baseFills);
      if (span.strike) {
        textNode.setRangeTextDecoration(start, end, "STRIKETHROUGH");
      }
    } else {
      textNode.setRangeFills(start, end, DEFAULT_TEXT_FILL);
      if (span.strike) {
        textNode.setRangeTextDecoration(start, end, "STRIKETHROUGH");
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
