import type { FigmaSelectionLink } from "./types.js";

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
        console.warn(`[figdeck] Invalid Figma URL (missing fileKey): ${props.link}`);
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
