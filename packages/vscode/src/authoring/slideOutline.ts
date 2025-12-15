import * as vscode from "vscode";
import {
  isFigdeckDocument,
  type SlideInfo,
  splitIntoSlidesWithRanges,
} from "./slideParser";

// Re-export for backward compatibility
export {
  isFigdeckDocument,
  type SlideInfo,
  splitIntoSlidesWithRanges,
} from "./slideParser";

/**
 * TreeItem for a slide
 */
export class SlideTreeItem extends vscode.TreeItem {
  constructor(
    public readonly slideInfo: SlideInfo,
    public readonly document: vscode.TextDocument,
  ) {
    super(
      `${slideInfo.index}. ${slideInfo.title}`,
      vscode.TreeItemCollapsibleState.None,
    );

    this.tooltip = `Slide ${slideInfo.index}: ${slideInfo.title}\nLines ${slideInfo.startLine + 1}-${slideInfo.endLine + 1}`;
    this.description = `L${slideInfo.startLine + 1}`;

    // Click to reveal the slide in editor
    this.command = {
      command: "figdeck.revealSlide",
      title: "Reveal Slide",
      arguments: [document, slideInfo],
    };

    this.contextValue = "slide";
  }
}

/**
 * TreeDataProvider for slide outline
 */
export class SlideOutlineProvider
  implements vscode.TreeDataProvider<SlideTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    SlideTreeItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private slides: SlideInfo[] = [];
  private currentDocument: vscode.TextDocument | undefined;

  constructor() {
    // Update when active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      this.updateFromEditor(editor);
    });

    // Update when document changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === this.currentDocument) {
        this.refresh();
      }
    });

    // Initial update
    this.updateFromEditor(vscode.window.activeTextEditor);
  }

  private updateFromEditor(editor: vscode.TextEditor | undefined): void {
    if (
      editor &&
      editor.document.languageId === "markdown" &&
      isFigdeckDocument(editor.document.getText())
    ) {
      this.currentDocument = editor.document;
      this.refresh();
    } else {
      this.currentDocument = undefined;
      this.slides = [];
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  refresh(): void {
    if (this.currentDocument) {
      this.slides = splitIntoSlidesWithRanges(this.currentDocument.getText());
    } else {
      this.slides = [];
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SlideTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<SlideTreeItem[]> {
    if (!this.currentDocument) {
      return Promise.resolve([]);
    }

    const doc = this.currentDocument;
    return Promise.resolve(
      this.slides.map((slide) => new SlideTreeItem(slide, doc)),
    );
  }

  /**
   * Get slides for current document
   */
  getSlides(): SlideInfo[] {
    return this.slides;
  }

  /**
   * Get current document
   */
  getDocument(): vscode.TextDocument | undefined {
    return this.currentDocument;
  }
}

/**
 * Reveal a slide in the editor
 */
export function revealSlide(
  document: vscode.TextDocument,
  slideInfo: SlideInfo,
): void {
  const range = new vscode.Range(
    new vscode.Position(slideInfo.startLine, 0),
    new vscode.Position(slideInfo.startLine, 0),
  );

  vscode.window.showTextDocument(document, {
    selection: range,
    preserveFocus: false,
  });
}

/**
 * Go to next/previous slide
 */
export function navigateSlide(
  provider: SlideOutlineProvider,
  direction: "next" | "previous",
): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== provider.getDocument()) {
    return;
  }

  const currentLine = editor.selection.active.line;
  const slides = provider.getSlides();

  if (slides.length === 0) return;

  // Find current slide
  let currentSlideIndex = 0;
  for (let i = 0; i < slides.length; i++) {
    if (
      slides[i].startLine <= currentLine &&
      currentLine <= slides[i].endLine
    ) {
      currentSlideIndex = i;
      break;
    }
    if (slides[i].startLine > currentLine) {
      currentSlideIndex = Math.max(0, i - 1);
      break;
    }
    currentSlideIndex = i;
  }

  let targetIndex: number;
  if (direction === "next") {
    targetIndex = Math.min(currentSlideIndex + 1, slides.length - 1);
  } else {
    targetIndex = Math.max(currentSlideIndex - 1, 0);
  }

  if (targetIndex !== currentSlideIndex) {
    revealSlide(editor.document, slides[targetIndex]);
  }
}
