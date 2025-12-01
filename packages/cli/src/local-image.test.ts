import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs";
import {
  getMimeType,
  isRemoteUrl,
  isSupportedImageFormat,
  readLocalImage,
  resolveImagePath,
} from "./local-image";

describe("isRemoteUrl", () => {
  it("returns true for http URLs", () => {
    expect(isRemoteUrl("http://example.com/image.png")).toBe(true);
  });

  it("returns true for https URLs", () => {
    expect(isRemoteUrl("https://example.com/image.png")).toBe(true);
  });

  it("returns true for HTTP URLs (case insensitive)", () => {
    expect(isRemoteUrl("HTTP://example.com/image.png")).toBe(true);
    expect(isRemoteUrl("HTTPS://example.com/image.png")).toBe(true);
  });

  it("returns false for relative paths", () => {
    expect(isRemoteUrl("./images/photo.jpg")).toBe(false);
    expect(isRemoteUrl("../assets/logo.png")).toBe(false);
    expect(isRemoteUrl("images/photo.jpg")).toBe(false);
  });

  it("returns false for absolute paths", () => {
    expect(isRemoteUrl("/home/user/images/photo.jpg")).toBe(false);
  });
});

describe("isSupportedImageFormat", () => {
  it("returns true for supported formats (PNG, JPEG, GIF only)", () => {
    expect(isSupportedImageFormat("image.jpg")).toBe(true);
    expect(isSupportedImageFormat("image.jpeg")).toBe(true);
    expect(isSupportedImageFormat("image.png")).toBe(true);
    expect(isSupportedImageFormat("image.gif")).toBe(true);
  });

  it("returns true for uppercase extensions", () => {
    expect(isSupportedImageFormat("image.JPG")).toBe(true);
    expect(isSupportedImageFormat("image.PNG")).toBe(true);
  });

  it("returns false for unsupported formats (WebP, SVG not supported by Figma Slides)", () => {
    expect(isSupportedImageFormat("image.webp")).toBe(false);
    expect(isSupportedImageFormat("image.svg")).toBe(false);
    expect(isSupportedImageFormat("image.bmp")).toBe(false);
    expect(isSupportedImageFormat("image.tiff")).toBe(false);
    expect(isSupportedImageFormat("document.pdf")).toBe(false);
    expect(isSupportedImageFormat("file.txt")).toBe(false);
  });
});

describe("getMimeType", () => {
  it("returns correct MIME types (PNG, JPEG, GIF only)", () => {
    expect(getMimeType("image.jpg")).toBe("image/jpeg");
    expect(getMimeType("image.jpeg")).toBe("image/jpeg");
    expect(getMimeType("image.png")).toBe("image/png");
    expect(getMimeType("image.gif")).toBe("image/gif");
  });

  it("returns null for unsupported formats (WebP, SVG not supported)", () => {
    expect(getMimeType("image.webp")).toBe(null);
    expect(getMimeType("image.svg")).toBe(null);
    expect(getMimeType("image.bmp")).toBe(null);
    expect(getMimeType("file.txt")).toBe(null);
  });
});

describe("resolveImagePath", () => {
  it("returns absolute path unchanged", () => {
    const result = resolveImagePath("/absolute/path/image.png", "/base/path");
    expect(result).toBe("/absolute/path/image.png");
  });

  it("resolves relative path against base", () => {
    const result = resolveImagePath("images/photo.jpg", "/project/slides");
    expect(result).toContain("/project/slides/images/photo.jpg");
  });

  it("handles parent directory references", () => {
    const result = resolveImagePath("../assets/logo.png", "/project/slides");
    expect(result).toContain("/project/assets/logo.png");
  });
});

describe("readLocalImage", () => {
  const testBasePath = "/test/base";

  // Mock console.warn to suppress warnings during tests
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns null for non-existent file", () => {
    const result = readLocalImage("nonexistent.png", testBasePath);
    expect(result).toBe(null);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Image not found"),
    );
  });

  it("returns null for unsupported format", () => {
    // Create a mock that simulates the file exists but has unsupported format
    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    const statSpy = spyOn(fs, "statSync").mockReturnValue({
      size: 1000,
    } as fs.Stats);

    const result = readLocalImage("image.bmp", testBasePath);

    expect(result).toBe(null);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported image format"),
    );

    existsSpy.mockRestore();
    statSpy.mockRestore();
  });

  it("returns null for oversized file", () => {
    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    // Mock a file larger than 5MB
    const statSpy = spyOn(fs, "statSync").mockReturnValue({
      size: 10 * 1024 * 1024,
    } as fs.Stats);

    const result = readLocalImage("large.png", testBasePath);

    expect(result).toBe(null);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Image too large"),
    );

    existsSpy.mockRestore();
    statSpy.mockRestore();
  });

  it("respects custom maxSize option", () => {
    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    // Mock a 2MB file
    const statSpy = spyOn(fs, "statSync").mockReturnValue({
      size: 2 * 1024 * 1024,
    } as fs.Stats);

    // Should fail with 1MB limit
    const result = readLocalImage("image.png", testBasePath, {
      maxSize: 1024 * 1024,
    });

    expect(result).toBe(null);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Image too large"),
    );

    existsSpy.mockRestore();
    statSpy.mockRestore();
  });

  it("returns base64 encoded data for valid image", () => {
    const testImageData = Buffer.from("fake image data");

    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    const statSpy = spyOn(fs, "statSync").mockReturnValue({
      size: 1000,
    } as fs.Stats);
    const readSpy = spyOn(fs, "readFileSync").mockReturnValue(testImageData);

    const result = readLocalImage("photo.png", testBasePath);

    expect(result).not.toBe(null);
    expect(result?.mimeType).toBe("image/png");
    expect(result?.dataBase64).toBe(testImageData.toString("base64"));

    existsSpy.mockRestore();
    statSpy.mockRestore();
    readSpy.mockRestore();
  });

  it("returns correct MIME type for different formats (PNG, JPEG, GIF)", () => {
    const testImageData = Buffer.from("fake image data");

    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    const statSpy = spyOn(fs, "statSync").mockReturnValue({
      size: 1000,
    } as fs.Stats);
    const readSpy = spyOn(fs, "readFileSync").mockReturnValue(testImageData);

    // Test JPG
    let result = readLocalImage("photo.jpg", testBasePath);
    expect(result?.mimeType).toBe("image/jpeg");

    // Test GIF
    result = readLocalImage("animation.gif", testBasePath);
    expect(result?.mimeType).toBe("image/gif");

    // Test PNG
    result = readLocalImage("image.png", testBasePath);
    expect(result?.mimeType).toBe("image/png");

    existsSpy.mockRestore();
    statSpy.mockRestore();
    readSpy.mockRestore();
  });

  it("returns null for unsupported formats (WebP, SVG)", () => {
    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    const statSpy = spyOn(fs, "statSync").mockReturnValue({
      size: 1000,
    } as fs.Stats);

    // WebP is not supported by Figma Slides
    let result = readLocalImage("modern.webp", testBasePath);
    expect(result).toBe(null);

    // SVG is not supported by Figma Slides createImage API
    result = readLocalImage("vector.svg", testBasePath);
    expect(result).toBe(null);

    existsSpy.mockRestore();
    statSpy.mockRestore();
  });
});
