import * as vscode from "vscode";
import { isFigdeckDocument } from "../authoring/slideParser";
import type { AnalysisResult, Issue } from "./types";
import { issueToVSCodeDiagnostic } from "./types";

/**
 * Analyzer function type
 */
export type Analyzer = (
  document: vscode.TextDocument,
  basePath: string,
) => Promise<AnalysisResult> | AnalysisResult;

/**
 * Manages diagnostic collection with debouncing
 */
export class DiagnosticsManager implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private analyzer: Analyzer;
  private debounceMs: number;
  private pendingAnalyses = new Map<string, NodeJS.Timeout>();
  private disposables: vscode.Disposable[] = [];
  private isEnabled = true;

  constructor(
    analyzer: Analyzer,
    options: { debounceMs?: number; enabled?: boolean } = {},
  ) {
    this.analyzer = analyzer;
    this.debounceMs = options.debounceMs ?? 300;
    this.isEnabled = options.enabled ?? true;

    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("figdeck");

    // Listen for document events
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        this.scheduleAnalysis(doc);
      }),

      vscode.workspace.onDidChangeTextDocument((e) => {
        this.scheduleAnalysis(e.document);
      }),

      vscode.workspace.onDidSaveTextDocument((doc) => {
        // Immediate analysis on save
        this.runAnalysis(doc);
      }),

      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.clearDiagnostics(doc.uri);
        this.cancelPendingAnalysis(doc.uri.toString());
      }),

      // Listen for configuration changes
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("figdeck.diagnostics")) {
          this.updateConfiguration();
          return;
        }

        if (e.affectsConfiguration("figdeck.images")) {
          // Re-analyze to reflect image-related diagnostics settings.
          for (const doc of vscode.workspace.textDocuments) {
            this.scheduleAnalysis(doc);
          }
        }
      }),
    );

    // Analyze all open markdown documents
    for (const doc of vscode.workspace.textDocuments) {
      this.scheduleAnalysis(doc);
    }
  }

  /**
   * Update configuration from settings
   */
  private updateConfiguration(): void {
    const config = vscode.workspace.getConfiguration("figdeck.diagnostics");
    this.isEnabled = config.get("enabled", true);
    this.debounceMs = config.get("debounceMs", 300);

    if (!this.isEnabled) {
      // Clear all diagnostics if disabled
      this.diagnosticCollection.clear();
    } else {
      // Re-analyze all open documents
      for (const doc of vscode.workspace.textDocuments) {
        this.scheduleAnalysis(doc);
      }
    }
  }

  /**
   * Check if document should be analyzed
   * Only analyzes markdown files with `figdeck: true` in global frontmatter
   */
  private shouldAnalyze(document: vscode.TextDocument): boolean {
    if (!this.isEnabled) return false;
    if (document.languageId !== "markdown") return false;
    if (!isFigdeckDocument(document.getText())) return false;
    return true;
  }

  /**
   * Schedule analysis with debouncing
   */
  private scheduleAnalysis(document: vscode.TextDocument): void {
    if (!this.shouldAnalyze(document)) return;

    const uri = document.uri.toString();

    // Cancel any pending analysis
    this.cancelPendingAnalysis(uri);

    // Schedule new analysis
    const timeout = setTimeout(() => {
      this.pendingAnalyses.delete(uri);
      this.runAnalysis(document);
    }, this.debounceMs);

    this.pendingAnalyses.set(uri, timeout);
  }

  /**
   * Cancel pending analysis for a document
   */
  private cancelPendingAnalysis(uriString: string): void {
    const pending = this.pendingAnalyses.get(uriString);
    if (pending) {
      clearTimeout(pending);
      this.pendingAnalyses.delete(uriString);
    }
  }

  /**
   * Run analysis on a document
   */
  private async runAnalysis(document: vscode.TextDocument): Promise<void> {
    if (!this.shouldAnalyze(document)) return;

    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      const basePath = workspaceFolder?.uri.fsPath ?? "";

      const result = await this.analyzer(document, basePath);
      this.setDiagnostics(document.uri, result.issues);
    } catch (error) {
      console.error("figdeck: Error analyzing document", error);
    }
  }

  /**
   * Set diagnostics for a document
   */
  private setDiagnostics(uri: vscode.Uri, issues: Issue[]): void {
    const diagnostics = issues.map(issueToVSCodeDiagnostic);
    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Clear diagnostics for a document
   */
  private clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  /**
   * Force refresh diagnostics for a document
   */
  refresh(document?: vscode.TextDocument): void {
    if (document) {
      this.runAnalysis(document);
    } else {
      for (const doc of vscode.workspace.textDocuments) {
        if (this.shouldAnalyze(doc)) {
          this.runAnalysis(doc);
        }
      }
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Cancel all pending analyses
    for (const timeout of this.pendingAnalyses.values()) {
      clearTimeout(timeout);
    }
    this.pendingAnalyses.clear();

    // Dispose subscriptions
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];

    // Dispose diagnostic collection
    this.diagnosticCollection.dispose();
  }
}
