import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const CLI_PATH = join(import.meta.dir, "../dist/index.js");
const FIXTURES_DIR = join(import.meta.dir, "../../../examples");

describe("CLI", () => {
  describe("build command", () => {
    it("should output JSON to stdout", async () => {
      const result =
        await $`bun ${CLI_PATH} build ${FIXTURES_DIR}/sample.md`.text();
      const slides = JSON.parse(result);

      expect(Array.isArray(slides)).toBe(true);
      expect(slides.length).toBeGreaterThan(0);
      expect(slides[0]).toHaveProperty("blocks");
    });

    it("should output valid SlideContent[] schema", async () => {
      const result =
        await $`bun ${CLI_PATH} build ${FIXTURES_DIR}/sample.md`.text();
      const slides = JSON.parse(result);

      for (const slide of slides) {
        expect(Array.isArray(slide.blocks)).toBe(true);
        expect(slide.blocks.length).toBeGreaterThan(0);
      }
    });

    it("should write JSON to file with -o option", async () => {
      const outPath = join(import.meta.dir, "test-output.json");

      // Clean up if exists
      if (existsSync(outPath)) {
        unlinkSync(outPath);
      }

      await $`bun ${CLI_PATH} build ${FIXTURES_DIR}/sample.md -o ${outPath}`
        .text()
        .catch((e) => e.message);

      expect(existsSync(outPath)).toBe(true);

      const content = readFileSync(outPath, "utf-8");
      const slides = JSON.parse(content);

      expect(Array.isArray(slides)).toBe(true);
      expect(slides.length).toBeGreaterThan(0);

      // Clean up
      unlinkSync(outPath);
    });

    it("should fail with non-existent file", async () => {
      const result = await $`bun ${CLI_PATH} build non-existent.md`
        .text()
        .catch(() => "error");

      expect(result).toBe("error");
    });

    it("should parse different markdown files correctly", async () => {
      // Test with backgrounds.md
      const bgResult =
        await $`bun ${CLI_PATH} build ${FIXTURES_DIR}/backgrounds.md`.text();
      const bgSlides = JSON.parse(bgResult);

      expect(Array.isArray(bgSlides)).toBe(true);
      // backgrounds.md should have slides with background settings
      const hasBackground = bgSlides.some(
        (s: { background?: unknown }) => s.background,
      );
      expect(hasBackground).toBe(true);
    });
  });

  describe("serve command", () => {
    it("should show help without errors", async () => {
      const result = await $`bun ${CLI_PATH} serve --help`.text();

      expect(result).toContain("serve");
      expect(result).toContain("--host");
      expect(result).toContain("--port");
      expect(result).toContain("--no-watch");
      expect(result).toContain("--allow-remote");
      expect(result).toContain("--secret");
    });
  });

  describe("help", () => {
    it("should show available commands", async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();

      expect(result).toContain("build");
      expect(result).toContain("serve");
      expect(result).toContain("Markdown");
    });

    it("should show build command help", async () => {
      const result = await $`bun ${CLI_PATH} build --help`.text();

      expect(result).toContain("--out");
      expect(result).toContain("-o");
    });
  });

  describe("init command", () => {
    const TMP_DIR = join(import.meta.dir, ".tmp-init-test");

    beforeEach(() => {
      if (existsSync(TMP_DIR)) {
        rmSync(TMP_DIR, { recursive: true, force: true });
      }
      mkdirSync(TMP_DIR, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(TMP_DIR)) {
        rmSync(TMP_DIR, { recursive: true, force: true });
      }
    });

    it("should show --ai-rules and --no-slides in help", async () => {
      const result = await $`bun ${CLI_PATH} init --help`.text();

      expect(result).toContain("--ai-rules");
      expect(result).toContain("--no-slides");
      expect(result).toContain("agents,claude,cursor,copilot");
    });

    it("should create only slides.md by default", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath}`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(join(TMP_DIR, "AGENTS.md"))).toBe(false);
      expect(existsSync(join(TMP_DIR, ".claude/rules/figdeck.md"))).toBe(false);
    });

    it("should create AGENTS.md with --ai-rules agents", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules agents`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(join(TMP_DIR, "AGENTS.md"))).toBe(true);
      expect(existsSync(join(TMP_DIR, ".claude/rules/figdeck.md"))).toBe(false);
    });

    it("should create .claude/rules/figdeck.md with --ai-rules claude", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules claude`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(join(TMP_DIR, ".claude/rules/figdeck.md"))).toBe(true);
      expect(existsSync(join(TMP_DIR, "AGENTS.md"))).toBe(false);
    });

    it("should create .cursor/rules/figdeck.mdc with --ai-rules cursor", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules cursor`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(join(TMP_DIR, ".cursor/rules/figdeck.mdc"))).toBe(true);
    });

    it("should create .github/instructions/figdeck.instructions.md with --ai-rules copilot", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules copilot`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(
        existsSync(
          join(TMP_DIR, ".github/instructions/figdeck.instructions.md"),
        ),
      ).toBe(true);
    });

    it("should create two files with --ai-rules claude,cursor", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules claude,cursor`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(join(TMP_DIR, ".claude/rules/figdeck.md"))).toBe(true);
      expect(existsSync(join(TMP_DIR, ".cursor/rules/figdeck.mdc"))).toBe(true);
      expect(existsSync(join(TMP_DIR, "AGENTS.md"))).toBe(false);
      expect(
        existsSync(
          join(TMP_DIR, ".github/instructions/figdeck.instructions.md"),
        ),
      ).toBe(false);
    });

    it("should create all files with --ai-rules all", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules all`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(join(TMP_DIR, "AGENTS.md"))).toBe(true);
      expect(existsSync(join(TMP_DIR, ".claude/rules/figdeck.md"))).toBe(true);
      expect(existsSync(join(TMP_DIR, ".cursor/rules/figdeck.mdc"))).toBe(true);
      expect(
        existsSync(
          join(TMP_DIR, ".github/instructions/figdeck.instructions.md"),
        ),
      ).toBe(true);
    });

    it("should create all files with --ai-rules (no value)", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules`.text();

      expect(existsSync(outPath)).toBe(true);
      expect(existsSync(join(TMP_DIR, "AGENTS.md"))).toBe(true);
      expect(existsSync(join(TMP_DIR, ".claude/rules/figdeck.md"))).toBe(true);
      expect(existsSync(join(TMP_DIR, ".cursor/rules/figdeck.mdc"))).toBe(true);
      expect(
        existsSync(
          join(TMP_DIR, ".github/instructions/figdeck.instructions.md"),
        ),
      ).toBe(true);
    });

    it("should fail with invalid --ai-rules value", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      const result =
        await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules invalid`
          .text()
          .catch((e) => e.stderr?.toString() || "error");

      expect(result).toContain("Invalid --ai-rules targets");
      expect(existsSync(outPath)).toBe(false);
    });

    it("should fail without --force when file exists", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      writeFileSync(outPath, "existing content", "utf-8");

      const result = await $`bun ${CLI_PATH} init -o ${outPath}`
        .text()
        .catch((e) => e.stderr?.toString() || "error");

      expect(result).toContain("already exist");
      // Existing content should be preserved
      expect(readFileSync(outPath, "utf-8")).toBe("existing content");
    });

    it("should overwrite with --force", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      writeFileSync(outPath, "existing content", "utf-8");

      await $`bun ${CLI_PATH} init -o ${outPath} --force`.text();

      expect(existsSync(outPath)).toBe(true);
      // Content should be overwritten
      expect(readFileSync(outPath, "utf-8")).not.toBe("existing content");
    });

    it("should skip slides.md with --no-slides", async () => {
      const outPath = join(TMP_DIR, "slides.md");
      writeFileSync(outPath, "existing content", "utf-8");

      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules agents --no-slides`.text();

      // slides.md should not be changed
      expect(readFileSync(outPath, "utf-8")).toBe("existing content");
      // AGENTS.md should be created
      expect(existsSync(join(TMP_DIR, "AGENTS.md"))).toBe(true);
    });

    it("should replace {{slidesPath}} placeholder in templates", async () => {
      const outPath = join(TMP_DIR, "deck/my-slides.md");
      mkdirSync(join(TMP_DIR, "deck"), { recursive: true });

      await $`bun ${CLI_PATH} init -o ${outPath} --ai-rules claude`.text();

      const claudeContent = readFileSync(
        join(TMP_DIR, "deck/.claude/rules/figdeck.md"),
        "utf-8",
      );
      expect(claudeContent).toContain("deck/my-slides.md");
      expect(claudeContent).not.toContain("{{slidesPath}}");
    });
  });
});
