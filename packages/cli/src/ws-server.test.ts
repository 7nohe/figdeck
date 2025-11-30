import { describe, expect, it } from "bun:test";
import { generateSecret, isLoopbackHost } from "./ws-server";

describe("isLoopbackHost", () => {
  describe("loopback addresses", () => {
    it("should return true for 127.0.0.1", () => {
      expect(isLoopbackHost("127.0.0.1")).toBe(true);
    });

    it("should return true for ::1", () => {
      expect(isLoopbackHost("::1")).toBe(true);
    });

    it("should return true for localhost", () => {
      expect(isLoopbackHost("localhost")).toBe(true);
    });
  });

  describe("non-loopback addresses", () => {
    it("should return false for 0.0.0.0", () => {
      expect(isLoopbackHost("0.0.0.0")).toBe(false);
    });

    it("should return false for external IPs", () => {
      expect(isLoopbackHost("192.168.1.1")).toBe(false);
      expect(isLoopbackHost("10.0.0.1")).toBe(false);
    });

    it("should return false for hostnames", () => {
      expect(isLoopbackHost("example.com")).toBe(false);
      expect(isLoopbackHost("my-server")).toBe(false);
    });
  });
});

describe("generateSecret", () => {
  it("should generate a 32-character hex string", () => {
    const secret = generateSecret();
    expect(secret).toHaveLength(32);
    expect(secret).toMatch(/^[0-9a-f]+$/);
  });

  it("should generate unique secrets", () => {
    const secrets = new Set<string>();
    for (let i = 0; i < 100; i++) {
      secrets.add(generateSecret());
    }
    expect(secrets.size).toBe(100);
  });
});
