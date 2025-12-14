import * as vscode from "vscode";

/**
 * CodeAction provider for figdeck diagnostics
 */
export class FigdeckCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "figdeck") continue;

      const action = this.createCodeAction(document, diagnostic);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  private createCodeAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const code = diagnostic.code as string | undefined;
    if (!code) return null;

    switch (code) {
      case "figma-invalid-url":
        return this.createFigmaUrlFix(document, diagnostic);
      case "figma-missing-link":
        return this.createAddLinkPropertyFix(document, diagnostic);
      case "columns-gap-exceeded":
        return this.createClampGapFix(document, diagnostic);
      case "frontmatter-invalid-format":
        return this.createColorNormalizationFix(document, diagnostic);
      case "frontmatter-invalid-value":
        return this.createTransitionNormalizationFix(document, diagnostic);
      default:
        return null;
    }
  }

  /**
   * Fix for invalid Figma URL - suggest fixing common issues
   */
  private createFigmaUrlFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const line = document.lineAt(diagnostic.range.start.line);
    const text = line.text;

    // Check if it's a bare URL (missing link=)
    const bareUrlMatch = text.match(/^(https:\/\/[^\s]+)$/);
    if (bareUrlMatch) {
      const action = new vscode.CodeAction(
        "Convert to link= property",
        vscode.CodeActionKind.QuickFix,
      );
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, line.range, `link=${bareUrlMatch[1]}`);
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      return action;
    }

    return null;
  }

  /**
   * Add link= property to :::figma block
   */
  private createAddLinkPropertyFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const lineNumber = diagnostic.range.start.line;

    // Find the next line after :::figma to insert
    const nextLine = lineNumber + 1;
    if (nextLine >= document.lineCount) return null;

    const action = new vscode.CodeAction(
      "Add link= property",
      vscode.CodeActionKind.QuickFix,
    );
    action.edit = new vscode.WorkspaceEdit();

    const insertPosition = new vscode.Position(nextLine, 0);
    action.edit.insert(
      document.uri,
      insertPosition,
      "link=https://www.figma.com/file/xxx/name?node-id=1234-5678\n",
    );
    action.diagnostics = [diagnostic];
    return action;
  }

  /**
   * Clamp gap value to maximum
   */
  private createClampGapFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const line = document.lineAt(diagnostic.range.start.line);
    const text = line.text;

    const gapMatch = text.match(/(gap\s*=\s*)(\d+)/);
    if (!gapMatch) return null;

    const action = new vscode.CodeAction(
      "Set gap to maximum (200)",
      vscode.CodeActionKind.QuickFix,
    );
    action.edit = new vscode.WorkspaceEdit();

    const newText = text.replace(/(gap\s*=\s*)\d+/, "$1200");
    action.edit.replace(document.uri, line.range, newText);
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  /**
   * Fix for invalid transition style/curve - convert underscores to hyphens
   */
  private createTransitionNormalizationFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    // Check if it's about transition style or curve
    const msg = diagnostic.message;
    if (
      !msg.includes("style") &&
      !msg.includes("curve") &&
      !msg.includes("type")
    ) {
      return null;
    }

    const line = document.lineAt(diagnostic.range.start.line);
    const text = line.text;

    // Match YAML key: value pattern
    const match = text.match(/^(\s*)(style|curve|type):\s*(.+?)\s*$/);
    if (!match) return null;

    const [, indent, key, value] = match;
    const trimmedValue = value.replace(/^["']|["']$/g, "").trim();

    // Try to normalize the value
    const normalizedValue = normalizeTransitionValue(key, trimmedValue);
    if (!normalizedValue || normalizedValue === trimmedValue) {
      return null;
    }

    const action = new vscode.CodeAction(
      `Change to "${normalizedValue}"`,
      vscode.CodeActionKind.QuickFix,
    );
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
      document.uri,
      line.range,
      `${indent}${key}: ${normalizedValue}`,
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  /**
   * Fix for invalid color format - convert rgb() or #rgb to #rrggbb
   */
  private createColorNormalizationFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    // Only apply to color-related fields
    if (!diagnostic.message.includes("color format")) {
      return null;
    }

    const line = document.lineAt(diagnostic.range.start.line);
    const text = line.text;

    // Match YAML key: value pattern for color properties
    const colorMatch = text.match(/^(\s*)(background|color):\s*(.+?)\s*$/);
    if (!colorMatch) return null;

    const [, indent, key, value] = colorMatch;
    const normalizedColor = normalizeColor(value);

    if (!normalizedColor) return null;

    const action = new vscode.CodeAction(
      `Convert to ${normalizedColor}`,
      vscode.CodeActionKind.QuickFix,
    );
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
      document.uri,
      line.range,
      `${indent}${key}: "${normalizedColor}"`,
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }
}

/**
 * Normalize various color formats to #rrggbb
 */
function normalizeColor(value: string): string | null {
  const trimmed = value.replace(/^["']|["']$/g, "").trim();

  // Handle #rgb shorthand -> #rrggbb
  const shorthandMatch = trimmed.match(
    /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/,
  );
  if (shorthandMatch) {
    const [, r, g, b] = shorthandMatch;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  // Handle rgb(r, g, b) -> #rrggbb
  const rgbMatch = trimmed.match(
    /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[3], 10)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // Handle rgba(r, g, b, a) -> #rrggbb (ignore alpha)
  const rgbaMatch = trimmed.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i,
  );
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, Number.parseInt(rgbaMatch[1], 10)));
    const g = Math.min(255, Math.max(0, Number.parseInt(rgbaMatch[2], 10)));
    const b = Math.min(255, Math.max(0, Number.parseInt(rgbaMatch[3], 10)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // Handle common color names
  const colorNames: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
  };

  const lowerTrimmed = trimmed.toLowerCase();
  if (colorNames[lowerTrimmed]) {
    return colorNames[lowerTrimmed];
  }

  return null;
}

const TRANSITION_STYLES = [
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
];

const TRANSITION_CURVES = [
  "ease-in",
  "ease-out",
  "ease-in-and-out",
  "linear",
  "gentle",
  "quick",
  "bouncy",
  "slow",
];

const TIMING_TYPES = ["on-click", "after-delay"];

/**
 * Normalize transition style/curve values
 */
function normalizeTransitionValue(key: string, value: string): string | null {
  // Convert underscores to hyphens
  const normalized = value.toLowerCase().replace(/_/g, "-");

  // Check against valid values
  if (key === "style") {
    if (TRANSITION_STYLES.includes(normalized)) {
      return normalized;
    }
    // Try fuzzy matching for common mistakes
    const closest = findClosestMatch(normalized, TRANSITION_STYLES);
    return closest;
  }

  if (key === "curve") {
    if (TRANSITION_CURVES.includes(normalized)) {
      return normalized;
    }
    // Handle common variations
    if (normalized === "ease" || normalized === "easein") return "ease-in";
    if (normalized === "easeout") return "ease-out";
    if (normalized === "easeinout" || normalized === "ease-in-out")
      return "ease-in-and-out";

    const closest = findClosestMatch(normalized, TRANSITION_CURVES);
    return closest;
  }

  if (key === "type") {
    if (TIMING_TYPES.includes(normalized)) {
      return normalized;
    }
    // Handle common variations
    if (normalized === "onclick" || normalized === "click") return "on-click";
    if (
      normalized === "afterdelay" ||
      normalized === "delay" ||
      normalized === "auto"
    ) {
      return "after-delay";
    }
    const closest = findClosestMatch(normalized, TIMING_TYPES);
    return closest;
  }

  return null;
}

/**
 * Find closest matching string using Levenshtein distance
 */
function findClosestMatch(value: string, candidates: string[]): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(value, candidate);
    if (distance < bestDistance && distance <= 3) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Register the code action provider
 */
export function registerCodeActionProvider(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "markdown", scheme: "file" },
      new FigdeckCodeActionProvider(),
      {
        providedCodeActionKinds:
          FigdeckCodeActionProvider.providedCodeActionKinds,
      },
    ),
  );
}
