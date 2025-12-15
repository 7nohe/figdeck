import * as vscode from "vscode";
import { FRONTMATTER_SPEC, type FrontmatterDef } from "../frontmatter-spec";
import {
  hasMeaningfulContent,
  looksLikeInlineFrontmatter,
} from "../frontmatter-utils";

function getObjectChildren(
  def: FrontmatterDef,
): Record<string, FrontmatterDef> | undefined {
  if (def.kind === "object") return def.children;
  if (def.kind === "oneOf") {
    const entries = def.options.flatMap((option) => {
      const children = getObjectChildren(option);
      return children ? Object.entries(children) : [];
    });
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
}

function hasChildren(def: FrontmatterDef): boolean {
  return Boolean(getObjectChildren(def));
}

function getDefAtPath(path: string[]): FrontmatterDef | undefined {
  let current: FrontmatterDef = {
    kind: "object",
    description: "Frontmatter",
    children: FRONTMATTER_SPEC,
  };

  for (const key of path) {
    const children = getObjectChildren(current);
    if (!children) return undefined;
    const next = children[key];
    if (!next) return undefined;
    current = next;
  }

  return current;
}

function getCompletionValues(def: FrontmatterDef): string[] {
  if (def.kind === "oneOf") {
    const values = def.options.flatMap(getCompletionValues);
    return [...new Set(values)];
  }

  if (def.kind === "string") {
    return def.values ? [...def.values] : [];
  }

  if (def.kind === "boolean") {
    const allowed = def.allowedValues ?? [true, false];
    return allowed.map((value) => (value ? "true" : "false"));
  }

  return [];
}

/**
 * Check if cursor is inside a frontmatter block
 */
function isInFrontmatter(
  document: vscode.TextDocument,
  position: vscode.Position,
): boolean {
  // Keep frontmatter detection aligned with figdeck's Markdown parser:
  // - `---` is either a slide separator or a fenced frontmatter fence
  // - fenced frontmatter can only start at the beginning of a slide (no meaningful content yet)
  // - implicit frontmatter is a YAML-looking block at the beginning of a slide terminated by `---`

  const targetLine = position.line;
  let currentLines: string[] = [];
  let inFencedFrontmatter = false;
  let codeFence: string | null = null;

  for (let lineIndex = 0; lineIndex <= targetLine; lineIndex++) {
    const lineText = document.lineAt(lineIndex).text;
    const trimmed = lineText.trim();

    // Track fenced code blocks so we don't treat --- inside code samples as separators/frontmatter
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      if (codeFence === null) {
        codeFence = fenceMatch[1];
      } else if (trimmed.startsWith(codeFence)) {
        codeFence = null;
      }
      currentLines.push(lineText);
      continue;
    }

    if (codeFence !== null) {
      currentLines.push(lineText);
      continue;
    }

    if (trimmed === "---") {
      if (inFencedFrontmatter) {
        currentLines.push(lineText);
        inFencedFrontmatter = false;
        continue;
      }

      if (!hasMeaningfulContent(currentLines)) {
        inFencedFrontmatter = true;
        currentLines.push(lineText);
        continue;
      }

      // Implicit frontmatter closer (no opening fence, only key/value lines so far)
      if (looksLikeInlineFrontmatter(currentLines)) {
        currentLines.push(lineText);
        continue;
      }

      // Slide separator: start a new slide context
      currentLines = [];
      inFencedFrontmatter = false;
      continue;
    }

    currentLines.push(lineText);
  }

  if (inFencedFrontmatter) {
    return true;
  }

  return looksLikeInlineFrontmatter(currentLines);
}

/**
 * Get the current indentation context
 */
function getIndentContext(
  document: vscode.TextDocument,
  position: vscode.Position,
): { indent: number; parentKeys: string[] } {
  const lineText = document.lineAt(position.line).text;
  const currentIndent = lineText.match(/^(\s*)/)?.[1].length ?? 0;
  const parentKeys: string[] = [];

  // Look backwards to find parent keys
  for (let i = position.line - 1; i >= 0; i--) {
    const line = document.lineAt(i).text;
    const trimmed = line.trim();

    if (trimmed === "---") break;
    if (!trimmed) continue;

    const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
    const keyMatch = trimmed.match(/^([a-zA-Z][\w-]*):/);

    if (keyMatch && lineIndent < currentIndent) {
      parentKeys.unshift(keyMatch[1]);
      if (lineIndent === 0) break;
    }
  }

  return { indent: currentIndent, parentKeys };
}

/**
 * CompletionItemProvider for frontmatter
 */
export class FrontmatterCompletionProvider
  implements vscode.CompletionItemProvider
{
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): vscode.CompletionItem[] | undefined {
    if (!isInFrontmatter(document, position)) {
      return undefined;
    }

    const lineText = document.lineAt(position.line).text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // Check if we're completing a value (after :)
    const valueMatch = textBeforeCursor.match(
      /^(\s*)([a-zA-Z][\w-]*):\s*(.*)$/,
    );
    if (valueMatch) {
      const key = valueMatch[2];
      const { parentKeys } = getIndentContext(document, position);

      return this.getValueCompletions(key, parentKeys);
    }

    // Check if we're completing a key
    const keyMatch = textBeforeCursor.match(/^(\s*)([a-zA-Z][\w-]*)?$/);
    if (keyMatch) {
      const { indent, parentKeys } = getIndentContext(document, position);
      return this.getKeyCompletions(parentKeys, indent);
    }

    return undefined;
  }

  private getKeyCompletions(
    parentKeys: string[],
    indent: number,
  ): vscode.CompletionItem[] {
    const def = getDefAtPath(parentKeys);
    const children = def ? getObjectChildren(def) : undefined;
    if (!children) return [];

    return Object.entries(children).map(([key, childDef]) => {
      const item = new vscode.CompletionItem(
        key,
        vscode.CompletionItemKind.Property,
      );
      item.detail = childDef.description;
      item.insertText = hasChildren(childDef)
        ? `${key}:\n${" ".repeat(indent + 2)}`
        : `${key}: `;
      return item;
    });
  }

  private getValueCompletions(
    key: string,
    parentKeys: string[],
  ): vscode.CompletionItem[] {
    const def = getDefAtPath([...parentKeys, key]);
    if (!def) return [];

    return getCompletionValues(def).map((value) => {
      const item = new vscode.CompletionItem(
        value,
        vscode.CompletionItemKind.Value,
      );
      return item;
    });
  }
}

/**
 * Register the frontmatter completion provider
 */
export function registerFrontmatterCompletion(
  context: vscode.ExtensionContext,
): void {
  const provider = new FrontmatterCompletionProvider();

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "markdown", scheme: "file" },
      provider,
      ":", // Trigger on colon for value completions
    ),
  );
}
