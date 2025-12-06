import { describe, expect, it } from "bun:test";
import { djb2Hash, djb2HashSampled } from "./hash";

describe("djb2Hash", () => {
  it("returns consistent hash for same input", () => {
    const input = "hello world";
    const hash1 = djb2Hash(input);
    const hash2 = djb2Hash(input);
    expect(hash1).toBe(hash2);
  });

  it("returns different hashes for different inputs", () => {
    const hash1 = djb2Hash("hello");
    const hash2 = djb2Hash("world");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a string in base36 format", () => {
    const hash = djb2Hash("test");
    // Base36 contains only 0-9 and a-z
    expect(hash).toMatch(/^[0-9a-z]+$/);
  });

  it("handles empty string", () => {
    const hash = djb2Hash("");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("handles unicode characters", () => {
    const hash1 = djb2Hash("こんにちは");
    const hash2 = djb2Hash("こんにちは");
    expect(hash1).toBe(hash2);
  });

  it("handles special characters", () => {
    const hash = djb2Hash("!@#$%^&*()_+-=[]{}|;':\",./<>?");
    expect(typeof hash).toBe("string");
  });
});

describe("djb2HashSampled", () => {
  it("returns consistent hash for same input", () => {
    const input = "hello world";
    const hash1 = djb2HashSampled(input);
    const hash2 = djb2HashSampled(input);
    expect(hash1).toBe(hash2);
  });

  it("returns same hash as djb2Hash for short strings", () => {
    const shortString = "short";
    // For strings shorter than threshold, should behave like djb2Hash
    const sampledHash = djb2HashSampled(shortString, 100);
    const directHash = djb2Hash(shortString);
    expect(sampledHash).toBe(directHash);
  });

  it("samples long strings correctly", () => {
    // Create a string longer than 2 * sampleSize
    const sampleSize = 10;
    const longString = "A".repeat(100);

    const hash1 = djb2HashSampled(longString, sampleSize);
    const hash2 = djb2HashSampled(longString, sampleSize);

    expect(hash1).toBe(hash2);
  });

  it("differentiates strings with different content", () => {
    const sampleSize = 10;
    const string1 = "A".repeat(50) + "B".repeat(50);
    const string2 = "A".repeat(50) + "C".repeat(50);

    const hash1 = djb2HashSampled(string1, sampleSize);
    const hash2 = djb2HashSampled(string2, sampleSize);

    // Should be different because the end portions differ
    expect(hash1).not.toBe(hash2);
  });

  it("differentiates strings with same start/end but different length", () => {
    const sampleSize = 10;
    // Same start and end characters, but different lengths
    const string1 = "A".repeat(10) + "X".repeat(30) + "B".repeat(10);
    const string2 = "A".repeat(10) + "X".repeat(50) + "B".repeat(10);

    const hash1 = djb2HashSampled(string1, sampleSize);
    const hash2 = djb2HashSampled(string2, sampleSize);

    // Should be different because length is included in the sample
    expect(hash1).not.toBe(hash2);
  });

  it("uses default sample size of 1000", () => {
    // String shorter than 2000 should not be sampled
    const shortString = "X".repeat(1999);
    const hash1 = djb2HashSampled(shortString);
    const hash2 = djb2Hash(shortString);
    expect(hash1).toBe(hash2);

    // String longer than 2000 should be sampled
    const longString = "Y".repeat(2001);
    const hash3 = djb2HashSampled(longString);
    const hash4 = djb2Hash(longString);
    // These should be different because sampling changes the input
    expect(hash3).not.toBe(hash4);
  });
});
