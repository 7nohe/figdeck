import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

/**
 * Result of CLI detection
 */
export interface CliDetectionResult {
  found: boolean;
  command: string[];
  source: "workspace" | "path" | "config" | "none";
}

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
        found: true,
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
      found: true,
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
      found: true,
      command: configCommand,
      source: "config",
    };
  }

  // 4. Fallback to npx figdeck@latest
  return {
    found: true,
    command: ["npx", "figdeck@latest"],
    source: "none",
  };
}

/**
 * Options for running CLI commands
 */
export interface RunCliOptions {
  args: string[];
  cwd?: string;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number | null) => void;
  onError?: (error: Error) => void;
}

function formatCliCommand(cmd: string, args: string[]): string {
  return [cmd, ...args]
    .map((part) => (/[^\w@%+=:,./-]/u.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function toSpawnError(error: unknown, cmd: string, args: string[]): Error {
  const command = formatCliCommand(cmd, args);

  if (error instanceof Error) {
    return new Error(
      `Failed to spawn figdeck CLI (${command}): ${error.message}`,
      {
        cause: error,
      },
    );
  }

  return new Error(`Failed to spawn figdeck CLI (${command})`);
}

/**
 * Run a figdeck CLI command
 */
export async function runCli(
  cliResult: CliDetectionResult,
  options: RunCliOptions,
): Promise<ChildProcess> {
  if (!cliResult.found) {
    throw new Error("figdeck CLI not found");
  }

  const [cmd, ...baseArgs] = cliResult.command;
  const args = [...baseArgs, ...options.args];

  let proc: ChildProcess;
  try {
    proc = spawn(cmd, args, {
      cwd: options.cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw toSpawnError(error, cmd, args);
  }

  const spawned = new Promise<void>((resolve, reject) => {
    const onSpawn = () => {
      proc.off("error", onError);
      resolve();
    };

    const onError = (error: Error) => {
      proc.off("spawn", onSpawn);
      reject(toSpawnError(error, cmd, args));
    };

    proc.once("spawn", onSpawn);
    proc.once("error", onError);
  });

  // Handle spawn errors to avoid crashing the extension host.
  proc.on("error", (error) => {
    options.onError?.(error);
  });

  if (options.onStdout && proc.stdout) {
    proc.stdout.on("data", (data: Buffer) => {
      options.onStdout?.(data.toString());
    });
  }

  if (options.onStderr && proc.stderr) {
    proc.stderr.on("data", (data: Buffer) => {
      options.onStderr?.(data.toString());
    });
  }

  if (options.onExit) {
    proc.on("exit", options.onExit);
  }

  // Wait until the process is successfully spawned, or surface spawn errors to callers.
  await spawned;

  return proc;
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
