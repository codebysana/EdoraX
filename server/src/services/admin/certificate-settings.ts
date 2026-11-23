import { PlatformCertificateSettingsSchema, type PlatformCertificateSettings } from "../../shared/lib/certificates.js";
import { prisma } from "../../db/prisma.js";
import { BadRequestError } from "../../utils/errors.js";

const KEY = "platform_certificate";
const DEFAULTS = PlatformCertificateSettingsSchema.parse({});

export async function getPlatformCertificateSettings(): Promise<PlatformCertificateSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULTS;
  try {
    const parsed = PlatformCertificateSettingsSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function savePlatformCertificateSettings(input: unknown): Promise<PlatformCertificateSettings> {
  const settings = PlatformCertificateSettingsSchema.parse(input);
  if (settings.imageData && (!/^data:image\/(png|jpeg|webp);base64,/.test(settings.imageData) || settings.imageData.length > 970_000)) {
    throw new BadRequestError("Certificate artwork must be a PNG, JPEG, or WebP image smaller than 700 KB.");
  }
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
  return settings;
}
