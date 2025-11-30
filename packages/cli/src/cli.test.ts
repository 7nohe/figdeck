import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
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
      expect(slides[0]).toHaveProperty("type");
    });

    it("should output valid SlideContent[] schema", async () => {
      const result =
        await $`bun ${CLI_PATH} build ${FIXTURES_DIR}/sample.md`.text();
      const slides = JSON.parse(result);

      for (const slide of slides) {
        expect(["title", "content"]).toContain(slide.type);
        if (slide.title) {
          expect(typeof slide.title).toBe("string");
        }
        if (slide.blocks) {
          expect(Array.isArray(slide.blocks)).toBe(true);
        }
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
});
