import * as vscode from "vscode";
import { registerFrontmatterCompletion } from "./authoring/frontmatterCompletion";
import {
  navigateSlide,
  revealSlide,
  type SlideInfo,
  SlideOutlineProvider,
} from "./authoring/slideOutline";
import { analyzeDocument } from "./diagnostics/analyzer";
import { registerCodeActionProvider } from "./diagnostics/codeActions";
import { DiagnosticsManager } from "./diagnostics/collection";
import {
  detectCli,
  runCli,
  showCliNotFoundNotification,
} from "./ops/figdeckCli";
import { ServerManager } from "./ops/serverManager";

let outputChannel: vscode.OutputChannel;
let slideOutlineProvider: SlideOutlineProvider;
let diagnosticsManager: DiagnosticsManager;
let serverManager: ServerManager;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("figdeck");
  outputChannel.appendLine("figdeck extension activated");

  // Create slide outline provider
  slideOutlineProvider = new SlideOutlineProvider();

  // Create diagnostics manager
  const config = vscode.workspace.getConfiguration("figdeck.diagnostics");
  diagnosticsManager = new DiagnosticsManager(
    (document, basePath) => {
      const imagesConfig = vscode.workspace.getConfiguration("figdeck.images");
      const maxSizeMb = imagesConfig.get<number>("maxSizeMb", 5);
      return analyzeDocument(document, basePath, { images: { maxSizeMb } });
    },
    {
      debounceMs: config.get("debounceMs", 300),
      enabled: config.get("enabled", true),
    },
  );

  // Create server manager
  serverManager = new ServerManager(outputChannel);

  // Register TreeView
  const treeView = vscode.window.createTreeView("figdeck.slideOutline", {
    treeDataProvider: slideOutlineProvider,
    showCollapseAll: false,
  });

  context.subscriptions.push(treeView);
  context.subscriptions.push(diagnosticsManager);
  context.subscriptions.push(serverManager);

  // Register code action provider
  registerCodeActionProvider(context);

  // Register frontmatter completion provider
  registerFrontmatterCompletion(context);

  // Register commands
  context.subscriptions.push(
    // Init command
    vscode.commands.registerCommand("figdeck.init", async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const cliResult = await detectCli(workspaceFolder);

      if (!cliResult.found) {
        await showCliNotFoundNotification();
        return;
      }

      // Ask for output filename
      const filename = await vscode.window.showInputBox({
        prompt: "Enter filename for the new slides file",
        value: "slides.md",
        validateInput: (value) => {
          if (!value.endsWith(".md")) {
            return "Filename must end with .md";
          }
          return null;
        },
      });

      if (!filename) return;

      outputChannel.appendLine(`\n[figdeck] Running init...`);

      try {
        await runCli(cliResult, {
          args: ["init", "-o", filename],
          cwd: workspaceFolder?.uri.fsPath,
          onStdout: (data) => outputChannel.append(data),
          onStderr: (data) => outputChannel.append(`[stderr] ${data}`),
          onExit: async (code) => {
            if (code === 0) {
              vscode.window.showInformationMessage(`Created ${filename}`);
              // Open the created file
              const filePath = workspaceFolder
                ? vscode.Uri.joinPath(workspaceFolder.uri, filename)
                : vscode.Uri.file(filename);
              const doc = await vscode.workspace.openTextDocument(filePath);
              await vscode.window.showTextDocument(doc);
            } else {
              vscode.window.showErrorMessage(
                `figdeck init failed with code ${code}`,
              );
            }
          },
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to run figdeck init: ${error}`);
      }
    }),

    // Build command
    vscode.commands.registerCommand("figdeck.build", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith(".md")) {
        vscode.window.showErrorMessage("Please open a Markdown file to build");
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const cliResult = await detectCli(workspaceFolder);

      if (!cliResult.found) {
        await showCliNotFoundNotification();
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const outputPath = filePath.replace(/\.md$/, ".json");

      outputChannel.appendLine(`\n[figdeck] Building ${filePath}...`);

      try {
        await runCli(cliResult, {
          args: ["build", filePath, "-o", outputPath],
          cwd: workspaceFolder?.uri.fsPath,
          onStdout: (data) => outputChannel.append(data),
          onStderr: (data) => outputChannel.append(`[stderr] ${data}`),
          onExit: (code) => {
            if (code === 0) {
              vscode.window.showInformationMessage(`Built to ${outputPath}`);
            } else {
              vscode.window.showErrorMessage(
                `figdeck build failed with code ${code}`,
              );
            }
          },
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to run figdeck build: ${error}`);
      }
    }),

    // Serve commands
    vscode.commands.registerCommand("figdeck.serve.start", () => {
      serverManager.start();
    }),

    vscode.commands.registerCommand("figdeck.serve.stop", () => {
      serverManager.stop();
    }),

    vscode.commands.registerCommand("figdeck.serve.restart", () => {
      serverManager.restart();
    }),

    vscode.commands.registerCommand("figdeck.serve.quickPick", () => {
      serverManager.showQuickPick();
    }),

    // Output command
    vscode.commands.registerCommand("figdeck.showOutput", () => {
      outputChannel.show();
    }),

    // Slide navigation commands
    vscode.commands.registerCommand(
      "figdeck.revealSlide",
      (document: vscode.TextDocument, slideInfo: SlideInfo) => {
        revealSlide(document, slideInfo);
      },
    ),

    vscode.commands.registerCommand("figdeck.nextSlide", () => {
      navigateSlide(slideOutlineProvider, "next");
    }),

    vscode.commands.registerCommand("figdeck.previousSlide", () => {
      navigateSlide(slideOutlineProvider, "previous");
    }),

    vscode.commands.registerCommand("figdeck.refreshOutline", () => {
      slideOutlineProvider.refresh();
    }),

    vscode.commands.registerCommand("figdeck.refreshDiagnostics", () => {
      diagnosticsManager.refresh();
    }),
  );

  outputChannel.appendLine(
    "Commands, TreeView, Diagnostics, and Server Manager registered",
  );
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}
