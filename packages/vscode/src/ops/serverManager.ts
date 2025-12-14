import type { ChildProcess } from "node:child_process";
import * as vscode from "vscode";
import { detectCli, runCli, showCliNotFoundNotification } from "./figdeckCli";

export type ServerState = "stopped" | "starting" | "running" | "error";

/**
 * Manages the figdeck serve process
 */
export class ServerManager implements vscode.Disposable {
  private process: ChildProcess | null = null;
  private state: ServerState = "stopped";
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private currentFile: string | null = null;
  private currentPort: number | null = null;

  private _onStateChange = new vscode.EventEmitter<ServerState>();
  readonly onStateChange = this._onStateChange.event;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "figdeck.serve.quickPick";
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  /**
   * Get current server state
   */
  getState(): ServerState {
    return this.state;
  }

  /**
   * Get current port
   */
  getPort(): number | null {
    return this.currentPort;
  }

  /**
   * Start the serve process
   */
  async start(filePath?: string): Promise<void> {
    if (this.state === "running" || this.state === "starting") {
      vscode.window.showWarningMessage("figdeck serve is already running");
      return;
    }

    // Get file to serve
    const file =
      filePath ?? vscode.window.activeTextEditor?.document.uri.fsPath;

    if (!file || !file.endsWith(".md")) {
      vscode.window.showErrorMessage("Please open a Markdown file to serve");
      return;
    }

    // Detect CLI
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const cliResult = await detectCli(workspaceFolder);

    if (!cliResult.found) {
      await showCliNotFoundNotification();
      return;
    }

    // Get config
    const config = vscode.workspace.getConfiguration("figdeck.serve");
    const host = config.get<string>("host", "127.0.0.1");
    const port = config.get<number>("port", 4141);
    const allowRemote = config.get<boolean>("allowRemote", false);
    const secret = config.get<string>("secret", "");
    const noAuth = config.get<boolean>("noAuth", false);
    const noWatch = config.get<boolean>("noWatch", false);

    this.setState("starting");
    this.currentFile = file;
    this.currentPort = port;

    this.outputChannel.appendLine(`\n[figdeck] Starting serve...`);
    this.outputChannel.appendLine(`[figdeck] File: ${file}`);
    this.outputChannel.appendLine(`[figdeck] Host: ${host}:${port}`);

    try {
      const args = ["serve", file, "--host", host, "--port", String(port)];

      // Add optional flags based on config
      if (allowRemote) {
        args.push("--allow-remote");
        this.outputChannel.appendLine(`[figdeck] Remote access enabled`);
      }
      if (secret) {
        args.push("--secret", secret);
        this.outputChannel.appendLine(`[figdeck] Authentication enabled`);
      }
      if (noAuth) {
        args.push("--no-auth");
        this.outputChannel.appendLine(`[figdeck] Authentication disabled`);
      }
      if (noWatch) {
        args.push("--no-watch");
        this.outputChannel.appendLine(`[figdeck] File watching disabled`);
      }

      this.process = await runCli(cliResult, {
        args,
        cwd: workspaceFolder?.uri.fsPath,
        onStdout: (data) => {
          this.outputChannel.append(data);
          // Check for successful start
          if (data.includes("WebSocket server") || data.includes("listening")) {
            this.setState("running");
          }
        },
        onStderr: (data) => {
          this.outputChannel.append(`[stderr] ${data}`);
          // Check for common errors
          if (
            data.includes("EADDRINUSE") ||
            data.includes("address already in use")
          ) {
            this.setState("error");
            vscode.window
              .showErrorMessage(
                `Port ${port} is already in use. Change the port in settings or stop the other process.`,
                "Open Settings",
              )
              .then((selection) => {
                if (selection === "Open Settings") {
                  vscode.commands.executeCommand(
                    "workbench.action.openSettings",
                    "figdeck.serve.port",
                  );
                }
              });
          }
        },
        onExit: (code) => {
          this.outputChannel.appendLine(
            `\n[figdeck] Process exited with code ${code}`,
          );
          this.process = null;
          this.setState(code === 0 ? "stopped" : "error");
        },
      });

      // Set running state after a short delay if not already set
      setTimeout(() => {
        if (this.state === "starting") {
          this.setState("running");
        }
      }, 1000);
    } catch (error) {
      this.outputChannel.appendLine(`[figdeck] Error: ${error}`);
      this.setState("error");
      vscode.window.showErrorMessage(`Failed to start figdeck serve: ${error}`);
    }
  }

  /**
   * Stop the serve process
   */
  stop(): void {
    if (!this.process) {
      this.setState("stopped");
      return;
    }

    this.outputChannel.appendLine("\n[figdeck] Stopping serve...");

    this.process.kill("SIGTERM");

    // Force kill after timeout
    setTimeout(() => {
      if (this.process) {
        this.process.kill("SIGKILL");
        this.process = null;
      }
    }, 3000);

    this.setState("stopped");
    this.currentFile = null;
    this.currentPort = null;
  }

  /**
   * Restart the serve process
   */
  async restart(): Promise<void> {
    const file = this.currentFile;
    this.stop();

    // Wait for process to fully stop
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (file) {
      await this.start(file);
    } else {
      await this.start();
    }
  }

  /**
   * Show quick pick menu for serve actions
   */
  async showQuickPick(): Promise<void> {
    const items: vscode.QuickPickItem[] = [];

    if (this.state === "running") {
      items.push(
        {
          label: "$(debug-stop) Stop Serve",
          description: "Stop the running server",
        },
        {
          label: "$(debug-restart) Restart Serve",
          description: "Restart the server",
        },
      );
    } else {
      items.push({
        label: "$(debug-start) Start Serve",
        description: "Start serving the current file",
      });
    }

    items.push({
      label: "$(output) Show Output",
      description: "Show figdeck output channel",
    });

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: "figdeck serve actions",
    });

    if (!selection) return;

    if (selection.label.includes("Start")) {
      await this.start();
    } else if (selection.label.includes("Stop")) {
      this.stop();
    } else if (selection.label.includes("Restart")) {
      await this.restart();
    } else if (selection.label.includes("Output")) {
      this.outputChannel.show();
    }
  }

  private setState(state: ServerState): void {
    this.state = state;
    this.updateStatusBar();
    this._onStateChange.fire(state);
  }

  private updateStatusBar(): void {
    switch (this.state) {
      case "stopped":
        this.statusBarItem.text = "$(debug-disconnect) figdeck";
        this.statusBarItem.tooltip = "figdeck serve: stopped";
        this.statusBarItem.backgroundColor = undefined;
        break;
      case "starting":
        this.statusBarItem.text = "$(loading~spin) figdeck";
        this.statusBarItem.tooltip = "figdeck serve: starting...";
        this.statusBarItem.backgroundColor = undefined;
        break;
      case "running":
        this.statusBarItem.text = `$(radio-tower) figdeck :${this.currentPort}`;
        this.statusBarItem.tooltip = `figdeck serve: running on port ${this.currentPort}`;
        this.statusBarItem.backgroundColor = undefined;
        break;
      case "error":
        this.statusBarItem.text = "$(error) figdeck";
        this.statusBarItem.tooltip = "figdeck serve: error";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        break;
    }
  }

  dispose(): void {
    this.stop();
    this.statusBarItem.dispose();
    this._onStateChange.dispose();
  }
}
