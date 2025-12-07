/**
 * Figma URL validation and parsing utilities
 * Works in both Node.js and Figma plugin sandbox environments
 */

/**
 * Check if a hostname is a valid Figma hostname
 * Accepts: figma.com, www.figma.com, *.figma.com
 */
export function isValidFigmaHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "figma.com" || normalized.endsWith(".figma.com");
}

/**
 * Extract hostname from a URL using regex (works in Figma sandbox without URL API)
 */
export function extractHostname(url: string): string | null {
  const match = url.match(/^https?:\/\/([^/]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Check if a URL is a valid Figma URL
 * Uses regex-based parsing that works in both Node.js and Figma plugin sandbox
 */
export function isValidFigmaUrl(url: string): boolean {
  const hostname = extractHostname(url);
  return hostname !== null && isValidFigmaHostname(hostname);
}

/**
 * Parse a Figma URL and extract fileKey and nodeId
 * Uses URL API when available (Node.js), falls back to regex (Figma sandbox)
 *
 * Supports formats:
 * - https://www.figma.com/file/<fileKey>/<name>?node-id=<nodeId>
 * - https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>
 * - https://www.figma.com/slides/<fileKey>/<name>?node-id=<nodeId>
 * - https://figma.com/file/<fileKey>?node-id=<nodeId>
 */
export function parseFigmaUrl(url: string): {
  fileKey?: string;
  nodeId?: string;
} {
  // First validate the URL
  if (!isValidFigmaUrl(url)) {
    return {};
  }

  try {
    // Try using URL API (available in Node.js)
    const parsed = new URL(url);

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
    // Fallback to regex-based parsing (for Figma sandbox or if URL parsing fails)
    return parseFigmaUrlWithRegex(url);
  }
}

/**
 * Parse Figma URL using only regex (for Figma plugin sandbox)
 */
function parseFigmaUrlWithRegex(url: string): {
  fileKey?: string;
  nodeId?: string;
} {
  // Extract fileKey from path
  const pathMatch = url.match(/\/(file|design|slides)\/([^/?]+)/);
  const fileKey = pathMatch ? pathMatch[2] : undefined;

  // Extract node-id from query string
  const nodeIdMatch = url.match(/[?&]node-id=([^&]+)/);
  let nodeId: string | undefined;
  if (nodeIdMatch) {
    try {
      nodeId = decodeURIComponent(nodeIdMatch[1]).replace(/-/g, ":");
    } catch {
      nodeId = nodeIdMatch[1].replace(/-/g, ":");
    }
  }

  return { fileKey, nodeId };
}
