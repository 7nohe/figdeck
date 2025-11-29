import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import type {
  FigmaSelectionLink,
  SlideBackground,
  SlideContent,
  SlideNumberConfig,
  SlideNumberPosition,
  TableAlignment,
  TextSpan,
  TextStyle,
} from "./types";

// Default font sizes
const DEFAULT_H1_SIZE = 64;
const DEFAULT_H2_SIZE = 48;
const DEFAULT_H3_SIZE = 36;
const DEFAULT_H4_SIZE = 28;
const DEFAULT_PARAGRAPH_SIZE = 24;
const DEFAULT_BULLET_SIZE = 24;
const DEFAULT_CODE_SIZE = 16;

// Default colors
const DEFAULT_TEXT_COLOR = "#000000";
const DEFAULT_TEXT_FILL: Paint[] = (() => {
  const parsed = parseColor(DEFAULT_TEXT_COLOR);
  const rgb: RGB = parsed
    ? { r: parsed.r, g: parsed.g, b: parsed.b }
    : { r: 0, g: 0, b: 0 };
  return [{ type: "SOLID", color: rgb }];
})();

function isValidHyperlinkUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function safeSetRangeHyperlink(
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

// Register languages
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);

// Language aliases
const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
};

// Theme colors (VS Code dark theme inspired)
const THEME_COLORS: Record<string, RGB> = {
  keyword: { r: 0.78, g: 0.47, b: 0.81 }, // Purple #c678dd
  string: { r: 0.6, g: 0.76, b: 0.45 }, // Green #98c379
  number: { r: 0.82, g: 0.68, b: 0.47 }, // Orange #d19a66
  comment: { r: 0.45, g: 0.5, b: 0.55 }, // Gray #737d8c
  function: { r: 0.38, g: 0.68, b: 0.93 }, // Blue #61afef
  variable: { r: 0.88, g: 0.53, b: 0.49 }, // Red #e06c75
  type: { r: 0.9, g: 0.78, b: 0.48 }, // Yellow #e5c07b
  punctuation: { r: 0.67, g: 0.7, b: 0.75 }, // Light gray #abb2bf
  default: { r: 0.67, g: 0.7, b: 0.75 }, // Light gray #abb2bf
};

// Map hljs class names to theme colors
function getColorForClass(className: string): RGB {
  if (className.includes("keyword") || className.includes("built_in")) {
    return THEME_COLORS.keyword;
  }
  if (className.includes("string") || className.includes("regexp")) {
    return THEME_COLORS.string;
  }
  if (className.includes("number") || className.includes("literal")) {
    return THEME_COLORS.number;
  }
  if (className.includes("comment")) {
    return THEME_COLORS.comment;
  }
  if (className.includes("function") || className.includes("title")) {
    return THEME_COLORS.function;
  }
  if (className.includes("variable") || className.includes("attr")) {
    return THEME_COLORS.variable;
  }
  if (className.includes("type") || className.includes("class")) {
    return THEME_COLORS.type;
  }
  if (className.includes("punctuation") || className.includes("operator")) {
    return THEME_COLORS.punctuation;
  }
  return THEME_COLORS.default;
}

interface HighlightSegment {
  text: string;
  color: RGB;
}

// Parse highlighted HTML to extract text segments with colors
function parseHighlightedCode(html: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let currentText = "";
  let currentColor = THEME_COLORS.default;
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      // Flush current text
      if (currentText) {
        segments.push({ text: currentText, color: currentColor });
        currentText = "";
      }

      // Find the end of the tag
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;

      const tag = html.slice(i, tagEnd + 1);

      if (tag.startsWith("<span")) {
        // Extract class name
        const classMatch = tag.match(/class="([^"]+)"/);
        if (classMatch) {
          currentColor = getColorForClass(classMatch[1]);
        }
      } else if (tag === "</span>") {
        currentColor = THEME_COLORS.default;
      }

      i = tagEnd + 1;
    } else if (html[i] === "&") {
      // Handle HTML entities
      const entityEnd = html.indexOf(";", i);
      if (entityEnd !== -1) {
        const entity = html.slice(i, entityEnd + 1);
        if (entity === "&lt;") currentText += "<";
        else if (entity === "&gt;") currentText += ">";
        else if (entity === "&amp;") currentText += "&";
        else if (entity === "&quot;") currentText += '"';
        else if (entity === "&#x27;") currentText += "'";
        else currentText += entity;
        i = entityEnd + 1;
      } else {
        currentText += html[i];
        i++;
      }
    } else {
      currentText += html[i];
      i++;
    }
  }

  // Flush remaining text
  if (currentText) {
    segments.push({ text: currentText, color: currentColor });
  }

  return segments;
}

const PLUGIN_DATA_KEY = "figdeck-index";

figma.showUI(__html__, { visible: true, width: 320, height: 420 });

async function loadFont() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Italic" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold Italic" });
}

// Link color
const LINK_COLOR: RGB = { r: 0.23, g: 0.52, b: 0.93 }; // #3b82f5

// Inline code background
const INLINE_CODE_BG: RGB = { r: 0.94, g: 0.94, b: 0.94 }; // #f0f0f0

/**
 * Render TextSpan[] to a Figma text node with formatting
 * Returns the created text node
 */
async function renderSpansToText(
  spans: TextSpan[],
  baseSize: number,
  baseFills?: Paint[],
): Promise<TextNode> {
  const textNode = figma.createText();
  const fullText = spans.map((s) => s.text).join("");
  textNode.characters = fullText;

  let charIndex = 0;
  for (const span of spans) {
    if (span.text.length === 0) continue;

    const start = charIndex;
    const end = charIndex + span.text.length;

    // Determine font style
    let fontStyle: "Regular" | "Bold" | "Italic" | "Bold Italic" = "Regular";
    if (span.bold && span.italic) {
      fontStyle = "Bold Italic";
    } else if (span.bold) {
      fontStyle = "Bold";
    } else if (span.italic) {
      fontStyle = "Italic";
    }
    textNode.setRangeFontName(start, end, {
      family: "Inter",
      style: fontStyle,
    });

    // Set font size
    textNode.setRangeFontSize(start, end, baseSize);

    // Determine fill color
    let fill: Paint[];
    if (span.href) {
      fill = [{ type: "SOLID", color: LINK_COLOR }];
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
async function renderSpansWithInlineCode(
  spans: TextSpan[],
  baseSize: number,
  baseFills?: Paint[],
  x?: number,
  y?: number,
): Promise<FrameNode | TextNode> {
  // Check if any spans have inline code
  const hasInlineCode = spans.some((s) => s.code);

  if (!hasInlineCode) {
    // Simple case: no inline code, just render text
    const textNode = await renderSpansToText(spans, baseSize, baseFills);
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

      // Render code text (slightly smaller)
      const codeTextNode = await renderSpansToText(
        group.spans,
        baseSize * 0.9,
        baseFills,
      );
      codeFrame.appendChild(codeTextNode);
      frame.appendChild(codeFrame);
    } else {
      // Render normal text group
      const textNode = await renderSpansToText(
        group.spans,
        baseSize,
        baseFills,
      );
      frame.appendChild(textNode);
    }
  }

  return frame;
}

/**
 * Render a blockquote block with left border and indentation
 */
async function renderBlockquote(
  spans: TextSpan[],
  baseSize: number,
  baseFills?: Paint[],
  x?: number,
  y?: number,
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = "Blockquote";
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.itemSpacing = 12;
  frame.fills = [];
  if (x !== undefined) frame.x = x;
  if (y !== undefined) frame.y = y;

  // Left border line
  const border = figma.createRectangle();
  border.name = "border";
  border.resize(4, 100); // height will be adjusted
  border.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }];
  border.cornerRadius = 2;
  frame.appendChild(border);

  // Quote content (slightly muted color)
  const quoteFills: Paint[] = baseFills || [
    { type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } },
  ];
  const textNode = await renderSpansWithInlineCode(
    spans,
    baseSize * 0.95,
    quoteFills,
  );
  frame.appendChild(textNode);

  // Adjust border height to match content
  border.resize(4, textNode.height);

  return frame;
}

/**
 * Render an image block (placeholder with alt text since Figma plugin can't load remote images directly)
 */
function renderImagePlaceholder(
  url: string,
  alt?: string,
  x?: number,
  y?: number,
): FrameNode {
  const frame = figma.createFrame();
  frame.name = alt || "Image";
  frame.resize(400, 250);
  frame.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
  frame.cornerRadius = 8;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";
  frame.itemSpacing = 8;
  if (x !== undefined) frame.x = x;
  if (y !== undefined) frame.y = y;

  // Image icon placeholder
  const icon = figma.createText();
  icon.fontName = { family: "Inter", style: "Regular" };
  icon.fontSize = 48;
  icon.characters = "🖼️";
  icon.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  frame.appendChild(icon);

  // Alt text or URL
  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Regular" };
  label.fontSize = 14;
  label.characters = alt || url;
  label.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  label.textAlignHorizontal = "CENTER";
  frame.appendChild(label);

  return frame;
}

// Figma link card colors
const FIGMA_CARD_BG: RGB = { r: 0.96, g: 0.96, b: 0.98 };
const FIGMA_CARD_BORDER: RGB = { r: 0.85, g: 0.85, b: 0.9 };
const FIGMA_BRAND_COLOR: RGB = { r: 0.64, g: 0.33, b: 0.97 }; // Figma purple

// Max size for cloned node preview
const MAX_PREVIEW_WIDTH = 400;
const MAX_PREVIEW_HEIGHT = 300;

/**
 * Render a Figma selection link
 * If the node exists in the same file, clone it as a preview
 * Otherwise, show a card with a link
 */
async function renderFigmaLink(
  link: FigmaSelectionLink,
  x?: number,
  y?: number,
): Promise<FrameNode> {
  const currentFileKey = figma.fileKey;
  // Consider same file if: fileKeys match, OR both are undefined, OR link has no fileKey
  const isSameFile =
    !link.fileKey || !currentFileKey || link.fileKey === currentFileKey;

  // Try to find and clone the node if it could be in the same file
  if (link.nodeId && isSameFile) {
    try {
      const targetNode = await figma.getNodeByIdAsync(link.nodeId);

      if (targetNode && "clone" in targetNode) {
        // Clone the node for preview
        const clonedNode = (targetNode as SceneNode).clone();

        // Frame to hold the cloned preview
        const previewFrame = figma.createFrame();
        previewFrame.name = `Figma Link Preview: ${targetNode.name}`;
        previewFrame.fills = [];
        previewFrame.clipsContent = true;

        // Scale down if the node is too large
        let scale = 1;
        if ("width" in clonedNode && "height" in clonedNode) {
          const nodeWidth = clonedNode.width;
          const nodeHeight = clonedNode.height;

          if (
            nodeWidth > MAX_PREVIEW_WIDTH ||
            nodeHeight > MAX_PREVIEW_HEIGHT
          ) {
            const scaleX = MAX_PREVIEW_WIDTH / nodeWidth;
            const scaleY = MAX_PREVIEW_HEIGHT / nodeHeight;
            scale = Math.min(scaleX, scaleY);
          }
        }

        // Apply scale if needed
        if (scale < 1 && "rescale" in clonedNode) {
          (
            clonedNode as SceneNode & { rescale: (scale: number) => void }
          ).rescale(scale);
        } else if (scale < 1 && "resize" in clonedNode) {
          const scaledWidth = (clonedNode as FrameNode).width * scale;
          const scaledHeight = (clonedNode as FrameNode).height * scale;
          (clonedNode as FrameNode).resize(scaledWidth, scaledHeight);
        }

        // Set preview frame size to match cloned node
        if ("width" in clonedNode && "height" in clonedNode) {
          previewFrame.resize(clonedNode.width, clonedNode.height);
        }

        // Position the cloned node at origin within preview frame
        clonedNode.x = 0;
        clonedNode.y = 0;
        previewFrame.appendChild(clonedNode);

        // Add a clickable label that jumps to the original node
        const linkLabel = figma.createText();
        linkLabel.fontName = { family: "Inter", style: "Regular" };
        linkLabel.fontSize = 14;
        linkLabel.characters = `Open ${targetNode.name}`;
        linkLabel.fills = [{ type: "SOLID", color: FIGMA_BRAND_COLOR }];
        const setNodeLink = safeSetRangeHyperlink(
          linkLabel,
          0,
          linkLabel.characters.length,
          {
            type: "NODE",
            value: targetNode.id,
          },
        );
        if (setNodeLink) {
          linkLabel.setRangeTextDecoration(
            0,
            linkLabel.characters.length,
            "UNDERLINE",
          );
        }

        // Wrap preview and label together
        const wrapper = figma.createFrame();
        wrapper.name = `Figma Link: ${targetNode.name}`;
        wrapper.layoutMode = "VERTICAL";
        wrapper.primaryAxisSizingMode = "AUTO";
        wrapper.counterAxisSizingMode = "AUTO";
        wrapper.itemSpacing = 8;
        wrapper.fills = [];
        wrapper.appendChild(previewFrame);
        wrapper.appendChild(linkLabel);

        // Position the wrapper
        if (x !== undefined) wrapper.x = x;
        if (y !== undefined) wrapper.y = y;

        return wrapper;
      }
    } catch {
      // Failed to get node, fall through to fallback
    }
  }

  // Fallback: show a card with link
  const frame = figma.createFrame();
  frame.name = "Figma Link";
  frame.resize(320, 56);
  frame.fills = [{ type: "SOLID", color: FIGMA_CARD_BG }];
  frame.strokes = [{ type: "SOLID", color: FIGMA_CARD_BORDER }];
  frame.strokeWeight = 1;
  frame.cornerRadius = 8;
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";
  frame.paddingLeft = 16;
  frame.paddingRight = 16;
  frame.paddingTop = 12;
  frame.paddingBottom = 12;
  frame.itemSpacing = 12;
  if (x !== undefined) frame.x = x;
  if (y !== undefined) frame.y = y;

  // Figma icon
  const icon = figma.createText();
  icon.fontName = { family: "Inter", style: "Bold" };
  icon.fontSize = 20;
  icon.characters = "◈";
  icon.fills = [{ type: "SOLID", color: FIGMA_BRAND_COLOR }];
  frame.appendChild(icon);

  // Label text container
  const textContainer = figma.createFrame();
  textContainer.name = "Text Container";
  textContainer.layoutMode = "VERTICAL";
  textContainer.primaryAxisSizingMode = "AUTO";
  textContainer.counterAxisSizingMode = "AUTO";
  textContainer.itemSpacing = 2;
  textContainer.fills = [];

  // Node ID or URL as label
  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Regular" };
  label.fontSize = 14;

  if (link.nodeId && isSameFile) {
    // Node not found in same file
    label.characters = `Node: ${link.nodeId} (not found)`;
    label.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.2, b: 0.2 } }];
    if (isValidHyperlinkUrl(link.url)) {
      const ok = safeSetRangeHyperlink(label, 0, label.characters.length, {
        type: "URL",
        value: link.url,
      });
      if (ok) {
        label.setRangeTextDecoration(0, label.characters.length, "UNDERLINE");
      }
    }
    figma.notify(`Node ${link.nodeId} not found in current file`, {
      error: true,
    });
  } else {
    // Different file or no nodeId: use URL hyperlink
    const displayText = link.nodeId
      ? `Node: ${link.nodeId} (external)`
      : "Open in Figma";
    label.characters = displayText;
    label.fills = [{ type: "SOLID", color: FIGMA_BRAND_COLOR }];
    if (isValidHyperlinkUrl(link.url)) {
      const ok = safeSetRangeHyperlink(label, 0, label.characters.length, {
        type: "URL",
        value: link.url,
      });
      if (ok) {
        label.setRangeTextDecoration(0, label.characters.length, "UNDERLINE");
      }
    }
  }

  textContainer.appendChild(label);
  frame.appendChild(textContainer);

  return frame;
}

/**
 * Render a table block
 */
async function renderTable(
  headers: TextSpan[][],
  rows: TextSpan[][][],
  align: TableAlignment[],
  baseSize: number,
  baseFills?: Paint[],
  x?: number,
  y?: number,
): Promise<FrameNode> {
  const cellPadding = 12;
  const borderWidth = 1;
  const borderColor: RGB = { r: 0.85, g: 0.85, b: 0.85 };
  const headerBg: RGB = { r: 0.96, g: 0.96, b: 0.96 };

  const tableFrame = figma.createFrame();
  tableFrame.name = "Table";
  tableFrame.layoutMode = "VERTICAL";
  tableFrame.primaryAxisSizingMode = "AUTO";
  tableFrame.counterAxisSizingMode = "AUTO";
  tableFrame.itemSpacing = 0;
  tableFrame.fills = [];
  tableFrame.strokes = [{ type: "SOLID", color: borderColor }];
  tableFrame.strokeWeight = borderWidth;
  tableFrame.cornerRadius = 4;
  tableFrame.clipsContent = true;
  if (x !== undefined) tableFrame.x = x;
  if (y !== undefined) tableFrame.y = y;

  const getAlignment = (index: number): "LEFT" | "CENTER" | "RIGHT" => {
    const a = align[index];
    if (a === "center") return "CENTER";
    if (a === "right") return "RIGHT";
    return "LEFT";
  };

  // Render header row
  if (headers.length > 0) {
    const headerRow = figma.createFrame();
    headerRow.name = "Header Row";
    headerRow.layoutMode = "HORIZONTAL";
    headerRow.primaryAxisSizingMode = "AUTO";
    headerRow.counterAxisSizingMode = "AUTO";
    headerRow.itemSpacing = 0;
    headerRow.fills = [{ type: "SOLID", color: headerBg }];

    for (let i = 0; i < headers.length; i++) {
      const cell = figma.createFrame();
      cell.name = `Header ${i}`;
      cell.layoutMode = "HORIZONTAL";
      cell.primaryAxisSizingMode = "AUTO";
      cell.counterAxisSizingMode = "AUTO";
      cell.paddingLeft = cellPadding;
      cell.paddingRight = cellPadding;
      cell.paddingTop = cellPadding;
      cell.paddingBottom = cellPadding;
      cell.fills = [];
      if (i > 0) {
        cell.strokes = [{ type: "SOLID", color: borderColor }];
        cell.strokeWeight = borderWidth;
        cell.strokeAlign = "INSIDE";
        cell.strokeLeftWeight = borderWidth;
        cell.strokeRightWeight = 0;
        cell.strokeTopWeight = 0;
        cell.strokeBottomWeight = 0;
      }

      const textNode = await renderSpansToText(headers[i], baseSize, baseFills);
      textNode.fontName = { family: "Inter", style: "Bold" };
      textNode.textAlignHorizontal = getAlignment(i);
      cell.appendChild(textNode);
      headerRow.appendChild(cell);
    }

    tableFrame.appendChild(headerRow);
  }

  // Render body rows
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowFrame = figma.createFrame();
    rowFrame.name = `Row ${rowIdx}`;
    rowFrame.layoutMode = "HORIZONTAL";
    rowFrame.primaryAxisSizingMode = "AUTO";
    rowFrame.counterAxisSizingMode = "AUTO";
    rowFrame.itemSpacing = 0;
    rowFrame.fills = [];
    rowFrame.strokes = [{ type: "SOLID", color: borderColor }];
    rowFrame.strokeWeight = borderWidth;
    rowFrame.strokeAlign = "INSIDE";
    rowFrame.strokeTopWeight = borderWidth;
    rowFrame.strokeBottomWeight = 0;
    rowFrame.strokeLeftWeight = 0;
    rowFrame.strokeRightWeight = 0;

    for (let i = 0; i < row.length; i++) {
      const cell = figma.createFrame();
      cell.name = `Cell ${rowIdx}-${i}`;
      cell.layoutMode = "HORIZONTAL";
      cell.primaryAxisSizingMode = "AUTO";
      cell.counterAxisSizingMode = "AUTO";
      cell.paddingLeft = cellPadding;
      cell.paddingRight = cellPadding;
      cell.paddingTop = cellPadding;
      cell.paddingBottom = cellPadding;
      cell.fills = [];
      if (i > 0) {
        cell.strokes = [{ type: "SOLID", color: borderColor }];
        cell.strokeWeight = borderWidth;
        cell.strokeAlign = "INSIDE";
        cell.strokeLeftWeight = borderWidth;
        cell.strokeRightWeight = 0;
        cell.strokeTopWeight = 0;
        cell.strokeBottomWeight = 0;
      }

      const textNode = await renderSpansToText(row[i], baseSize, baseFills);
      textNode.textAlignHorizontal = getAlignment(i);
      cell.appendChild(textNode);
      rowFrame.appendChild(cell);
    }

    tableFrame.appendChild(rowFrame);
  }

  return tableFrame;
}

/**
 * Parse a color string (hex or rgba) to Figma RGB/RGBA
 */
function parseColor(
  color: string,
): { r: number; g: number; b: number; a?: number } | null {
  color = color.trim();

  // Handle hex colors (#rgb or #rrggbb)
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
      const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
      const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
      return { r, g, b };
    }
  }

  // Handle rgba(r,g,b,a)
  const rgbaMatch = color.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i,
  );
  if (rgbaMatch) {
    return {
      r: Number.parseInt(rgbaMatch[1], 10) / 255,
      g: Number.parseInt(rgbaMatch[2], 10) / 255,
      b: Number.parseInt(rgbaMatch[3], 10) / 255,
      a: Number.parseFloat(rgbaMatch[4]),
    };
  }

  // Handle rgb(r,g,b)
  const rgbMatch = color.match(
    /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
  );
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1], 10) / 255,
      g: Number.parseInt(rgbMatch[2], 10) / 255,
      b: Number.parseInt(rgbMatch[3], 10) / 255,
    };
  }

  return null;
}

/**
 * Create a rotation matrix for gradient angle (in degrees)
 * Figma gradients use a 2x3 transform matrix
 */
function createGradientTransform(angleDegrees: number): Transform {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);

  // Center the rotation at (0.5, 0.5) and apply rotation
  return [
    [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
    [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos],
  ];
}

/**
 * Apply background fill to a slide node
 */
async function applyBackground(
  slideNode: SlideNode,
  background: SlideBackground,
): Promise<void> {
  // Priority: templateStyle > gradient > solid
  if (background.templateStyle) {
    // Try to find local paint style first
    const localStyles = await figma.getLocalPaintStylesAsync();
    const localStyle = localStyles.find(
      (s) => s.name === background.templateStyle,
    );

    if (localStyle) {
      slideNode.fillStyleId = localStyle.id;
      return;
    }

    // Try to import by key (for team library styles)
    try {
      const importedStyle = await figma.importStyleByKeyAsync(
        background.templateStyle,
      );
      if (importedStyle && importedStyle.type === "PAINT") {
        slideNode.fillStyleId = importedStyle.id;
        return;
      }
    } catch (_e) {
      // Style not found, fall through to notify
    }

    figma.notify(`Paint style "${background.templateStyle}" not found`, {
      error: true,
    });
    return;
  }

  if (background.gradient) {
    const { stops, angle = 0 } = background.gradient;
    const gradientStops: ColorStop[] = [];

    for (const stop of stops) {
      const color = parseColor(stop.color);
      if (color) {
        gradientStops.push({
          position: stop.position,
          color: { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 },
        });
      }
    }

    if (gradientStops.length >= 2) {
      const gradientFill: GradientPaint = {
        type: "GRADIENT_LINEAR",
        gradientTransform: createGradientTransform(angle),
        gradientStops,
      };
      slideNode.fills = [gradientFill];
    }
    return;
  }

  if (background.solid) {
    const color = parseColor(background.solid);
    if (color) {
      const solidFill: SolidPaint = {
        type: "SOLID",
        color: { r: color.r, g: color.g, b: color.b },
        opacity: color.a ?? 1,
      };
      slideNode.fills = [solidFill];
    } else {
      figma.notify(`Invalid color "${background.solid}"`, { error: true });
    }
  }
}

// Slide number defaults
const DEFAULT_SLIDE_NUMBER_SIZE = 14;
const DEFAULT_SLIDE_NUMBER_POSITION: SlideNumberPosition = "bottom-right";
const DEFAULT_SLIDE_NUMBER_PADDING_X = 32;
const DEFAULT_SLIDE_NUMBER_PADDING_Y = 24;
const DEFAULT_SLIDE_NUMBER_FORMAT = "{{current}} / {{total}}";
const SLIDE_NUMBER_NODE_NAME = "figdeck-slide-number";

/**
 * Format slide number text using template
 */
function formatSlideNumber(
  format: string,
  current: number,
  total: number,
): string {
  return format
    .replace("{{current}}", String(current))
    .replace("{{total}}", String(total));
}

/**
 * Render slide number footer on a slide
 */
async function renderSlideNumber(
  slideNode: SlideNode,
  config: SlideNumberConfig,
  current: number,
  total: number,
): Promise<void> {
  // Remove existing slide number if present
  for (const child of slideNode.children) {
    if (child.name === SLIDE_NUMBER_NODE_NAME) {
      child.remove();
      break;
    }
  }

  // Check if we should show the slide number
  if (config.show === false) {
    return;
  }

  const size = config.size ?? DEFAULT_SLIDE_NUMBER_SIZE;
  const position = config.position ?? DEFAULT_SLIDE_NUMBER_POSITION;
  const paddingX = config.paddingX ?? DEFAULT_SLIDE_NUMBER_PADDING_X;
  const paddingY = config.paddingY ?? DEFAULT_SLIDE_NUMBER_PADDING_Y;
  const format = config.format ?? DEFAULT_SLIDE_NUMBER_FORMAT;

  const text = formatSlideNumber(format, current, total);

  const textNode = figma.createText();
  textNode.name = SLIDE_NUMBER_NODE_NAME;
  textNode.fontName = { family: "Inter", style: "Regular" };
  textNode.fontSize = size;
  textNode.characters = text;

  // Set color
  if (config.color) {
    const color = parseColor(config.color);
    if (color) {
      textNode.fills = [
        {
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a !== undefined ? color.a : 1,
        },
      ];
    }
  } else {
    // Default: semi-transparent gray
    textNode.fills = [
      {
        type: "SOLID",
        color: { r: 0.5, g: 0.5, b: 0.5 },
        opacity: 0.8,
      },
    ];
  }

  // Get slide dimensions
  const slideWidth = slideNode.width;
  const slideHeight = slideNode.height;
  const textWidth = textNode.width;
  const textHeight = textNode.height;

  // Calculate position
  let x: number;
  let y: number;

  switch (position) {
    case "bottom-right":
      x = slideWidth - paddingX - textWidth;
      y = slideHeight - paddingY - textHeight;
      break;
    case "bottom-left":
      x = paddingX;
      y = slideHeight - paddingY - textHeight;
      break;
    case "top-right":
      x = slideWidth - paddingX - textWidth;
      y = paddingY;
      break;
    case "top-left":
      x = paddingX;
      y = paddingY;
      break;
    default:
      x = slideWidth - paddingX - textWidth;
      y = slideHeight - paddingY - textHeight;
  }

  textNode.x = x;
  textNode.y = y;

  slideNode.appendChild(textNode);
}

function clearSlideContent(slideNode: SlideNode) {
  for (const child of [...slideNode.children]) {
    child.remove();
  }
}

async function fillSlide(slideNode: SlideNode, slide: SlideContent) {
  let yOffset = 100;

  // Helper to create fill from TextStyle color
  const createFill = (style: TextStyle | undefined): Paint[] | undefined => {
    if (!style?.color) return undefined;
    const color = parseColor(style.color);
    if (color) {
      return [
        {
          type: "SOLID" as const,
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a !== undefined ? color.a : 1,
        },
      ];
    }
    return undefined;
  };

  // Get styles for each element type
  const styles = slide.styles ?? {};
  const h1Style = styles.headings?.h1;
  const h2Style = styles.headings?.h2;
  const h3Style = styles.headings?.h3;
  const h4Style = styles.headings?.h4;
  const paragraphStyle = styles.paragraphs;
  const bulletStyle = styles.bullets;
  const codeStyle = styles.code;

  const renderCodeBlock = (codeBlock: { language?: string; code: string }) => {
    const codeFrame = figma.createFrame();
    codeFrame.name = codeBlock.language
      ? `Code (${codeBlock.language})`
      : "Code";
    codeFrame.fills = [{ type: "SOLID", color: { r: 0.13, g: 0.13, b: 0.13 } }];
    codeFrame.cornerRadius = 8;
    codeFrame.paddingLeft = 20;
    codeFrame.paddingRight = 20;
    codeFrame.paddingTop = 16;
    codeFrame.paddingBottom = 16;
    codeFrame.layoutMode = "VERTICAL";
    codeFrame.primaryAxisSizingMode = "AUTO";
    codeFrame.counterAxisSizingMode = "AUTO";

    const codeText = figma.createText();
    codeText.fontName = { family: "Inter", style: "Regular" };
    codeText.fontSize = codeStyle?.size ?? DEFAULT_CODE_SIZE;

    let lang = codeBlock.language ? codeBlock.language.toLowerCase() : null;
    if (lang && LANG_ALIASES[lang]) {
      lang = LANG_ALIASES[lang];
    }

    let segments: HighlightSegment[];
    if (lang && hljs.getLanguage(lang)) {
      const result = hljs.highlight(codeBlock.code, { language: lang });
      segments = parseHighlightedCode(result.value);
    } else {
      segments = [{ text: codeBlock.code, color: THEME_COLORS.default }];
    }

    const fullText = segments.map((s) => s.text).join("");
    codeText.characters = fullText;

    let charIndex = 0;
    for (const segment of segments) {
      if (segment.text.length > 0) {
        codeText.setRangeFills(charIndex, charIndex + segment.text.length, [
          { type: "SOLID", color: segment.color },
        ]);
        charIndex += segment.text.length;
      }
    }

    codeFrame.appendChild(codeText);
    codeFrame.x = 100;
    codeFrame.y = yOffset;
    slideNode.appendChild(codeFrame);
    yOffset += codeFrame.height + 30;
  };

  if (slide.title) {
    const title = figma.createText();
    title.fontName = { family: "Inter", style: "Bold" };
    const titleStyle = slide.type === "title" ? h1Style : h2Style;
    const defaultSize =
      slide.type === "title" ? DEFAULT_H1_SIZE : DEFAULT_H2_SIZE;
    title.fontSize = titleStyle?.size ?? defaultSize;
    title.characters = slide.title;
    const fill = createFill(titleStyle);
    if (fill) {
      title.fills = fill;
    }
    title.x = 100;
    title.y = yOffset;
    slideNode.appendChild(title);
    yOffset += title.height + 40;
  }

  if (slide.blocks && slide.blocks.length > 0) {
    for (const block of slide.blocks) {
      if (block.kind === "paragraph") {
        const fill = createFill(paragraphStyle);
        const fontSize = paragraphStyle?.size ?? DEFAULT_PARAGRAPH_SIZE;

        if (block.spans && block.spans.length > 0) {
          // Use spans for rich formatting
          const node = await renderSpansWithInlineCode(
            block.spans,
            fontSize,
            fill,
            100,
            yOffset,
          );
          slideNode.appendChild(node);
          yOffset += node.height + 30;
        } else {
          // Fallback to plain text
          const body = figma.createText();
          body.fontName = { family: "Inter", style: "Regular" };
          body.fontSize = fontSize;
          body.characters = block.text;
          if (fill) {
            body.fills = fill;
          }
          body.x = 100;
          body.y = yOffset;
          slideNode.appendChild(body);
          yOffset += body.height + 30;
        }
      } else if (block.kind === "heading") {
        const headingStyle = block.level === 3 ? h3Style : h4Style;
        const defaultSize =
          block.level === 3 ? DEFAULT_H3_SIZE : DEFAULT_H4_SIZE;
        const fontSize = headingStyle?.size ?? defaultSize;
        const fill = createFill(headingStyle);

        if (block.spans && block.spans.length > 0) {
          // Use spans for rich formatting
          const node = await renderSpansWithInlineCode(
            block.spans,
            fontSize,
            fill,
            100,
            yOffset,
          );
          // For headings, ensure bold is applied to non-formatted spans
          if (node.type === "TEXT") {
            node.fontName = { family: "Inter", style: "Bold" };
          }
          slideNode.appendChild(node);
          yOffset += node.height + 30;
        } else {
          // Fallback to plain text
          const heading = figma.createText();
          heading.fontName = { family: "Inter", style: "Bold" };
          heading.fontSize = fontSize;
          heading.characters = block.text;
          if (fill) {
            heading.fills = fill;
          }
          heading.x = 100;
          heading.y = yOffset;
          slideNode.appendChild(heading);
          yOffset += heading.height + 30;
        }
      } else if (block.kind === "bullets") {
        const fill = createFill(bulletStyle);
        const fontSize = bulletStyle?.size ?? DEFAULT_BULLET_SIZE;
        const startNum = block.start ?? 1;

        if (block.itemSpans && block.itemSpans.length > 0) {
          // Render each bullet item with rich formatting
          const bulletFrame = figma.createFrame();
          bulletFrame.name = block.ordered ? "Ordered List" : "Bullet List";
          bulletFrame.layoutMode = "VERTICAL";
          bulletFrame.primaryAxisSizingMode = "AUTO";
          bulletFrame.counterAxisSizingMode = "AUTO";
          bulletFrame.itemSpacing = 8;
          bulletFrame.fills = [];
          bulletFrame.x = 100;
          bulletFrame.y = yOffset;

          for (let i = 0; i < block.itemSpans.length; i++) {
            const itemFrame = figma.createFrame();
            itemFrame.name = `Item ${i}`;
            itemFrame.layoutMode = "HORIZONTAL";
            itemFrame.primaryAxisSizingMode = "AUTO";
            itemFrame.counterAxisSizingMode = "AUTO";
            itemFrame.itemSpacing = 8;
            itemFrame.fills = [];

            // Bullet/number prefix
            const prefix = figma.createText();
            prefix.fontName = { family: "Inter", style: "Regular" };
            prefix.fontSize = fontSize;
            prefix.characters = block.ordered ? `${startNum + i}.` : "•";
            if (fill) {
              prefix.fills = fill;
            }
            itemFrame.appendChild(prefix);

            // Item content with spans
            const itemNode = await renderSpansWithInlineCode(
              block.itemSpans[i],
              fontSize,
              fill,
            );
            itemFrame.appendChild(itemNode);

            bulletFrame.appendChild(itemFrame);
          }

          slideNode.appendChild(bulletFrame);
          yOffset += bulletFrame.height + 30;
        } else {
          // Fallback to plain text
          const bullets = figma.createText();
          bullets.fontName = { family: "Inter", style: "Regular" };
          bullets.fontSize = fontSize;
          const prefix = block.ordered
            ? block.items.map((b, i) => `${startNum + i}. ${b}`).join("\n")
            : block.items.map((b) => `• ${b}`).join("\n");
          bullets.characters = prefix;
          if (fill) {
            bullets.fills = fill;
          }
          bullets.x = 100;
          bullets.y = yOffset;
          slideNode.appendChild(bullets);
          yOffset += bullets.height + 30;
        }
      } else if (block.kind === "code") {
        renderCodeBlock(block);
      } else if (block.kind === "blockquote") {
        const fontSize = paragraphStyle?.size ?? DEFAULT_PARAGRAPH_SIZE;
        const fill = createFill(paragraphStyle);
        const quoteNode = await renderBlockquote(
          block.spans || [{ text: block.text }],
          fontSize,
          fill,
          100,
          yOffset,
        );
        slideNode.appendChild(quoteNode);
        yOffset += quoteNode.height + 30;
      } else if (block.kind === "image") {
        const imgNode = renderImagePlaceholder(
          block.url,
          block.alt,
          100,
          yOffset,
        );
        slideNode.appendChild(imgNode);
        yOffset += imgNode.height + 30;
      } else if (block.kind === "table") {
        const fontSize = paragraphStyle?.size ?? DEFAULT_PARAGRAPH_SIZE;
        const fill = createFill(paragraphStyle);
        const tableNode = await renderTable(
          block.headers,
          block.rows,
          block.align || [],
          fontSize * 0.85,
          fill,
          100,
          yOffset,
        );
        slideNode.appendChild(tableNode);
        yOffset += tableNode.height + 30;
      } else if (block.kind === "figma") {
        // Render Figma selection link
        const figmaX = block.link.x !== undefined ? block.link.x : 100;
        const figmaY = block.link.y !== undefined ? block.link.y : yOffset;
        const figmaNode = await renderFigmaLink(block.link, figmaX, figmaY);
        slideNode.appendChild(figmaNode);
        // Only advance yOffset if no custom position was specified
        if (block.link.y === undefined) {
          yOffset += figmaNode.height + 30;
        }
      }
    }
  } else {
    if (slide.body && slide.body.length > 0) {
      const body = figma.createText();
      body.fontName = { family: "Inter", style: "Regular" };
      body.fontSize = paragraphStyle?.size ?? DEFAULT_PARAGRAPH_SIZE;
      body.characters = slide.body.join("\n");
      const fill = createFill(paragraphStyle);
      if (fill) {
        body.fills = fill;
      }
      body.x = 100;
      body.y = yOffset;
      slideNode.appendChild(body);
      yOffset += body.height + 30;
    }

    if (slide.bullets && slide.bullets.length > 0) {
      const bullets = figma.createText();
      bullets.fontName = { family: "Inter", style: "Regular" };
      bullets.fontSize = bulletStyle?.size ?? DEFAULT_BULLET_SIZE;
      bullets.characters = slide.bullets.map((b) => `• ${b}`).join("\n");
      const fill = createFill(bulletStyle);
      if (fill) {
        bullets.fills = fill;
      }
      bullets.x = 100;
      bullets.y = yOffset;
      slideNode.appendChild(bullets);
      yOffset += bullets.height + 30;
    }

    if (slide.codeBlocks && slide.codeBlocks.length > 0) {
      for (const codeBlock of slide.codeBlocks) {
        renderCodeBlock(codeBlock);
      }
    }
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

async function generateSlides(slides: SlideContent[]) {
  await loadFont();

  const existingSlides = findExistingSlides();
  const totalSlides = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    let node: SlideNode;

    if (existingSlides.has(i)) {
      const existing = existingSlides.get(i);
      if (existing) {
        node = existing;
        clearSlideContent(node);
        existingSlides.delete(i);
      } else {
        node = figma.createSlide();
      }
    } else {
      node = figma.createSlide();
    }

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

figma.ui.onmessage = async (msg: { type: string; slides?: SlideContent[] }) => {
  if (msg.type === "generate-slides" && msg.slides) {
    try {
      await generateSlides(msg.slides);
      figma.ui.postMessage({ type: "success", count: msg.slides.length });
    } catch (error) {
      figma.ui.postMessage({ type: "error", message: String(error) });
    }
  }
};
