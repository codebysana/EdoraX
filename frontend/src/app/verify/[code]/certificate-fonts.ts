import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Fonts ship with the app (public/fonts/certificate), so the image never waits on a font service. */
const FONT_DIR = join(process.cwd(), "public/fonts/certificate");
const readFont = (file: string) =>
  readFile(join(FONT_DIR, file))
    .then((buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
    .catch(() => null);

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

/** The fonts every certificate template can use. A font that fails to load is left out. */
export async function loadCertificateFonts(): Promise<Font[]> {
  const [regular, bold, signature, serif, serifBold, display, body, bodyBold] = await Promise.all([
    readFont("Poppins-Regular.ttf"),
    readFont("Poppins-Bold.ttf"),
    readFont("MrsSaintDelafield-Regular.ttf"),
    readFont("LibreBaskerville-Regular.ttf"),
    readFont("LibreBaskerville-Bold.ttf"),
    readFont("Unbounded-Bold.woff"),
    readFont("DMSans-Regular.woff"),
    readFont("DMSans-Bold.woff"),
  ]);
  const font = (name: string, data: ArrayBuffer | null, weight: 400 | 700): Font[] => (data ? [{ name, data, weight, style: "normal" }] : []);
  return [
    ...font("Poppins", regular, 400),
    ...font("Poppins", bold, 700),
    ...font("Libre Baskerville", serif, 400),
    ...font("Libre Baskerville", serifBold, 700),
    ...font("Signature", signature, 400),
    ...font("Unbounded", display, 700),
    ...font("DM Sans", body, 400),
    ...font("DM Sans", bodyBold, 700),
  ];
}
