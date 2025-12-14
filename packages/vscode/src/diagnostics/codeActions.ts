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
