import * as vscode from "vscode";

/**
 * Frontmatter property definitions for autocompletion
 */
const FRONTMATTER_PROPERTIES: Record<
  string,
  {
    description: string;
    values?: string[];
    children?: Record<string, { description: string; values?: string[] }>;
  }
> = {
  figdeck: {
    description: "Enable figdeck processing for this file",
    values: ["true", "false"],
  },
  background: {
    description: "Solid background color (e.g., #1a1a2e)",
  },
  gradient: {
    description:
      "Gradient background (e.g., #0d1117:0%,#1f2937:50%,#58a6ff:100%@45)",
  },
  backgroundImage: {
    description: "Background image path or URL",
  },
  template: {
    description: "Figma paint style name",
  },
  color: {
    description: "Base text color for all elements",
  },
  align: {
    description: "Horizontal alignment",
    values: ["left", "center", "right"],
  },
  valign: {
    description: "Vertical alignment",
    values: ["top", "middle", "bottom"],
  },
  headings: {
    description: "Heading styles configuration",
    children: {
      h1: { description: "H1 heading style" },
      h2: { description: "H2 heading style" },
      h3: { description: "H3 heading style" },
      h4: { description: "H4 heading style" },
    },
  },
  paragraphs: {
    description: "Paragraph style configuration",
    children: {
      size: { description: "Font size in pixels" },
      color: { description: "Text color" },
      x: { description: "Absolute X position" },
      y: { description: "Absolute Y position" },
    },
  },
  bullets: {
    description: "Bullet list style configuration",
    children: {
      size: { description: "Font size in pixels" },
      color: { description: "Text color" },
      x: { description: "Absolute X position" },
      y: { description: "Absolute Y position" },
      spacing: { description: "Gap between bullet items" },
    },
  },
  code: {
    description: "Code block style configuration",
    children: {
      size: { description: "Font size in pixels" },
    },
  },
  fonts: {
    description: "Custom font configuration",
    children: {
      h1: { description: "H1 font family" },
      h2: { description: "H2 font family" },
      h3: { description: "H3 font family" },
      h4: { description: "H4 font family" },
      body: { description: "Body text font family" },
      bullets: { description: "Bullet text font family" },
      code: { description: "Code font family" },
    },
  },
  slideNumber: {
    description: "Slide number configuration",
    children: {
      show: {
        description: "Show/hide slide numbers",
        values: ["true", "false"],
      },
      position: {
        description: "Position of slide number",
        values: ["bottom-right", "bottom-left", "top-right", "top-left"],
      },
      size: { description: "Font size in pixels" },
      color: { description: "Text color" },
      format: {
        description: 'Display format (e.g., "{{current}} / {{total}}")',
      },
      link: { description: "Custom Frame design Figma link" },
      startFrom: { description: "Start showing from slide N" },
    },
  },
  titlePrefix: {
    description: "Title prefix component configuration",
    children: {
      link: { description: "Figma component link" },
      spacing: { description: "Gap between prefix and title" },
    },
  },
  transition: {
    description: "Slide transition animation",
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
    ],
    children: {
      style: {
        description: "Animation style",
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
        ],
      },
      duration: { description: "Duration in seconds (0.01-10)" },
      curve: {
        description: "Easing curve",
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
      timing: { description: "Timing configuration" },
    },
  },
};

/**
 * Nested property definitions (for size, color, etc.)
 */
const STYLE_PROPERTIES: Record<string, { description: string }> = {
  size: { description: "Font size in pixels" },
  color: { description: "Text color" },
  x: { description: "Absolute X position" },
  y: { description: "Absolute Y position" },
};

const FONT_PROPERTIES: Record<string, { description: string }> = {
  family: { description: "Font family name" },
  style: { description: 'Base style (default: "Regular")' },
  bold: { description: 'Bold variant (default: "Bold")' },
  italic: { description: 'Italic variant (default: "Italic")' },
  boldItalic: { description: "Bold Italic variant" },
};

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

  const hasMeaningfulContent = (lines: string[]): boolean =>
    lines.some((l) => l.trim() !== "");

  const looksLikeInlineFrontmatter = (lines: string[]): boolean => {
    let sawKey = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^[a-zA-Z][\w-]*:\s*/.test(trimmed)) {
        sawKey = true;
        continue;
      }
      if (/^\s+/.test(line) && sawKey) {
        continue;
      }
      return false;
    }
    return sawKey;
  };

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
    _indent: number,
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    if (parentKeys.length === 0) {
      // Top-level keys
      for (const [key, def] of Object.entries(FRONTMATTER_PROPERTIES)) {
        const item = new vscode.CompletionItem(
          key,
          vscode.CompletionItemKind.Property,
        );
        item.detail = def.description;
        item.insertText = def.children ? `${key}:\n  ` : `${key}: `;
        items.push(item);
      }
    } else {
      // Nested keys
      const parentKey = parentKeys[parentKeys.length - 1];
      const parentDef = FRONTMATTER_PROPERTIES[parentKey];

      if (parentDef?.children) {
        for (const [key, def] of Object.entries(parentDef.children)) {
          const item = new vscode.CompletionItem(
            key,
            vscode.CompletionItemKind.Property,
          );
          item.detail = def.description;
          item.insertText = `${key}: `;
          items.push(item);
        }
      }

      // Add style properties for headings children (h1, h2, etc.)
      if (
        parentKeys.includes("headings") ||
        parentKeys.includes("paragraphs") ||
        parentKeys.includes("bullets")
      ) {
        for (const [key, def] of Object.entries(STYLE_PROPERTIES)) {
          const item = new vscode.CompletionItem(
            key,
            vscode.CompletionItemKind.Property,
          );
          item.detail = def.description;
          item.insertText = `${key}: `;
          items.push(item);
        }
      }

      // Add font properties for fonts children
      if (parentKeys.includes("fonts")) {
        for (const [key, def] of Object.entries(FONT_PROPERTIES)) {
          const item = new vscode.CompletionItem(
            key,
            vscode.CompletionItemKind.Property,
          );
          item.detail = def.description;
          item.insertText = `${key}: `;
          items.push(item);
        }
      }
    }

    return items;
  }

  private getValueCompletions(
    key: string,
    parentKeys: string[],
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Check for nested key values
    if (parentKeys.length > 0) {
      const parentKey = parentKeys[parentKeys.length - 1];
      const parentDef = FRONTMATTER_PROPERTIES[parentKey];
      const childDef = parentDef?.children?.[key];

      if (childDef?.values) {
        for (const value of childDef.values) {
          const item = new vscode.CompletionItem(
            value,
            vscode.CompletionItemKind.Value,
          );
          items.push(item);
        }
        return items;
      }
    }

    // Check for top-level key values
    const def = FRONTMATTER_PROPERTIES[key];
    if (def?.values) {
      for (const value of def.values) {
        const item = new vscode.CompletionItem(
          value,
          vscode.CompletionItemKind.Value,
        );
        items.push(item);
      }
    }

    return items;
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
