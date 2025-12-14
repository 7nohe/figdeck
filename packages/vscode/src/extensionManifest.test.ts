import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

const extensionRoot = path.resolve(import.meta.dir, "..");
const extensionPackageJsonPath = path.join(extensionRoot, "package.json");
const snippetsPath = path.join(extensionRoot, "snippets", "figdeck.json");
const grammarPath = path.join(
  extensionRoot,
  "syntaxes",
  "figdeck-markdown.injection.tmLanguage.json",
);

describe("VS Code extension packaging", () => {
  it("contributes figdeck snippets for markdown and yaml", () => {
    const packageJson = readJson<{
      contributes?: { snippets?: Array<{ language: string; path: string }> };
    }>(extensionPackageJsonPath);

    const snippets = packageJson.contributes?.snippets ?? [];
    expect(Array.isArray(snippets)).toBe(true);

    expect(
      snippets.some(
        (snippet) =>
          snippet.language === "markdown" && snippet.path === "./snippets/figdeck.json",
      ),
    ).toBe(true);

    expect(
      snippets.some(
        (snippet) =>
          snippet.language === "yaml" && snippet.path === "./snippets/figdeck.json",
      ),
    ).toBe(true);
  });

  it("keeps the figdeck-global snippet prefix present", () => {
    const snippetsJson = readJson<Record<string, { prefix?: unknown }>>(
      snippetsPath,
    );

    const globalFrontmatter = snippetsJson["figdeck: Global Frontmatter"];
    expect(globalFrontmatter).toBeDefined();

    const prefixes = globalFrontmatter.prefix;
    expect(Array.isArray(prefixes)).toBe(true);
    expect(prefixes).toContain("figdeck-global");
  });
});

describe("figdeck markdown injection grammar", () => {
  it("ends a frontmatter block on non-YAML content lines", () => {
    const grammar = readJson<{
      repository?: Record<
        string,
        { name?: string; begin?: string; end?: string }
      >;
    }>(grammarPath);

    const frontmatter = grammar.repository?.["figdeck-frontmatter-block"];
    expect(frontmatter).toBeDefined();
    expect(typeof frontmatter?.name).toBe("string");
    expect(frontmatter?.name === "meta.embedded.block.frontmatter.figdeck").toBe(
      false,
    );
    expect(typeof frontmatter?.end).toBe("string");

    const endRegex = new RegExp(frontmatter?.end ?? "", "m");

    // Closing fence should end the block
    expect(endRegex.test("---")).toBe(true);

    // YAML-looking lines should NOT end the block
    expect(endRegex.test('background: "#000"')).toBe(false);
    expect(endRegex.test("  size: 12")).toBe(false);

    // Typical slide content should end the block (prevents --- separators from swallowing the next slide)
    expect(endRegex.test("## Slide 2")).toBe(true);
    expect(endRegex.test(":::columns")).toBe(true);
    expect(endRegex.test("- bullet")).toBe(true);
  });
});
