import { CONTENT_WIDTH, LAYOUT, type SlideBlockItem } from "@figdeck/shared";

/**
 * Parsed column attributes from :::columns directive
 */
export interface ColumnsAttributes {
  gap?: number;
  widths?: number[];
}

/**
 * Placeholder for a :::columns block during AST processing
 */
export interface ColumnsBlockPlaceholder {
  id: string;
  attributes: ColumnsAttributes;
  columnContents: string[];
}

/**
 * Parse width value (supports fr, %, px units)
 * @param value - Width value string (e.g., "1fr", "50%", "400", "400px")
 * @param totalFr - Total fractional units for fr calculation
 * @param availableWidth - Available width for percentage/fr calculations
 * @returns Width in pixels or null if invalid
 */
function parseWidthValue(
  value: string,
  totalFr: number,
  availableWidth: number,
): number | null {
  const trimmed = value.trim();

  // fr units (e.g., "1fr", "2fr")
  const frMatch = trimmed.match(/^(\d+(?:\.\d+)?)fr$/);
  if (frMatch) {
    const fr = Number.parseFloat(frMatch[1]);
    if (fr > 0 && totalFr > 0) {
      return Math.round((fr / totalFr) * availableWidth);
    }
    return null;
  }

  // Percentage (e.g., "50%")
  const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)%$/);
  if (percentMatch) {
    const percent = Number.parseFloat(percentMatch[1]);
    if (percent > 0 && percent <= 100) {
      return Math.round((percent / 100) * availableWidth);
    }
    return null;
  }

  // Pixel value (e.g., "400" or "400px")
  const pxMatch = trimmed.match(/^(\d+)(?:px)?$/);
  if (pxMatch) {
    const px = Number.parseInt(pxMatch[1], 10);
    if (px > 0) {
      return px;
    }
    return null;
  }

  return null;
}

/**
 * Parse width attribute string into pixel widths
 * @param widthStr - Width specification (e.g., "1fr/2fr", "50%/50%", "400/800")
 * @param columnCount - Number of columns
 * @param gap - Gap between columns
 * @returns Array of widths in pixels, or undefined for even split
 */
function parseWidths(
  widthStr: string,
  columnCount: number,
  gap: number,
): number[] | undefined {
  if (!widthStr) return undefined;

  const parts = widthStr.split("/").map((s) => s.trim());

  // Must match column count
  if (parts.length !== columnCount) {
    console.warn(
      `[figdeck] Width count (${parts.length}) doesn't match column count (${columnCount}), using even split`,
    );
    return undefined;
  }

  // Calculate available width (total width minus gaps)
  const totalGap = gap * (columnCount - 1);
  const availableWidth = CONTENT_WIDTH - totalGap;

  // Calculate total fr if any fr units are used
  let totalFr = 0;
  for (const part of parts) {
    const frMatch = part.match(/^(\d+(?:\.\d+)?)fr$/);
    if (frMatch) {
      totalFr += Number.parseFloat(frMatch[1]);
    }
  }

  // Parse each width
  const widths: number[] = [];
  for (const part of parts) {
    const width = parseWidthValue(part, totalFr, availableWidth);
    if (width === null) {
      console.warn(`[figdeck] Invalid width value "${part}", using even split`);
      return undefined;
    }
    widths.push(width);
  }

  // Validate minimum widths
  for (const width of widths) {
    if (width < LAYOUT.COLUMN_MIN_WIDTH) {
      console.warn(
        `[figdeck] Column width ${width}px is below minimum (${LAYOUT.COLUMN_MIN_WIDTH}px), using even split`,
      );
      return undefined;
    }
  }

  return widths;
}

/**
 * Parse attributes from :::columns directive
 * Supports: gap=32 width=1fr/2fr align=top
 */
function parseColumnsAttributes(
  attrString: string,
  columnCount: number,
): ColumnsAttributes {
  const attrs: ColumnsAttributes = {};

  if (!attrString) return attrs;

  // Parse key=value pairs
  const regex = /(\w+)=([^\s]+)/g;
  let match = regex.exec(attrString);

  while (match !== null) {
    const [, key, value] = match;

    switch (key) {
      case "gap": {
        const gap = Number.parseInt(value, 10);
        if (!Number.isNaN(gap) && gap >= 0) {
          attrs.gap = Math.min(gap, LAYOUT.MAX_COLUMN_GAP);
        }
        break;
      }
      case "width": {
        const gap = attrs.gap ?? LAYOUT.COLUMN_GAP;
        attrs.widths = parseWidths(value, columnCount, gap);
        break;
      }
      // align is reserved for future use
    }
    match = regex.exec(attrString);
  }

  return attrs;
}

/**
 * Extract :::columns blocks from markdown text and return the modified text
 * with placeholders that can be replaced after AST parsing.
 *
 * Block format:
 * :::columns [gap=32 width=1fr/2fr]
 * :::column
 * Left column content
 * :::column
 * Right column content
 * :::
 */
export function extractColumnsBlocks(markdown: string): {
  processedMarkdown: string;
  columnsBlocks: ColumnsBlockPlaceholder[];
} {
  const columnsBlocks: ColumnsBlockPlaceholder[] = [];
  let blockId = 0;

  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const columnsMatch = line.match(/^:::columns(?:\s+(.*))?$/);

    if (columnsMatch) {
      const attrsStr = columnsMatch[1] || "";
      const blockLines: string[] = [];
      i++; // Move past :::columns

      // Collect all lines until we find a standalone ::: (not another directive)
      // Track nesting depth for nested directive blocks (figma, note, tip, warning, caution)
      let nestedDepth = 0;
      while (i < lines.length) {
        const currentLine = lines[i];
        const trimmedLine = currentLine.trim();

        // Check for opening nested directive blocks
        if (/^:::(figma|note|tip|warning|caution)\s*$/.test(trimmedLine)) {
          nestedDepth++;
          blockLines.push(currentLine);
          i++;
          continue;
        }

        // Check for closing ::: - could be for nested block or columns
        if (/^:::(?!\s*column)/.test(trimmedLine)) {
          if (nestedDepth > 0) {
            // This closes a nested directive, not the columns block
            nestedDepth--;
            blockLines.push(currentLine);
            i++;
            continue;
          }
          // This is the actual closing ::: for columns
          break;
        }

        blockLines.push(currentLine);
        i++;
      }
      i++; // Move past closing :::

      const content = blockLines.join("\n");

      // Split content by :::column markers
      const columnParts = content.split(/^:::column\s*$/m);

      // First part before any :::column is ignored (usually empty)
      // Remaining parts are column contents
      const columnContents = columnParts.slice(1).map((c) => c.trim());

      // Validate column count
      if (columnContents.length < LAYOUT.MIN_COLUMNS) {
        console.warn(
          `[figdeck] :::columns block has ${columnContents.length} columns, minimum is ${LAYOUT.MIN_COLUMNS}. Rendering as linear content.`,
        );
        // Return the content as-is (fallback)
        result.push(content);
        continue;
      }

      if (columnContents.length > LAYOUT.MAX_COLUMNS) {
        console.warn(
          `[figdeck] :::columns block has ${columnContents.length} columns, maximum is ${LAYOUT.MAX_COLUMNS}. Using first ${LAYOUT.MAX_COLUMNS} columns.`,
        );
        columnContents.length = LAYOUT.MAX_COLUMNS;
      }

      // Parse attributes
      const attributes = parseColumnsAttributes(
        attrsStr.trim(),
        columnContents.length,
      );

      const id = `FIGDECK_COLUMNS_BLOCK_${blockId++}_PLACEHOLDER`;
      columnsBlocks.push({ id, attributes, columnContents });

      // Add placeholder
      result.push("");
      result.push(id);
      result.push("");
    } else {
      result.push(line);
      i++;
    }
  }

  return { processedMarkdown: result.join("\n"), columnsBlocks };
}

/**
 * Check if a text matches a columns block placeholder pattern
 * Returns the block index if matched, or null otherwise
 */
export function matchColumnsPlaceholder(text: string): number | null {
  const match = text.match(/^FIGDECK_COLUMNS_BLOCK_(\d+)_PLACEHOLDER$/);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return null;
}

/**
 * Parse a single column's content into SlideBlockItems
 * This will be called from markdown.ts with the appropriate parser context
 */
export function createColumnsBlock(
  placeholder: ColumnsBlockPlaceholder,
  parseColumnContent: (content: string) => SlideBlockItem[],
): {
  kind: "columns";
  columns: SlideBlockItem[][];
  gap?: number;
  widths?: number[];
} {
  const columns = placeholder.columnContents.map((content) =>
    parseColumnContent(content),
  );

  return {
    kind: "columns",
    columns,
    gap: placeholder.attributes.gap,
    widths: placeholder.attributes.widths,
  };
}
