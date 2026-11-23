import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { qrModules } from "@/lib/qr";
import { decodePng, pngToPdf } from "@/lib/png-to-pdf";

// The QR encoder was also decoded with an independent reader (zxing) when it was written, for
// versions 1 to 8. These tests keep the structure from drifting.
describe("qrModules", () => {
  it("draws the three finder patterns and the timing lines", () => {
    const grid = qrModules("https://edorax.com/verify/ED-ABCDEF-12345678");
    const size = grid.length;
    expect((size - 17) % 4).toBe(0);
    for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]] as const) {
      expect(grid[y]![x]).toBe(true); // outer ring corner
      expect(grid[y + 1]![x + 1]).toBe(false); // gap ring
      expect(grid[y + 3]![x + 3]).toBe(true); // centre block
    }
    for (let i = 8; i < size - 8; i++) expect(grid[6]![i]).toBe(i % 2 === 0);
  });

  it("picks a bigger version for longer text and is deterministic", () => {
    expect(qrModules("A").length).toBe(21);
    expect(qrModules("x".repeat(100)).length).toBeGreaterThan(qrModules("x".repeat(10)).length);
    expect(qrModules("same")).toEqual(qrModules("same"));
  });

  it("refuses text that does not fit", () => {
    expect(() => qrModules("x".repeat(300))).toThrow();
  });
});

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

/** A 2 x 2 RGBA PNG with filter type 0: red, green / blue, half-transparent white. */
function tinyPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.from([
    0, 255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 0, 255, 255, 255, 255, 255, 0,
  ]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

describe("png to pdf", () => {
  it("decodes an RGBA PNG and lays transparency over white", () => {
    const { width, height, rgb } = decodePng(tinyPng());
    expect([width, height]).toEqual([2, 2]);
    expect([...rgb.subarray(0, 3)]).toEqual([255, 0, 0]);
    expect([...rgb.subarray(3, 6)]).toEqual([0, 255, 0]);
  });

  it("writes a one-page PDF with the picture inside", () => {
    const pdf = pngToPdf(tinyPng(), "Certificate TEST");
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 1");
    expect(text).toContain("/Width 2 /Height 2");
    expect(text).toContain("/Title (Certificate TEST)");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("rejects a file that is not a PNG", () => {
    expect(() => decodePng(Buffer.from("not a png at all, just text that is long enough to pass the length check"))).toThrow();
  });
});
