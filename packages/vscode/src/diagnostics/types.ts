import type * as vscode from "vscode";

/**
 * Severity level for diagnostic issues
 */
export type IssueSeverity = "error" | "warning" | "info" | "hint";

/**
 * A diagnostic issue found in the document
 */
export interface Issue {
  /** Severity of the issue */
  severity: IssueSeverity;
  /** Human-readable message describing the issue */
  message: string;
  /** Range in the document where the issue occurs */
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  /** Optional code for the diagnostic (for CodeAction matching) */
  code?: string;
  /** Optional data for quick fixes */
  data?: unknown;
  /** Optional source identifier */
  source?: string;
}

/**
 * Result of analyzing a document
 */
export interface AnalysisResult {
  issues: Issue[];
}

/**
 * Convert IssueSeverity to VS Code DiagnosticSeverity
 */
export function toVSCodeSeverity(
  severity: IssueSeverity,
): vscode.DiagnosticSeverity {
  // Import dynamically to avoid issues at module load time
  const vscode = require("vscode") as typeof import("vscode");

  switch (severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
    case "hint":
      return vscode.DiagnosticSeverity.Hint;
  }
}

/**
 * Convert an Issue to a VS Code Diagnostic
 */
export function issueToVSCodeDiagnostic(issue: Issue): vscode.Diagnostic {
  const vscode = require("vscode") as typeof import("vscode");

  const range = new vscode.Range(
    new vscode.Position(issue.range.startLine, issue.range.startColumn),
    new vscode.Position(issue.range.endLine, issue.range.endColumn),
  );

  const diagnostic = new vscode.Diagnostic(
    range,
    issue.message,
    toVSCodeSeverity(issue.severity),
  );

  diagnostic.source = issue.source ?? "figdeck";

  if (issue.code) {
    diagnostic.code = issue.code;
  }

  return diagnostic;
}
