import * as fs from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";
import { parse as parseYaml } from "yaml";
import {
  extractFrontmatterBlocks,
  validateFrontmatter,
} from "./frontmatterValidator";
import type { AnalysisResult, Issue } from "./types";

type CachedFileStat = {
  exists: boolean;
  isFile: boolean;
  size: number;
};

const DEFAULT_MAX_IMAGE_SIZE_MB = 5;

const STAT_CACHE_TTL_MS = 2000;
const STAT_CACHE_MAX_ENTRIES = 2000;
const statCache = new Map<
  string,
  { expiresAt: number; stat: CachedFileStat }
>();

export function clearImageDiagnosticsCache(): void {
  statCache.clear();
}

async function statWithCache(filePath: string): Promise<CachedFileStat> {
  const now = Date.now();
  const cached = statCache.get(filePath);
  if (cached && cached.expiresAt > now) {
    return cached.stat;
  }

  let stat: CachedFileStat;
  try {
    const fsStat = await fs.promises.stat(filePath);
    stat = { exists: true, isFile: fsStat.isFile(), size: fsStat.size };
  } catch {
    stat = { exists: false, isFile: false, size: 0 };
  }

  if (statCache.size >= STAT_CACHE_MAX_ENTRIES) {
    statCache.clear();
  }

  statCache.set(filePath, { expiresAt: now + STAT_CACHE_TTL_MS, stat });
  return stat;
}

export interface AnalyzeImagesOptions {
  maxSizeMb?: number | null;
}

export interface AnalyzeDocumentOptions {
  images?: AnalyzeImagesOptions;
}

function resolveMaxSizeMb(options?: AnalyzeImagesOptions): number | null {
  const hasOverride = options && Object.hasOwn(options, "maxSizeMb");
  if (!hasOverride) return DEFAULT_MAX_IMAGE_SIZE_MB;

  const value = options?.maxSizeMb;
  if (value === undefined) return DEFAULT_MAX_IMAGE_SIZE_MB;
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseImageDestination(raw: string): string {
  const trimmed = raw.trim();

  // Markdown supports angle-bracket link destinations: ![](</path with spaces.png>)
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    if (end > 1) {
      return trimmed.slice(1, end);
    }
  }

  // Fall back to first token before a title.
  const [first] = trimmed.split(/\s+/);
  return first ?? trimmed;
}

function toCandidatePaths(
  destination: string,
  basePath: string,
  documentUri: vscode.Uri,
): string[] {
  const candidates: string[] = [];

  if (destination.startsWith("/") && basePath) {
    candidates.push(path.join(basePath, destination.slice(1)));
    return candidates;
  }

  if (path.isAbsolute(destination)) {
    candidates.push(destination);
    return candidates;
  }

  if (documentUri.scheme === "file") {
    const documentDir = path.dirname(documentUri.fsPath);
    candidates.push(path.resolve(documentDir, destination));
  }

  if (basePath) {
    candidates.push(path.resolve(basePath, destination));
  }

  return candidates;
}

/**
 * Analyze a figdeck markdown document for issues
 */
export async function analyzeDocument(
  document: vscode.TextDocument,
  basePath: string,
  options?: AnalyzeDocumentOptions,
): Promise<AnalysisResult> {
  const issues: Issue[] = [];
  const text = document.getText();
  const lines = text.split(/\r?\n/);

  // Run all analyzers
  issues.push(...analyzeFrontmatterStructure(lines));
  issues.push(...validateFrontmatter(lines));
  issues.push(
    ...(await analyzeBackgroundImages(
      lines,
      basePath,
      document.uri,
      options?.images,
    )),
  );
  issues.push(
    ...(await analyzeImages(lines, basePath, document.uri, options?.images)),
  );
  issues.push(...analyzeFigmaBlocks(lines));
  issues.push(...analyzeColumnsBlocks(lines));

  return { issues };
}

/**
 * Analyze YAML frontmatter structure for issues (unclosed blocks, etc.)
 * @internal Exported for testing
 */
export function analyzeFrontmatterStructure(lines: string[]): Issue[] {
  const issues: Issue[] = [];

  // Find global frontmatter
  if (lines[0]?.trim() === "---") {
    let endLine = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endLine = i;
        break;
      }
    }

    if (endLine === -1) {
      issues.push({
        severity: "error",
        message: "Unclosed frontmatter block",
        range: {
          startLine: 0,
          startColumn: 0,
          endLine: 0,
          endColumn: 3,
        },
        code: "frontmatter-unclosed",
      });
    }
  }

  // Check for per-slide frontmatter issues
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences
    if (trimmed.match(/^(```+|~~~+)/)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) continue;

    // Check for common frontmatter mistakes
    // Example: Missing colon in key-value
    if (
      trimmed.match(/^[a-zA-Z][\w-]*\s+[^:=]/) &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith(">")
    ) {
      // Could be missing colon, but this is too noisy
      // Skip for now
    }
  }

  return issues;
}

const SUPPORTED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif"];

/**
 * Find the line number where a key appears in frontmatter content
 */
function findKeyLineInFrontmatter(
  lines: string[],
  startLine: number,
  endLine: number,
  key: string,
): number {
  const keyPattern = new RegExp(`^\\s*${key}\\s*:`);
  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    if (keyPattern.test(lines[i])) {
      return i;
    }
  }
  return startLine;
}

/**
 * Analyze backgroundImage references in frontmatter for issues
 * @internal Exported for testing
 */
export async function analyzeBackgroundImages(
  lines: string[],
  basePath: string,
  documentUri: vscode.Uri,
  options?: AnalyzeImagesOptions,
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const maxSizeMb = resolveMaxSizeMb(options);
  const blocks = extractFrontmatterBlocks(lines);

  for (const block of blocks) {
    if (!block.content.trim()) continue;

    let parsed: unknown;
    try {
      parsed = parseYaml(block.content);
    } catch {
      continue; // YAML parse errors are handled by validateFrontmatter
    }

    if (typeof parsed !== "object" || parsed === null) continue;

    const backgroundImage = (parsed as Record<string, unknown>).backgroundImage;
    if (typeof backgroundImage !== "string" || !backgroundImage) continue;

    const url = backgroundImage.trim();

    // Skip remote URLs
    if (url.startsWith("http://") || url.startsWith("https://")) {
      continue;
    }

    const keyLine = findKeyLineInFrontmatter(
      lines,
      block.startLine,
      block.endLine,
      "backgroundImage",
    );
    const lineLength = lines[keyLine]?.length ?? 100;

    // Check extension
    const ext = url.toLowerCase().split(".").pop();
    if (ext && !SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
      issues.push({
        severity: "warning",
        message: `Image format '${ext}' is not supported. Use PNG, JPEG, or GIF.`,
        range: {
          startLine: keyLine,
          startColumn: 0,
          endLine: keyLine,
          endColumn: lineLength,
        },
        code: "background-image-unsupported-format",
        data: { url, ext },
      });
    }

    // Check file existence and size
    const candidatePaths = toCandidatePaths(url, basePath, documentUri);
    let fileFound = false;

    for (const candidatePath of candidatePaths) {
      const stat = await statWithCache(candidatePath);
      if (!stat.exists || !stat.isFile) continue;

      fileFound = true;

      // Check file size
      if (maxSizeMb) {
        const maxSizeBytes = maxSizeMb * 1024 * 1024;
        if (stat.size > maxSizeBytes) {
          const sizeMb = stat.size / 1024 / 1024;
          issues.push({
            severity: "warning",
            message: `Background image is ${sizeMb.toFixed(1)}MB (max ${maxSizeMb}MB). Consider compressing it.`,
            range: {
              startLine: keyLine,
              startColumn: 0,
              endLine: keyLine,
              endColumn: lineLength,
            },
            code: "background-image-too-large",
            data: {
              url,
              filePath: candidatePath,
              sizeBytes: stat.size,
              maxSizeMb,
            },
          });
        }
      }
      break;
    }

    // Check if file exists
    if (!fileFound && candidatePaths.length > 0) {
      issues.push({
        severity: "error",
        message: `Background image not found: ${url}`,
        range: {
          startLine: keyLine,
          startColumn: 0,
          endLine: keyLine,
          endColumn: lineLength,
        },
        code: "background-image-not-found",
        data: { url },
      });
    }
  }

  return issues;
}

/**
 * Analyze image references for issues
 * @internal Exported for testing
 */
export async function analyzeImages(
  lines: string[],
  basePath: string,
  documentUri: vscode.Uri,
  options?: AnalyzeImagesOptions,
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const maxSizeMb = resolveMaxSizeMb(options);

  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences
    if (trimmed.match(/^(```+|~~~+)/)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) continue;

    // Find images in line
    for (const match of line.matchAll(imagePattern)) {
      const alt = match[1];
      const rawUrl = match[2];
      const startCol = match.index;
      const endCol = match.index + match[0].length;

      const destination = parseImageDestination(rawUrl);
      const url = destination.split(/[?#]/)[0];

      // Skip remote URLs
      if (url.startsWith("http://") || url.startsWith("https://")) {
        continue;
      }

      // Check for unsupported extensions
      const ext = url.toLowerCase().split(".").pop();
      if (ext && ["webp", "svg", "bmp", "tiff"].includes(ext)) {
        issues.push({
          severity: "warning",
          message: `Image format '${ext}' may not be supported by Figma. Use PNG, JPEG, or GIF instead.`,
          range: {
            startLine: i,
            startColumn: startCol,
            endLine: i,
            endColumn: endCol,
          },
          code: "image-unsupported-format",
          data: { url, ext },
        });
      }

      if (maxSizeMb) {
        const maxSizeBytes = maxSizeMb * 1024 * 1024;
        for (const candidatePath of toCandidatePaths(
          url,
          basePath,
          documentUri,
        )) {
          const stat = await statWithCache(candidatePath);
          if (!stat.exists || !stat.isFile) continue;

          if (stat.size > maxSizeBytes) {
            const sizeMb = stat.size / 1024 / 1024;
            issues.push({
              severity: "warning",
              message: `Image is ${sizeMb.toFixed(1)}MB (max ${maxSizeMb}MB). Consider compressing it or raising 'figdeck.images.maxSizeMb'.`,
              range: {
                startLine: i,
                startColumn: startCol,
                endLine: i,
                endColumn: endCol,
              },
              code: "image-too-large",
              data: {
                url,
                filePath: candidatePath,
                sizeBytes: stat.size,
                maxSizeMb,
              },
            });
          }
          break;
        }
      }

      // Check w/h/x/y values in alt text
      const sizeIssues = validateImageAlt(alt, i, startCol);
      issues.push(...sizeIssues);
    }
  }

  return issues;
}

/**
 * Validate image alt text size/position specs
 * @internal Exported for testing
 */
export function validateImageAlt(
  alt: string,
  line: number,
  baseCol: number,
): Issue[] {
  const issues: Issue[] = [];

  // Check for invalid w/h values
  const widthMatch = alt.match(/w:(-?\d+)(%?)/);
  if (widthMatch) {
    const value = Number.parseInt(widthMatch[1], 10);
    if (value <= 0) {
      issues.push({
        severity: "warning",
        message: "Image width must be positive",
        range: {
          startLine: line,
          startColumn: baseCol,
          endLine: line,
          endColumn: baseCol + alt.length + 4, // ![alt]
        },
        code: "image-invalid-width",
      });
    }
    if (widthMatch[2] === "%" && value > 100) {
      issues.push({
        severity: "warning",
        message: "Image width percentage cannot exceed 100%",
        range: {
          startLine: line,
          startColumn: baseCol,
          endLine: line,
          endColumn: baseCol + alt.length + 4,
        },
        code: "image-invalid-width-percent",
      });
    }
  }

  const heightMatch = alt.match(/h:(-?\d+)(%?)/);
  if (heightMatch) {
    const value = Number.parseInt(heightMatch[1], 10);
    if (value <= 0) {
      issues.push({
        severity: "warning",
        message: "Image height must be positive",
        range: {
          startLine: line,
          startColumn: baseCol,
          endLine: line,
          endColumn: baseCol + alt.length + 4,
        },
        code: "image-invalid-height",
      });
    }
  }

  return issues;
}

/**
 * Analyze :::figma blocks for issues
 * @internal Exported for testing
 */
export function analyzeFigmaBlocks(lines: string[]): Issue[] {
  const issues: Issue[] = [];

  let inCodeFence = false;
  let inFigmaBlock = false;
  let figmaBlockStart = -1;
  let hasLink = false;
  let linkValue = "";
  let linkLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences
    if (trimmed.match(/^(```+|~~~+)/)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) continue;

    if (trimmed === ":::figma") {
      inFigmaBlock = true;
      figmaBlockStart = i;
      hasLink = false;
      linkValue = "";
      linkLine = -1;
      continue;
    }

    if (inFigmaBlock) {
      if (trimmed === ":::") {
        // End of block - check if link was provided
        if (!hasLink) {
          issues.push({
            severity: "error",
            message: ":::figma block requires a 'link=' property",
            range: {
              startLine: figmaBlockStart,
              startColumn: 0,
              endLine: figmaBlockStart,
              endColumn: lines[figmaBlockStart].length,
            },
            code: "figma-missing-link",
          });
        } else if (linkValue && !isValidFigmaUrl(linkValue)) {
          issues.push({
            severity: "warning",
            message:
              "Invalid Figma URL. Expected format: https://www.figma.com/...",
            range: {
              startLine: linkLine,
              startColumn: 0,
              endLine: linkLine,
              endColumn: lines[linkLine].length,
            },
            code: "figma-invalid-url",
            data: { url: linkValue },
          });
        }
        inFigmaBlock = false;
        continue;
      }

      // Check for link property
      const linkMatch = trimmed.match(/^link\s*=\s*(.+)$/);
      if (linkMatch) {
        hasLink = true;
        linkValue = linkMatch[1].trim();
        linkLine = i;
      }

      // Check x/y values
      const posMatch = trimmed.match(/^(x|y)\s*=\s*(.+)$/);
      if (posMatch) {
        const prop = posMatch[1];
        const value = posMatch[2];
        if (value && Number.isNaN(Number.parseFloat(value.replace("%", "")))) {
          issues.push({
            severity: "warning",
            message: `Invalid ${prop} value: expected number or percentage`,
            range: {
              startLine: i,
              startColumn: 0,
              endLine: i,
              endColumn: line.length,
            },
            code: "figma-invalid-position",
          });
        }
      }
    }
  }

  // Check for unclosed block
  if (inFigmaBlock) {
    issues.push({
      severity: "error",
      message: "Unclosed :::figma block",
      range: {
        startLine: figmaBlockStart,
        startColumn: 0,
        endLine: figmaBlockStart,
        endColumn: lines[figmaBlockStart].length,
      },
      code: "figma-unclosed",
    });
  }

  return issues;
}

/**
 * Check if URL is a valid Figma URL
 * @internal Exported for testing
 */
export function isValidFigmaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "figma.com" || hostname.endsWith(".figma.com");
  } catch {
    return false;
  }
}

/**
 * Analyze :::columns blocks for issues
 * @internal Exported for testing
 */
export function analyzeColumnsBlocks(lines: string[]): Issue[] {
  const issues: Issue[] = [];

  let inCodeFence = false;
  let inColumnsBlock = false;
  let columnsBlockStart = -1;
  let columnCount = 0;
  let columnsParams = "";
  let columnsParamsLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences
    if (trimmed.match(/^(```+|~~~+)/)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) continue;

    const columnsMatch = trimmed.match(/^:::columns\s*(.*)$/);
    if (columnsMatch) {
      inColumnsBlock = true;
      columnsBlockStart = i;
      columnCount = 0;
      columnsParams = columnsMatch[1];
      columnsParamsLine = i;
      continue;
    }

    if (inColumnsBlock) {
      if (trimmed === ":::column") {
        columnCount++;
        continue;
      }

      if (trimmed === ":::") {
        // End of block - validate
        if (columnCount < 2) {
          issues.push({
            severity: "warning",
            message: `Column block has ${columnCount} column(s), minimum is 2. Content will be rendered linearly.`,
            range: {
              startLine: columnsBlockStart,
              startColumn: 0,
              endLine: columnsBlockStart,
              endColumn: lines[columnsBlockStart].length,
            },
            code: "columns-too-few",
          });
        }

        if (columnCount > 4) {
          issues.push({
            severity: "info",
            message: `Column block has ${columnCount} columns, maximum is 4. Only first 4 columns will be used.`,
            range: {
              startLine: columnsBlockStart,
              startColumn: 0,
              endLine: columnsBlockStart,
              endColumn: lines[columnsBlockStart].length,
            },
            code: "columns-too-many",
          });
        }

        // Validate gap parameter
        if (columnsParams) {
          const gapMatch = columnsParams.match(/gap\s*=\s*(\d+)/);
          if (gapMatch) {
            const gap = Number.parseInt(gapMatch[1], 10);
            if (gap > 200) {
              issues.push({
                severity: "warning",
                message: `Gap value ${gap} exceeds maximum (200). Value will be clamped.`,
                range: {
                  startLine: columnsParamsLine,
                  startColumn: 0,
                  endLine: columnsParamsLine,
                  endColumn: lines[columnsParamsLine].length,
                },
                code: "columns-gap-exceeded",
              });
            }
          }

          // Validate width parameter
          const widthMatch = columnsParams.match(/width\s*=\s*([^\s]+)/);
          if (widthMatch) {
            const widthValue = widthMatch[1];
            const widths = widthValue.split("/");
            if (columnCount > 0 && widths.length !== columnCount) {
              issues.push({
                severity: "warning",
                message: `Width specifies ${widths.length} values but block has ${columnCount} columns. Will use even split.`,
                range: {
                  startLine: columnsParamsLine,
                  startColumn: 0,
                  endLine: columnsParamsLine,
                  endColumn: lines[columnsParamsLine].length,
                },
                code: "columns-width-mismatch",
              });
            }
          }
        }

        inColumnsBlock = false;
      }
    }
  }

  // Check for unclosed block
  if (inColumnsBlock) {
    issues.push({
      severity: "error",
      message: "Unclosed :::columns block",
      range: {
        startLine: columnsBlockStart,
        startColumn: 0,
        endLine: columnsBlockStart,
        endColumn: lines[columnsBlockStart].length,
      },
      code: "columns-unclosed",
    });
  }

  return issues;
}
