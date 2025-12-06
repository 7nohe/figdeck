import { describe, expect, it } from "bun:test";
import { isValidHyperlinkUrl, normalizeHyperlinkUrl } from "./text-renderer";

describe("isValidHyperlinkUrl", () => {
  it("returns true for http URLs", () => {
    expect(isValidHyperlinkUrl("http://example.com")).toBe(true);
    expect(isValidHyperlinkUrl("http://example.com/path")).toBe(true);
  });

  it("returns true for https URLs", () => {
    expect(isValidHyperlinkUrl("https://example.com")).toBe(true);
    expect(isValidHyperlinkUrl("https://www.example.com/path?query=1")).toBe(
      true,
    );
  });

  it("returns true for mailto URLs", () => {
    expect(isValidHyperlinkUrl("mailto:user@example.com")).toBe(true);
  });

  it("returns true for tel URLs", () => {
    expect(isValidHyperlinkUrl("tel:+1234567890")).toBe(true);
  });

  it("returns false for URLs without valid protocol", () => {
    expect(isValidHyperlinkUrl("example.com")).toBe(false);
    expect(isValidHyperlinkUrl("www.example.com")).toBe(false);
    expect(isValidHyperlinkUrl("ftp://example.com")).toBe(false);
  });

  it("returns false for empty or undefined", () => {
    expect(isValidHyperlinkUrl("")).toBe(false);
    expect(isValidHyperlinkUrl(undefined)).toBe(false);
  });
});

describe("normalizeHyperlinkUrl", () => {
  describe("URLs with valid protocols", () => {
    it("returns http URLs as-is", () => {
      expect(normalizeHyperlinkUrl("http://example.com")).toBe(
        "http://example.com",
      );
    });

    it("returns https URLs as-is", () => {
      expect(normalizeHyperlinkUrl("https://example.com")).toBe(
        "https://example.com",
      );
    });

    it("returns mailto URLs as-is", () => {
      expect(normalizeHyperlinkUrl("mailto:user@example.com")).toBe(
        "mailto:user@example.com",
      );
    });

    it("returns tel URLs as-is", () => {
      expect(normalizeHyperlinkUrl("tel:+1234567890")).toBe("tel:+1234567890");
    });
  });

  describe("domain-like strings without protocol", () => {
    it("prepends https:// to valid domains", () => {
      expect(normalizeHyperlinkUrl("example.com")).toBe("https://example.com");
      expect(normalizeHyperlinkUrl("www.example.com")).toBe(
        "https://www.example.com",
      );
    });

    it("prepends https:// to domains with paths", () => {
      expect(normalizeHyperlinkUrl("example.com/path")).toBe(
        "https://example.com/path",
      );
      expect(normalizeHyperlinkUrl("example.com/path/to/page")).toBe(
        "https://example.com/path/to/page",
      );
    });

    it("prepends https:// to domains with query strings", () => {
      expect(normalizeHyperlinkUrl("example.com?query=1")).toBe(
        "https://example.com?query=1",
      );
    });

    it("prepends https:// to subdomains", () => {
      expect(normalizeHyperlinkUrl("sub.domain.example.com")).toBe(
        "https://sub.domain.example.com",
      );
    });

    it("prepends https:// to domains with hyphens", () => {
      expect(normalizeHyperlinkUrl("my-example.com")).toBe(
        "https://my-example.com",
      );
      expect(normalizeHyperlinkUrl("my-sub.my-domain.com")).toBe(
        "https://my-sub.my-domain.com",
      );
    });
  });

  describe("invalid URLs", () => {
    it("returns undefined for empty or undefined", () => {
      expect(normalizeHyperlinkUrl("")).toBeUndefined();
      expect(normalizeHyperlinkUrl(undefined)).toBeUndefined();
    });

    it("returns undefined for URLs without dots", () => {
      expect(normalizeHyperlinkUrl("localhost")).toBeUndefined();
      expect(normalizeHyperlinkUrl("example")).toBeUndefined();
    });

    it("returns undefined for URLs with spaces", () => {
      expect(normalizeHyperlinkUrl("example .com")).toBeUndefined();
      expect(normalizeHyperlinkUrl("example. com")).toBeUndefined();
    });

    it("returns undefined for URLs starting with dot", () => {
      expect(normalizeHyperlinkUrl(".example.com")).toBeUndefined();
    });

    it("returns undefined for URLs starting with hyphen", () => {
      expect(normalizeHyperlinkUrl("-example.com")).toBeUndefined();
    });

    it("returns undefined for URLs with consecutive dots", () => {
      expect(normalizeHyperlinkUrl("example..com")).toBeUndefined();
      expect(normalizeHyperlinkUrl("www..example.com")).toBeUndefined();
    });

    it("returns undefined for URLs with domain ending in dot", () => {
      expect(normalizeHyperlinkUrl("example.com.")).toBeUndefined();
      expect(normalizeHyperlinkUrl("example.")).toBeUndefined();
    });

    it("returns undefined for URLs with domain ending in hyphen", () => {
      expect(normalizeHyperlinkUrl("example-.com")).toBeUndefined();
      expect(normalizeHyperlinkUrl("example.com-")).toBeUndefined();
    });

    it("returns undefined for plain text", () => {
      expect(normalizeHyperlinkUrl("just some text")).toBeUndefined();
      expect(normalizeHyperlinkUrl("not a url")).toBeUndefined();
    });
  });
});

