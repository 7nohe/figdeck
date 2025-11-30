import { describe, expect, it } from "bun:test";
import { base64ToUint8Array } from "./base64";

describe("base64ToUint8Array", () => {
  it("decodes simple ASCII string", () => {
    // "Hello" in base64 is "SGVsbG8="
    const result = base64ToUint8Array("SGVsbG8=");
    const expected = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(result).toEqual(expected);
  });

  it("decodes string without padding", () => {
    // "Hi" in base64 is "SGk=" (with padding)
    // But some encoders might produce strings that are multiples of 4
    const result = base64ToUint8Array("SGk=");
    const expected = new Uint8Array([72, 105]); // "Hi"
    expect(result).toEqual(expected);
  });

  it("decodes string with double padding", () => {
    // "A" in base64 is "QQ=="
    const result = base64ToUint8Array("QQ==");
    const expected = new Uint8Array([65]); // "A"
    expect(result).toEqual(expected);
  });

  it("decodes binary data correctly", () => {
    // Binary data [0, 1, 2, 255] encoded in base64 is "AAEC/w=="
    const result = base64ToUint8Array("AAEC/w==");
    const expected = new Uint8Array([0, 1, 2, 255]);
    expect(result).toEqual(expected);
  });

  it("decodes longer strings", () => {
    // "Hello, World!" in base64 is "SGVsbG8sIFdvcmxkIQ=="
    const result = base64ToUint8Array("SGVsbG8sIFdvcmxkIQ==");
    const expected = new Uint8Array([
      72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33,
    ]); // "Hello, World!"
    expect(result).toEqual(expected);
  });

  it("handles empty string", () => {
    const result = base64ToUint8Array("");
    expect(result).toEqual(new Uint8Array([]));
  });

  it("decodes base64 with + and / characters", () => {
    // Data that produces + and / in base64
    // [251, 239] encodes to "++8=" (contains +)
    // [255, 255] encodes to "//8=" (contains /)
    const result1 = base64ToUint8Array("++8=");
    expect(result1).toEqual(new Uint8Array([251, 239]));

    const result2 = base64ToUint8Array("//8=");
    expect(result2).toEqual(new Uint8Array([255, 255]));
  });

  it("produces same result as Node.js Buffer.from for image-like data", () => {
    // Simulated JPEG magic bytes: FF D8 FF E0
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64");
    const result = base64ToUint8Array(jpegMagic);
    expect(result).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
  });

  it("produces same result as Node.js Buffer.from for PNG magic bytes", () => {
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]).toString("base64");
    const result = base64ToUint8Array(pngMagic);
    expect(result).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("handles large data correctly", () => {
    // Create a large array and verify round-trip
    const original = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) {
      original[i] = i % 256;
    }
    const base64 = Buffer.from(original).toString("base64");
    const result = base64ToUint8Array(base64);
    expect(result).toEqual(original);
  });
});
