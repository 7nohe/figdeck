import { parse as parseYaml } from "yaml";
import {
  FRONTMATTER_SPEC,
  type FrontmatterDef,
  TRANSITION_STYLES,
} from "../frontmatter-spec";
import type { Issue } from "./types";

type FrontmatterSchema = Record<string, FrontmatterDef>;

function countErrors(issues: Issue[]): number {
  return issues.filter((issue) => issue.severity === "error").length;
}

function compareIssueSets(a: Issue[], b: Issue[]): number {
  const aErrors = countErrors(a);
  const bErrors = countErrors(b);
  if (aErrors !== bErrors) return aErrors - bErrors;
  return a.length - b.length;
}

function isValueCompatibleWithDef(
  value: unknown,
  def: FrontmatterDef,
): boolean {
  if (def.kind === "oneOf") {
    return def.options.some((option) =>
      isValueCompatibleWithDef(value, option),
    );
  }

  switch (def.kind) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
  }
}

function validateTransitionShorthand(
  raw: string,
  line: number,
  lineLength: number,
): Issue[] {
  const issues: Issue[] = [];

  const trimmed = raw.trim();
  if (!trimmed) {
    issues.push({
      code: "frontmatter-invalid-value",
      message: "'transition' must not be empty",
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

  const [styleRaw, durationRaw] = trimmed.split(/\s+/, 2);
  const style = styleRaw.toLowerCase().replace(/_/g, "-");

  if (
    !TRANSITION_STYLES.includes(style as (typeof TRANSITION_STYLES)[number])
  ) {
    issues.push({
      code: "frontmatter-invalid-value",
      message: `'transition' must be one of: ${TRANSITION_STYLES.join(", ")}`,
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

  if (durationRaw) {
    const duration = Number(durationRaw);
    if (!Number.isFinite(duration)) {
      issues.push({
        code: "frontmatter-invalid-format",
        message: "'transition' duration must be a number",
        severity: "warning",
        range: {
          startLine: line,
          startColumn: 0,
          endLine: line,
          endColumn: lineLength,
        },
      });
    } else if (duration < 0.01 || duration > 10) {
      issues.push({
        code: "frontmatter-out-of-range",
        message: "'transition' duration must be between 0.01 and 10",
        severity: "warning",
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
  def: FrontmatterDef,
  keyPath: string[],
  lines: string[],
  startLine: number,
  endLine: number,
): Issue[] {
  const line = findKeyLine(lines, startLine, endLine, keyPath);
  const keyName = keyPath.join(".");
  const lineLength = lines[line]?.length ?? 100;

  if (keyPath.length === 1 && keyPath[0] === "transition") {
    if (typeof value === "string") {
      return validateTransitionShorthand(value, line, lineLength);
    }
  }

  if (def.kind === "oneOf") {
    const candidates = def.options.filter((candidate) =>
      isValueCompatibleWithDef(value, candidate),
    );
    if (candidates.length === 0) {
      return [
        {
          code: "frontmatter-invalid-type",
          message: `'${keyName}' has an invalid type`,
          severity: "error",
          range: {
            startLine: line,
            startColumn: 0,
            endLine: line,
            endColumn: lineLength,
          },
        },
      ];
    }

    let bestIssues: Issue[] | null = null;
    for (const candidate of candidates) {
      const candidateIssues = validateValue(
        value,
        candidate,
        keyPath,
        lines,
        startLine,
        endLine,
      );
      if (candidateIssues.length === 0) return candidateIssues;
      if (!bestIssues || compareIssueSets(candidateIssues, bestIssues) < 0) {
        bestIssues = candidateIssues;
      }
    }

    return bestIssues ?? [];
  }

  switch (def.kind) {
    case "number": {
      if (typeof value !== "number") {
        return [
          {
            code: "frontmatter-invalid-type",
            message: `'${keyName}' must be a number`,
            severity: "error",
            range: {
              startLine: line,
              startColumn: 0,
              endLine: line,
              endColumn: lineLength,
            },
          },
        ];
      }

      const issues: Issue[] = [];
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
      return issues;
    }

    case "boolean": {
      if (typeof value !== "boolean") {
        return [
          {
            code: "frontmatter-invalid-type",
            message: `'${keyName}' must be true or false`,
            severity: "error",
            range: {
              startLine: line,
              startColumn: 0,
              endLine: line,
              endColumn: lineLength,
            },
          },
        ];
      }

      if (def.allowedValues && !def.allowedValues.includes(value)) {
        return [
          {
            code: "frontmatter-invalid-value",
            message: `'${keyName}' must be ${def.allowedValues.join(" or ")}`,
            severity: "error",
            range: {
              startLine: line,
              startColumn: 0,
              endLine: line,
              endColumn: lineLength,
            },
          },
        ];
      }

      return [];
    }

    case "string": {
      if (typeof value !== "string") {
        return [
          {
            code: "frontmatter-invalid-type",
            message: `'${keyName}' must be a string`,
            severity: "error",
            range: {
              startLine: line,
              startColumn: 0,
              endLine: line,
              endColumn: lineLength,
            },
          },
        ];
      }

      const issues: Issue[] = [];
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

      return issues;
    }

    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return [
          {
            code: "frontmatter-invalid-type",
            message: `'${keyName}' must be an object`,
            severity: "error",
            range: {
              startLine: line,
              startColumn: 0,
              endLine: line,
              endColumn: lineLength,
            },
          },
        ];
      }

      return validateObject(
        value as Record<string, unknown>,
        def.children,
        keyPath,
        lines,
        startLine,
        endLine,
      );
    }
  }
}

/**
 * Validate an object against a schema
 */
function validateObject(
  obj: Record<string, unknown>,
  schema: FrontmatterSchema,
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
          FRONTMATTER_SPEC,
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
