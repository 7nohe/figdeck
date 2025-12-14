import { parse as parseYaml } from "yaml";
import type { Issue } from "./types";

/**
 * Property definition for validation
 */
interface PropertyDef {
  type: "string" | "number" | "boolean" | "object" | "array";
  values?: string[];
  pattern?: RegExp;
  min?: number;
  max?: number;
  children?: Record<string, PropertyDef>;
  patternError?: string;
}

/**
 * Frontmatter schema definition
 */
const FRONTMATTER_SCHEMA: Record<string, PropertyDef> = {
  figdeck: {
    type: "boolean",
  },
  background: {
    type: "string",
    pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    patternError: "Invalid color format. Use #rgb or #rrggbb",
  },
  gradient: {
    type: "string",
    pattern: /^#[0-9a-fA-F]{3,6}:\d+%/,
    patternError: "Invalid gradient format. Use #color:0%,#color:100%[@angle]",
  },
  backgroundImage: {
    type: "string",
  },
  template: {
    type: "string",
  },
  color: {
    type: "string",
    pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    patternError: "Invalid color format. Use #rgb or #rrggbb",
  },
  align: {
    type: "string",
    values: ["left", "center", "right"],
  },
  valign: {
    type: "string",
    values: ["top", "middle", "bottom"],
  },
  headings: {
    type: "object",
    children: {
      h1: { type: "object", children: createStyleSchema() },
      h2: { type: "object", children: createStyleSchema() },
      h3: { type: "object", children: createStyleSchema() },
      h4: { type: "object", children: createStyleSchema() },
    },
  },
  paragraphs: {
    type: "object",
    children: createStyleSchema(),
  },
  bullets: {
    type: "object",
    children: {
      ...createStyleSchema(),
      spacing: { type: "number", min: 0 },
    },
  },
  code: {
    type: "object",
    children: {
      size: { type: "number", min: 1 },
    },
  },
  fonts: {
    type: "object",
    children: {
      h1: { type: "object", children: createFontSchema() },
      h2: { type: "object", children: createFontSchema() },
      h3: { type: "object", children: createFontSchema() },
      h4: { type: "object", children: createFontSchema() },
      body: { type: "object", children: createFontSchema() },
      bullets: { type: "object", children: createFontSchema() },
      code: { type: "object", children: createFontSchema() },
    },
  },
  slideNumber: {
    type: "object",
    children: {
      show: { type: "boolean" },
      position: {
        type: "string",
        values: ["bottom-right", "bottom-left", "top-right", "top-left"],
      },
      size: { type: "number", min: 1 },
      color: {
        type: "string",
        pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        patternError: "Invalid color format",
      },
      format: { type: "string" },
      link: {
        type: "string",
        pattern: /^https:\/\/(www\.)?figma\.com\//,
        patternError: "Must be a valid Figma URL",
      },
      startFrom: { type: "number", min: 1 },
    },
  },
  titlePrefix: {
    type: "object",
    children: {
      link: {
        type: "string",
        pattern: /^https:\/\/(www\.)?figma\.com\//,
        patternError: "Must be a valid Figma URL",
      },
      spacing: { type: "number", min: 0 },
    },
  },
  transition: {
    type: "object",
    children: {
      style: {
        type: "string",
        values: [
          "none",
          "dissolve",
          "smart-animate",
          "slide-from-left",
          "slide-from-right",
          "slide-from-top",
          "slide-from-bottom",
          "push-from-left",
          "push-from-right",
          "push-from-top",
          "push-from-bottom",
          "move-from-left",
          "move-from-right",
          "move-from-top",
          "move-from-bottom",
          "slide-out-to-left",
          "slide-out-to-right",
          "slide-out-to-top",
          "slide-out-to-bottom",
          "move-out-to-left",
          "move-out-to-right",
          "move-out-to-top",
          "move-out-to-bottom",
        ],
      },
      duration: { type: "number", min: 0.01, max: 10 },
      curve: {
        type: "string",
        values: [
          "ease-in",
          "ease-out",
          "ease-in-and-out",
          "linear",
          "gentle",
          "quick",
          "bouncy",
          "slow",
        ],
      },
      timing: {
        type: "object",
        children: {
          type: { type: "string", values: ["on-click", "after-delay"] },
          delay: { type: "number", min: 0, max: 30 },
        },
      },
    },
  },
};

/**
 * Create style schema (size, color, x, y)
 */
function createStyleSchema(): Record<string, PropertyDef> {
  return {
    size: { type: "number", min: 1 },
    color: {
      type: "string",
      pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
      patternError: "Invalid color format",
    },
    x: { type: "number" },
    y: { type: "number" },
  };
}

/**
 * Create font schema
 */
function createFontSchema(): Record<string, PropertyDef> {
  return {
    family: { type: "string" },
    style: { type: "string" },
    bold: { type: "string" },
    italic: { type: "string" },
    boldItalic: { type: "string" },
  };
}

/**
 * Find line number for a YAML key in the content
 */
function findKeyLine(
  lines: string[],
  startLine: number,
  endLine: number,
  keyPath: string[],
): number {
  const targetKey = keyPath[keyPath.length - 1];
  const depth = keyPath.length - 1;
  const expectedIndent = depth * 2;

  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)([a-zA-Z][\w-]*):/);
    if (match) {
      const indent = match[1].length;
      const key = match[2];
      if (key === targetKey && Math.abs(indent - expectedIndent) <= 2) {
        return i;
      }
    }
  }
  return startLine;
}

/**
 * Validate a value against a property definition
 */
function validateValue(
  value: unknown,
  def: PropertyDef,
  keyPath: string[],
  lines: string[],
  startLine: number,
  endLine: number,
): Issue[] {
  const issues: Issue[] = [];
  const line = findKeyLine(lines, startLine, endLine, keyPath);
  const keyName = keyPath.join(".");
  const lineLength = lines[line]?.length ?? 100;

  // Type check
  if (def.type === "number") {
    if (typeof value !== "number") {
      issues.push({
        code: "frontmatter-invalid-type",
        message: `'${keyName}' must be a number`,
        severity: "error",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
      return issues;
    }
    if (def.min !== undefined && value < def.min) {
      issues.push({
        code: "frontmatter-out-of-range",
        message: `'${keyName}' must be at least ${def.min}`,
        severity: "warning",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
    }
    if (def.max !== undefined && value > def.max) {
      issues.push({
        code: "frontmatter-out-of-range",
        message: `'${keyName}' must be at most ${def.max}`,
        severity: "warning",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
    }
  } else if (def.type === "boolean") {
    if (typeof value !== "boolean") {
      issues.push({
        code: "frontmatter-invalid-type",
        message: `'${keyName}' must be true or false`,
        severity: "error",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
    }
  } else if (def.type === "string") {
    if (typeof value !== "string") {
      issues.push({
        code: "frontmatter-invalid-type",
        message: `'${keyName}' must be a string`,
        severity: "error",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
      return issues;
    }
    // Value validation
    if (def.values && !def.values.includes(value)) {
      issues.push({
        code: "frontmatter-invalid-value",
        message: `'${keyName}' must be one of: ${def.values.join(", ")}`,
        severity: "error",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
    }
    // Pattern validation
    if (def.pattern && !def.pattern.test(value)) {
      issues.push({
        code: "frontmatter-invalid-format",
        message: def.patternError || `'${keyName}' has invalid format`,
        severity: "warning",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
    }
  } else if (def.type === "object" && def.children) {
    if (typeof value === "object" && value !== null) {
      issues.push(
        ...validateObject(
          value as Record<string, unknown>,
          def.children,
          keyPath,
          lines,
          startLine,
          endLine,
        ),
      );
    } else if (typeof value !== "boolean") {
      // Allow boolean false for properties like titlePrefix that can be disabled
      // But report error for other non-object types (strings, numbers)
      issues.push({
        code: "frontmatter-invalid-type",
        message: `'${keyName}' must be an object or false`,
        severity: "error",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
    }
  }

  return issues;
}

/**
 * Validate an object against a schema
 */
function validateObject(
  obj: Record<string, unknown>,
  schema: Record<string, PropertyDef>,
  parentPath: string[],
  lines: string[],
  startLine: number,
  endLine: number,
): Issue[] {
  const issues: Issue[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const keyPath = [...parentPath, key];
    const def = schema[key];

    if (!def) {
      // Unknown property warning
      const line = findKeyLine(lines, startLine, endLine, keyPath);
      const lineLength = lines[line]?.length ?? 100;
      issues.push({
        code: "frontmatter-unknown-property",
        message: `Unknown property '${keyPath.join(".")}'`,
        severity: "info",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
      continue;
    }

    issues.push(
      ...validateValue(value, def, keyPath, lines, startLine, endLine),
    );
  }

  return issues;
}

/**
 * Check if a line looks like YAML key-value
 */
function isYamlLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true; // Empty lines are OK in YAML
  // YAML comments start with # but NOT Markdown headings (## or more followed by space)
  if (trimmed.startsWith("#") && !/^#{1,6}\s/.test(trimmed)) return true;
  // Key: value or key with nested content
  if (/^[a-zA-Z_][a-zA-Z0-9_-]*:/.test(trimmed)) return true;
  // Indented content (continuation of previous value)
  if (/^\s+/.test(line) && trimmed) return true;
  return false;
}

/**
 * Check if a line is a content line (heading, paragraph, directive, etc.)
 */
function isContentLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Headings
  if (/^#{1,6}\s/.test(trimmed)) return true;
  // Directives
  if (trimmed.startsWith(":::")) return true;
  // Images
  if (/^!\[/.test(trimmed)) return true;
  // Lists (but not YAML lists which start with "- " followed by key:)
  if (
    /^[-*+]\s+[^a-zA-Z_]/.test(trimmed) ||
    /^[-*+]\s+[a-zA-Z_][^:]*$/.test(trimmed)
  )
    return true;
  // Ordered lists
  if (/^\d+\.\s/.test(trimmed)) return true;
  // Blockquotes
  if (trimmed.startsWith(">")) return true;
  // Code fences
  if (/^(`{3,}|~{3,})/.test(trimmed)) return true;
  return false;
}

/**
 * Extract frontmatter blocks from lines (both explicit and implicit)
 * @internal Exported for use by analyzer
 */
export function extractFrontmatterBlocks(
  lines: string[],
): Array<{ startLine: number; endLine: number; content: string }> {
  const blocks: Array<{
    startLine: number;
    endLine: number;
    content: string;
  }> = [];
  let i = 0;
  let inCodeFence = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      i++;
      continue;
    }

    if (inCodeFence) {
      i++;
      continue;
    }

    // Check for explicit frontmatter (---)
    if (trimmed === "---") {
      const startLine = i;
      i++;
      const contentLines: string[] = [];

      // Look ahead to see if next lines are YAML (and not content)
      let hasYamlContent = false;
      let hasContentLine = false;
      let j = i;
      while (j < lines.length && lines[j].trim() !== "---") {
        const checkLine = lines[j];
        // If we find a content line (heading, directive, etc.), this isn't frontmatter
        if (isContentLine(checkLine)) {
          hasContentLine = true;
          break;
        }
        if (isYamlLine(checkLine) && checkLine.trim()) {
          hasYamlContent = true;
        }
        j++;
      }

      if (j < lines.length && hasYamlContent && !hasContentLine) {
        // Explicit frontmatter block (--- to ---)
        while (i < lines.length && lines[i].trim() !== "---") {
          contentLines.push(lines[i]);
          i++;
        }
        blocks.push({
          startLine: startLine + 1,
          endLine: i - 1,
          content: contentLines.join("\n"),
        });
        i++; // Skip closing ---

        // Check for implicit frontmatter immediately after explicit block
        // (YAML content after closing --- without its own opening ---)
        if (i < lines.length && lines[i].trim() !== "---") {
          const implicitAfterStart = i;
          const implicitAfterLines: string[] = [];

          while (i < lines.length) {
            const currentLine = lines[i];
            const currentTrimmed = currentLine.trim();

            // Stop at next separator or content
            if (currentTrimmed === "---") break;
            if (isContentLine(currentLine)) break;

            // Check if it's YAML-like
            if (isYamlLine(currentLine)) {
              implicitAfterLines.push(currentLine);
              i++;
            } else {
              break;
            }
          }

          // Only add if we found actual YAML content
          const implicitAfterContent = implicitAfterLines.join("\n").trim();
          if (
            implicitAfterContent &&
            /^[a-zA-Z_][a-zA-Z0-9_-]*:/.test(implicitAfterContent)
          ) {
            blocks.push({
              startLine: implicitAfterStart,
              endLine: i - 1,
              content: implicitAfterContent,
            });
          }
        }
      } else {
        // Check for implicit frontmatter (YAML after --- without closing ---)
        const implicitStart = i;
        const implicitLines: string[] = [];

        while (i < lines.length) {
          const currentLine = lines[i];
          const currentTrimmed = currentLine.trim();

          // Stop at next separator or content
          if (currentTrimmed === "---") break;
          if (isContentLine(currentLine)) break;

          // Check if it's YAML-like
          if (isYamlLine(currentLine)) {
            implicitLines.push(currentLine);
            i++;
          } else {
            break;
          }
        }

        // Only add if we found actual YAML content
        const yamlContent = implicitLines.join("\n").trim();
        if (yamlContent && /^[a-zA-Z_][a-zA-Z0-9_-]*:/.test(yamlContent)) {
          blocks.push({
            startLine: implicitStart,
            endLine: i - 1,
            content: yamlContent,
          });
        }
      }
    } else {
      i++;
    }
  }

  return blocks;
}

/**
 * Analyze frontmatter blocks for validation issues
 */
export function validateFrontmatter(lines: string[]): Issue[] {
  const issues: Issue[] = [];
  const blocks = extractFrontmatterBlocks(lines);

  for (const block of blocks) {
    if (!block.content.trim()) continue;

    try {
      const parsed = parseYaml(block.content);
      if (typeof parsed !== "object" || parsed === null) continue;

      issues.push(
        ...validateObject(
          parsed as Record<string, unknown>,
          FRONTMATTER_SCHEMA,
          [],
          lines,
          block.startLine,
          block.endLine,
        ),
      );
    } catch (e) {
      // YAML parse error
      if (e instanceof Error) {
        const lineLength = lines[block.startLine]?.length ?? 100;
        issues.push({
          code: "frontmatter-parse-error",
          message: `YAML parse error: ${e.message}`,
          severity: "error",
          range: {
            startLine: block.startLine,
            startColumn: 0,
            endLine: block.startLine,
            endColumn: lineLength,
          },
        });
      }
    }
  }

  return issues;
}
