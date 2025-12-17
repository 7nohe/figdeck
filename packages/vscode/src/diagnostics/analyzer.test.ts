import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";
import {
  analyzeBackgroundImages,
  analyzeColumnsBlocks,
  analyzeDocument,
  analyzeFigmaBlocks,
  analyzeFrontmatterStructure,
  analyzeImages,
  clearImageDiagnosticsCache,
  isValidFigmaUrl,
  validateImageAlt,
} from "./analyzer";
import { validateFrontmatter } from "./frontmatterValidator";

function makeFileUri(fsPath: string): { scheme: "file"; fsPath: string } {
  return { scheme: "file", fsPath };
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

describe("diagnostics analyzer code fences", () => {
  it("ignores :::figma blocks inside fenced code", () => {
    const content = [
      "# Slide",
      "",
      "```markdown",
      ":::figma",
      ":::",
      "```",
    ].join("\n");

    const issues = analyzeFigmaBlocks(splitLines(content));
    expect(issues).toHaveLength(0);
  });

  it("ignores unclosed :::figma blocks inside fenced code", () => {
    const content = [
      "```markdown",
      ":::figma",
      "link=https://example.com",
      "```",
    ].join("\n");

    const issues = analyzeFigmaBlocks(splitLines(content));
    expect(issues).toHaveLength(0);
  });

  it("still reports :::figma blocks outside fenced code", () => {
    const content = [
      "```markdown",
      ":::figma",
      ":::",
      "```",
      "",
      ":::figma",
      ":::",
    ].join("\n");

    const issues = analyzeFigmaBlocks(splitLines(content));
    expect(issues.map((issue) => issue.code)).toEqual(["figma-missing-link"]);
  });

  it("ignores :::columns blocks inside fenced code", () => {
    const content = [
      "```markdown",
      ":::columns gap=300",
      ":::column",
      "A",
      ":::",
      "```",
    ].join("\n");

    const issues = analyzeColumnsBlocks(splitLines(content));
    expect(issues).toHaveLength(0);
  });

  it("ignores unclosed :::columns blocks inside fenced code", () => {
    const content = ["```markdown", ":::columns", ":::column", "A", "```"].join(
      "\n",
    );

    const issues = analyzeColumnsBlocks(splitLines(content));
    expect(issues).toHaveLength(0);
  });

  it("still reports :::columns blocks outside fenced code", () => {
    const content = [
      "```markdown",
      ":::columns gap=300",
      ":::column",
      "A",
      ":::",
      "```",
      "",
      ":::columns gap=300",
      ":::column",
      "A",
      ":::",
    ].join("\n");

    const issues = analyzeColumnsBlocks(splitLines(content));
    expect(issues.map((issue) => issue.code)).toEqual([
      "columns-too-few",
      "columns-gap-exceeded",
    ]);
  });
});

describe("validateFrontmatter", () => {
  it("should return no issues for valid frontmatter", () => {
    const lines = ["---", 'background: "#1a1a2e"', "align: center", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues).toHaveLength(0);
  });

  it("should detect invalid align value", () => {
    const lines = ["---", "align: invalid", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-value")).toBe(
      true,
    );
  });

  it("should detect invalid valign value", () => {
    const lines = ["---", "valign: wrong", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-value")).toBe(
      true,
    );
  });

  it("should detect invalid color format", () => {
    const lines = ["---", "color: red", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-format")).toBe(
      true,
    );
  });

  it("should accept valid hex color", () => {
    const lines = ["---", 'color: "#ff0000"', "---"];
    const issues = validateFrontmatter(lines);
    expect(issues).toHaveLength(0);
  });

  it("should detect number out of range", () => {
    const lines = ["---", "transition:", "  duration: 15", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-out-of-range")).toBe(
      true,
    );
  });

  it("should detect unknown property", () => {
    const lines = ["---", "unknownProp: value", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-unknown-property")).toBe(
      true,
    );
  });

  it("should validate nested properties", () => {
    const lines = ["---", "slideNumber:", "  position: invalid-pos", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-value")).toBe(
      true,
    );
  });

  it("should accept valid transition style", () => {
    const lines = ["---", "transition:", "  style: slide-from-right", "---"];
    const issues = validateFrontmatter(lines);
    expect(issues).toHaveLength(0);
  });

  // Per-slide frontmatter validation tests
  it("should validate per-slide explicit frontmatter (--- to ---)", () => {
    const lines = [
      "---",
      'background: "#000"',
      "---",
      "",
      "# Slide 1",
      "",
      "---",
      "align: invalid", // Invalid value
      "---",
      "",
      "## Slide 2",
    ];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-value")).toBe(
      true,
    );
  });

  it("should validate per-slide implicit frontmatter (YAML after --- without closing)", () => {
    const lines = [
      "---",
      'background: "#000"',
      "---",
      "",
      "# Slide 1",
      "",
      "---",
      "align: invalid", // Invalid value - implicit frontmatter
      "",
      "## Slide 2",
    ];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-value")).toBe(
      true,
    );
  });

  it("should validate multiple per-slide frontmatters", () => {
    const lines = [
      "---",
      'background: "#000"',
      "---",
      "",
      "# Slide 1",
      "",
      "---",
      "align: center",
      "---",
      "",
      "## Slide 2",
      "",
      "---",
      "valign: wrong", // Invalid value in third block
      "---",
      "",
      "## Slide 3",
    ];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-value")).toBe(
      true,
    );
  });

  it("should not validate YAML-like content inside code fences", () => {
    const lines = [
      "---",
      'background: "#000"',
      "---",
      "",
      "# Slide",
      "",
      "```yaml",
      "align: invalid", // This is in a code fence, should be ignored
      "```",
    ];
    const issues = validateFrontmatter(lines);
    expect(
      issues.filter((i) => i.code === "frontmatter-invalid-value"),
    ).toHaveLength(0);
  });

  it("should validate implicit frontmatter with nested properties", () => {
    const lines = [
      "---",
      'background: "#000"',
      "---",
      "",
      "# Slide 1",
      "",
      "---",
      "transition:",
      "  duration: 999", // Out of range (max 10)
      "",
      "## Slide 2",
    ];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-out-of-range")).toBe(
      true,
    );
  });

  it("should validate implicit frontmatter immediately after explicit block", () => {
    // This is the pattern: --- (explicit yaml) --- (implicit yaml) ---
    const lines = [
      "---",
      'background: "#ffffff"',
      'color: "#1a1a2e"',
      "---",
      "align: invalid", // Implicit frontmatter right after explicit block
      "valign: middle",
      "---",
      "",
      "# Title",
    ];
    const issues = validateFrontmatter(lines);
    expect(issues.some((i) => i.code === "frontmatter-invalid-value")).toBe(
      true,
    );
  });

  it("should validate unknown properties in implicit frontmatter after explicit block", () => {
    const lines = [
      "---",
      'background: "#ffffff"',
      "---",
      "titlePrefix: falsegag", // Invalid - should be boolean or object
      "---",
      "",
      "# Title",
    ];
    const issues = validateFrontmatter(lines);
    // titlePrefix expects boolean or object, string "falsegag" should trigger type error
    expect(issues.length).toBeGreaterThan(0);
  });

  it("should not produce errors for slides without frontmatter settings", () => {
    const lines = [
      "---",
      'background: "#ffffff"',
      "---",
      "",
      "# Title Slide",
      "",
      "---",
      "",
      "## Agenda", // No frontmatter, just content
      "",
      "- Item 1",
      "- Item 2",
      "",
      "---",
      "",
      "## Another Slide", // Another slide without frontmatter
      "",
      "Content here",
    ];
    const issues = validateFrontmatter(lines);
    expect(issues).toHaveLength(0);
  });

  it("should not confuse Markdown headings with YAML comments", () => {
    const lines = [
      "---",
      'background: "#000"',
      "---",
      "",
      "# H1 Heading", // Should not be treated as YAML comment
      "",
      "---",
      "",
      "## H2 Heading", // Should not be treated as YAML comment
      "",
      "---",
      "",
      "### H3 Heading",
    ];
    const issues = validateFrontmatter(lines);
    expect(issues).toHaveLength(0);
  });
});

describe("analyzeFrontmatterStructure", () => {
  it("should return no issues for valid frontmatter", () => {
    const lines = ["---", 'background: "#1a1a2e"', "---", "", "# Title"];
    const issues = analyzeFrontmatterStructure(lines);
    expect(issues).toHaveLength(0);
  });

  it("should detect unclosed frontmatter block", () => {
    const lines = ["---", 'background: "#1a1a2e"', "", "# Title"];
    const issues = analyzeFrontmatterStructure(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("frontmatter-unclosed");
    expect(issues[0].severity).toBe("error");
    expect(issues[0].range.startLine).toBe(0);
  });

  it("should not detect unclosed frontmatter when closed properly", () => {
    const lines = [
      "---",
      'background: "#000"',
      "color: white",
      "---",
      "# Slide",
    ];
    const issues = analyzeFrontmatterStructure(lines);
    expect(issues).toHaveLength(0);
  });

  it("should handle file without frontmatter", () => {
    const lines = ["# Title", "", "Content"];
    const issues = analyzeFrontmatterStructure(lines);
    expect(issues).toHaveLength(0);
  });

  it("should not report issues for --- inside code fences", () => {
    const lines = ["```", "---", "```"];
    const issues = analyzeFrontmatterStructure(lines);
    expect(issues).toHaveLength(0);
  });
});

describe("validateImageAlt", () => {
  it("should return no issues for valid alt text", () => {
    const issues = validateImageAlt("w:400 h:300", 0, 0);
    expect(issues).toHaveLength(0);
  });

  it("should return no issues for plain alt text", () => {
    const issues = validateImageAlt("Logo image", 0, 0);
    expect(issues).toHaveLength(0);
  });

  it("should detect invalid width (zero)", () => {
    const issues = validateImageAlt("w:0", 5, 10);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("image-invalid-width");
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].range.startLine).toBe(5);
  });

  it("should detect invalid width (negative)", () => {
    const issues = validateImageAlt("w:-100", 0, 0);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("image-invalid-width");
  });

  it("should detect invalid height (zero)", () => {
    const issues = validateImageAlt("h:0", 0, 0);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("image-invalid-height");
  });

  it("should detect invalid height (negative)", () => {
    const issues = validateImageAlt("h:-50", 0, 0);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("image-invalid-height");
  });

  it("should detect width percentage exceeding 100%", () => {
    const issues = validateImageAlt("w:150%", 0, 0);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("image-invalid-width-percent");
    expect(issues[0].message).toContain("100%");
  });

  it("should allow valid percentage width", () => {
    const issues = validateImageAlt("w:50%", 0, 0);
    expect(issues).toHaveLength(0);
  });

  it("should allow 100% width", () => {
    const issues = validateImageAlt("w:100%", 0, 0);
    expect(issues).toHaveLength(0);
  });

  it("should detect multiple issues", () => {
    const issues = validateImageAlt("w:0 h:-10", 0, 0);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.code)).toContain("image-invalid-width");
    expect(issues.map((i) => i.code)).toContain("image-invalid-height");
  });
});

describe("isValidFigmaUrl", () => {
  it("should accept valid figma.com URL", () => {
    expect(isValidFigmaUrl("https://figma.com/file/abc")).toBe(true);
  });

  it("should accept valid www.figma.com URL", () => {
    expect(
      isValidFigmaUrl("https://www.figma.com/file/abc/Name?node-id=1-2"),
    ).toBe(true);
  });

  it("should accept figma.com/design URLs", () => {
    expect(isValidFigmaUrl("https://www.figma.com/design/xyz/Name")).toBe(true);
  });

  it("should reject non-figma URLs", () => {
    expect(isValidFigmaUrl("https://google.com")).toBe(false);
  });

  it("should reject spoofed URLs", () => {
    expect(isValidFigmaUrl("https://evilfigma.com/file/abc")).toBe(false);
  });

  it("should reject invalid URLs", () => {
    expect(isValidFigmaUrl("not-a-url")).toBe(false);
  });

  it("should reject URLs with figma in path but wrong host", () => {
    expect(isValidFigmaUrl("https://example.com/figma/file")).toBe(false);
  });

  it("should accept subdomain URLs", () => {
    expect(isValidFigmaUrl("https://sub.figma.com/something")).toBe(true);
  });
});

describe("analyzeFigmaBlocks", () => {
  it("should return no issues for valid figma block", () => {
    const lines = [
      ":::figma",
      "link=https://www.figma.com/file/abc?node-id=1-2",
      ":::",
    ];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(0);
  });

  it("should detect missing link property", () => {
    const lines = [":::figma", "x=100", "y=200", ":::"];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("figma-missing-link");
    expect(issues[0].severity).toBe("error");
  });

  it("should detect invalid Figma URL", () => {
    const lines = [":::figma", "link=https://example.com/not-figma", ":::"];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("figma-invalid-url");
    expect(issues[0].severity).toBe("warning");
  });

  it("should detect unclosed figma block", () => {
    const lines = [":::figma", "link=https://www.figma.com/file/abc"];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("figma-unclosed");
    expect(issues[0].severity).toBe("error");
  });

  it("should detect invalid x position value", () => {
    const lines = [
      ":::figma",
      "link=https://www.figma.com/file/abc",
      "x=invalid",
      ":::",
    ];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("figma-invalid-position");
    expect(issues[0].message).toContain("x");
  });

  it("should detect invalid y position value", () => {
    const lines = [
      ":::figma",
      "link=https://www.figma.com/file/abc",
      "y=abc",
      ":::",
    ];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("figma-invalid-position");
    expect(issues[0].message).toContain("y");
  });

  it("should detect position values with units", () => {
    const lines = [
      ":::figma",
      "link=https://www.figma.com/file/abc",
      "x=10px",
      "y=20rem",
      ":::",
    ];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(2);
    expect(issues[0].code).toBe("figma-invalid-position");
    expect(issues[0].message).toContain("x");
    expect(issues[1].code).toBe("figma-invalid-position");
    expect(issues[1].message).toContain("y");
  });

  it("should allow percentage position values", () => {
    const lines = [
      ":::figma",
      "link=https://www.figma.com/file/abc",
      "x=50%",
      "y=25%",
      ":::",
    ];
    const issues = analyzeFigmaBlocks(lines);
    expect(issues).toHaveLength(0);
  });
});

describe("analyzeColumnsBlocks", () => {
  it("should return no issues for valid 2-column block", () => {
    const lines = [
      ":::columns",
      ":::column",
      "Left content",
      ":::column",
      "Right content",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(0);
  });

  it("should return no issues for valid 3-column block", () => {
    const lines = [
      ":::columns",
      ":::column",
      "A",
      ":::column",
      "B",
      ":::column",
      "C",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(0);
  });

  it("should return no issues for valid 4-column block", () => {
    const lines = [
      ":::columns",
      ":::column",
      "1",
      ":::column",
      "2",
      ":::column",
      "3",
      ":::column",
      "4",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(0);
  });

  it("should detect too few columns (0)", () => {
    const lines = [":::columns", "Some content without column markers", ":::"];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("columns-too-few");
    expect(issues[0].severity).toBe("warning");
  });

  it("should detect too few columns (1)", () => {
    const lines = [":::columns", ":::column", "Only one column", ":::"];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("columns-too-few");
    expect(issues[0].message).toContain("1 column(s)");
  });

  it("should detect too many columns (5+)", () => {
    const lines = [
      ":::columns",
      ":::column",
      "1",
      ":::column",
      "2",
      ":::column",
      "3",
      ":::column",
      "4",
      ":::column",
      "5",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("columns-too-many");
    expect(issues[0].severity).toBe("info");
    expect(issues[0].message).toContain("5 columns");
  });

  it("should detect gap exceeding maximum", () => {
    const lines = [
      ":::columns gap=500",
      ":::column",
      "A",
      ":::column",
      "B",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("columns-gap-exceeded");
    expect(issues[0].message).toContain("500");
    expect(issues[0].message).toContain("200");
  });

  it("should allow valid gap value", () => {
    const lines = [
      ":::columns gap=64",
      ":::column",
      "A",
      ":::column",
      "B",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(0);
  });

  it("should detect width mismatch with columns", () => {
    const lines = [
      ":::columns width=1fr/2fr/3fr",
      ":::column",
      "A",
      ":::column",
      "B",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("columns-width-mismatch");
    expect(issues[0].message).toContain("3 values");
    expect(issues[0].message).toContain("2 columns");
  });

  it("should allow matching width specification", () => {
    const lines = [
      ":::columns width=1fr/2fr",
      ":::column",
      "A",
      ":::column",
      "B",
      ":::",
    ];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(0);
  });

  it("should detect unclosed columns block", () => {
    const lines = [":::columns", ":::column", "Content"];
    const issues = analyzeColumnsBlocks(lines);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("columns-unclosed");
    expect(issues[0].severity).toBe("error");
  });
});

describe("analyzeImages", () => {
  let statSpy: ReturnType<typeof spyOn> | null = null;

  afterEach(() => {
    statSpy?.mockRestore();
    statSpy = null;
    clearImageDiagnosticsCache();
  });

  it("skips remote image URLs", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));

    const issues = await analyzeImages(
      ["![alt](https://example.com/image.png)"],
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("warns for unsupported image formats", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));

    const issues = await analyzeImages(
      ["![alt](images/image.webp)"],
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(
      issues.some((issue) => issue.code === "image-unsupported-format"),
    ).toBe(true);
  });

  it("warns when a local image exceeds the size limit", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/big.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 6 * 1024 * 1024,
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeImages(
      ["![alt](images/big.png)"],
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(statSpy).toHaveBeenCalledWith(expectedPath);
    expect(issues.some((issue) => issue.code === "image-too-large")).toBe(true);
  });

  it("supports angle-bracket destinations with spaces", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/big file.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 6 * 1024 * 1024,
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeImages(
      ['![alt](<images/big file.png> "title")'],
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(statSpy).toHaveBeenCalledWith(expectedPath);
    expect(issues.some((issue) => issue.code === "image-too-large")).toBe(true);
  });

  it("respects an injected maxSizeMb override", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/medium.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 2 * 1024 * 1024,
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeImages(
      ["![alt](images/medium.png)"],
      basePath,
      documentUri as unknown as vscode.Uri,
      { maxSizeMb: 1 },
    );

    expect(statSpy).toHaveBeenCalledWith(expectedPath);
    expect(issues.some((issue) => issue.code === "image-too-large")).toBe(true);
  });

  it("allows disabling the size check via injected maxSizeMb", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async () => {
      throw new Error("Should not be called");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeImages(
      ["![alt](images/huge.png)"],
      basePath,
      documentUri as unknown as vscode.Uri,
      { maxSizeMb: null },
    );

    expect(statSpy).not.toHaveBeenCalled();
    expect(issues.some((issue) => issue.code === "image-too-large")).toBe(
      false,
    );
  });

  it("caches file stats across calls (within TTL)", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/cached.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 2 * 1024 * 1024,
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    await analyzeImages(
      ["![alt](images/cached.png)"],
      basePath,
      documentUri as unknown as vscode.Uri,
      { maxSizeMb: 1 },
    );

    await analyzeImages(
      ["![alt](images/cached.png)"],
      basePath,
      documentUri as unknown as vscode.Uri,
      { maxSizeMb: 1 },
    );

    expect(statSpy).toHaveBeenCalledTimes(1);
  });
});

describe("analyzeBackgroundImages", () => {
  let statSpy: ReturnType<typeof spyOn> | null = null;

  afterEach(() => {
    statSpy?.mockRestore();
    statSpy = null;
    clearImageDiagnosticsCache();
  });

  it("skips solid hex color background", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", 'background: "#1a1a2e"', "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips hex color with alpha", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", 'background: "#1a1a2eff"', "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips rgb/rgba colors", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: rgb(255, 0, 0)", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips named colors", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: red", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips gradient background", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", 'background: "#0d1117:0%,#58a6ff:100%@45"', "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips gradient without leading hash", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: 0d1117:0%,58a6ff:100%", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips 3-character hex color", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", 'background: "#fff"', "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips hsl color", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: hsl(0, 100%, 50%)", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips hsla color", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: hsla(0, 100%, 50%, 0.5)", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips rgba color", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: rgba(255, 0, 0, 0.5)", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips remote http URLs", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: http://example.com/image.png", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("skips remote https URLs", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = ["---", "background: https://example.com/image.png", "---"];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });

  it("reports error for non-existent background image (string format)", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = ["---", "background: ./images/missing.png", "---"];

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async () => {
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(
      issues.some((issue) => issue.code === "background-image-not-found"),
    ).toBe(true);
  });

  it("reports error for non-existent background image (object format)", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = [
      "---",
      "background:",
      "  image: ./images/missing.png",
      "---",
    ];

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async () => {
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(
      issues.some((issue) => issue.code === "background-image-not-found"),
    ).toBe(true);
  });

  it("warns for unsupported background image format", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = ["---", "background: ./images/bg.webp", "---"];

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async () => {
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(
      issues.some(
        (issue) => issue.code === "background-image-unsupported-format",
      ),
    ).toBe(true);
  });

  it("warns for oversized background image", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = ["---", "background: ./images/large.png", "---"];

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/large.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 10 * 1024 * 1024, // 10MB
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(
      issues.some((issue) => issue.code === "background-image-too-large"),
    ).toBe(true);
  });

  it("detects image path in object format with image property", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = ["---", "background:", "  image: ./images/large.png", "---"];

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/large.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 10 * 1024 * 1024, // 10MB
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(
      issues.some((issue) => issue.code === "background-image-too-large"),
    ).toBe(true);
  });

  it("does not warn when image size is within limit", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = ["---", "background: ./images/small.png", "---"];

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/small.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 1 * 1024 * 1024, // 1MB
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(
      issues.some((issue) => issue.code === "background-image-too-large"),
    ).toBe(false);
    expect(
      issues.some((issue) => issue.code === "background-image-not-found"),
    ).toBe(false);
  });

  it("respects maxSizeMb option", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = ["---", "background: ./images/medium.png", "---"];

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/medium.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 2 * 1024 * 1024, // 2MB
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
      { maxSizeMb: 1 },
    );

    expect(
      issues.some((issue) => issue.code === "background-image-too-large"),
    ).toBe(true);
  });

  it("allows disabling size check via maxSizeMb: null", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);
    const lines = ["---", "background: ./images/huge.png", "---"];

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/huge.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 100 * 1024 * 1024, // 100MB
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
      { maxSizeMb: null },
    );

    expect(
      issues.some((issue) => issue.code === "background-image-too-large"),
    ).toBe(false);
  });

  it("skips per-slide frontmatter with color background", async () => {
    const basePath = path.resolve("test-workspace");
    const documentUri = makeFileUri(path.join(basePath, "docs", "slides.md"));
    const lines = [
      "---",
      'background: "#000"',
      "---",
      "",
      "# Title",
      "",
      "---",
      'background: "#fff"',
      "---",
      "",
      "## Slide 2",
    ];

    const issues = await analyzeBackgroundImages(
      lines,
      basePath,
      documentUri as unknown as vscode.Uri,
    );

    expect(issues).toHaveLength(0);
  });
});

describe("analyzeDocument", () => {
  let statSpy: ReturnType<typeof spyOn> | null = null;

  afterEach(() => {
    statSpy?.mockRestore();
    statSpy = null;
    clearImageDiagnosticsCache();
  });

  it("forwards image options to analyzeImages", async () => {
    const basePath = path.resolve("test-workspace");
    const documentPath = path.join(basePath, "docs", "slides.md");
    const documentUri = makeFileUri(documentPath);

    const expectedPath = path.resolve(
      path.dirname(documentPath),
      "images/medium.png",
    );

    statSpy = spyOn(fs.promises, "stat").mockImplementation((async (
      filePath: fs.PathLike,
    ) => {
      if (String(filePath) === expectedPath) {
        return {
          size: 2 * 1024 * 1024,
          isFile: () => true,
        } as unknown as fs.Stats;
      }
      throw new Error("ENOENT");
    }) as unknown as typeof fs.promises.stat);

    const document = {
      getText: () => "![alt](images/medium.png)",
      uri: documentUri,
    } as unknown as vscode.TextDocument;

    const result = await analyzeDocument(document, basePath, {
      images: { maxSizeMb: 1 },
    });

    expect(statSpy).toHaveBeenCalledWith(expectedPath);
    expect(
      result.issues.some((issue) => issue.code === "image-too-large"),
    ).toBe(true);
  });
});
