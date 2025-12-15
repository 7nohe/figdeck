import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { CliDetectionResult } from "./cli-runner";

export type { CliDetectionResult, RunCliOptions } from "./cli-runner";
export { runCli } from "./cli-runner";

/**
 * Detect figdeck CLI
 *
 * Priority:
 * 1. Workspace node_modules/.bin/figdeck
 * 2. PATH figdeck
 * 3. Config figdeck.cli.command
 * 4. Fallback: npx figdeck@latest
 */
export async function detectCli(
  workspaceFolder?: vscode.WorkspaceFolder,
): Promise<CliDetectionResult> {
  // 1. Check workspace node_modules
  if (workspaceFolder) {
    const localBin = path.join(
      workspaceFolder.uri.fsPath,
      "node_modules",
      ".bin",
      "figdeck",
    );
    if (fs.existsSync(localBin)) {
      return {
        command: [localBin],
        source: "workspace",
      };
    }
  }

  // 2. Check PATH
  try {
    const { execSync } = await import("node:child_process");
    const which = process.platform === "win32" ? "where" : "which";
    execSync(`${which} figdeck`, { stdio: "ignore" });
    return {
      command: ["figdeck"],
      source: "path",
    };
  } catch {
    // Not found in PATH
  }

  // 3. Check config
  const config = vscode.workspace.getConfiguration("figdeck.cli");
  const configCommand = config.get<string[]>("command");
  if (configCommand && configCommand.length > 0) {
    return {
      command: configCommand,
      source: "config",
    };
  }

  // 4. Fallback to npx figdeck@latest
  return {
    command: ["npx", "figdeck@latest"],
    source: "none",
  };
}

/**
 * Show CLI not found notification with guidance
 */
export async function showCliNotFoundNotification(): Promise<void> {
  const selection = await vscode.window.showWarningMessage(
    "figdeck CLI not found. Install it to use figdeck commands.",
    "Install with npm",
    "Install with bun",
    "Configure manually",
  );

  if (selection === "Install with npm") {
    const terminal = vscode.window.createTerminal("figdeck");
    terminal.show();
    terminal.sendText("npm install -g figdeck");
  } else if (selection === "Install with bun") {
    const terminal = vscode.window.createTerminal("figdeck");
    terminal.show();
    terminal.sendText("bun add -g figdeck");
  } else if (selection === "Configure manually") {
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "figdeck.cli.command",
    );
  }
}
