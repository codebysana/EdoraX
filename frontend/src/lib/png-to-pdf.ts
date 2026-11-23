import { deflateSync, inflateSync } from "node:zlib";

// Wraps one PNG in a single-page PDF, with no PDF library. The picture is decoded to RGB
// (transparency is laid over white), recompressed, and placed to fill the page. The certificate
// image is drawn on the server as a PNG, so this keeps the PDF the same document as the image.

type Decoded = { width: number; height: number; rgb: Buffer };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Reads an 8-bit, non-interlaced RGB or RGBA PNG. Throws for anything else. */
export function decodePng(png: Buffer): Decoded {
  if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG");
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  const parts: Buffer[] = [];
  for (let offset = 8; offset + 8 <= png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") parts.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) throw new Error("Unsupported PNG format");

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(parts));
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[row + x - channels]! : 0;
      const up = y > 0 ? pixels[row - stride + x]! : 0;
      const upLeft = y > 0 && x >= channels ? pixels[row - stride + x - channels]! : 0;
      const value = raw[source + x]!;
      pixels[row + x] =
        (filter === 0 ? value : filter === 1 ? value + left : filter === 2 ? value + up : filter === 3 ? value + ((left + up) >> 1) : value + paeth(left, up, upLeft)) & 255;
    }
  }

  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const alpha = channels === 4 ? pixels[i * 4 + 3]! / 255 : 1;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(pixels[i * channels + c]! * alpha + 255 * (1 - alpha));
  }
  return { width, height, rgb };
}

/** A one-page PDF, 842 points wide (A4 landscape), as tall as the picture needs. */
export function pngToPdf(png: Buffer, title: string): Buffer {
  const { width, height, rgb } = decodePng(png);
  const pageWidth = 842;
  const pageHeight = Math.round((pageWidth * height) / width * 100) / 100;
  const image = deflateSync(rgb);
  const content = Buffer.from(`q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`);
  const safeTitle = title.replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "");

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets: number[] = [];
  let length = chunks[0]!.length;
  const add = (object: Buffer) => {
    offsets.push(length);
    chunks.push(object);
    length += object.length;
  };
  const text = (value: string) => Buffer.from(value, "latin1");
  const stream = (dictionary: string, body: Buffer) => Buffer.concat([text(`<< ${dictionary} /Length ${body.length} >>\nstream\n`), body, text("\nendstream\nendobj\n")]);

  add(text("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
  add(text("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"));
  add(text(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`));
  add(Buffer.concat([text("4 0 obj\n"), stream("", content)]));
  add(Buffer.concat([text("5 0 obj\n"), stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, image)]));
  add(text(`6 0 obj\n<< /Title (${safeTitle}) /Producer (Edorax) >>\nendobj\n`));

  const xref = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  chunks.push(text(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${xref}trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
