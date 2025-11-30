import { base64ToUint8Array } from "./base64";
import {
  FIGMA_BRAND_COLOR,
  FIGMA_CARD_BG,
  FIGMA_CARD_BORDER,
  MAX_PREVIEW_HEIGHT,
  MAX_PREVIEW_WIDTH,
} from "./constants";
import { highlightCode } from "./highlight";
import type { ResolvedTextStyle } from "./styles";
import { LAYOUT } from "./styles";
import {
  isValidHyperlinkUrl,
  renderSpansToText,
  renderSpansWithInlineCode,
  safeSetRangeHyperlink,
} from "./text-renderer";
import type { FigmaSelectionLink, TableAlignment, TextSpan } from "./types";

/**
 * Result from a block renderer
 */
export interface BlockRenderResult {
  node: SceneNode;
  height: number;
}

/**
 * Render a title or heading block
 * Handles both plain text and spans with rich formatting
 */
export async function renderHeading(
  text: string,
  spans: TextSpan[] | undefined,
  style: ResolvedTextStyle,
  x: number,
  y: number,
): Promise<BlockRenderResult> {
  if (spans && spans.length > 0) {
    const node = await renderSpansWithInlineCode(
      spans,
      style.fontSize,
      style.fills,
      x,
      y,
    );
    // For headings rendered via spans, apply bold to non-code text nodes
    if (node.type === "TEXT") {
      node.fontName = { family: "Inter", style: "Bold" };
    }
    return { node, height: node.height };
  }

  // Plain text fallback
  const heading = figma.createText();
  heading.fontName = { family: "Inter", style: style.fontStyle };
  heading.fontSize = style.fontSize;
  heading.characters = text;
  if (style.fills) {
    heading.fills = style.fills;
  }
  heading.x = x;
  heading.y = y;
  return { node: heading, height: heading.height };
}

/**
 * Render a paragraph block
 * Handles both plain text and spans with rich formatting
 */
export async function renderParagraph(
  text: string,
  spans: TextSpan[] | undefined,
  style: ResolvedTextStyle,
  x: number,
  y: number,
): Promise<BlockRenderResult> {
  if (spans && spans.length > 0) {
    const node = await renderSpansWithInlineCode(
      spans,
      style.fontSize,
      style.fills,
      x,
      y,
    );
    return { node, height: node.height };
  }

  // Plain text fallback
  const body = figma.createText();
  body.fontName = { family: "Inter", style: style.fontStyle };
  body.fontSize = style.fontSize;
  body.characters = text;
  if (style.fills) {
    body.fills = style.fills;
  }
  body.x = x;
  body.y = y;
  return { node: body, height: body.height };
}

/**
 * Render a bullet/numbered list block
 * Handles both plain text items and items with spans
 */
export async function renderBulletList(
  items: string[],
  itemSpans: TextSpan[][] | undefined,
  style: ResolvedTextStyle,
  ordered: boolean,
  startNum: number,
  x: number,
  y: number,
): Promise<BlockRenderResult> {
  if (itemSpans && itemSpans.length > 0) {
    // Render each bullet item with rich formatting
    const bulletFrame = figma.createFrame();
    bulletFrame.name = ordered ? "Ordered List" : "Bullet List";
    bulletFrame.layoutMode = "VERTICAL";
    bulletFrame.primaryAxisSizingMode = "AUTO";
    bulletFrame.counterAxisSizingMode = "AUTO";
    bulletFrame.itemSpacing = LAYOUT.BULLET_ITEM_SPACING;
    bulletFrame.fills = [];
    bulletFrame.x = x;
    bulletFrame.y = y;

    for (let i = 0; i < itemSpans.length; i++) {
      const itemFrame = figma.createFrame();
      itemFrame.name = `Item ${i}`;
      itemFrame.layoutMode = "HORIZONTAL";
      itemFrame.primaryAxisSizingMode = "AUTO";
      itemFrame.counterAxisSizingMode = "AUTO";
      itemFrame.itemSpacing = LAYOUT.BULLET_ITEM_SPACING;
      itemFrame.fills = [];

      // Bullet/number prefix
      const prefix = figma.createText();
      prefix.fontName = { family: "Inter", style: "Regular" };
      prefix.fontSize = style.fontSize;
      prefix.characters = ordered ? `${startNum + i}.` : "•";
      if (style.fills) {
        prefix.fills = style.fills;
      }
      itemFrame.appendChild(prefix);

      // Item content with spans
      const itemNode = await renderSpansWithInlineCode(
        itemSpans[i],
        style.fontSize,
        style.fills,
      );
      itemFrame.appendChild(itemNode);

      bulletFrame.appendChild(itemFrame);
    }

    return { node: bulletFrame, height: bulletFrame.height };
  }

  // Plain text fallback
  const bullets = figma.createText();
  bullets.fontName = { family: "Inter", style: style.fontStyle };
  bullets.fontSize = style.fontSize;
  const prefix = ordered
    ? items.map((b, i) => `${startNum + i}. ${b}`).join("\n")
    : items.map((b) => `• ${b}`).join("\n");
  bullets.characters = prefix;
  if (style.fills) {
    bullets.fills = style.fills;
  }
  bullets.x = x;
  bullets.y = y;
  return { node: bullets, height: bullets.height };
}

/**
 * Render a blockquote block with left border and indentation
 */
export async function renderBlockquote(
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
 * Fetch remote image data as bytes for figma.createImage
 */
async function fetchRemoteImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `[figdeck] Remote image request failed (${response.status}): ${url}`,
      );
      return null;
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (e) {
    console.warn(`[figdeck] Error fetching remote image: ${url}`, e);
    return null;
  }
}

/**
 * Image block data
 */
export interface ImageBlockData {
  url: string;
  alt?: string;
  mimeType?: string;
  dataBase64?: string;
  source?: "local" | "remote";
}

/**
 * Render an image block
 * - If dataBase64 is provided (local image), decode and use figma.createImage
 * - If source is "remote", fetch bytes then try figma.createImage
 * - Otherwise, fall back to placeholder
 *
 * Supported formats: PNG, JPEG, GIF (per Figma's createImage API)
 */
export async function renderImage(
  image: ImageBlockData,
  x?: number,
  y?: number,
): Promise<FrameNode> {
  try {
    let imageData: Image | null = null;

    if (image.dataBase64) {
      // Local image with base64 data
      const bytes = base64ToUint8Array(image.dataBase64);
      imageData = figma.createImage(bytes);
    } else if (image.source === "remote" && image.url) {
      // Remote image - fetch bytes then use createImage
      const remoteBytes = await fetchRemoteImageBytes(image.url);
      if (remoteBytes) {
        imageData = figma.createImage(remoteBytes);
      }
    }

    if (imageData) {
      // Get image dimensions
      const size = await imageData.getSizeAsync();

      // Scale down if needed
      let width = size.width;
      let height = size.height;
      const maxWidth = MAX_PREVIEW_WIDTH;
      const maxHeight = MAX_PREVIEW_HEIGHT;

      if (width > maxWidth || height > maxHeight) {
        const scaleX = maxWidth / width;
        const scaleY = maxHeight / height;
        const scale = Math.min(scaleX, scaleY);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      // Create frame with image fill
      const frame = figma.createFrame();
      frame.name = image.alt || "Image";
      frame.resize(width, height);
      frame.fills = [
        {
          type: "IMAGE",
          imageHash: imageData.hash,
          scaleMode: "FILL",
        },
      ];
      frame.cornerRadius = 4;
      if (x !== undefined) frame.x = x;
      if (y !== undefined) frame.y = y;

      return frame;
    }
  } catch (e) {
    console.warn(`[figdeck] Failed to render image: ${image.url}`, e);
  }

  // Fallback to placeholder
  return renderImagePlaceholder(image.url, image.alt, x, y);
}

/**
 * Render a placeholder when image data cannot be loaded
 */
export function renderImagePlaceholder(
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

/**
 * Render a Figma selection link
 * If the node exists in the same file, clone it as a preview
 * Otherwise, show a card with a link
 */
export async function renderFigmaLink(
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
 * Table layout constants
 */
const TABLE_LAYOUT = {
  CELL_PADDING: 12,
  BORDER_WIDTH: 1,
  BORDER_COLOR: { r: 0.85, g: 0.85, b: 0.85 } as RGB,
  HEADER_BG: { r: 0.96, g: 0.96, b: 0.96 } as RGB,
} as const;

/**
 * Create a table cell frame with consistent styling
 */
function createTableCell(name: string, showLeftBorder: boolean): FrameNode {
  const cell = figma.createFrame();
  cell.name = name;
  cell.layoutMode = "HORIZONTAL";
  cell.primaryAxisSizingMode = "AUTO";
  cell.counterAxisSizingMode = "AUTO";
  cell.paddingLeft = TABLE_LAYOUT.CELL_PADDING;
  cell.paddingRight = TABLE_LAYOUT.CELL_PADDING;
  cell.paddingTop = TABLE_LAYOUT.CELL_PADDING;
  cell.paddingBottom = TABLE_LAYOUT.CELL_PADDING;
  cell.fills = [];

  if (showLeftBorder) {
    cell.strokes = [{ type: "SOLID", color: TABLE_LAYOUT.BORDER_COLOR }];
    cell.strokeWeight = TABLE_LAYOUT.BORDER_WIDTH;
    cell.strokeAlign = "INSIDE";
    cell.strokeLeftWeight = TABLE_LAYOUT.BORDER_WIDTH;
    cell.strokeRightWeight = 0;
    cell.strokeTopWeight = 0;
    cell.strokeBottomWeight = 0;
  }

  return cell;
}

/**
 * Create a table row frame
 */
function createTableRow(
  name: string,
  isBodyRow: boolean,
  bgColor?: RGB,
): FrameNode {
  const row = figma.createFrame();
  row.name = name;
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "AUTO";
  row.itemSpacing = 0;
  row.fills = bgColor ? [{ type: "SOLID", color: bgColor }] : [];

  if (isBodyRow) {
    row.strokes = [{ type: "SOLID", color: TABLE_LAYOUT.BORDER_COLOR }];
    row.strokeWeight = TABLE_LAYOUT.BORDER_WIDTH;
    row.strokeAlign = "INSIDE";
    row.strokeTopWeight = TABLE_LAYOUT.BORDER_WIDTH;
    row.strokeBottomWeight = 0;
    row.strokeLeftWeight = 0;
    row.strokeRightWeight = 0;
  }

  return row;
}

/**
 * Convert TableAlignment to Figma text alignment
 */
function toFigmaAlignment(
  align: TableAlignment[] | undefined,
  index: number,
): "LEFT" | "CENTER" | "RIGHT" {
  const a = align?.[index];
  if (a === "center") return "CENTER";
  if (a === "right") return "RIGHT";
  return "LEFT";
}

/**
 * Render a table block
 */
export async function renderTable(
  headers: TextSpan[][],
  rows: TextSpan[][][],
  align: TableAlignment[],
  baseSize: number,
  baseFills?: Paint[],
  x?: number,
  y?: number,
): Promise<FrameNode> {
  const tableFrame = figma.createFrame();
  tableFrame.name = "Table";
  tableFrame.layoutMode = "VERTICAL";
  tableFrame.primaryAxisSizingMode = "AUTO";
  tableFrame.counterAxisSizingMode = "AUTO";
  tableFrame.itemSpacing = 0;
  tableFrame.fills = [];
  tableFrame.strokes = [{ type: "SOLID", color: TABLE_LAYOUT.BORDER_COLOR }];
  tableFrame.strokeWeight = TABLE_LAYOUT.BORDER_WIDTH;
  tableFrame.cornerRadius = 4;
  tableFrame.clipsContent = true;
  if (x !== undefined) tableFrame.x = x;
  if (y !== undefined) tableFrame.y = y;

  // Render header row
  if (headers.length > 0) {
    const headerRow = createTableRow(
      "Header Row",
      false,
      TABLE_LAYOUT.HEADER_BG,
    );

    for (let i = 0; i < headers.length; i++) {
      const cell = createTableCell(`Header ${i}`, i > 0);
      const textNode = await renderSpansToText(headers[i], baseSize, baseFills);
      textNode.fontName = { family: "Inter", style: "Bold" };
      textNode.textAlignHorizontal = toFigmaAlignment(align, i);
      cell.appendChild(textNode);
      headerRow.appendChild(cell);
    }

    tableFrame.appendChild(headerRow);
  }

  // Render body rows
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowFrame = createTableRow(`Row ${rowIdx}`, true);

    for (let i = 0; i < row.length; i++) {
      const cell = createTableCell(`Cell ${rowIdx}-${i}`, i > 0);
      const textNode = await renderSpansToText(row[i], baseSize, baseFills);
      textNode.textAlignHorizontal = toFigmaAlignment(align, i);
      cell.appendChild(textNode);
      rowFrame.appendChild(cell);
    }

    tableFrame.appendChild(rowFrame);
  }

  return tableFrame;
}

/**
 * Code block layout constants
 */
const CODE_LAYOUT = {
  BG_COLOR: { r: 0.13, g: 0.13, b: 0.13 } as RGB,
  CORNER_RADIUS: 8,
  PADDING_X: 20,
  PADDING_Y: 16,
} as const;

/**
 * Render a code block with syntax highlighting
 * Returns BlockRenderResult for consistency with other block renderers
 */
export function renderCodeBlock(
  codeBlock: { language?: string; code: string },
  codeSize: number,
  x: number,
  y: number,
): BlockRenderResult {
  const codeFrame = figma.createFrame();
  codeFrame.name = codeBlock.language ? `Code (${codeBlock.language})` : "Code";
  codeFrame.fills = [{ type: "SOLID", color: CODE_LAYOUT.BG_COLOR }];
  codeFrame.cornerRadius = CODE_LAYOUT.CORNER_RADIUS;
  codeFrame.paddingLeft = CODE_LAYOUT.PADDING_X;
  codeFrame.paddingRight = CODE_LAYOUT.PADDING_X;
  codeFrame.paddingTop = CODE_LAYOUT.PADDING_Y;
  codeFrame.paddingBottom = CODE_LAYOUT.PADDING_Y;
  codeFrame.layoutMode = "VERTICAL";
  codeFrame.primaryAxisSizingMode = "AUTO";
  codeFrame.counterAxisSizingMode = "AUTO";

  const codeText = figma.createText();
  codeText.fontName = { family: "Inter", style: "Regular" };
  codeText.fontSize = codeSize;

  const segments = highlightCode(codeBlock.code, codeBlock.language);

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
  codeFrame.x = x;
  codeFrame.y = y;

  return { node: codeFrame, height: codeFrame.height };
}
